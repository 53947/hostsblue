import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/lib/api';
import {
  Globe,
  Server,
  ShoppingCart,
  AlertTriangle,
  ArrowRight,
  Loader2,
  Mail,
  ShieldCheck,
  Shield,
  Palette
} from 'lucide-react';
import { Link } from 'react-router-dom';

export function DashboardPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: dashboardApi.getStats,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-[#1844A6] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500">Overview of your domains, hosting, and recent activity</p>
      </div>

      {/* Stats Cards */}
      <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-6">
        <div className="bg-white border border-gray-200 rounded-[7px] p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <Globe className="w-5 h-5 text-[#1844A6]" />
            </div>
            <span className="badge badge-neutral">{stats?.domains?.total || 0} Total</span>
          </div>
          <h3 className="text-3xl font-bold text-gray-900 mb-1">
            {stats?.domains?.total || 0}
          </h3>
          <p className="text-gray-500 text-sm">Active Domains</p>
          {stats?.domains?.expiringSoon?.length > 0 && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center gap-2 text-yellow-700 text-sm">
                <AlertTriangle className="w-4 h-4" />
                <span>{stats.domains.expiringSoon.length} domain(s) expiring soon</span>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-[7px] p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <Server className="w-5 h-5 text-[#1844A6]" />
            </div>
            <span className="badge badge-neutral">{stats?.hosting?.total || 0} Total</span>
          </div>
          <h3 className="text-3xl font-bold text-gray-900 mb-1">
            {stats?.hosting?.total || 0}
          </h3>
          <p className="text-gray-500 text-sm">Hosting Accounts</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-[7px] p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-[#1844A6]" />
            </div>
          </div>
          <h3 className="text-3xl font-bold text-gray-900 mb-1">
            {stats?.recentOrders?.length || 0}
          </h3>
          <p className="text-gray-500 text-sm">Recent Orders</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-[7px] p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <Mail className="w-5 h-5 text-[#1844A6]" />
            </div>
          </div>
          <h3 className="text-3xl font-bold text-gray-900 mb-1">0</h3>
          <p className="text-gray-500 text-sm">Email Accounts</p>
        </div>
      </div>

      {/* Service Overview Cards */}
      <div className="grid md:grid-cols-3 gap-6">
        <Link to="/dashboard/ssl" className="bg-white border border-gray-200 rounded-[7px] p-6 hover:shadow-md transition-shadow group">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-[#1844A6]" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">SSL Certificates</h3>
          </div>
          <p className="text-gray-500 text-sm">Manage your SSL certificates and security</p>
          <span className="text-[#1844A6] text-sm mt-3 inline-flex items-center gap-1 group-hover:underline">
            View SSL <ArrowRight className="w-3 h-3" />
          </span>
        </Link>

        <Link to="/dashboard/sitelock" className="bg-white border border-gray-200 rounded-[7px] p-6 hover:shadow-md transition-shadow group">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-[#1844A6]" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">SiteLock</h3>
          </div>
          <p className="text-gray-500 text-sm">Website security scanning and malware protection</p>
          <span className="text-[#1844A6] text-sm mt-3 inline-flex items-center gap-1 group-hover:underline">
            View SiteLock <ArrowRight className="w-3 h-3" />
          </span>
        </Link>

        <Link to="/dashboard/website-builder" className="bg-white border border-gray-200 rounded-[7px] p-6 hover:shadow-md transition-shadow group">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <Palette className="w-5 h-5 text-[#1844A6]" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Website Builder</h3>
          </div>
          <p className="text-gray-500 text-sm">Build and manage your website projects</p>
          <span className="text-[#1844A6] text-sm mt-3 inline-flex items-center gap-1 group-hover:underline">
            View Projects <ArrowRight className="w-3 h-3" />
          </span>
        </Link>
      </div>

      {/* Quick Actions */}
      <div className="bg-white border border-gray-200 rounded-[7px] p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            to="/domains/search"
            className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group"
          >
            <Globe className="w-5 h-5 text-[#1844A6]" />
            <span className="text-gray-900 flex-1">Search Domains</span>
            <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-gray-900 transition-colors" />
          </Link>
          <Link
            to="/hosting"
            className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group"
          >
            <Server className="w-5 h-5 text-[#1844A6]" />
            <span className="text-gray-900 flex-1">View Hosting Plans</span>
            <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-gray-900 transition-colors" />
          </Link>
          <Link
            to="/dashboard/domains"
            className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group"
          >
            <Globe className="w-5 h-5 text-[#1844A6]" />
            <span className="text-gray-900 flex-1">Manage Domains</span>
            <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-gray-900 transition-colors" />
          </Link>
          <Link
            to="/dashboard/hosting"
            className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group"
          >
            <Server className="w-5 h-5 text-[#1844A6]" />
            <span className="text-gray-900 flex-1">Manage Hosting</span>
            <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-gray-900 transition-colors" />
          </Link>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="bg-white border border-gray-200 rounded-[7px] p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Recent Orders</h2>
          <Link to="/dashboard/orders" className="text-[#1844A6] text-sm hover:text-[#133A8A]">
            View All
          </Link>
        </div>
        {stats?.recentOrders?.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500 border-b border-gray-200">
                  <th className="pb-3 font-medium">Order #</th>
                  <th className="pb-3 font-medium">Date</th>
                  <th className="pb-3 font-medium">Total</th>
                  <th className="pb-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {stats.recentOrders.slice(0, 5).map((order: any) => (
                  <tr key={order.id} className="border-b border-gray-100">
                    <td className="py-4 text-gray-900">{order.orderNumber}</td>
                    <td className="py-4 text-gray-500">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-4 text-gray-900">
                      ${(order.total / 100).toFixed(2)}
                    </td>
                    <td className="py-4">
                      <span className={`badge badge-${
                        order.status === 'completed' ? 'success' :
                        order.status === 'pending' ? 'warning' :
                        order.status === 'failed' ? 'error' : 'neutral'
                      }`}>
                        {order.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">No orders yet</p>
        )}
      </div>
    </div>
  );
}
