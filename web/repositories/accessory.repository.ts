import { createClient } from '@/lib/supabase/client';
import type { AddAccessoryInput } from '@/modules/subjects/subject.types';

const supabase = createClient();

export function findBySubjectId(subjectId: string) {
  return supabase
    .from('subject_accessories')
    .select('id,subject_id,item_name,quantity,unit_price,total_price,added_by,created_at')
    .eq('subject_id', subjectId)
    .order('created_at', { ascending: true });
}

export function createAccessory(subjectId: string, addedBy: string, input: AddAccessoryInput) {
  return supabase
    .from('subject_accessories')
    .insert({
      subject_id: subjectId,
      item_name: input.item_name,
      quantity: input.quantity,
      unit_price: input.unit_price,
      added_by: addedBy,
    })
    .select('id,subject_id,item_name,quantity,unit_price,total_price,added_by,created_at')
    .single();
}

export function createManyAccessories(subjectId: string, addedBy: string, items: AddAccessoryInput[]) {
  return supabase
    .from('subject_accessories')
    .insert(
      items.map((item) => ({
        subject_id: subjectId,
        item_name: item.item_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        added_by: addedBy,
      })),
    )
    .select('id,subject_id,item_name,quantity,unit_price,total_price,added_by,created_at');
}

export function deleteBySubjectId(subjectId: string) {
  return supabase
    .from('subject_accessories')
    .delete()
    .eq('subject_id', subjectId);
}

export function calculateAccessoriesTotal(subjectId: string) {
  return supabase
    .from('subject_accessories')
    .select('total_price')
    .eq('subject_id', subjectId);
}
