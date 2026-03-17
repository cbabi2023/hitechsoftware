import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { createSubjectTicket, getSubjectDetails, getSubjects, removeSubject, updateSubjectRecord } from '@/modules/subjects/subject.service';
import { SUBJECT_DEFAULT_PAGE_SIZE, SUBJECT_QUERY_KEYS } from '@/modules/subjects/subject.constants';
import type { CreateSubjectInput, SubjectListFilters, UpdateSubjectInput } from '@/modules/subjects/subject.types';
import { getAssignableTechnicians } from '@/modules/technicians/technician.service';

export function useSubjects() {
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(SUBJECT_DEFAULT_PAGE_SIZE);
  const [sourceType, setSourceType] = useState<'all' | 'brand' | 'dealer'>('all');
  const [priority, setPriority] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all');
  const [status, setStatus] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [brandId, setBrandId] = useState('');
  const [dealerId, setDealerId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const filters: SubjectListFilters = useMemo(() => {
    return {
      search: searchInput.trim() || undefined,
      source_type: sourceType,
      priority,
      status: status.trim() || undefined,
      category_id: categoryId || undefined,
      brand_id: brandId || undefined,
      dealer_id: dealerId || undefined,
      from_date: fromDate || undefined,
      to_date: toDate || undefined,
      page,
      page_size: pageSize,
    };
  }, [searchInput, sourceType, priority, status, categoryId, brandId, dealerId, fromDate, toDate, page, pageSize]);

  const query = useQuery({
    queryKey: [...SUBJECT_QUERY_KEYS.list, filters],
    queryFn: () => getSubjects(filters),
  });

  const createSubjectMutation = useMutation({
    mutationFn: (input: CreateSubjectInput) => createSubjectTicket(input),
    onSuccess: (result) => {
      if (result.ok) {
        toast.success('Subject created successfully');
        queryClient.invalidateQueries({ queryKey: SUBJECT_QUERY_KEYS.all });
      } else {
        toast.error(result.error.message);
      }
    },
  });

  const updateSubjectMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateSubjectInput }) => updateSubjectRecord(id, input),
    onSuccess: (result, variables) => {
      if (result.ok) {
        toast.success('Subject updated successfully');
        queryClient.invalidateQueries({ queryKey: SUBJECT_QUERY_KEYS.all });
        queryClient.invalidateQueries({ queryKey: SUBJECT_QUERY_KEYS.detail(variables.id) });
      } else {
        toast.error(result.error.message);
      }
    },
  });

  const deleteSubjectMutation = useMutation({
    mutationFn: (id: string) => removeSubject(id),
    onSuccess: (result) => {
      if (result.ok) {
        toast.success('Subject deleted successfully');
        queryClient.invalidateQueries({ queryKey: SUBJECT_QUERY_KEYS.all });
      } else {
        toast.error(result.error.message);
      }
    },
  });

  return {
    subjects: query.data?.ok ? query.data.data.data : [],
    pagination: query.data?.ok
      ? {
          page: query.data.data.page,
          pageSize: query.data.data.page_size,
          total: query.data.data.total,
          totalPages: query.data.data.total_pages,
        }
      : {
          page: 1,
          pageSize: SUBJECT_DEFAULT_PAGE_SIZE,
          total: 0,
          totalPages: 1,
        },
    searchInput,
    pageSize,
    sourceType,
    priority,
    status,
    categoryId,
    brandId,
    dealerId,
    fromDate,
    toDate,
    isLoading: query.isLoading,
    isCreating: createSubjectMutation.isPending,
    error:
      (query.data && !query.data.ok && query.data.error.message) ||
      (query.error instanceof Error ? query.error.message : null),
    createSubjectMutation,
    updateSubjectMutation,
    deleteSubjectMutation,
    setSearch: (value: string) => {
      setSearchInput(value);
      setPage(1);
    },
    setSourceType: (value: 'all' | 'brand' | 'dealer') => {
      setSourceType(value);
      setPage(1);
    },
    setPriority: (value: 'all' | 'critical' | 'high' | 'medium' | 'low') => {
      setPriority(value);
      setPage(1);
    },
    setStatus: (value: string) => {
      setStatus(value);
      setPage(1);
    },
    setCategoryId: (value: string) => {
      setCategoryId(value);
      setPage(1);
    },
    setBrandId: (value: string) => {
      setBrandId(value);
      setPage(1);
    },
    setDealerId: (value: string) => {
      setDealerId(value);
      setPage(1);
    },
    setFromDate: (value: string) => {
      setFromDate(value);
      setPage(1);
    },
    setToDate: (value: string) => {
      setToDate(value);
      setPage(1);
    },
    setPage: (value: number) => setPage(Math.max(1, value)),
    setPageSize: (value: number) => {
      setPageSize(value);
      setPage(1);
    },
  };
}

export function useSubjectDetail(id: string) {
  return useQuery({
    queryKey: SUBJECT_QUERY_KEYS.detail(id),
    queryFn: () => getSubjectDetails(id),
    staleTime: 1000 * 60 * 5,
    enabled: Boolean(id),
  });
}

export function useAssignableTechnicians() {
  return useQuery({
    queryKey: SUBJECT_QUERY_KEYS.assignableTechnicians,
    queryFn: getAssignableTechnicians,
    staleTime: 60 * 1000,
  });
}
