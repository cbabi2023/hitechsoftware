'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/auth/useAuth';
import { useSubjects } from '@/hooks/subjects/useSubjects';
import SubjectForm from '@/components/subjects/SubjectForm';
import { ROUTES } from '@/lib/constants/routes';
import type { SubjectFormValues } from '@/modules/subjects/subject.types';

const DEFAULT_VALUES: SubjectFormValues = {
  subject_number: '',
  source_type: 'brand',
  brand_id: undefined,
  dealer_id: undefined,
  assigned_technician_id: undefined,
  priority: 'medium',
  priority_reason: '',
  allocated_date: new Date().toISOString().slice(0, 10),
  type_of_service: 'service',
  category_id: '',
  customer_phone: undefined,
  customer_name: undefined,
  customer_address: undefined,
  product_name: undefined,
  serial_number: undefined,
  product_description: undefined,
  purchase_date: undefined,
  warranty_end_date: undefined,
  amc_start_date: undefined,
  amc_end_date: undefined,
};

export default function NewSubjectPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { createSubjectMutation } = useSubjects();
  return (
    <SubjectForm
      heading="Create Subject"
      description="Create service subjects with strict source and priority rules."
      initialValues={DEFAULT_VALUES}
      submitLabel="Create subject"
      submittingLabel="Creating subject..."
      isSubmitting={createSubjectMutation.isPending}
      onCancel={() => router.push(ROUTES.DASHBOARD_SUBJECTS)}
      onSubmit={async (values) => {
        if (!user?.id) {
          return;
        }

        const result = await createSubjectMutation.mutateAsync({
          ...values,
          created_by: user.id,
        });

        if (result.ok) {
          router.push(ROUTES.DASHBOARD_SUBJECTS_DETAIL(result.data.id));
        }
      }}
    />
  );
}
