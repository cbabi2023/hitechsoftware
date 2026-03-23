import { createClient } from '@/lib/supabase/client';
import type { AddAccessoryInput } from '@/modules/subjects/subject.types';

const supabase = createClient();

const ACCESSORY_COLUMNS = 'id,subject_id,item_name,quantity,mrp,discount_type,discount_value,discount_amount,discounted_mrp,base_price,gst_amount,line_total,line_base_total,line_gst_total,added_by,created_at';

export function findBySubjectId(subjectId: string) {
  return supabase
    .from('subject_accessories')
    .select(ACCESSORY_COLUMNS)
    .eq('subject_id', subjectId)
    .order('created_at', { ascending: true });
}

export function createAccessory(subjectId: string, addedBy: string, input: AddAccessoryInput) {
  return supabase
    .from('subject_accessories')
    .insert({
      subject_id: subjectId,
      item_name: input.item_name,
      quantity: input.quantity,
      mrp: input.mrp,
      discount_type: input.discount_type ?? 'percentage',
      discount_value: input.discount_value ?? 0,
      added_by: addedBy,
    })
    .select(ACCESSORY_COLUMNS)
    .single();
}

export function createManyAccessories(subjectId: string, addedBy: string, items: AddAccessoryInput[]) {
  return supabase
    .from('subject_accessories')
    .insert(
      items.map((item) => ({
        subject_id: subjectId,
        item_name: item.item_name,
        quantity: item.quantity,
        mrp: item.mrp,
        discount_type: item.discount_type ?? 'percentage',
        discount_value: item.discount_value ?? 0,
        added_by: addedBy,
      })),
    )
    .select(ACCESSORY_COLUMNS);
}

export function deleteBySubjectId(subjectId: string) {
  return supabase
    .from('subject_accessories')
    .delete()
    .eq('subject_id', subjectId);
}

export function calculateAccessoriesTotal(subjectId: string) {
  return supabase
    .from('subject_accessories')
    .select('line_total,line_base_total,line_gst_total,discount_amount,quantity')
    .eq('subject_id', subjectId);
}
