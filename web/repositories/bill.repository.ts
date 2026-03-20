import { createClient } from '@/lib/supabase/client';
import type { SubjectBill } from '@/modules/subjects/subject.types';

const supabase = createClient();

export function findBySubjectId(subjectId: string) {
  return supabase
    .from('subject_bills')
    .select('*')
    .eq('subject_id', subjectId)
    .maybeSingle<SubjectBill>();
}

export function findByBrandId(brandId: string) {
  return supabase
    .from('subject_bills')
    .select('*,subjects(subject_number)')
    .eq('brand_id', brandId)
    .order('generated_at', { ascending: false });
}

export function findByDealerId(dealerId: string) {
  return supabase
    .from('subject_bills')
    .select('*,subjects(subject_number)')
    .eq('dealer_id', dealerId)
    .order('generated_at', { ascending: false });
}

export async function getBrandDueSummary(brandId: string) {
  const result = await supabase
    .from('subject_bills')
    .select('grand_total')
    .eq('brand_id', brandId)
    .eq('payment_status', 'due');

  if (result.error) {
    return { data: null, error: result.error };
  }

  const totalDue = (result.data ?? []).reduce((sum, row) => sum + Number((row as { grand_total: number }).grand_total || 0), 0);
  return { data: { totalDue, dueCount: (result.data ?? []).length }, error: null };
}

export async function getDealerDueSummary(dealerId: string) {
  const result = await supabase
    .from('subject_bills')
    .select('grand_total')
    .eq('dealer_id', dealerId)
    .eq('payment_status', 'due');

  if (result.error) {
    return { data: null, error: result.error };
  }

  const totalDue = (result.data ?? []).reduce((sum, row) => sum + Number((row as { grand_total: number }).grand_total || 0), 0);
  return { data: { totalDue, dueCount: (result.data ?? []).length }, error: null };
}

export async function createBill(bill: Omit<SubjectBill, 'id' | 'generated_at'>) {
  const createResult = await supabase
    .from('subject_bills')
    .insert(bill)
    .select('*')
    .single<SubjectBill>();

  if (createResult.error || !createResult.data) {
    return createResult;
  }

  const subjectUpdate = await supabase
    .from('subjects')
    .update({
      bill_number: createResult.data.bill_number,
      bill_generated: true,
      bill_generated_at: new Date().toISOString(),
    })
    .eq('id', createResult.data.subject_id);

  if (subjectUpdate.error) {
    return { data: null, error: subjectUpdate.error };
  }

  return createResult;
}

export async function updatePaymentStatus(billId: string, paymentStatus: 'paid' | 'due' | 'waived') {
  const update = await supabase
    .from('subject_bills')
    .update({
      payment_status: paymentStatus,
      payment_collected_at: paymentStatus === 'paid' ? new Date().toISOString() : null,
    })
    .eq('id', billId)
    .select('*')
    .single<SubjectBill>();

  if (update.error || !update.data) {
    return update;
  }

  await supabase
    .from('subjects')
    .update({
      billing_status: paymentStatus,
      payment_collected: paymentStatus === 'paid',
      payment_collected_at: paymentStatus === 'paid' ? new Date().toISOString() : null,
    })
    .eq('id', update.data.subject_id);

  return update;
}
