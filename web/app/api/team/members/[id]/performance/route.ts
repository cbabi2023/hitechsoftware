import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

function toMonthKey(value: string) {
  const date = new Date(value);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function buildLastMonths(count: number) {
  const now = new Date();
  const list: Array<{ key: string; label: string }> = [];

  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });
    list.push({ key, label });
  }

  return list;
}

async function ensureSuperAdmin() {
  const supabase = await createServerClient();
  const authState = await supabase.auth.getUser();

  if (authState.error || !authState.data.user) {
    return { ok: false as const, response: NextResponse.json({ ok: false, error: { message: 'Unauthorized' } }, { status: 401 }) };
  }

  const profileResult = await supabase
    .from('profiles')
    .select('role')
    .eq('id', authState.data.user.id)
    .maybeSingle<{ role: string }>();

  if (profileResult.error || profileResult.data?.role !== 'super_admin') {
    return { ok: false as const, response: NextResponse.json({ ok: false, error: { message: 'Forbidden' } }, { status: 403 }) };
  }

  return { ok: true as const };
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await ensureSuperAdmin();
  if (!access.ok) {
    return access.response;
  }

  const { id } = await context.params;

  if (!id) {
    return NextResponse.json({ ok: false, error: { message: 'Team member id is required' } }, { status: 400 });
  }

  const admin = createAdminClient();
  const months = buildLastMonths(6);
  const startIso = `${months[0]?.key ?? toMonthKey(new Date().toISOString())}-01T00:00:00.000Z`;

  const [rejectionEventsResult, rejectedSubjectsResult] = await Promise.all([
    admin
      .from('subject_status_history')
      .select('changed_at')
      .eq('event_type', 'rejection')
      .eq('changed_by', id)
      .gte('changed_at', startIso),
    admin
      .from('subjects')
      .select('id')
      .eq('is_deleted', false)
      .eq('rejected_by_technician_id', id),
  ]);

  if (rejectionEventsResult.error) {
    return NextResponse.json({ ok: false, error: { message: rejectionEventsResult.error.message } }, { status: 500 });
  }

  if (rejectedSubjectsResult.error) {
    return NextResponse.json({ ok: false, error: { message: rejectedSubjectsResult.error.message } }, { status: 500 });
  }

  const rejectedSubjectIds = (rejectedSubjectsResult.data ?? []).map((row) => row.id as string);

  const rescheduleEventsResult = rejectedSubjectIds.length === 0
    ? { data: [] as Array<{ changed_at: string }>, error: null }
    : await admin
      .from('subject_status_history')
      .select('changed_at')
      .eq('event_type', 'reschedule')
      .in('subject_id', rejectedSubjectIds)
      .gte('changed_at', startIso);

  if (rescheduleEventsResult.error) {
    return NextResponse.json({ ok: false, error: { message: rescheduleEventsResult.error.message } }, { status: 500 });
  }

  const rejectionsByMonth = new Map<string, number>();
  const reschedulesByMonth = new Map<string, number>();

  for (const row of rejectionEventsResult.data ?? []) {
    const key = toMonthKey(row.changed_at as string);
    rejectionsByMonth.set(key, (rejectionsByMonth.get(key) ?? 0) + 1);
  }

  for (const row of rescheduleEventsResult.data ?? []) {
    const key = toMonthKey(row.changed_at as string);
    reschedulesByMonth.set(key, (reschedulesByMonth.get(key) ?? 0) + 1);
  }

  const monthly = months.map((month) => ({
    month: month.key,
    label: month.label,
    rejections: rejectionsByMonth.get(month.key) ?? 0,
    reschedules: reschedulesByMonth.get(month.key) ?? 0,
  }));

  return NextResponse.json({
    ok: true,
    data: {
      monthly,
      totals: {
        rejections: monthly.reduce((sum, item) => sum + item.rejections, 0),
        reschedules: monthly.reduce((sum, item) => sum + item.reschedules, 0),
      },
    },
  });
}
