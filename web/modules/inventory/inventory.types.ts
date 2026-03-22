export interface InventoryItem {
  id: string;
  item_code: string;
  item_name: string;
  item_category: string;
  description: string | null;
  unit_cost: number;
  mrp_price: number;
  reorder_level: number;
  supplier_id: string | null;
  is_active: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface StockLevel {
  id: string;
  inventory_id: string;
  quantity_on_hand: number;
  quantity_reserved: number;
  quantity_available: number;
  last_stock_date: string | null;
  last_counted_date: string | null;
  warehouse_location: string | null;
  updated_at: string;
}

export interface InventoryWithStock extends InventoryItem {
  stock: StockLevel | null;
}

export interface CreateInventoryInput {
  item_code: string;
  item_name: string;
  item_category: string;
  description?: string;
  unit_cost: number;
  mrp_price: number;
  reorder_level?: number;
  is_active?: boolean;
}

export interface UpdateInventoryInput extends Partial<CreateInventoryInput> {}

export interface StockAdjustmentInput {
  adjustment: number;
  warehouse_location?: string;
  last_stock_date?: string;
}

export interface InventoryFilters {
  search?: string;
  category?: string;
  is_active?: boolean;
  low_stock?: boolean;
  page?: number;
  page_size?: number;
}

export interface InventoryListResponse {
  data: InventoryWithStock[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}
