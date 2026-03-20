import React from 'react';

type TextareaProps = {
  className?: string;
} & React.TextareaHTMLAttributes<HTMLTextAreaElement>;

type InputProps = {
  className?: string;
} & React.InputHTMLAttributes<HTMLInputElement>;

export function Select({ value, onValueChange, children }: { value: string; onValueChange: (val: string) => void; children: React.ReactNode }) {
  return (
    <select
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      {children}
    </select>
  );
}

export function SelectTrigger({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function SelectContent({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function SelectItem({ value, children }: { value: string; children: React.ReactNode }) {
  return <option value={value}>{children}</option>;
}

export function SelectValue({ placeholder: _placeholder }: { placeholder?: string }) {
  return <></>;
}

export function Textarea({
  value,
  onChange,
  placeholder,
  className = '',
  ...props
}: TextareaProps) {
  return (
    <textarea
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
      {...props}
    />
  );
}

export function Input({
  type = 'text',
  value,
  onChange,
  placeholder,
  className = '',
  ...props
}: InputProps) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
      {...props}
    />
  );
}

export function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-medium text-gray-700 mb-1.5">
      {children}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
  );
}

export function Alert({ children, variant = 'default', className = '' }: { children: React.ReactNode; variant?: 'default' | 'destructive'; className?: string }) {
  const baseClasses = 'p-3 border rounded-lg';
  const bgColor = variant === 'destructive' ? 'bg-red-50 border-red-200' : className || 'bg-yellow-50 border-yellow-200';
  return <div className={`${baseClasses} ${bgColor}`}>{children}</div>;
}

export function AlertDescription({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <p className={`text-sm ${className}`}>{children}</p>;
}

export function Progress({ value, className = '' }: { value: number; className?: string }) {
  return (
    <div className={`w-full bg-gray-200 rounded-full h-2 ${className}`}>
      <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${value}%` }} />
    </div>
  );
}
