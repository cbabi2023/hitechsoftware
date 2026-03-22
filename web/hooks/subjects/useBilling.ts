import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/auth/useAuth';
import { SUBJECT_QUERY_KEYS } from '@/modules/subjects/subject.constants';
import {
  getAccessoriesBySubject,
  getBillBySubject,
} from '@/modules/subjects/billing.service';
import type { AddAccessoryInput, EditBillInput, GenerateBillInput } from '@/modules/subjects/subject.types';

export function useSubjectAccessories(subjectId: string) {
  return useQuery({
    queryKey: ['subject-accessories', subjectId],
    queryFn: async () => {
      const result = await getAccessoriesBySubject(subjectId);
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    },
    enabled: Boolean(subjectId),
  });
}

export function useAddAccessory(subjectId: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: AddAccessoryInput) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      const res = await fetch(`/api/subjects/${subjectId}/billing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_accessory', ...input }),
      });
      
      const json = await res.json() as { 
        ok: boolean
        data?: { id: string; item_name: string; quantity: number; unit_price: number }
        error?: { userMessage: string }
      };
      
      if (!json.ok) throw new Error(json.error?.userMessage ?? 'Failed to add accessory');
      return json.data!;
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
      
      const res = await fetch(`/api/subjects/${subjectId}/billing`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove_accessory', accessoryId }),
      });
      
      const json = await res.json() as { 
        ok: boolean
        error?: { userMessage: string }
      };
      
      if (!json.ok) throw new Error(json.error?.userMessage ?? 'Failed to remove accessory');
      return null;
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
      
      const res = await fetch(`/api/subjects/${subjectId}/billing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_bill', ...input }),
      });
      
      const json = await res.json() as { 
        ok: boolean
        data?: { id: string; bill_number: string; bill_type: string; grand_total: number }
        error?: { userMessage: string }
      };
      
      if (!json.ok) throw new Error(json.error?.userMessage ?? 'Failed to generate bill');
      return json.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SUBJECT_QUERY_KEYS.detail(subjectId) });
      queryClient.invalidateQueries({ queryKey: SUBJECT_QUERY_KEYS.list });
      queryClient.invalidateQueries({ queryKey: ['subject-accessories', subjectId] });
      queryClient.invalidateQueries({ queryKey: ['subject-bill', subjectId] });
      toast.success('Bill generated and job completed successfully');
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
    mutationFn: async ({ billId, paymentStatus, paymentMode }: { billId: string; paymentStatus: 'paid' | 'due' | 'waived'; paymentMode?: 'cash' | 'upi' | 'card' | 'cheque' }) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      const res = await fetch(`/api/subjects/${subjectId}/billing`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_payment_status', billId, paymentStatus, paymentMode }),
      });
      
      const json = await res.json() as { 
        ok: boolean
        data?: { id: string; payment_status: 'paid' | 'due' | 'waived' }
        error?: { userMessage: string }
      };
      
      if (!json.ok) throw new Error(json.error?.userMessage ?? 'Failed to update payment status');
      return json.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subject-bill', subjectId] });
      queryClient.invalidateQueries({ queryKey: SUBJECT_QUERY_KEYS.detail(subjectId) });
      toast.success('Payment status updated');
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useEditBill(subjectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: EditBillInput) => {
      const res = await fetch(`/api/subjects/${subjectId}/billing`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      const json = await res.json() as {
        ok: boolean;
        data?: { id: string; grand_total: number; accessories_total: number; visit_charge: number; service_charge: number };
        error?: { userMessage: string };
      };

      if (!json.ok) throw new Error(json.error?.userMessage ?? 'Failed to update bill');
      return json.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subject-bill', subjectId] });
      queryClient.invalidateQueries({ queryKey: ['subject-accessories', subjectId] });
      queryClient.invalidateQueries({ queryKey: SUBJECT_QUERY_KEYS.detail(subjectId) });
      queryClient.invalidateQueries({ queryKey: SUBJECT_QUERY_KEYS.list });
      toast.success('Bill updated successfully');
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
