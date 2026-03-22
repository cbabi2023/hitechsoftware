interface InventoryStatusBadgeProps {
  isActive: boolean;
}

export function InventoryStatusBadge({ isActive }: InventoryStatusBadgeProps) {
  return isActive ? (
    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
      Active
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-500/20">
      Inactive
    </span>
  );
}
