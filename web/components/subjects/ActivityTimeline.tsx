'use client';

import { Activity, Calendar, CheckCircle2, Flag, UserCheck, UserMinus, UserPlus, XCircle } from 'lucide-react';
import type { SubjectTimelineItem } from '@/modules/subjects/subject.types';

function formatDate(value: string) {
  return new Date(value).toLocaleString('en-GB');
}

function formatStatus(value: string) {
  return value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDateOnly(value: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-GB');
}

const EVENT_META: Record<string, { label: string; icon: React.ReactNode; iconBg: string; iconColor: string; borderColor: string }> = {
  status_change: {
    label: 'Status Change',
    icon: <Activity className="h-3.5 w-3.5" />,
    iconBg: 'bg-violet-100',
    iconColor: 'text-violet-600',
    borderColor: 'border-violet-100',
  },
  assignment: {
    label: 'Technician Assigned',
    icon: <UserPlus className="h-3.5 w-3.5" />,
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    borderColor: 'border-emerald-100',
  },
  reassignment: {
    label: 'Technician Reassigned',
    icon: <UserCheck className="h-3.5 w-3.5" />,
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    borderColor: 'border-amber-100',
  },
  unassignment: {
    label: 'Technician Removed',
    icon: <UserMinus className="h-3.5 w-3.5" />,
    iconBg: 'bg-rose-100',
    iconColor: 'text-rose-600',
    borderColor: 'border-rose-100',
  },
  reschedule: {
    label: 'Rescheduled',
    icon: <Calendar className="h-3.5 w-3.5" />,
    iconBg: 'bg-sky-100',
    iconColor: 'text-sky-600',
    borderColor: 'border-sky-100',
  },
  priority_change: {
    label: 'Priority Changed',
    icon: <Flag className="h-3.5 w-3.5" />,
    iconBg: 'bg-orange-100',
    iconColor: 'text-orange-600',
    borderColor: 'border-orange-100',
  },
  rejection: {
    label: 'Rejected by Technician',
    icon: <XCircle className="h-3.5 w-3.5" />,
    iconBg: 'bg-rose-100',
    iconColor: 'text-rose-600',
    borderColor: 'border-rose-200',
  },
  acceptance: {
    label: 'Accepted by Technician',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    borderColor: 'border-emerald-100',
  },
};

function TimelineEventDetail({ item }: { item: SubjectTimelineItem }) {
  const meta = EVENT_META[item.event_type] ?? EVENT_META.status_change;

  const renderContent = () => {
    switch (item.event_type) {
      case 'status_change':
        return (
          <p className="mt-0.5 text-[13px] text-slate-700">
            {item.old_value ? (
              <><span className="rounded bg-slate-200 px-1.5 py-0.5 font-medium text-slate-600">{formatStatus(item.old_value)}</span>
              <span className="mx-1.5 text-slate-400">&rarr;</span></>
            ) : null}
            <span className="rounded bg-violet-100 px-1.5 py-0.5 font-medium text-violet-700">{formatStatus(item.new_value ?? item.status)}</span>
          </p>
        );
      case 'assignment':
        return (
          <p className="mt-0.5 text-[13px] text-slate-700">
            Assigned to <span className="font-medium text-slate-900">{item.new_value ?? '-'}</span>
          </p>
        );
      case 'reassignment':
        return (
          <p className="mt-0.5 text-[13px] text-slate-700">
            <span className="font-medium text-slate-500">{item.old_value ?? '-'}</span>
            <span className="mx-1.5 text-slate-400">&rarr;</span>
            <span className="font-medium text-slate-900">{item.new_value ?? '-'}</span>
          </p>
        );
      case 'unassignment':
        return (
          <p className="mt-0.5 text-[13px] text-rose-700">
            Removed <span className="font-medium">{item.old_value ?? '-'}</span>
          </p>
        );
      case 'reschedule':
        return (
          <p className="mt-0.5 text-[13px] text-slate-700">
            {item.old_value ? (
              <><span className="rounded bg-slate-200 px-1.5 py-0.5 font-medium text-slate-600">{formatDateOnly(item.old_value)}</span>
              <span className="mx-1.5 text-slate-400">&rarr;</span></>
            ) : null}
            <span className="rounded bg-sky-100 px-1.5 py-0.5 font-medium text-sky-700">{formatDateOnly(item.new_value)}</span>
          </p>
        );
      case 'priority_change':
        return (
          <p className="mt-0.5 text-[13px] text-slate-700">
            {item.old_value ? (
              <><span className="rounded bg-slate-200 px-1.5 py-0.5 font-medium capitalize text-slate-600">{item.old_value}</span>
              <span className="mx-1.5 text-slate-400">&rarr;</span></>
            ) : null}
            <span className="rounded bg-orange-100 px-1.5 py-0.5 font-medium capitalize text-orange-700">{item.new_value ?? item.status}</span>
          </p>
        );
      case 'rejection':
        return (
          <p className="mt-0.5 text-[13px] text-rose-700">
            Reason: <span className="italic font-medium">{item.new_value ?? 'No reason provided'}</span>
          </p>
        );
      case 'acceptance':
        return (
          <p className="mt-0.5 text-[13px] text-emerald-700">Technician accepted this service.</p>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`flex gap-3 rounded-lg border ${meta.borderColor} bg-white p-3`}>
      <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${meta.iconBg} ${meta.iconColor}`}>
        {meta.icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-1">
          <span className="text-[13px] font-semibold text-slate-800">{meta.label}</span>
          <span className="text-[11px] text-slate-400">{formatDate(item.changed_at)}</span>
        </div>
        {renderContent()}
        {item.changed_by_name ? <p className="mt-1 text-[12px] text-slate-500">By: <span className="font-medium text-slate-700">{item.changed_by_name}</span></p> : null}
        {item.note ? <p className="mt-1 text-[12px] italic text-slate-500">{item.note}</p> : null}
      </div>
    </div>
  );
}

interface ActivityTimelineProps {
  timeline: SubjectTimelineItem[];
}

export function ActivityTimeline({ timeline }: ActivityTimelineProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 xl:col-span-3">
      <h2 className="mb-4 text-base font-semibold text-slate-900">Activity Timeline</h2>
      {timeline.length === 0 ? (
        <p className="text-sm text-slate-500">No activity recorded yet.</p>
      ) : (
        <div className="space-y-2.5">
          {timeline.map((item) => (
            <TimelineEventDetail key={item.id} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}
