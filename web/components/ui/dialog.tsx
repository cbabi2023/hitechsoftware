import React from 'react';

export function Dialog({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div onClick={() => onOpenChange(false)} className="absolute inset-0" />
      <div onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  );
}

export function DialogContent({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto ${className}`}>
      {children}
    </div>
  );
}

export function DialogHeader({ children }: { children: React.ReactNode }) {
  return <div className="p-6 border-b border-gray-200">{children}</div>;
}

export function DialogTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-semibold text-gray-900">{children}</h2>;
}

export function DialogDescription({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-gray-600 mt-1">{children}</p>;
}

export function AlertDialog({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}) {
  return <Dialog open={open} onOpenChange={onOpenChange}>{children}</Dialog>;
}

export function AlertDialogContent({ children }: { children: React.ReactNode }) {
  return <DialogContent>{children}</DialogContent>;
}

export function AlertDialogHeader({ children }: { children: React.ReactNode }) {
  return <DialogHeader>{children}</DialogHeader>;
}

export function AlertDialogTitle({ children }: { children: React.ReactNode }) {
  return <DialogTitle>{children}</DialogTitle>;
}

export function AlertDialogDescription({ children }: { children: React.ReactNode }) {
  return <DialogDescription>{children}</DialogDescription>;
}

export function AlertDialogAction({
  onClick,
  disabled,
  children,
  className = '',
}: {
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${className}`}
    >
      {children}
    </button>
  );
}

export function AlertDialogCancel({ onClick, children }: { onClick?: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
    >
      {children}
    </button>
  );
}
