import { createClient } from '@/lib/supabase/client';
import type { StockAdjustmentInput, StockLevel } from '@/modules/inventory/inventory.types';

const supabase = createClient();

export async function findByInventoryId(inventoryId: string) {
  return supabase
    .from('stock')
    .select('*')
    .eq('inventory_id', inventoryId)
    .maybeSingle<StockLevel>();
}

export async function adjustStock(inventoryId: string, input: StockAdjustmentInput) {
  const { data: current, error: fetchError } = await supabase
    .from('stock')
    .select('id,quantity_on_hand,quantity_reserved')
    .eq('inventory_id', inventoryId)
    .maybeSingle<{ id: string; quantity_on_hand: number; quantity_reserved: number }>();

  if (fetchError) {
    return { data: null, error: fetchError };
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (current) {
    const newOnHand = current.quantity_on_hand + input.adjustment;
    if (newOnHand < 0) {
      return {
        data: null,
        error: {
          message: `Adjustment would result in a negative stock level (current: ${current.quantity_on_hand}, adjustment: ${input.adjustment})`,
          code: 'NEGATIVE_STOCK',
        },
      };
    }
    patch.quantity_on_hand = newOnHand;
    patch.quantity_available = Math.max(0, newOnHand - current.quantity_reserved);
  } else {
    if (input.adjustment < 0) {
      return {
        data: null,
        error: {
          message: 'Cannot reduce stock for an item with no stock record',
          code: 'NO_STOCK_RECORD',
        },
      };
    }
    patch.inventory_id = inventoryId;
    patch.quantity_on_hand = input.adjustment;
    patch.quantity_available = input.adjustment;
  }

  if (input.warehouse_location !== undefined) {
    patch.warehouse_location = input.warehouse_location.trim() || null;
  }

  if (input.last_stock_date !== undefined) {
    patch.last_stock_date = input.last_stock_date;
  }

  if (current) {
    return supabase
      .from('stock')
      .update(patch)
      .eq('id', current.id)
      .select('*')
      .single<StockLevel>();
  }

  return supabase.from('stock').insert(patch).select('*').single<StockLevel>();
}

