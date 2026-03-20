import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/auth/useAuth';
import { SUBJECT_QUERY_KEYS } from '@/modules/subjects/subject.constants';
import {
  uploadJobPhoto,
  getRequiredPhotos,
  checkCompletionRequirements,
} from '@/modules/subjects/subject.job-workflow';
import type {
  JobCompletionRequirements,
  PhotoType,
  IncompleteJobInput,
} from '@/modules/subjects/subject.types';

export function useJobWorkflow(subjectId: string) {
  const { user } = useAuth();
  const technicianId = user?.id;
  const queryClient = useQueryClient();

  // Query: get required photos
  const requiredPhotosQuery = useQuery({
    queryKey: ['job-workflow', subjectId, 'required-photos'],
    queryFn: async () => {
      const result = await getRequiredPhotos(subjectId);
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    },
    enabled: !!subjectId,
  });

  // Query: check completion requirements
  const completionRequirementsQuery = useQuery({
    queryKey: ['job-workflow', subjectId, 'completion-requirements'],
    queryFn: async () => {
      const result = await checkCompletionRequirements(subjectId);
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    },
    enabled: !!subjectId,
    refetchInterval: 5000, // Poll every 5 seconds for real-time requirements
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
      requiredPhotosQuery.refetch();
      completionRequirementsQuery.refetch();
      const labels: Record<string, string> = {
        ARRIVED: 'Marked as Arrived',
        IN_PROGRESS: 'Work Started',
        AWAITING_PARTS: 'Marked as Awaiting Parts',
      };
      toast.success(labels[newStatus] ?? 'Status updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Mutation: upload photo with progress tracking
  const uploadPhotoMutation = useMutation({
    mutationFn: async ({ file, photoType }: { file: File; photoType: PhotoType }) => {
      if (!technicianId) throw new Error('Not authenticated');
      const result = await uploadJobPhoto(subjectId, technicianId, file, photoType);
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    },
    onSuccess: (_, { photoType }) => {
      queryClient.invalidateQueries({ queryKey: SUBJECT_QUERY_KEYS.detail(subjectId) });
      completionRequirementsQuery.refetch();
      toast.success(`${photoType.replace(/_/g, ' ')} uploaded`);
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
    requiredPhotos: requiredPhotosQuery.data ?? [],
    completionRequirements: completionRequirementsQuery.data as JobCompletionRequirements | undefined,
    isLoadingRequirements: requiredPhotosQuery.isLoading || completionRequirementsQuery.isLoading,

    updateStatus: updateStatusMutation.mutate,
    isUpdatingStatus: updateStatusMutation.isPending,
    updateStatusError: updateStatusMutation.error,

    uploadPhoto: uploadPhotoMutation.mutate,
    isUploadingPhoto: uploadPhotoMutation.isPending,
    uploadPhotoError: uploadPhotoMutation.error,

    markIncomplete: markIncompleteMutation.mutate,
    isMarkingIncomplete: markIncompleteMutation.isPending,
    markIncompleteError: markIncompleteMutation.error,

    markComplete: markCompleteMutation.mutate,
    isMarkingComplete: markCompleteMutation.isPending,
    markCompleteError: markCompleteMutation.error,
  };
}
