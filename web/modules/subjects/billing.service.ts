import { createClient } from '@/lib/supabase/client';
import type { ServiceResult } from '@/types/common.types';
import type {
  AddAccessoryInput,
  GenerateBillInput,
  SubjectAccessory,
  SubjectBill,
} from '@/modules/subjects/subject.types';
import {
  calculateAccessoriesTotal,
  createAccessory,
  createManyAccessories,
  findBySubjectId as findAccessoriesBySubjectId,
} from '@/repositories/accessory.repository';
import {
  createBill,
  findBySubjectId as findBillBySubjectId,
  updatePaymentStatus,
} from '@/repositories/bill.repository';
import { checkCompletionRequirements } from '@/modules/subjects/subject.job-workflow';
import { getSubjectDetails } from '@/modules/subjects/subject.service';

const supabase = createClient();

function toNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export async function addAccessory(
  subjectId: string,
  technicianId: string,
  input: AddAccessoryInput,
): Promise<ServiceResult<SubjectAccessory>> {
  if (!input.item_name?.trim()) {
    return { ok: false, error: { message: 'Item name is required' } };
  }
  if (input.quantity < 1) {
    return { ok: false, error: { message: 'Quantity must be at least 1' } };
  }
  if (input.unit_price < 0) {
    return { ok: false, error: { message: 'Unit price must be at least 0' } };
  }

  const subjectCheck = await supabase
    .from('subjects')
    .select('assigned_technician_id,status')
    .eq('id', subjectId)
    .eq('is_deleted', false)
    .maybeSingle<{ assigned_technician_id: string | null; status: string }>();

  if (subjectCheck.error || !subjectCheck.data) {
    return { ok: false, error: { message: 'Subject not found' } };
  }

  if (subjectCheck.data.assigned_technician_id !== technicianId) {
    return { ok: false, error: { message: 'You are not assigned to this subject' } };
  }

  if (subjectCheck.data.status !== 'IN_PROGRESS') {
    return { ok: false, error: { message: 'Accessories can be edited only while job is in progress' } };
  }

  const result = await createAccessory(subjectId, technicianId, {
    item_name: input.item_name.trim(),
    quantity: input.quantity,
    unit_price: input.unit_price,
  });

  if (result.error || !result.data) {
    return { ok: false, error: { message: result.error?.message ?? 'Failed to add accessory' } };
  }

  return { ok: true, data: result.data as SubjectAccessory };
}

export async function removeAccessory(
  accessoryId: string,
  technicianId: string,
): Promise<ServiceResult<{ id: string }>> {
  const row = await supabase
    .from('subject_accessories')
    .select('id,subject_id')
    .eq('id', accessoryId)
    .maybeSingle<{ id: string; subject_id: string }>();

  if (row.error || !row.data) {
    return { ok: false, error: { message: 'Accessory not found' } };
  }

  const subjectCheck = await supabase
    .from('subjects')
    .select('assigned_technician_id,status')
    .eq('id', row.data.subject_id)
    .eq('is_deleted', false)
    .maybeSingle<{ assigned_technician_id: string | null; status: string }>();

  if (subjectCheck.error || !subjectCheck.data) {
    return { ok: false, error: { message: 'Subject not found' } };
  }

  if (subjectCheck.data.assigned_technician_id !== technicianId) {
    return { ok: false, error: { message: 'You are not assigned to this subject' } };
  }

  if (subjectCheck.data.status !== 'IN_PROGRESS') {
    return { ok: false, error: { message: 'Accessories can be edited only while job is in progress' } };
  }

  const del = await supabase.from('subject_accessories').delete().eq('id', accessoryId);
  if (del.error) {
    return { ok: false, error: { message: del.error.message } };
  }

  return { ok: true, data: { id: accessoryId } };
}

export async function getAccessoriesBySubject(
  subjectId: string,
): Promise<ServiceResult<{ items: SubjectAccessory[]; total: number }>> {
  const rows = await findAccessoriesBySubjectId(subjectId);
  if (rows.error) {
    return { ok: false, error: { message: rows.error.message } };
  }

  const items = (rows.data ?? []) as SubjectAccessory[];
  const total = items.reduce((sum, item) => sum + toNumber(item.total_price), 0);

  return { ok: true, data: { items, total } };
}

