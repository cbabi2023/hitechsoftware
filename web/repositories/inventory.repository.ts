import { createClient } from '@/lib/supabase/client';
import { INVENTORY_DEFAULT_PAGE_SIZE } from '@/modules/inventory/inventory.constants';
import type {
  CreateInventoryInput,
  InventoryFilters,
  InventoryItem,
  InventoryWithStock,
  StockLevel,
  UpdateInventoryInput,
} from '@/modules/inventory/inventory.types';

const supabase = createClient();

const INVENTORY_SELECT = `
  id,item_code,item_name,item_category,description,
  unit_cost,mrp_price,reorder_level,supplier_id,
  is_active,is_deleted,created_at,updated_at
`.replace(/\s+/g, '');

const INVENTORY_WITH_STOCK_SELECT = `
  id,item_code,item_name,item_category,description,
  unit_cost,mrp_price,reorder_level,supplier_id,
  is_active,is_deleted,created_at,updated_at,
  stock(id,inventory_id,quantity_on_hand,quantity_reserved,quantity_available,last_stock_date,last_counted_date,warehouse_location,updated_at)
`.replace(/\s+/g, '');

export async function findAll(filters: InventoryFilters) {
  const page = filters.page && filters.page > 0 ? filters.page : 1;
  const pageSize =
    filters.page_size && filters.page_size > 0 ? filters.page_size : INVENTORY_DEFAULT_PAGE_SIZE;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('inventory')
    .select(INVENTORY_WITH_STOCK_SELECT, { count: 'exact' })
    .eq('is_deleted', false);

  if (typeof filters.is_active === 'boolean') {
    query = query.eq('is_active', filters.is_active);
  }

  if (filters.category?.trim()) {
    query = query.eq('item_category', filters.category.trim());
  }

  if (filters.search?.trim()) {
    const escaped = filters.search.trim().replaceAll(',', ' ');
    query = query.or(`item_name.ilike.%${escaped}%,item_code.ilike.%${escaped}%`);
  }

  const result = await query
    .order('created_at', { ascending: false })
    .range(from, to)
    .returns<InventoryWithStock[]>();

  return {
    data: result.data,
    error: result.error,
    count: result.count ?? 0,
    page,
    pageSize,
  };
}

export async function findById(id: string) {
  return supabase
    .from('inventory')
    .select(INVENTORY_WITH_STOCK_SELECT)
    .eq('id', id)
    .eq('is_deleted', false)
    .single<InventoryWithStock>();
}

export async function findByItemCode(itemCode: string, excludeId?: string) {
  let query = supabase
    .from('inventory')
    .select('id,item_code')
    .eq('item_code', itemCode)
    .eq('is_deleted', false);

  if (excludeId) {
    query = query.neq('id', excludeId);
  }

  return query.maybeSingle<Pick<InventoryItem, 'id' | 'item_code'>>();
}

export async function create(input: CreateInventoryInput) {
  return supabase
    .from('inventory')
    .insert({
      item_code: input.item_code.toUpperCase(),
      item_name: input.item_name,
      item_category: input.item_category,
      description: input.description?.trim() || null,
      unit_cost: input.unit_cost,
      mrp_price: input.mrp_price,
      reorder_level: input.reorder_level ?? 10,
      is_active: input.is_active ?? true,
    })
    .select(INVENTORY_SELECT)
    .single<InventoryItem>();
}

export async function update(id: string, input: UpdateInventoryInput) {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (input.item_code !== undefined) patch.item_code = input.item_code.toUpperCase();
  if (input.item_name !== undefined) patch.item_name = input.item_name;
  if (input.item_category !== undefined) patch.item_category = input.item_category;
  if (input.description !== undefined) patch.description = input.description?.trim() || null;
  if (input.unit_cost !== undefined) patch.unit_cost = input.unit_cost;
  if (input.mrp_price !== undefined) patch.mrp_price = input.mrp_price;
  if (input.reorder_level !== undefined) patch.reorder_level = input.reorder_level;
  if (input.is_active !== undefined) patch.is_active = input.is_active;

  return supabase
    .from('inventory')
    .update(patch)
    .eq('id', id)
    .eq('is_deleted', false)
    .select(INVENTORY_SELECT)
    .single<InventoryItem>();
}

export async function softDelete(id: string) {
  return supabase
    .from('inventory')
    .update({ is_deleted: true, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('is_deleted', false);
}

export async function initStockRecord(inventoryId: string) {
  return supabase
    .from('stock')
    .insert({ inventory_id: inventoryId })
    .select('*')
    .single<StockLevel>();
}

