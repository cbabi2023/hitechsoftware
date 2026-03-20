import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/auth/useAuth';
import { SUBJECT_QUERY_KEYS } from '@/modules/subjects/subject.constants';
import type {
  JobCompletionRequirements,
  PhotoType,
  IncompleteJobInput,
} from '@/modules/subjects/subject.types';

export function useJobWorkflow(subjectId: string) {
  const { user } = useAuth();
  const technicianId = user?.id;
  const queryClient = useQueryClient();

  const workflowRequirementsQuery = useQuery({
    queryKey: ['job-workflow', subjectId, 'requirements'],
    queryFn: async () => {
      const res = await fetch(`/api/subjects/${subjectId}/workflow`, {
        method: 'GET',
      });

      const json = await res.json() as {
        ok: boolean;
        data?: {
          requiredPhotos: PhotoType[];
          completionRequirements: JobCompletionRequirements;
        };
        error?: { userMessage?: string; message?: string };
      };

      if (!json.ok) {
        throw new Error(json.error?.userMessage ?? json.error?.message ?? 'Failed to load workflow requirements');
      }

      return json.data!;
    },
    enabled: !!subjectId,
    refetchInterval: 5000,
  });

  // Mutation: update job status (runs via API route — admin client is server-side only)
  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const res = await fetch(`/api/subjects/${subjectId}/workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_status', status: newStatus }),
      });
      const json = await res.json() as { ok: boolean; data?: { id: string; status: string }; error?: { message: string } };
      if (!json.ok) throw new Error(json.error?.message ?? 'Failed to update status');
      return json.data!;
    },
    onSuccess: (_, newStatus) => {
      queryClient.invalidateQueries({ queryKey: SUBJECT_QUERY_KEYS.detail(subjectId) });
      queryClient.invalidateQueries({ queryKey: SUBJECT_QUERY_KEYS.list });
      workflowRequirementsQuery.refetch();
      const labels: Record<string, string> = {
        ARRIVED: 'Marked as Arrived',
        IN_PROGRESS: 'Work Started',
        AWAITING_PARTS: 'Marked as Awaiting Parts',
      };
      toast.success(labels[newStatus] ?? 'Status updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Mutation: upload photo with progress tracking (via API route for storage access)
  const uploadPhotoMutation = useMutation({
    mutationFn: async ({ file, photoType }: { file: File; photoType: PhotoType }) => {
      if (!technicianId) throw new Error('Not authenticated');
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('photoType', photoType);
      
      const res = await fetch(`/api/subjects/${subjectId}/photos/upload`, {
        method: 'POST',
        body: formData,
      });
      
      const json = await res.json() as { 
        ok: boolean
        data?: { id: string; photo_type: string; public_url: string }
        error?: { code: string; userMessage: string }
      };
      
      if (!json.ok) throw new Error(json.error?.userMessage ?? 'Upload failed');
      return json.data!;
    },
    onSuccess: (_, { photoType }) => {
      queryClient.invalidateQueries({ queryKey: SUBJECT_QUERY_KEYS.detail(subjectId) });
      workflowRequirementsQuery.refetch();
      toast.success(`${photoType.replace(/_/g, ' ')} uploaded`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removePhotoMutation = useMutation({
    mutationFn: async ({
      photoId,
      storagePath,
      photoType,
    }: {
      photoId: string;
      storagePath: string;
      photoType: PhotoType;
    }) => {
      const res = await fetch(`/api/subjects/${subjectId}/photos`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoId, storagePath }),
      });

      const json = await res.json() as {
        ok: boolean;
        error?: { userMessage?: string; message?: string };
      };

      if (!json.ok) {
        throw new Error(json.error?.userMessage ?? json.error?.message ?? 'Failed to remove upload');
      }

      return { photoType };
    },
    onSuccess: (_, { photoType }) => {
      queryClient.invalidateQueries({ queryKey: SUBJECT_QUERY_KEYS.detail(subjectId) });
      workflowRequirementsQuery.refetch();
      toast.success(`${photoType.replace(/_/g, ' ')} removed`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Mutation: mark job incomplete (runs via API route)
  const markIncompleteMutation = useMutation({
    mutationFn: async (input: IncompleteJobInput) => {
      const res = await fetch(`/api/subjects/${subjectId}/workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_incomplete', ...input }),
      });
      const json = await res.json() as { ok: boolean; data?: { id: string; status: string }; error?: { message: string } };
      if (!json.ok) throw new Error(json.error?.message ?? 'Failed to mark incomplete');
      return json.data!;
    },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: SUBJECT_QUERY_KEYS.detail(subjectId) });
        queryClient.invalidateQueries({ queryKey: SUBJECT_QUERY_KEYS.list });
        toast.success('Job marked as incomplete');
      },
      onError: (err: Error) => toast.error(err.message),
  });

  // Mutation: mark job complete (runs via API route)
  const markCompleteMutation = useMutation({
    mutationFn: async (notes?: string) => {
      const res = await fetch(`/api/subjects/${subjectId}/workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_complete', notes }),
      });
      const json = await res.json() as { ok: boolean; data?: { id: string; status: string }; error?: { message: string } };
      if (!json.ok) throw new Error(json.error?.message ?? 'Failed to mark complete');
      return json.data!;
    },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: SUBJECT_QUERY_KEYS.detail(subjectId) });
        queryClient.invalidateQueries({ queryKey: SUBJECT_QUERY_KEYS.list });
        toast.success('Job completed successfully');
      },
      onError: (err: Error) => toast.error(err.message),
  });

  return {
    requiredPhotos: workflowRequirementsQuery.data?.requiredPhotos ?? [],
    completionRequirements: workflowRequirementsQuery.data?.completionRequirements,
    isLoadingRequirements: workflowRequirementsQuery.isLoading,

    updateStatus: updateStatusMutation.mutate,
    isUpdatingStatus: updateStatusMutation.isPending,
    updateStatusError: updateStatusMutation.error,

    uploadPhoto: uploadPhotoMutation.mutate,
    uploadPhotoAsync: uploadPhotoMutation.mutateAsync,
    isUploadingPhoto: uploadPhotoMutation.isPending,
    uploadPhotoError: uploadPhotoMutation.error,

    removePhoto: removePhotoMutation.mutate,
    removePhotoAsync: removePhotoMutation.mutateAsync,
    isRemovingPhoto: removePhotoMutation.isPending,
    removePhotoError: removePhotoMutation.error,

    markIncomplete: markIncompleteMutation.mutate,
    isMarkingIncomplete: markIncompleteMutation.isPending,
    markIncompleteError: markIncompleteMutation.error,

    markComplete: markCompleteMutation.mutate,
    isMarkingComplete: markCompleteMutation.isPending,
    markCompleteError: markCompleteMutation.error,
  };
}
