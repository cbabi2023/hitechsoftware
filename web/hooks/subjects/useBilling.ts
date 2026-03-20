import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/auth/useAuth';
import {
  addAccessory,
  generateBill,
  getAccessoriesBySubject,
  getBillBySubject,
  removeAccessory,
  updateBillPaymentStatus,
} from '@/modules/subjects/billing.service';
import type { AddAccessoryInput, GenerateBillInput } from '@/modules/subjects/subject.types';

export function useSubjectAccessories(subjectId: string) {
  return useQuery({
    queryKey: ['subject-accessories', subjectId],
    queryFn: async () => {
      const result = await getAccessoriesBySubject(subjectId);
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    },
    staleTime: 0,
    enabled: Boolean(subjectId),
  });
}

export function useAddAccessory(subjectId: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: AddAccessoryInput) => {
      if (!user?.id) throw new Error('Not authenticated');
      const result = await addAccessory(subjectId, user.id, input);
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    },
    onSuccess: (item) => {
      queryClient.invalidateQueries({ queryKey: ['subject-accessories', subjectId] });
      toast.success(`${item.item_name} added`);
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useRemoveAccessory(subjectId: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (accessoryId: string) => {
      if (!user?.id) throw new Error('Not authenticated');
      const result = await removeAccessory(accessoryId, user.id);
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subject-accessories', subjectId] });
      toast.success('Accessory removed');
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useGenerateBill(subjectId: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: GenerateBillInput) => {
      if (!user?.id) throw new Error('Not authenticated');
      const result = await generateBill(subjectId, user.id, input);
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subject', subjectId] });
      queryClient.invalidateQueries({ queryKey: ['subject-accessories', subjectId] });
      queryClient.invalidateQueries({ queryKey: ['subject-bill', subjectId] });
      toast.success('Bill generated successfully');
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useSubjectBill(subjectId: string) {
  return useQuery({
    queryKey: ['subject-bill', subjectId],
    queryFn: async () => {
      const result = await getBillBySubject(subjectId);
      if (!result.ok) {
        if (result.error.message === 'Bill not found for subject') {
          return null;
        }
        throw new Error(result.error.message);
      }
      return result.data;
    },
    enabled: Boolean(subjectId),
  });
}

export function useDownloadBill() {
  return async (billId: string) => {
    const loadingId = toast.loading('Generating bill PDF...');
    try {
      const response = await fetch(`/api/bills/${billId}/download`);
      if (!response.ok) {
        throw new Error('Failed to download bill');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const fallbackName = `bill-${billId}.pdf`;
      const headerName = response.headers.get('Content-Disposition')?.split('filename=')[1]?.replaceAll('"', '') ?? fallbackName;
      a.download = headerName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Download started');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to download bill');
    } finally {
      toast.dismiss(loadingId);
    }
  };
}

export function useUpdateBillPaymentStatus(subjectId: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ billId, paymentStatus }: { billId: string; paymentStatus: 'paid' | 'due' | 'waived' }) => {
      if (!user?.id) throw new Error('Not authenticated');
      const result = await updateBillPaymentStatus(billId, paymentStatus, user.id);
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subject-bill', subjectId] });
      toast.success('Payment status updated');
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
