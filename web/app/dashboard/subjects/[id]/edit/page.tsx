'use client';

import { useParams, useRouter } from 'next/navigation';
import { usePermission } from '@/hooks/auth/usePermission';
import { useSubjectDetail, useSubjects } from '@/hooks/subjects/useSubjects';
import SubjectForm from '@/components/subjects/SubjectForm';
import { ROUTES } from '@/lib/constants/routes';
import type { SubjectFormValues } from '@/modules/subjects/subject.types';

function buildInitialValues(subject: {
  subject_number: string;
  source_type: 'brand' | 'dealer';
  brand_id: string | null;
  dealer_id: string | null;
  assigned_technician_id: string | null;
  priority: 'critical' | 'high' | 'medium' | 'low';
  priority_reason: string;
  allocated_date: string;
  type_of_service: 'installation' | 'service';
  category_id: string | null;
  customer_phone: string | null;
  customer_name: string | null;
  customer_address: string | null;
  product_name: string | null;
  serial_number: string | null;
  product_description: string | null;
  purchase_date: string | null;
  warranty_end_date: string | null;
  amc_start_date: string | null;
  amc_end_date: string | null;
}): SubjectFormValues {
  return {
    subject_number: subject.subject_number,
    source_type: subject.source_type,
    brand_id: subject.brand_id ?? undefined,
    dealer_id: subject.dealer_id ?? undefined,
    assigned_technician_id: subject.assigned_technician_id ?? undefined,
    priority: subject.priority,
    priority_reason: subject.priority_reason,
    allocated_date: subject.allocated_date,
    type_of_service: subject.type_of_service,
    category_id: subject.category_id ?? '',
    customer_phone: subject.customer_phone ?? undefined,
    customer_name: subject.customer_name ?? undefined,
    customer_address: subject.customer_address ?? undefined,
    product_name: subject.product_name ?? undefined,
    serial_number: subject.serial_number ?? undefined,
    product_description: subject.product_description ?? undefined,
    purchase_date: subject.purchase_date ?? undefined,
    warranty_end_date: subject.warranty_end_date ?? undefined,
    amc_start_date: subject.amc_start_date ?? undefined,
    amc_end_date: subject.amc_end_date ?? undefined,
  };
}

export default function EditSubjectPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { can } = usePermission();
  const { updateSubjectMutation } = useSubjects();
  const query = useSubjectDetail(params.id);

  if (!can('subject:edit')) {
    return <div className="p-6 text-sm text-rose-700">You do not have access to edit subjects.</div>;
  }

  if (query.isLoading) {
    return <div className="p-6 text-sm text-slate-600">Loading subject...</div>;
  }

  if (!query.data?.ok) {
    const message = query.data && !query.data.ok ? query.data.error.message : 'Failed to load subject';
    return <div className="p-6 text-sm text-rose-700">{message}</div>;
  }

  const subject = query.data.data;

  return (
    <SubjectForm
      heading={`Edit Subject ${subject.subject_number}`}
      description="Update service subject details using the same service module form."
      initialValues={buildInitialValues(subject)}
      submitLabel="Save changes"
      submittingLabel="Saving changes..."
      isSubmitting={updateSubjectMutation.isPending}
      onCancel={() => router.push(ROUTES.DASHBOARD_SUBJECTS_DETAIL(subject.id))}
      onSubmit={async (values) => {
        const result = await updateSubjectMutation.mutateAsync({ id: subject.id, input: values });
        if (result.ok) {
          router.push(ROUTES.DASHBOARD_SUBJECTS_DETAIL(subject.id));
        }
      }}
    />
  );
}