export async function generateBill(
  subjectId: string,
  technicianId: string,
  input: GenerateBillInput,
): Promise<ServiceResult<SubjectBill>> {
  const subjectResult = await getSubjectDetails(subjectId);
  if (!subjectResult.ok) {
    return subjectResult as ServiceResult<SubjectBill>;
  }

  const subject = subjectResult.data;

  if (subject.assigned_technician_id !== technicianId) {
    return { ok: false, error: { message: 'You are not assigned to this subject' } };
  }

  if (subject.status !== 'IN_PROGRESS') {
    return { ok: false, error: { message: 'Bill can only be generated when subject is in progress' } };
  }

  const existingBill = await findBillBySubjectId(subjectId);
  if (existingBill.error) {
    return { ok: false, error: { message: existingBill.error.message } };
  }
  if (existingBill.data) {
    return { ok: false, error: { message: 'Bill already generated for this subject' } };
  }

  const completionCheck = await checkCompletionRequirements(subjectId);
  if (!completionCheck.ok) {
    return completionCheck as ServiceResult<SubjectBill>;
  }

  if (!completionCheck.data.canComplete) {
    return {
      ok: false,
      error: { message: `Missing required photos: ${completionCheck.data.missing.join(', ')}` },
    };
  }

  const accessoryItems = input.accessories ?? [];
  for (const item of accessoryItems) {
    if (!item.item_name?.trim()) {
      return { ok: false, error: { message: 'Accessory item name is required' } };
    }
    if (item.quantity < 1) {
      return { ok: false, error: { message: 'Accessory quantity must be at least 1' } };
    }
    if (item.unit_price < 0) {
      return { ok: false, error: { message: 'Accessory unit price must be at least 0' } };
    }
  }

  if (accessoryItems.length > 0) {
    const existingAccessories = await findAccessoriesBySubjectId(subjectId);
    if (existingAccessories.error) {
      return { ok: false, error: { message: existingAccessories.error.message } };
    }

    if ((existingAccessories.data ?? []).length === 0) {
      const inserted = await createManyAccessories(subjectId, technicianId, accessoryItems);
      if (inserted.error) {
        return { ok: false, error: { message: inserted.error.message } };
      }
    }
  }

  const accessoriesTotalResult = await calculateAccessoriesTotal(subjectId);
  if (accessoriesTotalResult.error) {
    return { ok: false, error: { message: accessoriesTotalResult.error.message } };
  }

  const accessories_total = (accessoriesTotalResult.data ?? []).reduce(
    (sum, row) => sum + toNumber((row as { total_price: number }).total_price),
    0,
  );

  const visit_charge = toNumber(input.visit_charge);
  const service_charge = toNumber(input.service_charge);
  const grand_total = visit_charge + service_charge + accessories_total;

  const isBrandDealerBill = subject.is_warranty_service || subject.is_amc_service;

  if (!isBrandDealerBill && !input.payment_mode) {
    return { ok: false, error: { message: 'Payment mode is required for out-of-warranty jobs' } };
  }

  const billNumberResult = await supabase.rpc('generate_bill_number');
  if (billNumberResult.error || !billNumberResult.data) {
    return { ok: false, error: { message: billNumberResult.error?.message ?? 'Failed to generate bill number' } };
  }

  const bill_number = billNumberResult.data as string;

  const billInsert = await createBill({
    subject_id: subject.id,
    bill_number,
    bill_type: isBrandDealerBill ? 'brand_dealer_invoice' : 'customer_receipt',
    issued_to: isBrandDealerBill ? subject.source_name : (subject.customer_name ?? 'Customer'),
    issued_to_type: isBrandDealerBill ? 'brand_dealer' : 'customer',
    brand_id: subject.brand_id ?? null,
    dealer_id: subject.dealer_id ?? null,
    visit_charge,
    service_charge,
    accessories_total,
    grand_total,
    payment_mode: isBrandDealerBill ? null : (input.payment_mode ?? null),
    payment_status: isBrandDealerBill ? 'due' : 'paid',
    payment_collected_at: isBrandDealerBill ? null : new Date().toISOString(),
    generated_by: technicianId,
  });

  if (billInsert.error || !billInsert.data) {
    return { ok: false, error: { message: billInsert.error?.message ?? 'Failed to create bill' } };
  }

  const subjectUpdate = await supabase
    .from('subjects')
    .update({
      visit_charge,
      service_charge,
      accessories_total,
      grand_total,
      payment_mode: isBrandDealerBill ? null : (input.payment_mode ?? null),
      payment_collected: !isBrandDealerBill,
      payment_collected_at: !isBrandDealerBill ? new Date().toISOString() : null,
      billing_status: isBrandDealerBill ? 'due' : 'paid',
      bill_generated: true,
      bill_generated_at: new Date().toISOString(),
      bill_number,
      status: 'COMPLETED',
      completed_at: new Date().toISOString(),
      completion_proof_uploaded: true,
    })
    .eq('id', subjectId);

  if (subjectUpdate.error) {
    return { ok: false, error: { message: subjectUpdate.error.message } };
  }

  return { ok: true, data: billInsert.data as SubjectBill };
}

export async function getBillBySubject(subjectId: string): Promise<ServiceResult<SubjectBill>> {
  const bill = await findBillBySubjectId(subjectId);
  if (bill.error) {
    return { ok: false, error: { message: bill.error.message } };
  }

  if (!bill.data) {
    return { ok: false, error: { message: 'Bill not found for subject' } };
  }

  return { ok: true, data: bill.data };
}

export async function updateBillPaymentStatus(
  billId: string,
  paymentStatus: 'paid' | 'due' | 'waived',
  officeStaffId: string,
): Promise<ServiceResult<SubjectBill>> {
  const profile = await supabase
    .from('profiles')
    .select('role')
    .eq('id', officeStaffId)
    .maybeSingle<{ role: string }>();

  if (profile.error || !profile.data) {
    return { ok: false, error: { message: 'User profile not found' } };
  }

  if (!['office_staff', 'super_admin'].includes(profile.data.role)) {
    return { ok: false, error: { message: 'Only office staff or super admin can update payment status' } };
  }

  const updated = await updatePaymentStatus(billId, paymentStatus);
  if (updated.error || !updated.data) {
    return { ok: false, error: { message: updated.error?.message ?? 'Failed to update payment status' } };
  }

  return { ok: true, data: updated.data };
}
