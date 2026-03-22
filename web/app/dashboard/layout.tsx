'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
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
  PanelLeftClose,
  PanelLeftOpen,
  Bell,
  CalendarDays,
  Building2,
  Shapes,
  Tags,
  Store,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/hooks/auth/useAuth';
import { ROUTES } from '@/lib/constants/routes';
import { ROLES } from '@/lib/constants/roles';
import { AppLoadingScreen } from '@/components/ui/AppLoadingScreen';
import type { UserRole } from '@/types/database.types';

interface DashboardLayoutProps {
  children: ReactNode;
}

const NAV_ITEMS = [
  { icon: Home, label: 'Dashboard', href: ROUTES.DASHBOARD, isAvailable: true },
  { icon: CalendarDays, label: 'Attendance', href: ROUTES.DASHBOARD_ATTENDANCE, isAvailable: true, allowedRoles: ['technician'] as UserRole[] },
  { icon: ClipboardList, label: 'Service Module', href: ROUTES.DASHBOARD_SUBJECTS, isAvailable: true },
  { icon: Users, label: 'Customers', href: ROUTES.DASHBOARD_CUSTOMERS, isAvailable: true },
  { icon: UserCog, label: 'Team', href: ROUTES.DASHBOARD_TEAM, isAvailable: true },
  { icon: Package, label: 'Inventory', href: ROUTES.DASHBOARD_INVENTORY, isAvailable: true },
  { icon: DollarSign, label: 'Billing', href: '#', isAvailable: false },
  { icon: BarChart3, label: 'Reports', href: '#', isAvailable: false },
  { icon: Settings, label: 'Settings', href: '#', isAvailable: false },
];

