import type { StockLevel } from '@/modules/inventory/inventory.types';

interface StockBadgeProps {
  stock: StockLevel | null;
  reorderLevel: number;
}

export function StockBadge({ stock, reorderLevel }: StockBadgeProps) {
  if (!stock) {
    return (
      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
        No stock record
      </span>
    );
  }

  const available = stock.quantity_available;
  const isLow = available <= reorderLevel;
  const isOut = available === 0;

  if (isOut) {
    return (
      <span className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-700 ring-1 ring-inset ring-rose-600/20">
        Out of stock
      </span>
    );
  }

  if (isLow) {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
        Low — {available} left
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
      {available} available
    </span>
  );
}
