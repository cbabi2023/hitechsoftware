import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addCustomer, getCustomers } from '@/modules/customers/customer.service';
import { CUSTOMER_QUERY_KEYS } from '@/modules/customers/customer.constants';
import type { CreateCustomerInput } from '@/modules/customers/customer.types';

export function useCustomers() {
  const queryClient = useQueryClient();

  const customersQuery = useQuery({
    queryKey: CUSTOMER_QUERY_KEYS.list,
    queryFn: getCustomers,
  });

  const createCustomerMutation = useMutation({
    mutationFn: (input: CreateCustomerInput) => addCustomer(input),
    onSuccess: (result) => {
      if (result.ok) {
        queryClient.invalidateQueries({ queryKey: CUSTOMER_QUERY_KEYS.all });
      }
    },
  });

  return {
    customers: customersQuery.data?.ok ? customersQuery.data.data : [],
    isLoading: customersQuery.isLoading,
    error:
      (customersQuery.data && !customersQuery.data.ok && customersQuery.data.error.message) ||
      (createCustomerMutation.data && !createCustomerMutation.data.ok && createCustomerMutation.data.error.message) ||
      null,
    createCustomer: async (input: CreateCustomerInput) => createCustomerMutation.mutateAsync(input),
  };
}
