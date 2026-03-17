import { createClient } from '@/lib/supabase/client';
import type { PhotoType, SubjectPhoto } from '@/modules/subjects/subject.types';

const supabase = createClient();

const STORAGE_BUCKET = 'subject-photos';

export async function uploadPhoto(
  subjectId: string,
  photoType: PhotoType,
  file: File,
) {
  const timestamp = Date.now();
  const fileName = `${photoType}_${timestamp}_${Math.random().toString(36).slice(2, 9)}`;
  const path = `${subjectId}/${fileName}`;

  // Upload to storage
  const uploadResult = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadResult.error) {
    throw new Error(`Storage upload failed: ${uploadResult.error.message}`);
  }

  // Get public URL
  const { data: publicUrlData } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(path);

  const publicUrl = publicUrlData?.publicUrl ?? '';

  // Save metadata to database
  const dbResult = await supabase
    .from('subject_photos')
    .insert({
      subject_id: subjectId,
      photo_type: photoType,
      storage_path: path,
      public_url: publicUrl,
      uploaded_by: (await supabase.auth.getUser()).data.user?.id,
      file_size_bytes: file.size,
      mime_type: file.type,
    })
    .select('id,photo_type,storage_path,public_url,uploaded_by,uploaded_at,file_size_bytes,mime_type')
    .single<SubjectPhoto>();

  if (dbResult.error) {
    // Attempt cleanup of uploaded file
    await supabase.storage.from(STORAGE_BUCKET).remove([path]);
    throw new Error(`Failed to save photo metadata: ${dbResult.error.message}`);
  }

  return dbResult.data;
}

export async function findBySubjectId(subjectId: string) {
  return supabase
    .from('subject_photos')
    .select('id,subject_id,photo_type,storage_path,public_url,uploaded_by,uploaded_at,file_size_bytes,mime_type')
    .eq('subject_id', subjectId)
    .eq('is_deleted', false)
    .order('uploaded_at', { ascending: false });
}

export async function findBySubjectAndType(subjectId: string, photoType: PhotoType) {
  return supabase
    .from('subject_photos')
    .select('id,subject_id,photo_type,storage_path,public_url,uploaded_by,uploaded_at,file_size_bytes,mime_type')
    .eq('subject_id', subjectId)
    .eq('photo_type', photoType)
    .eq('is_deleted', false)
    .maybeSingle<SubjectPhoto>();
}

export async function deletePhoto(photoId: string, storagePath: string) {
  // Soft delete in database
  const dbResult = await supabase
    .from('subject_photos')
    .update({ is_deleted: true })
    .eq('id', photoId)
    .select('id')
    .single();

  if (dbResult.error) {
    throw new Error(`Failed to delete photo: ${dbResult.error.message}`);
  }

  // Delete from storage
  const storageResult = await supabase.storage
    .from(STORAGE_BUCKET)
    .remove([storagePath]);

  if (storageResult.error) {
    console.warn(`Failed to delete storage file ${storagePath}:`, storageResult.error);
  }

  return dbResult.data;
}

export async function findById(photoId: string) {
  return supabase
    .from('subject_photos')
    .select('id,subject_id,photo_type,storage_path,public_url,uploaded_by,uploaded_at,file_size_bytes,mime_type')
    .eq('id', photoId)
    .eq('is_deleted', false)
    .maybeSingle<SubjectPhoto>();
}
