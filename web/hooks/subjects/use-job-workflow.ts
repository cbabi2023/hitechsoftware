import { useMutation, useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/auth/useAuth';
import {
  updateJobStatus,
  markJobIncomplete,
  uploadJobPhoto,
  getRequiredPhotos,
  checkCompletionRequirements,
  markJobComplete,
} from '@/modules/subjects/subject.job-workflow';
import type {
  JobCompletionRequirements,
  PhotoType,
  IncompleteJobInput,
} from '@/modules/subjects/subject.types';

export function useJobWorkflow(subjectId: string) {
  const { user } = useAuth();
  const technicianId = user?.id;

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

  // Mutation: update job status
  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      if (!technicianId) throw new Error('Not authenticated');
      const result = await updateJobStatus(subjectId, technicianId, newStatus);
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    },
    onSuccess: () => {
      // Invalidate related queries
      requiredPhotosQuery.refetch();
      completionRequirementsQuery.refetch();
    },
  });

  // Mutation: upload photo with progress tracking
  const uploadPhotoMutation = useMutation({
    mutationFn: async ({ file, photoType }: { file: File; photoType: PhotoType }) => {
      if (!technicianId) throw new Error('Not authenticated');
      const result = await uploadJobPhoto(subjectId, technicianId, file, photoType);
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    },
    onSuccess: () => {
      // Refresh completion requirements after photo upload
      completionRequirementsQuery.refetch();
    },
  });

  // Mutation: mark job incomplete
  const markIncompleteMutation = useMutation({
    mutationFn: async (input: IncompleteJobInput) => {
      if (!technicianId) throw new Error('Not authenticated');
      const result = await markJobIncomplete(subjectId, technicianId, input);
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    },
  });

  // Mutation: mark job complete
  const markCompleteMutation = useMutation({
    mutationFn: async (notes?: string) => {
      if (!technicianId) throw new Error('Not authenticated');
      const result = await markJobComplete(subjectId, technicianId, notes);
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    },
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