const SERVICE_MODULE_ITEMS = [
  { icon: ClipboardList, label: 'Service List', href: ROUTES.DASHBOARD_SUBJECTS, superAdminOnly: false },
  { icon: Shapes, label: 'Service Categories', href: ROUTES.DASHBOARD_SERVICE_CATEGORIES, superAdminOnly: true },
  { icon: Tags, label: 'Brands', href: ROUTES.DASHBOARD_SERVICE_BRANDS, superAdminOnly: true },
  { icon: Store, label: 'Dealers', href: ROUTES.DASHBOARD_SERVICE_DEALERS, superAdminOnly: true },
];

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [serviceMenuExpanded, setServiceMenuExpanded] = useState(true);
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut, isLoading, isHydrated, userRole } = useAuth();

  const ALLOWED_DASHBOARD_ROLES: string[] = [
    ROLES.SUPER_ADMIN,
    ROLES.OFFICE_STAFF,
    ROLES.TECHNICIAN,
    ROLES.STOCK_MANAGER
  ];
  const isReady = isHydrated && !isLoading;
  const isUnauthenticated = isReady && !user;
  const isUnauthorized = isReady && !!user && (!userRole || !ALLOWED_DASHBOARD_ROLES.includes(userRole));

  useEffect(() => {
    if (isUnauthenticated) {
      router.replace(ROUTES.LOGIN);
    } else if (isUnauthorized) {
      console.warn('[DashboardLayout] Unauthorized role access attempt:', {
        userId: user?.id,
        userRole,
        allowedRoles: ALLOWED_DASHBOARD_ROLES
      });
      router.replace(`${ROUTES.LOGIN}?error=unauthorized`);
    }
  }, [isUnauthenticated, isUnauthorized, router, userRole, user?.id]);

  const handleLogout = async () => {
    const result = await signOut();
    if (result.ok) {
      router.push(ROUTES.LOGIN);
    }
  };

  // Guard 1 — Loading: show loading screen until auth hydration completes
  if (isLoading || !isHydrated) {
    return <AppLoadingScreen />;
  }

  // Guard 2 — Authentication: show loading while useEffect fires the redirect
  if (!user) {
    return <AppLoadingScreen />;
  }

  // Guard 3 — Role: show loading while useEffect fires the redirect
  if (!userRole || !ALLOWED_DASHBOARD_ROLES.includes(userRole)) {
    return <AppLoadingScreen />;
  }

  const roleLabel = userRole ? userRole.replace('_', ' ') : 'team member';
  const identity = user.email ?? 'user';
  const firstNameMeta = String(user.user_metadata?.first_name ?? '').trim();
  const lastNameMeta = String(user.user_metadata?.last_name ?? '').trim();
  const fullNameMeta = String(user.user_metadata?.full_name ?? user.user_metadata?.name ?? '').trim();
  const emailParts = identity.split('@')[0]?.split(/[._-]/).filter(Boolean) ?? [];
  const fullNameParts = fullNameMeta.split(/\s+/).filter(Boolean);
  const firstInitial = (firstNameMeta[0] ?? fullNameParts[0]?.[0] ?? emailParts[0]?.[0] ?? 'U').toUpperCase();
  const lastInitial = (lastNameMeta[0] ?? fullNameParts[1]?.[0] ?? emailParts[1]?.[0] ?? firstInitial).toUpperCase();
  const initials = `${firstInitial}${lastInitial}`;
  const visibleServiceItems = SERVICE_MODULE_ITEMS.filter((item) => !item.superAdminOnly || userRole === 'super_admin');
  const isSuperAdmin = userRole === 'super_admin';
  const isServiceModuleActive =
    pathname === ROUTES.DASHBOARD_SUBJECTS ||
    pathname.startsWith(`${ROUTES.DASHBOARD_SUBJECTS}/`) ||
    pathname.startsWith('/dashboard/service/');

  return (
    <div className="min-h-screen bg-ht-page">
      <header className="sticky top-0 z-40 border-b border-ht-border/90 bg-gradient-to-r from-white to-ht-blue-50/30 shadow-[0_1px_0_0_rgba(15,23,42,0.03)]">
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarExpanded((prev) => !prev)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-ht-border text-ht-text-700/65 transition hover:border-ht-border-blue hover:bg-ht-blue-50 hover:text-ht-text-700"
              aria-label={sidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
            >
              {sidebarExpanded ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
            </button>

            <div className="min-w-0 rounded-xl border border-ht-border/70 bg-white/90 px-2.5 py-1.5 backdrop-blur">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-ht-blue-100 bg-gradient-to-br from-white to-ht-blue-50 text-ht-blue-600 shadow-sm">
                  <Building2 size={16} />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ht-text-900">Hi Tech Software</p>
                  <p className="truncate text-[10px] font-medium tracking-[0.2em] text-ht-text-500 uppercase">Operations Console</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-ht-border text-ht-text-600 transition hover:border-ht-border-blue hover:bg-ht-blue-50 hover:text-ht-blue-600"
              aria-label="Notifications"
            >
              <Bell size={17} />
            </button>

            <div className="hidden h-7 w-px bg-ht-border md:block" />

            <div className="hidden items-center gap-2 rounded-lg border border-ht-border bg-white px-2 py-1.5 shadow-[0_1px_1px_rgba(15,23,42,0.04)] md:flex">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-ht-navy-900 to-ht-navy-800 text-xs font-semibold uppercase tracking-wide text-white">
                {initials}
              </span>
              <div className="text-right">
                <p className="max-w-44 truncate text-sm font-semibold text-ht-text-900">{identity}</p>
                <p className="text-[11px] capitalize text-ht-text-500">{roleLabel}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-ht-border text-ht-text-700 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
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
            sidebarExpanded ? 'w-[260px]' : 'w-20'
          }`}
        >
          <nav className="space-y-1 p-3">
            {NAV_ITEMS.map((item) => {
              if (item.allowedRoles && (!userRole || !item.allowedRoles.includes(userRole))) {
                return null;
              }

              const isActive =
                item.href === ROUTES.DASHBOARD_SUBJECTS
                  ? isServiceModuleActive
                  : item.href !== '#' &&
                    (item.href === ROUTES.DASHBOARD
                      ? pathname === ROUTES.DASHBOARD
                      : pathname === item.href || pathname.startsWith(`${item.href}/`));

              return (
                <div key={item.label} className="space-y-1">
                  {item.href === ROUTES.DASHBOARD_SUBJECTS && sidebarExpanded && isSuperAdmin ? (
                    <div className="flex items-center gap-1">
                      <Link
                        href={item.href}
                        title={!sidebarExpanded ? item.label : undefined}
                        aria-current={isActive ? 'page' : undefined}
                        className={`relative flex flex-1 items-center gap-3 rounded-xl border px-3.5 py-3 text-[13px] transition ${
                          isActive
                            ? 'border-white/20 bg-white/15 font-semibold text-white shadow-sm'
                            : 'border-transparent font-medium text-blue-200/70 hover:border-white/10 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        {isActive ? <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-ht-blue-400" /> : null}
                        <item.icon size={18} />
                        <span className="whitespace-nowrap">{item.label}</span>
                      </Link>

                      <button
                        type="button"
                        onClick={() => setServiceMenuExpanded((prev) => !prev)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-transparent text-blue-200/80 transition hover:border-white/10 hover:bg-white/10 hover:text-white"
                        aria-label={serviceMenuExpanded ? 'Collapse service submenu' : 'Expand service submenu'}
                        title={serviceMenuExpanded ? 'Collapse' : 'Expand'}
                      >
                        {serviceMenuExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </button>
                    </div>
                  ) : item.isAvailable ? (
                    <Link
                      href={item.href}
                      title={!sidebarExpanded ? item.label : undefined}
                      aria-current={isActive ? 'page' : undefined}
                      className={`relative flex rounded-xl border text-sm transition ${
                        sidebarExpanded ? 'items-center gap-3 px-3.5 py-3' : 'justify-center px-0 py-3.5'
                      } ${
                        isActive
                          ? 'border-white/20 bg-white/15 font-semibold text-white shadow-sm'
                          : 'border-transparent font-medium text-blue-200/70 hover:border-white/10 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {isActive ? <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-ht-blue-400" /> : null}
                      <item.icon size={18} />
                      {sidebarExpanded ? <span className="whitespace-nowrap text-[13px]">{item.label}</span> : <span className="sr-only">{item.label}</span>}
                    </Link>
                  ) : (
                    <div
                      title={!sidebarExpanded ? item.label : undefined}
                      className={`relative flex rounded-xl border border-transparent text-sm ${
                        sidebarExpanded ? 'items-center gap-3 px-3.5 py-3' : 'justify-center px-0 py-3.5'
                      } pointer-events-none opacity-40 text-blue-200/80`}
                    >
                      <item.icon size={18} />
                      {sidebarExpanded ? (
                        <span className="whitespace-nowrap text-[13px]">{item.label}</span>
                      ) : (
                        <span className="sr-only">{item.label}</span>
                      )}
                    </div>
                  )}

                  {item.href === ROUTES.DASHBOARD_SUBJECTS && sidebarExpanded && isSuperAdmin && serviceMenuExpanded ? (
                    <div className="ml-4 space-y-1 border-l border-white/10 pl-3">
                      {visibleServiceItems.map((serviceItem) => {
                        const isServiceItemActive = pathname === serviceItem.href || pathname.startsWith(`${serviceItem.href}/`);

                        return (
                          <Link
                            key={serviceItem.label}
                            href={serviceItem.href}
                            aria-current={isServiceItemActive ? 'page' : undefined}
                            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
                              isServiceItemActive
                                ? 'bg-white/10 font-semibold text-white'
                                : 'text-blue-200/70 hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            <serviceItem.icon size={15} />
                            <span className="whitespace-nowrap">{serviceItem.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </nav>
        </aside>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
