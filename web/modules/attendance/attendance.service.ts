import type { ServiceResult } from '@/types/common.types';
import {
  getAttendanceLogByTechnicianAndDate,
  listAttendanceLogsByDate,
  listAttendanceLogsByTechnicianAndRange,
  listSubjectAssignmentsByDate,
  listSubjectAssignmentsForTechnicianInRange,
  listTechnicianProfiles,
} from '@/repositories/attendance.repository';
import type {
  AttendanceDaySummary,
  AttendanceLog,
  AttendanceSummary,
  AttendanceToggleResult,
  AttendanceStatus,
  TechnicianLiveStatus,
} from '@/modules/attendance/attendance.types';

function toDateString(date: Date) {
  return date.toISOString().split('T')[0];
}

function monthRange(month: number, year: number) {
  const first = new Date(year, month - 1, 1);
  const last = new Date(year, month, 0);
  return {
    fromDate: toDateString(first),
    toDate: toDateString(last),
    totalDays: last.getDate(),
  };
}

function parseAttendanceStatus(log: AttendanceLog | null): AttendanceStatus {
  if (!log) {
    return 'not_marked';
  }

  return log.is_present ? 'present' : 'absent';
}

export async function toggleAttendance(technicianId: string): Promise<ServiceResult<AttendanceToggleResult>> {
  if (!technicianId) {
    return { ok: false, error: { message: 'Technician id is required.' } };
  }

  try {
    const response = await fetch('/api/attendance/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const payload = (await response.json()) as {
      ok: boolean;
      data?: AttendanceToggleResult;
      error?: { message: string; code?: string };
    };

    if (!response.ok || !payload.ok || !payload.data) {
      return {
        ok: false,
        error: {
          message: payload.error?.message ?? 'Failed to toggle attendance',
          code: payload.error?.code,
        },
      };
    }

    return { ok: true, data: payload.data };
  } catch {
    return {
      ok: false,
      error: { message: 'Unable to reach server while toggling attendance.' },
    };
  }
}

export async function getTodayAttendance(technicianId: string): Promise<ServiceResult<AttendanceLog | null>> {
  const today = toDateString(new Date());
  const result = await getAttendanceLogByTechnicianAndDate(technicianId, today);

  if (result.error) {
    return { ok: false, error: { message: result.error.message, code: result.error.code } };
  }

  return { ok: true, data: result.data ?? null };
}

export async function getAttendanceSummary(technicianId: string, month: number, year: number): Promise<ServiceResult<AttendanceSummary>> {
  const { fromDate, toDate, totalDays } = monthRange(month, year);
  const [logsResult, subjectsResult] = await Promise.all([
    listAttendanceLogsByTechnicianAndRange(technicianId, fromDate, toDate),
    listSubjectAssignmentsForTechnicianInRange(technicianId, fromDate, toDate),
  ]);

  if (logsResult.error) {
    return { ok: false, error: { message: logsResult.error.message, code: logsResult.error.code } };
  }

  if (subjectsResult.error) {
    return { ok: false, error: { message: subjectsResult.error.message, code: subjectsResult.error.code } };
  }

  const logs = (logsResult.data ?? []) as AttendanceLog[];
  const logsByDate = new Map(logs.map((log) => [log.date, log]));

  const servicesByDate = new Map<string, Array<{ id: string; subject_number: string }>>();
  for (const row of subjectsResult.data ?? []) {
    const serviceDate = row.technician_allocated_date;
    if (!serviceDate) {
      continue;
    }

    const items = servicesByDate.get(serviceDate) ?? [];
    items.push({ id: row.id, subject_number: row.subject_number });
    servicesByDate.set(serviceDate, items);
  }

  const todayString = toDateString(new Date());
  const days: AttendanceDaySummary[] = [];
  let presentCount = 0;
  let absentCount = 0;
  let notMarkedCount = 0;

  for (let day = 1; day <= totalDays; day += 1) {
    const date = new Date(year, month - 1, day);
    const dateKey = toDateString(date);
    const attendance = logsByDate.get(dateKey) ?? null;
    const status = parseAttendanceStatus(attendance);
    const subjectNumbers = servicesByDate.get(dateKey) ?? [];

    if (status === 'present') {
      presentCount += 1;
    } else if (status === 'absent') {
      absentCount += 1;
    } else {
      notMarkedCount += 1;
    }

    days.push({
      date: dateKey,
      status,
      service_count: subjectNumbers.length,
      subject_numbers: subjectNumbers.map((s) => s.subject_number),
      subjects: subjectNumbers,
      is_today: dateKey === todayString,
      is_future: dateKey > todayString,
    });
  }

  return {
    ok: true,
    data: {
      technician_id: technicianId,
      month,
      year,
      present_count: presentCount,
      absent_count: absentCount,
      not_marked_count: notMarkedCount,
      days,
    },
  };
}

