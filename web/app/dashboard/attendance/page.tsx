'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { useAuth } from '@/hooks/auth/useAuth';
import { useAttendanceSummary, useTodayAttendance, useToggleAttendance } from '@/hooks/attendance/useAttendance';
import { ROUTES } from '@/lib/constants/routes';

function formatTime(value: string | null) {
  if (!value) {
    return '-';
  }

  return new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function monthLabel(month: number, year: number) {
  return new Date(year, month - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

function parseYmd(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export default function AttendancePage() {
  const { user, userRole } = useAuth();
  const toggleMutation = useToggleAttendance();

  const now = new Date();
  const [currentMonth, setCurrentMonth] = useState(now.getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const todayAttendanceQuery = useTodayAttendance(user?.id ?? '');
  const summaryQuery = useAttendanceSummary(user?.id ?? '', currentMonth, currentYear);

  if (userRole !== 'technician') {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          Attendance screen is available for technicians only.
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const todayAttendance = todayAttendanceQuery.data?.ok ? todayAttendanceQuery.data.data : null;
  const summary = summaryQuery.data?.ok ? summaryQuery.data.data : null;
  const isOnline = Boolean(todayAttendance?.toggled_on_at) && !todayAttendance?.toggled_off_at;

  const selectedDay = useMemo(() => {
    if (!summary || !selectedDate) {
      return null;
    }

    return summary.days.find((day) => day.date === selectedDate) ?? null;
  }, [selectedDate, summary]);

  const firstDayOfMonth = new Date(currentYear, currentMonth - 1, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();

  return (
    <div className="p-6 space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h1 className="text-2xl font-bold text-slate-900">Attendance</h1>
        <p className="mt-1 text-sm text-slate-600">Track your attendance and assigned services.</p>
      </div>

      <section className={`rounded-xl border p-6 ${isOnline ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
        <div className="flex flex-col items-center text-center">
          <button
            type="button"
            disabled={toggleMutation.isPending}
            onClick={() => toggleMutation.mutate(user.id)}
            className={`min-h-12 min-w-[220px] rounded-xl px-6 py-3 text-base font-semibold text-white ${isOnline ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-600 hover:bg-slate-700'} disabled:opacity-60`}
          >
            {toggleMutation.isPending ? 'Updating...' : isOnline ? 'Toggle OFF' : 'Toggle ON'}
          </button>

          <p className="mt-4 text-sm text-slate-700">
            {isOnline
              ? 'You are Active. Services are accessible.'
              : 'You are currently marked Absent. Toggle ON to mark attendance and access services.'}
          </p>

          {isOnline ? (
            <p className="mt-1 text-xs text-emerald-700">ON at {formatTime(todayAttendance?.toggled_on_at ?? null)}</p>
          ) : null}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold text-slate-900">Today's Service Summary</h2>
        <p className="mt-2 text-sm text-slate-700">
          Assigned subjects today:{' '}
          <span className="font-semibold text-slate-900">
            {summary?.days.find((day) => day.is_today)?.service_count ?? 0}
          </span>
        </p>
        <Link href={ROUTES.DASHBOARD_SUBJECTS} className="mt-2 inline-flex text-sm font-medium text-blue-600 hover:text-blue-700">
          Open service list
        </Link>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-slate-900">
            <CalendarDays className="h-5 w-5 text-blue-600" />
            <h2 className="text-base font-semibold">{monthLabel(currentMonth, currentYear)}</h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (currentMonth === 1) {
                  setCurrentMonth(12);
                  setCurrentYear((prev) => prev - 1);
                } else {
                  setCurrentMonth((prev) => prev - 1);
                }
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => {
                if (currentMonth === 12) {
                  setCurrentMonth(1);
                  setCurrentYear((prev) => prev + 1);
                } else {
                  setCurrentMonth((prev) => prev + 1);
                }
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              Next
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label) => (
            <div key={label}>{label}</div>
          ))}
        </div>

        <div className="mt-2 grid grid-cols-7 gap-2">
          {Array.from({ length: firstDayOfMonth }).map((_, index) => (
            <div key={`empty-${index}`} className="h-20 rounded-lg bg-slate-50" />
          ))}

          {Array.from({ length: daysInMonth }).map((_, index) => {
            const day = index + 1;
            const date = new Date(currentYear, currentMonth - 1, day);
            const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const daySummary = summary?.days.find((item) => item.date === dateString);
            const isToday = daySummary?.is_today;
            const serviceCount = daySummary?.service_count ?? 0;

            return (
              <button
                key={dateString}
                type="button"
                onClick={() => setSelectedDate(dateString)}
                className={`relative h-20 rounded-lg border p-2 text-left transition ${
                  isToday ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <span className="text-xs font-semibold text-slate-700">{day}</span>

                {daySummary?.status === 'present' && !daySummary.is_future ? (
                  <span className="absolute left-2 bottom-2 h-2.5 w-2.5 rounded-full bg-emerald-500" />
                ) : null}

                {daySummary?.status === 'absent' && !daySummary.is_future ? (
                  <span className="absolute left-2 bottom-2 h-2.5 w-2.5 rounded-full bg-rose-500" />
                ) : null}

                {serviceCount > 0 ? (
                  <span className="absolute right-2 bottom-2 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                    {serviceCount}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {selectedDay ? (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">{parseYmd(selectedDay.date).toLocaleDateString('en-GB')}</h3>
              <button
                type="button"
                onClick={() => setSelectedDate(null)}
                className="text-xs font-medium text-slate-500 hover:text-slate-700"
              >
                Close
              </button>
            </div>
            <p className="mt-2 text-sm text-slate-700">Service count: {selectedDay.service_count}</p>
            {selectedDay.is_today && selectedDay.subject_numbers.length > 0 ? (
              <p className="mt-1 text-xs text-slate-600">Subjects: {selectedDay.subject_numbers.join(', ')}</p>
            ) : selectedDay.is_today ? (
              <p className="mt-1 text-xs text-slate-500">No subjects assigned.</p>
            ) : (
              <p className="mt-1 text-xs text-slate-500">Only count is shown for non-current dates.</p>
            )}
            {!selectedDay.is_today ? (
              <p className="mt-2 text-xs text-slate-500">Full service details are accessible only for today.</p>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
