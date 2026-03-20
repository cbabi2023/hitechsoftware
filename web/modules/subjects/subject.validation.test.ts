import { describe, expect, it } from 'vitest';
import { createSubjectSchema } from '@/modules/subjects/subject.validation';

function validBasePayload() {
  return {
    subject_number: 'SUB-2026-001',
    source_type: 'brand' as const,
    brand_id: '11111111-1111-4111-8111-111111111111',
    dealer_id: '',
    assigned_technician_id: '',
    priority: 'medium' as const,
    priority_reason: 'Customer reported intermittent cooling issue',
    allocated_date: '2026-03-20',
    type_of_service: 'service' as const,
    category_id: '22222222-2222-4222-8222-222222222222',
    customer_phone: '9999999999',
    customer_name: 'Test Customer',
    customer_address: 'Test Address',
    product_name: 'Split AC',
    serial_number: 'SN123456',
    product_description: 'Test product description',
    purchase_date: '2026-01-10',
    warranty_end_date: '2027-01-10',
    amc_start_date: '2027-01-11',
    amc_end_date: '2028-01-11',
    created_by: '33333333-3333-4333-8333-333333333333',
  };
}

describe('subject validation', () => {
  it('accepts a valid service subject payload', () => {
    const parsed = createSubjectSchema.safeParse(validBasePayload());
    expect(parsed.success).toBe(true);
  });

  it('requires brand when source_type is brand', () => {
    const payload = validBasePayload();
    payload.brand_id = '';

    const parsed = createSubjectSchema.safeParse(payload);
    expect(parsed.success).toBe(false);

    if (!parsed.success) {
      const issue = parsed.error.issues.find((i) => i.path.join('.') === 'brand_id');
      expect(issue?.message).toContain('Brand is required');
    }
  });

  it('requires dealer when source_type is dealer', () => {
    const payload = validBasePayload();
    payload.source_type = 'dealer';
    payload.brand_id = '';
    payload.dealer_id = '';

    const parsed = createSubjectSchema.safeParse(payload);
    expect(parsed.success).toBe(false);

    if (!parsed.success) {
      const issue = parsed.error.issues.find((i) => i.path.join('.') === 'dealer_id');
      expect(issue?.message).toContain('Dealer is required');
    }
  });

  it('rejects warranty end date before purchase date', () => {
    const payload = validBasePayload();
    payload.purchase_date = '2026-03-20';
    payload.warranty_end_date = '2026-03-19';

    const parsed = createSubjectSchema.safeParse(payload);
    expect(parsed.success).toBe(false);

    if (!parsed.success) {
      const issue = parsed.error.issues.find((i) => i.path.join('.') === 'warranty_end_date');
      expect(issue?.message).toContain('Warranty end date cannot be before purchase date');
    }
  });

  it('requires AMC start date when AMC end date is provided', () => {
    const payload = validBasePayload();
    payload.amc_start_date = '';
    payload.amc_end_date = '2028-01-11';

    const parsed = createSubjectSchema.safeParse(payload);
    expect(parsed.success).toBe(false);

    if (!parsed.success) {
      const issue = parsed.error.issues.find((i) => i.path.join('.') === 'amc_start_date');
      expect(issue?.message).toContain('AMC purchase/start date is required');
    }
  });

  it('rejects AMC end date before AMC start date', () => {
    const payload = validBasePayload();
    payload.amc_start_date = '2027-06-01';
    payload.amc_end_date = '2027-05-31';

    const parsed = createSubjectSchema.safeParse(payload);
    expect(parsed.success).toBe(false);

    if (!parsed.success) {
      const issue = parsed.error.issues.find((i) => i.path.join('.') === 'amc_end_date');
      expect(issue?.message).toContain('AMC end date cannot be before AMC start date');
    }
  });
});