export async function getAllTechnicianStatus(): Promise<ServiceResult<TechnicianLiveStatus[]>> {
  const today = toDateString(new Date());

  const [profilesResult, logsResult] = await Promise.all([
    listTechnicianProfiles(),
    listAttendanceLogsByDate(today),
  ]);

  if (profilesResult.error) {
    return { ok: false, error: { message: profilesResult.error.message, code: profilesResult.error.code } };
  }

  if (logsResult.error) {
    return { ok: false, error: { message: logsResult.error.message, code: logsResult.error.code } };
  }

  const logsByTechnician = new Map<string, AttendanceLog>();
  for (const log of (logsResult.data ?? []) as AttendanceLog[]) {
    logsByTechnician.set(log.technician_id, log);
  }

  const profiles = (profilesResult.data ?? []) as Array<{
    id: string;
    display_name: string;
    email: string;
    phone_number: string | null;
    role: 'technician';
    is_online: boolean;
  }>;

  const subjectCounts = await Promise.all(
    profiles.map((profile) => listSubjectAssignmentsByDate(profile.id, today)),
  );

  const result: TechnicianLiveStatus[] = profiles.map((profile, index) => {
    const subjectResult = subjectCounts[index];
    const todayServiceCount = subjectResult.error ? 0 : (subjectResult.data ?? []).length;

    return {
      id: profile.id,
      display_name: profile.display_name,
      email: profile.email,
      phone_number: profile.phone_number,
      role: 'technician',
      is_online: profile.is_online,
      today_attendance: logsByTechnician.get(profile.id) ?? null,
      today_service_count: todayServiceCount,
    };
  });

  return { ok: true, data: result };
}

export async function getAbsentTechnicians(date: string): Promise<ServiceResult<TechnicianLiveStatus[]>> {
  const allStatusResult = await getAllTechnicianStatus();

  if (!allStatusResult.ok) {
    return allStatusResult;
  }

  if (date === toDateString(new Date())) {
    const absent = allStatusResult.data.filter((technician) => {
      const log = technician.today_attendance;
      return !log || !log.is_present;
    });

    return { ok: true, data: absent };
  }

  const [profilesResult, logsResult] = await Promise.all([
    listTechnicianProfiles(),
    listAttendanceLogsByDate(date),
  ]);

  if (profilesResult.error) {
    return { ok: false, error: { message: profilesResult.error.message, code: profilesResult.error.code } };
  }

  if (logsResult.error) {
    return { ok: false, error: { message: logsResult.error.message, code: logsResult.error.code } };
  }

  const logsByTechnician = new Map<string, AttendanceLog>();
  for (const log of (logsResult.data ?? []) as AttendanceLog[]) {
    logsByTechnician.set(log.technician_id, log);
  }

  const profiles = (profilesResult.data ?? []) as Array<{
    id: string;
    display_name: string;
    email: string;
    phone_number: string | null;
    role: 'technician';
    is_online: boolean;
  }>;

  const absent: TechnicianLiveStatus[] = profiles
    .filter((profile) => {
      const log = logsByTechnician.get(profile.id);
      return !log || !log.is_present;
    })
    .map((profile) => ({
      id: profile.id,
      display_name: profile.display_name,
      email: profile.email,
      phone_number: profile.phone_number,
      role: 'technician',
      is_online: profile.is_online,
      today_attendance: logsByTechnician.get(profile.id) ?? null,
      today_service_count: 0,
    }));

  return { ok: true, data: absent };
}
