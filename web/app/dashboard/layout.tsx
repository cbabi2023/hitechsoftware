'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home,
  Users,
  UserCog,
  ClipboardList,
  Package,
  DollarSign,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
  Search,
  Building2,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/lib/constants/routes';

interface DashboardLayoutProps {
  children: ReactNode;
}

const NAV_ITEMS = [
  { icon: Home, label: 'Dashboard', href: ROUTES.DASHBOARD },
  { icon: Users, label: 'Customers', href: ROUTES.DASHBOARD_CUSTOMERS },
  { icon: UserCog, label: 'Team', href: ROUTES.DASHBOARD_TEAM },
  { icon: ClipboardList, label: 'Subjects', href: ROUTES.DASHBOARD_SUBJECTS },
  { icon: Package, label: 'Inventory', href: ROUTES.DASHBOARD_INVENTORY },
  { icon: DollarSign, label: 'Billing', href: '#' },
  { icon: BarChart3, label: 'Reports', href: '#' },
  { icon: Settings, label: 'Settings', href: '#' },
];

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut, isLoading, userRole } = useAuth();

  const currentNavItem =
    NAV_ITEMS.find(
      (item) =>
        item.href !== '#' &&
        (item.href === ROUTES.DASHBOARD
          ? pathname === ROUTES.DASHBOARD
          : pathname === item.href || pathname.startsWith(`${item.href}/`)),
    ) ?? NAV_ITEMS[0];

  const roleLabel = userRole ? userRole.replace('_', ' ') : 'team member';
  const identity = user.email ?? 'user';
  const identityParts = identity.split('@')[0]?.split(/[._-]/).filter(Boolean) ?? [];
  const initials = (identityParts[0]?.[0] ?? 'U') + (identityParts[1]?.[0] ?? 'S');

  const handleLogout = async () => {
    const result = await signOut();
    if (result.ok) {
      router.push(ROUTES.LOGIN);
    }
  };

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ht-page">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-700" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ht-page">
      <header className="sticky top-0 z-40 border-b border-ht-border/90 bg-white/95 backdrop-blur">
        <div className="flex items-center justify-between gap-4 px-4 py-3 md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarExpanded((prev) => !prev)}
              className="rounded-lg border border-ht-border p-2 text-ht-text-700 transition hover:bg-ht-blue-50"
              aria-label={sidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
            >
              {sidebarExpanded ? <X size={18} /> : <Menu size={18} />}
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-ht-blue-50 p-1.5 text-ht-blue-600">
                  <Building2 size={15} />
                </span>
                <p className="truncate text-sm font-semibold tracking-wide text-ht-text-900">Hitech ERP Suite</p>
                <span className="hidden rounded-full border border-ht-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ht-text-500 md:inline-flex">
                  Enterprise
                </span>
              </div>

              <div className="mt-1 flex items-center gap-2 text-xs text-ht-text-500">
                <span>Dashboard</span>
                <ChevronRight size={12} />
                <span className="font-semibold text-ht-text-700">{currentNavItem.label}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            <button
              type="button"
              className="hidden items-center gap-2 rounded-lg border border-ht-border px-3 py-2 text-sm font-medium text-ht-text-500 transition hover:border-ht-border-blue hover:bg-ht-blue-50 hover:text-ht-text-700 md:inline-flex"
              aria-label="Open quick search"
            >
              <Search size={15} />
              <span>Search</span>
            </button>

            <button
              type="button"
              className="rounded-lg border border-ht-border p-2 text-ht-text-600 transition hover:border-ht-border-blue hover:bg-ht-blue-50 hover:text-ht-blue-600"
              aria-label="Notifications"
            >
              <Bell size={17} />
            </button>

            <div className="hidden items-center gap-2 rounded-xl border border-ht-border bg-white px-2 py-1.5 lg:flex">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-ht-navy-900 text-xs font-semibold uppercase tracking-wide text-white">
                {initials}
              </span>
              <div className="text-right">
                <p className="max-w-40 truncate text-sm font-semibold text-ht-text-900">{identity}</p>
                <p className="text-[11px] capitalize text-ht-text-500">{roleLabel}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg border border-ht-border p-2 text-ht-text-700 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        <aside
          className={`min-h-[calc(100vh-4rem)] border-r border-blue-900/40 bg-ht-navy-950 transition-[width] duration-200 ${
            sidebarExpanded ? 'w-72' : 'w-20'
          }`}
        >
          <nav className="space-y-1 p-3">
            {NAV_ITEMS.map((item) => {
              const isActive =
                item.href !== '#' &&
                (item.href === ROUTES.DASHBOARD
                  ? pathname === ROUTES.DASHBOARD
                  : pathname === item.href || pathname.startsWith(`${item.href}/`));

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  title={!sidebarExpanded ? item.label : undefined}
                  aria-current={isActive ? 'page' : undefined}
                  className={`relative flex rounded-xl border text-sm transition ${
                    sidebarExpanded ? 'items-center gap-3 px-3 py-2.5' : 'justify-center px-0 py-3'
                  } ${
                    isActive
                      ? 'border-white/20 bg-white/15 font-semibold text-white shadow-sm'
                      : 'border-transparent font-medium text-blue-200/70 hover:border-white/10 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {isActive ? <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-ht-blue-400" /> : null}
                  <item.icon size={18} />
                  {sidebarExpanded ? <span>{item.label}</span> : <span className="sr-only">{item.label}</span>}
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
