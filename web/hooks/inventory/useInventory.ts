'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { INVENTORY_DEFAULT_PAGE_SIZE, INVENTORY_QUERY_KEYS } from '@/modules/inventory/inventory.constants';
import {
  adjustInventoryStock,
  createInventoryItem,
  deleteInventoryItem,
  getInventoryList,
  updateInventoryItem,
} from '@/modules/inventory/inventory.service';
import type {
  CreateInventoryInput,
  InventoryFilters,
  StockAdjustmentInput,
  UpdateInventoryInput,
} from '@/modules/inventory/inventory.types';

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debouncedValue;
}

export function useInventory() {
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebouncedValue(searchInput, 400);

  const [filters, setFilters] = useState<{
    category?: string;
    status: 'all' | 'active' | 'inactive';
    low_stock: boolean;
    page: number;
  }>({ status: 'all', low_stock: false, page: 1 });

  const queryFilters = useMemo<InventoryFilters>(() => {
    const isActive =
      filters.status === 'active' ? true : filters.status === 'inactive' ? false : undefined;

    return {
      search: debouncedSearch || undefined,
      category: filters.category || undefined,
      is_active: isActive,
      low_stock: filters.low_stock || undefined,
      page: filters.page,
      page_size: INVENTORY_DEFAULT_PAGE_SIZE,
    };
  }, [debouncedSearch, filters]);

  const listQuery = useQuery({
    queryKey: [...INVENTORY_QUERY_KEYS.list, queryFilters],
    queryFn: () => getInventoryList(queryFilters),
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateInventoryInput) => createInventoryItem(input),
    onSuccess: (result) => {
      if (result.ok) {
        toast.success('Inventory item created successfully');
        queryClient.invalidateQueries({ queryKey: INVENTORY_QUERY_KEYS.all });
      } else {
        toast.error(result.error.message);
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateInventoryInput }) =>
      updateInventoryItem(id, input),
    onSuccess: (result, variables) => {
      if (result.ok) {
        toast.success('Inventory item updated');
        queryClient.invalidateQueries({ queryKey: INVENTORY_QUERY_KEYS.all });
        queryClient.invalidateQueries({ queryKey: INVENTORY_QUERY_KEYS.detail(variables.id) });
      } else {
        toast.error(result.error.message);
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteInventoryItem(id),
    onSuccess: (result) => {
      if (result.ok) {
        toast.success('Inventory item removed');
        queryClient.invalidateQueries({ queryKey: INVENTORY_QUERY_KEYS.all });
      } else {
        toast.error(result.error.message);
      }
    },
  });

  const adjustStockMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: StockAdjustmentInput }) =>
      adjustInventoryStock(id, input),
    onSuccess: (result, variables) => {
      if (result.ok) {
        toast.success('Stock updated');
        queryClient.invalidateQueries({ queryKey: INVENTORY_QUERY_KEYS.all });
        queryClient.invalidateQueries({ queryKey: INVENTORY_QUERY_KEYS.detail(variables.id) });
      } else {
        toast.error(result.error.message);
      }
    },
  });

  const listData = listQuery.data?.ok ? listQuery.data.data : null;

  return {
    items: listData?.data ?? [],
    pagination: {
      page: listData?.page ?? 1,
      totalPages: listData?.total_pages ?? 1,
      total: listData?.total ?? 0,
    },
    filters,
    searchInput,
    isLoading: listQuery.isLoading,
    error:
      (listQuery.data && !listQuery.data.ok && listQuery.data.error.message) ||
      (listQuery.error instanceof Error ? listQuery.error.message : null),

    setSearch: (value: string) => {
      setSearchInput(value);
      setFilters((prev) => ({ ...prev, page: 1 }));
    },
    setCategory: (value: string) => {
      setFilters((prev) => ({ ...prev, category: value || undefined, page: 1 }));
    },
    setStatus: (value: 'all' | 'active' | 'inactive') => {
      setFilters((prev) => ({ ...prev, status: value, page: 1 }));
    },
    setLowStock: (value: boolean) => {
      setFilters((prev) => ({ ...prev, low_stock: value, page: 1 }));
    },
    setPage: (value: number) => {
      setFilters((prev) => ({ ...prev, page: value }));
    },

    createMutation,
    updateMutation,
    deleteMutation,
    adjustStockMutation,
  };
}

