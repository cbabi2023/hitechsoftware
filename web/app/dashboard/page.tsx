'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart3,
  Users,
  Package,
  DollarSign,
  LogOut,
  Menu,
  X,
  Home,
  Settings,
  ClipboardList,
  Zap,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useState } from 'react';

interface DashboardStats {
  activeServices: number;
  technicians: number;
  inventory: number;
  revenue: string;
}

export default function DashboardPage() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const router = useRouter();
  const { user, signOut, isLoading, userRole } = useAuth();

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  const handleLogout = async () => {
    const result = await signOut();
    if (result.ok) {
      router.push('/login');
    }
  };

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const stats: DashboardStats = {
    activeServices: 47,
    technicians: 12,
    inventory: 328,
    revenue: '₹2,45,000',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-40">
        <div className="flex items-center justify-between h-16 px-6">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-slate-100 rounded-lg transition"
            >
              {sidebarOpen ? (
                <X size={20} className="text-slate-600" />
              ) : (
                <Menu size={20} className="text-slate-600" />
              )}
            </button>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold">HT</span>
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900">Hitech Software</h1>
                <p className="text-xs text-slate-500">Service Management System</p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="text-right">
              <p className="text-sm font-medium text-slate-900">{user?.email}</p>
              <p className="text-xs text-slate-500 capitalize">{userRole?.replace('_', ' ')}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 hover:bg-red-50 rounded-lg transition text-red-600 hover:text-red-700"
              title="Logout"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        {sidebarOpen && (
          <aside className="w-64 bg-slate-900 text-white shadow-lg">
            <nav className="p-4 space-y-2">
              {[
                { icon: Home, label: 'Dashboard', href: '#' },
                { icon: ClipboardList, label: 'Services', href: '#' },
                { icon: Users, label: 'Technicians', href: '#' },
                { icon: Package, label: 'Inventory', href: '#' },
                { icon: DollarSign, label: 'Billing', href: '#' },
                { icon: Zap, label: 'Warranty & AMC', href: '#' },
                { icon: BarChart3, label: 'Reports', href: '#' },
                { icon: Settings, label: 'Settings', href: '#' },
              ].map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className="flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-slate-800 transition"
                >
                  <item.icon size={20} />
                  <span>{item.label}</span>
                </a>
              ))}
            </nav>

            <div className="border-t border-slate-700 p-4 mt-auto">
              <p className="text-xs text-slate-400">Version 1.0.0</p>
              <p className="text-xs text-slate-400">© 2026 Hitech</p>
            </div>
          </aside>
        )}

        {/* Main Content */}
        <main className="flex-1 p-6 overflow-auto">
          {/* Welcome Section */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-slate-900 mb-2">Welcome back, {user?.user_metadata?.display_name || 'User'}! 👋</h2>
            <p className="text-slate-600">Here's what's happening with your service management system today.</p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[
              {
                icon: ClipboardList,
                label: 'Active Services',
                value: stats.activeServices,
                color: 'blue',
                bgColor: 'bg-blue-50',
                iconColor: 'text-blue-600',
              },
              {
                icon: Users,
                label: 'Technicians',
                value: stats.technicians,
                color: 'green',
                bgColor: 'bg-green-50',
                iconColor: 'text-green-600',
              },
              {
                icon: Package,
                label: 'Inventory Items',
                value: stats.inventory,
                color: 'purple',
                bgColor: 'bg-purple-50',
                iconColor: 'text-purple-600',
              },
              {
                icon: DollarSign,
                label: 'Today\'s Revenue',
                value: stats.revenue,
                color: 'orange',
                bgColor: 'bg-orange-50',
                iconColor: 'text-orange-600',
              },
            ].map((stat, index) => (
              <div
                key={index}
                className={`${stat.bgColor} rounded-xl p-6 border border-slate-200 hover:shadow-lg transition`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-600 text-sm font-medium">{stat.label}</p>
                    <p className="text-3xl font-bold text-slate-900 mt-2">{stat.value}</p>
                  </div>
                  <div className={`${stat.iconColor} bg-white rounded-lg p-3`}>
                    <stat.icon size={24} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Content Sections */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recent Services */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900">Recent Services</h3>
                <a href="#" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                  View all
                </a>
              </div>

              <div className="space-y-3">
                {[
                  { id: 'SRV001', customer: 'Rajesh Kumar', status: 'In Progress', date: 'Today' },
                  { id: 'SRV002', customer: 'Priya Singh', status: 'Completed', date: 'Yesterday' },
                  { id: 'SRV003', customer: 'Amit Patel', status: 'Pending', date: '2 days ago' },
                ].map((service) => (
                  <div
                    key={service.id}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition"
                  >
                    <div>
                      <p className="font-medium text-slate-900">{service.id}</p>
                      <p className="text-sm text-slate-600">{service.customer}</p>
                    </div>
                    <div className="text-right">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                          service.status === 'Completed'
                            ? 'bg-green-100 text-green-800'
                            : service.status === 'In Progress'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {service.status}
                      </span>
                      <p className="text-xs text-slate-500 mt-1">{service.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Quick Actions</h3>

              <div className="space-y-3">
                {[
                  { label: 'Create Service', icon: ClipboardList, color: 'blue' },
                  { label: 'Assign Technician', icon: Users, color: 'green' },
                  { label: 'Generate Invoice', icon: DollarSign, color: 'orange' },
                  { label: 'Update Inventory', icon: Package, color: 'purple' },
                ].map((action, index) => (
                  <button
                    key={index}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg border border-slate-200 hover:border-${action.color}-300 hover:bg-${action.color}-50 transition text-left`}
                  >
                    <action.icon
                      size={20}
                      className={`text-${action.color}-600`}
                    />
                    <span className="text-sm font-medium text-slate-700">{action.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Performance Chart Section */}
          <div className="mt-6 bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">Performance Overview</h3>
              <TrendingUp className="text-green-600" size={24} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { label: 'Services Completed', value: '156', growth: '+12%' },
                { label: 'Customer Satisfaction', value: '94%', growth: '+5%' },
                { label: 'Technician Utilization', value: '87%', growth: '+8%' },
              ].map((metric, index) => (
                <div key={index} className="text-center p-4 bg-slate-50 rounded-lg">
                  <p className="text-slate-600 text-sm font-medium">{metric.label}</p>
                  <p className="text-3xl font-bold text-slate-900 mt-2">{metric.value}</p>
                  <p className="text-xs text-green-600 font-semibold mt-2">{metric.growth} from last month</p>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
