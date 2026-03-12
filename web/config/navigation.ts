export interface NavItem {
  label: string;
  href: string;
  permission: string;
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', permission: 'customers:read' },
  { label: 'Customers', href: '/dashboard/customers', permission: 'customers:read' },
  { label: 'Subjects', href: '/dashboard/subjects', permission: 'subjects:read' },
  { label: 'Inventory', href: '/dashboard/inventory', permission: 'inventory:read' },
  { label: 'Billing', href: '/dashboard/billing', permission: 'billing:read' },
];
