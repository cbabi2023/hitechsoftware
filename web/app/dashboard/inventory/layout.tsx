'use client';

/**
 * @file layout.tsx
 * @module app/dashboard/inventory
 *
 * @description
 * Shared layout wrapper for all pages under /dashboard/inventory.
 *
 * WHY A SHARED LAYOUT?
 * --------------------
 * Next.js App Router `layout.tsx` files wrap every child route within the same
 * directory. Any UI placed here appears on ALL inventory sub-pages without
 * being re-mounted on navigation — this makes it ideal for the sub-navigation
 * tab bar.
 *
 * WHAT THIS PRODUCES
 * ------------------
 *  _______________________________________________________
 * |  Products  |  Categories  |  Product Types  |  Stock |
 * |------------------------------------------------------- |
 * |  { child page content here }                          |
 * |_______________________________________________________|
 *
 * ACTIVE TAB DETECTION
 * --------------------
 * `usePathname()` returns the current URL path (e.g. '/dashboard/inventory/categories').
 * Each tab link is "active" if:
 *   pathname === href         (exact match for top-level tabs)
 *   pathname.startsWith(href + '/')  (catches nested routes like /products/new)
 *
 * This prevents false positives — e.g. '/dashboard/inventory/product-types'
 * should NOT activate the 'Products' tab even though it starts with '/products'.
 *
 * ACCESSIBILITY
 * -------------
 * `aria-current="page"` is applied to the active tab for screen readers.
 * The wrapping `<nav>` has `aria-label="Inventory sections"` for landmark navigation.
 */

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, Tags, Package, ClipboardList } from 'lucide-react';
import { ROUTES } from '@/lib/constants/routes';

interface InventoryLayoutProps {
  children: ReactNode;
}

/**
 * Navigation tab definitions.
 * Each item has a route constant (from ROUTES), a display label, and a Lucide icon.
 * To add a new section, simply add another object here.
 */
const INVENTORY_NAV = [
  { label: 'Products', href: ROUTES.DASHBOARD_INVENTORY_PRODUCTS, icon: Package },
  { label: 'Categories', href: ROUTES.DASHBOARD_INVENTORY_CATEGORIES, icon: LayoutGrid },
  { label: 'Product Types', href: ROUTES.DASHBOARD_INVENTORY_PRODUCT_TYPES, icon: Tags },
  { label: 'Stock Entries', href: ROUTES.DASHBOARD_INVENTORY_STOCK, icon: ClipboardList },
];

export default function InventoryLayout({ children }: InventoryLayoutProps) {
  // Get the current URL path to highlight the active tab
  const pathname = usePathname();

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col">
      {/* Sub-navigation: horizontal tab bar linking to each inventory section */}
      <div className="border-b border-slate-200 bg-white px-6">
        <nav className="flex gap-1 overflow-x-auto" aria-label="Inventory sections">
          {INVENTORY_NAV.map(({ label, href, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                aria-current={isActive ? 'page' : undefined}
                className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
                }`}
              >
                <Icon size={15} />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Page content */}
      <div className="flex-1 bg-ht-page">{children}</div>
    </div>
  );
}
