import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { SubjectBill } from '@/modules/subjects/subject.types';
import { generateBillPDF } from '@/lib/pdf/generateBillPDF';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: billId } = await context.params;

  if (!billId) {
    return NextResponse.json({ ok: false, error: { message: 'Bill id is required' } }, { status: 400 });
  }

  const supabase = await createServerClient();
  const auth = await supabase.auth.getUser();

  if (auth.error || !auth.data.user) {
    return NextResponse.json({ ok: false, error: { message: 'Unauthorized' } }, { status: 401 });
  }

  const userId = auth.data.user.id;

  const profile = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle<{ role: string }>();

  if (profile.error || !profile.data) {
    return NextResponse.json({ ok: false, error: { message: 'Profile not found' } }, { status: 403 });
  }

  const admin = createAdminClient();

  const billResult = await admin
    .from('subject_bills')
    .select('*')
    .eq('id', billId)
    .maybeSingle<SubjectBill>();

  if (billResult.error || !billResult.data) {
    return NextResponse.json({ ok: false, error: { message: 'Bill not found' } }, { status: 404 });
  }

  const subjectResult = await admin
    .from('subjects')
    .select('id,subject_number,category_id,type_of_service,customer_name,customer_address,assigned_technician_id')
    .eq('id', billResult.data.subject_id)
    .maybeSingle<{
      id: string;
      subject_number: string;
      category_id: string | null;
      type_of_service: string;
      customer_name: string | null;
      customer_address: string | null;
      assigned_technician_id: string | null;
    }>();

  if (subjectResult.error || !subjectResult.data) {
    return NextResponse.json({ ok: false, error: { message: 'Subject not found for bill' } }, { status: 404 });
  }

  if (profile.data.role === 'technician' && subjectResult.data.assigned_technician_id !== userId) {
    return NextResponse.json({ ok: false, error: { message: 'Forbidden' } }, { status: 403 });
  }

  const [category, tech, accessories] = await Promise.all([
    subjectResult.data.category_id
      ? admin.from('service_categories').select('name').eq('id', subjectResult.data.category_id).maybeSingle<{ name: string }>()
      : Promise.resolve({ data: null, error: null } as { data: { name: string } | null; error: null }),
    subjectResult.data.assigned_technician_id
      ? admin.from('profiles').select('display_name').eq('id', subjectResult.data.assigned_technician_id).maybeSingle<{ display_name: string }>()
      : Promise.resolve({ data: null, error: null } as { data: { display_name: string } | null; error: null }),
    admin
      .from('subject_accessories')
      .select('item_name,quantity,mrp,discount_type,discount_value,discount_amount,discounted_mrp,base_price,gst_amount,line_total,line_base_total,line_gst_total')
      .eq('subject_id', subjectResult.data.id),
  ]);

  const pdfBlob = await generateBillPDF(billResult.data, {
    subject_number: subjectResult.data.subject_number,
    category_name: category.data?.name ?? null,
    type_of_service: subjectResult.data.type_of_service,
    technician_name: tech.data?.display_name ?? null,
    customer_name: subjectResult.data.customer_name,
    customer_address: subjectResult.data.customer_address,
    accessories: (accessories.data ?? []) as Array<{
      item_name: string; quantity: number; mrp: number;
      discount_type: 'percentage' | 'flat'; discount_value: number; discount_amount: number;
      discounted_mrp: number; base_price: number; gst_amount: number;
      line_total: number; line_base_total: number; line_gst_total: number;
    }>,
  });

  const buffer = await pdfBlob.arrayBuffer();

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${billResult.data.bill_number}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}
