import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

interface ErrorResponse {
  step: string;
  code: string;
  message: string;
  userMessage: string;
}

function startOfToday(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfWeekMonday(date: Date) {
  const day = date.getDay();
  const offset = day === 0 ? 6 : day - 1;
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - offset);
  return start;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfYear(date: Date) {
  return new Date(date.getFullYear(), 0, 1);
}

function nextDay(date: Date) {
  const next = new Date(date);
  next.setDate(next.getDate() + 1);
  return next;
}

interface PeriodStats {
  completed: number;
  products_sold: number;
  parts_sold_qty: number;
  parts_sold_amount: number;
}

async function getCompletedSubjectIdsForRange(
  admin: ReturnType<typeof createAdminClient>,
  technicianId: string,
  fromIso: string,
  toIso?: string,
) {
  let query = admin
    .from('subjects')
    .select('id')
    .eq('is_deleted', false)
    .eq('assigned_technician_id', technicianId)
    .eq('status', 'COMPLETED')
    .gte('completed_at', fromIso);

  if (toIso) {
    query = query.lt('completed_at', toIso);
  }

  const result = await query;
  if (result.error) {
    throw new Error(result.error.message);
  }

  return (result.data ?? []).map((row) => (row as { id: string }).id);
}

async function getPeriodStats(
  admin: ReturnType<typeof createAdminClient>,
  technicianId: string,
  fromIso: string,
  toIso?: string,
): Promise<PeriodStats> {
  const subjectIds = await getCompletedSubjectIdsForRange(admin, technicianId, fromIso, toIso);

  if (subjectIds.length === 0) {
    return {
      completed: 0,
      products_sold: 0,
      parts_sold_qty: 0,
      parts_sold_amount: 0,
    };
  }

  const productsSoldResult = await admin
    .from('subject_bills')
    .select('id', { head: true, count: 'exact' })
    .in('subject_id', subjectIds)
    .eq('bill_type', 'customer_receipt');

  if (productsSoldResult.error) {
    throw new Error(productsSoldResult.error.message);
  }

  const partsResult = await admin
    .from('subject_accessories')
    .select('quantity,total_price')
    .in('subject_id', subjectIds);

  if (partsResult.error) {
    throw new Error(partsResult.error.message);
  }

  const parts = partsResult.data ?? [];
  const parts_sold_qty = parts.reduce((sum, row) => sum + Number((row as { quantity: number }).quantity ?? 0), 0);
  const parts_sold_amount = parts.reduce((sum, row) => sum + Number((row as { total_price: number }).total_price ?? 0), 0);

  return {
    completed: subjectIds.length,
    products_sold: productsSoldResult.count ?? 0,
    parts_sold_qty,
    parts_sold_amount,
  };
}

export async function GET() {
  const supabase = await createServerClient();
  const authState = await supabase.auth.getUser();

  if (authState.error || !authState.data.user) {
    const error: ErrorResponse = {
      step: '1. Authentication',
      code: 'UNAUTHORIZED',
      message: authState.error?.message ?? 'No authenticated user found',
      userMessage: 'You must be logged in to view this summary',
    };
    return NextResponse.json({ ok: false, error }, { status: 401 });
  }

  const userId = authState.data.user.id;

  const profileResult = await supabase
    .from('profiles')
    .select('id,role')
    .eq('id', userId)
    .maybeSingle<{ id: string; role: string }>();

  if (profileResult.error || !profileResult.data) {
    const error: ErrorResponse = {
      step: '2. Load Profile',
      code: 'PROFILE_NOT_FOUND',
      message: profileResult.error?.message ?? 'Profile not found',
      userMessage: 'Profile could not be loaded',
    };
    return NextResponse.json({ ok: false, error }, { status: 400 });
  }

  if (profileResult.data.role !== 'technician') {
    const error: ErrorResponse = {
      step: '2. Verify Role',
      code: 'INVALID_ROLE',
      message: `Role '${profileResult.data.role}' is not allowed`,
      userMessage: 'Only technicians can access this summary',
    };
    return NextResponse.json({ ok: false, error }, { status: 403 });
  }

  const now = new Date();
  const todayStart = startOfToday(now);
  const tomorrowStart = nextDay(todayStart);
  const weekStart = startOfWeekMonday(now);
  const monthStart = startOfMonth(now);
  const yearStart = startOfYear(now);

  const admin = createAdminClient();

  try {
    const [today, week, month, year] = await Promise.all([
      getPeriodStats(admin, userId, todayStart.toISOString(), tomorrowStart.toISOString()),
      getPeriodStats(admin, userId, weekStart.toISOString()),
      getPeriodStats(admin, userId, monthStart.toISOString()),
      getPeriodStats(admin, userId, yearStart.toISOString()),
    ]);

    return NextResponse.json({
      ok: true,
      data: {
        today: today.completed,
        week: week.completed,
        month: month.completed,
        year: year.completed,
        sales: {
          today: {
            products_sold: today.products_sold,
            parts_sold_qty: today.parts_sold_qty,
            parts_sold_amount: today.parts_sold_amount,
          },
          week: {
            products_sold: week.products_sold,
            parts_sold_qty: week.parts_sold_qty,
            parts_sold_amount: week.parts_sold_amount,
          },
          month: {
            products_sold: month.products_sold,
            parts_sold_qty: month.parts_sold_qty,
            parts_sold_amount: month.parts_sold_amount,
          },
          year: {
            products_sold: year.products_sold,
            parts_sold_qty: year.parts_sold_qty,
            parts_sold_amount: year.parts_sold_amount,
          },
        },
      },
    });
  } catch (error) {
    const err = error instanceof Error ? error.message : 'Unknown error';
    const response: ErrorResponse = {
      step: '3. Compute Summary',
      code: 'SUMMARY_QUERY_FAILED',
      message: err,
      userMessage: 'Failed to load completed jobs summary',
    };
    return NextResponse.json({ ok: false, error: response }, { status: 400 });
  }
}
