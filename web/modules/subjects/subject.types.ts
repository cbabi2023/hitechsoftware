export type SubjectSourceType = 'brand' | 'dealer';
export type SubjectPriority = 'critical' | 'high' | 'medium' | 'low';
export type SubjectTypeOfService = 'installation' | 'service';

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
  warranty_end_date: string | null;
  amc_end_date: string | null;
  service_charge_type: 'customer' | 'brand_dealer';
  is_amc_service: boolean;
  is_warranty_service: boolean;
  billing_status: 'not_applicable' | 'due' | 'partially_paid' | 'paid' | 'waived';
  created_by: string | null;
  assigned_by: string | null;
  timeline: SubjectTimelineItem[];
}

export interface SubjectTimelineItem {
  id: string;
  status: string;
  changed_at: string;
  note: string | null;
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
