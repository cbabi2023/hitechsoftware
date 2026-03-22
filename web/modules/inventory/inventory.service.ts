import {
  create,
  findAll,
  findById,
  findByItemCode,
  initStockRecord,
  softDelete,
  update,
} from '@/repositories/inventory.repository';
import { adjustStock } from '@/repositories/stock.repository';
import type { ServiceResult } from '@/types/common.types';
import type {
  CreateInventoryInput,
  InventoryListResponse,
  InventoryWithStock,
  StockAdjustmentInput,
  StockLevel,
  UpdateInventoryInput,
} from './inventory.types';
import { INVENTORY_DEFAULT_PAGE_SIZE } from './inventory.constants';
import type { InventoryFilters } from './inventory.types';

export async function getInventoryList(
  filters: InventoryFilters = {},
): Promise<ServiceResult<InventoryListResponse>> {
  const { data, error, count, page, pageSize } = await findAll(filters);

  if (error) {
    return { ok: false, error: { message: error.message, code: error.code } };
  }

  const pageSize_ = pageSize ?? INVENTORY_DEFAULT_PAGE_SIZE;

  return {
    ok: true,
    data: {
      data: data ?? [],
      total: count,
      page,
      page_size: pageSize_,
      total_pages: Math.ceil(count / pageSize_),
    },
  };
}

export async function getInventoryById(
  id: string,
): Promise<ServiceResult<InventoryWithStock>> {
  const { data, error } = await findById(id);

  if (error) {
    return { ok: false, error: { message: error.message, code: error.code } };
  }

  if (!data) {
    return { ok: false, error: { message: 'Inventory item not found', code: 'NOT_FOUND' } };
  }

  return { ok: true, data };
}

export async function createInventoryItem(
  input: CreateInventoryInput,
): Promise<ServiceResult<InventoryWithStock>> {
  const { data: existing, error: codeError } = await findByItemCode(input.item_code.toUpperCase());

  if (codeError) {
    return { ok: false, error: { message: codeError.message, code: codeError.code } };
  }

  if (existing) {
    return {
      ok: false,
      error: { message: `Item code "${input.item_code.toUpperCase()}" is already in use`, code: 'DUPLICATE_CODE' },
    };
  }

  const { data: item, error: createError } = await create(input);

  if (createError || !item) {
    return {
      ok: false,
      error: { message: createError?.message ?? 'Failed to create inventory item', code: createError?.code },
    };
  }

  // Initialize stock record for the new item — ignore failure (stock is optional)
  await initStockRecord(item.id);

  const { data: withStock } = await findById(item.id);

  return { ok: true, data: withStock ?? { ...item, stock: null } };
}

export async function updateInventoryItem(
  id: string,
  input: UpdateInventoryInput,
): Promise<ServiceResult<InventoryWithStock>> {
  if (input.item_code) {
    const { data: existing, error: codeError } = await findByItemCode(
      input.item_code.toUpperCase(),
      id,
    );

    if (codeError) {
      return { ok: false, error: { message: codeError.message, code: codeError.code } };
    }

    if (existing) {
      return {
        ok: false,
        error: {
          message: `Item code "${input.item_code.toUpperCase()}" is already in use`,
          code: 'DUPLICATE_CODE',
        },
      };
    }
  }

  const { data: item, error: updateError } = await update(id, input);

  if (updateError || !item) {
    return {
      ok: false,
      error: {
        message: updateError?.message ?? 'Failed to update inventory item',
        code: updateError?.code,
      },
    };
  }

  const { data: withStock } = await findById(item.id);

  return { ok: true, data: withStock ?? { ...item, stock: null } };
}

export async function deleteInventoryItem(id: string): Promise<ServiceResult<void>> {
  const { error } = await softDelete(id);

  if (error) {
    return { ok: false, error: { message: error.message, code: error.code } };
  }

  return { ok: true, data: undefined };
}

export async function adjustInventoryStock(
  inventoryId: string,
  input: StockAdjustmentInput,
): Promise<ServiceResult<StockLevel>> {
  const { data, error } = await adjustStock(inventoryId, input);

  if (error) {
    return {
      ok: false,
      error: { message: (error as { message: string }).message, code: (error as { code?: string }).code },
    };
  }

  if (!data) {
    return { ok: false, error: { message: 'Failed to adjust stock', code: 'UNEXPECTED' } };
  }

  return { ok: true, data };
}

