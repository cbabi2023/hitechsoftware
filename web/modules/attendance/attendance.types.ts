export type AttendanceStatus = 'present' | 'absent' | 'not_marked';

export interface AttendanceLog {
  id: string;
  technician_id: string;
  date: string;
  toggled_on_at: string | null;
  toggled_off_at: string | null;
  is_present: boolean;
  auto_offed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubjectRef {
  id: string;
  subject_number: string;
}

export interface AttendanceDaySummary {
  date: string;
  status: AttendanceStatus;
  service_count: number;
  subject_numbers: string[];
  subjects: SubjectRef[];
  is_today: boolean;
  is_future: boolean;
}

export interface AttendanceSummary {
  technician_id: string;
  month: number;
  year: number;
  present_count: number;
  absent_count: number;
  not_marked_count: number;
  days: AttendanceDaySummary[];
}

export interface AttendanceToggleResult {
  status: 'online' | 'offline';
  attendance: AttendanceLog | null;
  message?: string;
}

export interface TechnicianLiveStatus {
  id: string;
  display_name: string;
  email: string;
  phone_number: string | null;
  role: 'technician';
  is_online: boolean;
  today_attendance: AttendanceLog | null;
  today_service_count: number;
}
