export type SubjectSourceType = 'brand' | 'dealer';
export type SubjectPriority = 'critical' | 'high' | 'medium' | 'low';
export type SubjectTypeOfService = 'installation' | 'service';
export type WarrantyPeriod = '6_months' | '1_year' | '2_years' | '3_years' | '4_years' | '5_years' | 'custom';
export type PhotoType = 'serial_number' | 'machine' | 'bill' | 'job_sheet' | 'defective_part' | 'site_photo_1' | 'site_photo_2' | 'site_photo_3' | 'service_video';
export type IncompleteReason = 'customer_cannot_afford' | 'power_issue' | 'door_locked' | 'spare_parts_not_available' | 'site_not_ready' | 'other';

export interface SubjectListItem {
  id: string;
  subject_number: string;
  source_type: SubjectSourceType;
  source_name: string;
  assigned_technician_id: string | null;
  assigned_technician_name: string | null;
  assigned_technician_code: string | null;
  priority: SubjectPriority;
  status: string;
  allocated_date: string;
  technician_allocated_date: string | null;
  technician_allocated_notes: string | null;
  technician_acceptance_status: 'pending' | 'accepted' | 'rejected';
  is_rejected_pending_reschedule: boolean;
  customer_name: string | null;
  customer_phone: string | null;
  category_name: string | null;
  type_of_service: SubjectTypeOfService;
  service_charge_type: 'customer' | 'brand_dealer';
  is_amc_service: boolean;
  is_warranty_service: boolean;
  billing_status: 'not_applicable' | 'due' | 'partially_paid' | 'paid' | 'waived';
  created_at: string;
}

export interface SubjectDetail extends SubjectListItem {
  brand_id: string | null;
  dealer_id: string | null;
  category_id: string | null;
  priority_reason: string;
  customer_name: string | null;
  customer_address: string | null;
  product_name: string | null;
  serial_number: string | null;
  product_description: string | null;
  purchase_date: string | null;
  warranty_period_months: number | null;
  warranty_end_date: string | null;
  warranty_status: 'active' | 'expired' | null;
  amc_end_date: string | null;
  service_charge_type: 'customer' | 'brand_dealer';
  is_amc_service: boolean;
  is_warranty_service: boolean;
  billing_status: 'not_applicable' | 'due' | 'partially_paid' | 'paid' | 'waived';
  technician_rejection_reason: string | null;
  rejected_by_technician_id: string | null;
  rejected_by_technician_name: string | null;
  en_route_at: string | null;
  arrived_at: string | null;
  work_started_at: string | null;
  completed_at: string | null;
  incomplete_at: string | null;
  incomplete_reason: IncompleteReason | null;
  incomplete_note: string | null;
  spare_parts_requested: string | null;
  spare_parts_quantity: number | null;
  completion_proof_uploaded: boolean;
  completion_notes: string | null;
  rescheduled_date: string | null;
  photos: SubjectPhoto[];
  created_by: string | null;
  assigned_by: string | null;
  timeline: SubjectTimelineItem[];
}

export interface SubjectTimelineItem {
  id: string;
  event_type: string;
  status: string;
  changed_at: string;
  note: string | null;
  old_value: string | null;
  new_value: string | null;
  changed_by: string | null;
  changed_by_name: string | null;
}

export interface SubjectListFilters {
  search?: string;
  source_type?: SubjectSourceType | 'all';
  priority?: SubjectPriority | 'all';
  status?: string;
  category_id?: string;
  brand_id?: string;
  dealer_id?: string;
  from_date?: string;
  to_date?: string;
  /** Filter by technician_allocated_date (used for technician role to see today's assignments) */
  technician_date?: string;
  /** Restrict technician views to active work queue (non-terminal statuses). */
  technician_pending_only?: boolean;
  /** Show unfinished work queue using schema-safe criteria. */
  pending_only?: boolean;
  /** Show only overdue pending technician-assigned subjects. */
  overdue_only?: boolean;
  page?: number;
  page_size?: number;
}

export interface SubjectListResponse {
  data: SubjectListItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface SubjectFormValues {
  subject_number: string;
  source_type: SubjectSourceType;
  brand_id?: string;
  dealer_id?: string;
  assigned_technician_id?: string;
  priority: SubjectPriority;
  priority_reason: string;
  allocated_date: string;
  type_of_service: SubjectTypeOfService;
  category_id: string;
  customer_phone?: string;
  customer_name?: string;
  customer_address?: string;
  product_name?: string;
  serial_number?: string;
  product_description?: string;
  purchase_date?: string;
  warranty_end_date?: string;
  amc_end_date?: string;
}

export interface CreateSubjectInput extends SubjectFormValues {
  created_by: string;
}

export type UpdateSubjectInput = SubjectFormValues;

export interface AssignTechnicianInput {
  subject_id: string;
  technician_id: string | null;
  technician_allocated_date: string | null;  // ISO date string YYYY-MM-DD
  technician_allocated_notes: string | null;
  assigned_by: string;
}

export interface SubjectPhoto {
  id: string;
  subject_id: string;
  photo_type: PhotoType;
  storage_path: string;
  public_url: string;
  uploaded_by: string | null;
  uploaded_at: string;
  file_size_bytes: number | null;
  mime_type: string | null;
}

export interface PhotoUploadProgress {
  photoType: PhotoType;
  progress: number; // 0-100
  isUploading: boolean;
}

export interface JobCompletionRequirements {
  required: PhotoType[];
  uploaded: PhotoType[];
  missing: PhotoType[];
  canComplete: boolean;
}

export interface IncompleteJobInput {
  reason: IncompleteReason;
  note: string;
  sparePartsRequested?: string;
  sparePartsQuantity?: number;
  sparePartsItems?: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  rescheduledDate?: string; // ISO date string YYYY-MM-DD
}

/** All valid status values for the job workflow. */
export type JobWorkflowStatus =
  | 'PENDING'
  | 'ALLOCATED'
  | 'ACCEPTED'
  | 'ARRIVED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'INCOMPLETE'
  | 'AWAITING_PARTS'
  | 'RESCHEDULED'
  | 'CANCELLED';

/** Service-layer input for marking a job incomplete (camelCase field names). */
export interface MarkIncompleteInput {
  reason: IncompleteReason;
  note?: string;
  spare_parts_requested?: string;
  spare_parts_quantity?: number;
  rescheduled_date?: string;
}

/** Service-layer input for completing a job. */
export interface CompleteJobInput {
  completion_notes?: string;
}

/** Return value from a successful photo upload. */
export interface PhotoUploadResult {
  storage_path: string;
  public_url: string;
  photo_type: PhotoType;
  file_size_bytes: number;
}

/** Result of a completion requirements check (snake_case variant). */
export interface RequiredPhotosCheck {
  required: PhotoType[];
  uploaded: PhotoType[];
  missing: PhotoType[];
  can_complete: boolean;
}

