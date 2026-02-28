import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/lib/api';
import {
  Globe,
  Server,
  Cloud,
  ShoppingCart,
  AlertTriangle,
  ArrowRight,
  Loader2,
  Mail,
  ShieldCheck,
  Shield,
  Palette,
  DollarSign,
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
        <Loader2 className="w-8 h-8 text-[#064A6C] animate-spin" />
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
      <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white border border-gray-200 rounded-[7px] p-5 hover:shadow-md transition-shadow">
          <div className="w-9 h-9 bg-teal-50 rounded-lg flex items-center justify-center mb-3">
            <Globe className="w-4.5 h-4.5 text-[#064A6C]" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-0.5">{stats?.domains?.total || 0}</h3>
          <p className="text-gray-500 text-xs">Domains</p>
          {stats?.domains?.expiringSoon?.length > 0 && (
            <div className="mt-2 flex items-center gap-1 text-yellow-600 text-xs">
              <AlertTriangle className="w-3 h-3" />
              <span>{stats.domains.expiringSoon.length} expiring</span>
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-[7px] p-5 hover:shadow-md transition-shadow">
          <div className="w-9 h-9 bg-teal-50 rounded-lg flex items-center justify-center mb-3">
            <Server className="w-4.5 h-4.5 text-[#064A6C]" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-0.5">{stats?.hosting?.total || 0}</h3>
          <p className="text-gray-500 text-xs">Hosting</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-[7px] p-5 hover:shadow-md transition-shadow">
          <div className="w-9 h-9 bg-teal-50 rounded-lg flex items-center justify-center mb-3">
            <Cloud className="w-4.5 h-4.5 text-[#064A6C]" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-0.5">{stats?.cloudServers?.total || 0}</h3>
          <p className="text-gray-500 text-xs">Cloud Servers</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-[7px] p-5 hover:shadow-md transition-shadow">
          <div className="w-9 h-9 bg-teal-50 rounded-lg flex items-center justify-center mb-3">
            <Mail className="w-4.5 h-4.5 text-[#064A6C]" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-0.5">{stats?.email?.total || 0}</h3>
          <p className="text-gray-500 text-xs">Email</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-[7px] p-5 hover:shadow-md transition-shadow">
          <div className="w-9 h-9 bg-teal-50 rounded-lg flex items-center justify-center mb-3">
            <Palette className="w-4.5 h-4.5 text-[#064A6C]" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-0.5">{stats?.builder?.total || 0}</h3>
          <p className="text-gray-500 text-xs">Websites</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-[7px] p-5 hover:shadow-md transition-shadow">
          <div className="w-9 h-9 bg-teal-50 rounded-lg flex items-center justify-center mb-3">
            <DollarSign className="w-4.5 h-4.5 text-[#064A6C]" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-0.5">
            ${((stats?.monthlySpendEstimate || 0) / 100).toFixed(2)}
          </h3>
          <p className="text-gray-500 text-xs">Monthly Spend</p>
        </div>
      </div>

      {/* Service Overview Cards */}
      <div className="grid md:grid-cols-3 gap-6">
        <Link to="/dashboard/ssl" className="bg-white border border-gray-200 rounded-[7px] p-6 hover:shadow-md transition-shadow group">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-teal-50 rounded-lg flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-[#064A6C]" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">SSL Certificates</h3>
              <p className="text-xs text-gray-500">{stats?.ssl?.active || 0} active of {stats?.ssl?.total || 0}</p>
            </div>
          </div>
          <p className="text-gray-500 text-sm">Manage your SSL certificates and security</p>
          {stats?.ssl?.expiringSoon?.length > 0 && (
            <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center gap-2 text-yellow-700 text-xs">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{stats.ssl.expiringSoon.length} certificate(s) expiring soon</span>
              </div>
            </div>
          )}
          <span className="text-[#064A6C] text-sm mt-3 btn-arrow-hover">
            View SSL
          </span>
        </Link>

        <Link to="/dashboard/sitelock" className="bg-white border border-gray-200 rounded-[7px] p-6 hover:shadow-md transition-shadow group">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-teal-50 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-[#064A6C]" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">SiteLock</h3>
              <p className="text-xs text-gray-500">{stats?.sitelock?.total || 0} active</p>
            </div>
          </div>
          <p className="text-gray-500 text-sm">Website security scanning and malware protection</p>
          <span className="text-[#064A6C] text-sm mt-3 btn-arrow-hover">
            View SiteLock
          </span>
        </Link>

        <Link to="/dashboard/website-builder" className="bg-white border border-gray-200 rounded-[7px] p-6 hover:shadow-md transition-shadow group">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-teal-50 rounded-lg flex items-center justify-center">
              <Palette className="w-5 h-5 text-[#064A6C]" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Website Builder</h3>
          </div>
          <p className="text-gray-500 text-sm">Build and manage your website projects</p>
          <span className="text-[#064A6C] text-sm mt-3 btn-arrow-hover">
            View Projects
          </span>
        </Link>
      </div>

      {/* Quick Actions */}
      <div className="bg-white border border-gray-200 rounded-[7px] p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link
            to="/domains/search"
            className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group"
          >
            <Globe className="w-5 h-5 text-[#064A6C]" />
            <span className="text-gray-900 flex-1">Search Domains</span>
            <ArrowRight className="w-4 h-4 text-gray-400 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 group-hover:text-[#064A6C] transition-all duration-200" />
          </Link>
          <Link
            to="/dashboard/servers"
            className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group"
          >
            <Cloud className="w-5 h-5 text-[#064A6C]" />
            <span className="text-gray-900 flex-1">Deploy Server</span>
            <ArrowRight className="w-4 h-4 text-gray-400 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 group-hover:text-[#064A6C] transition-all duration-200" />
          </Link>
          <Link
            to="/dashboard/website-builder"
            className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group"
          >
            <Palette className="w-5 h-5 text-[#064A6C]" />
            <span className="text-gray-900 flex-1">Create Website</span>
            <ArrowRight className="w-4 h-4 text-gray-400 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 group-hover:text-[#064A6C] transition-all duration-200" />
          </Link>
          <Link
            to="/dashboard/domains"
            className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group"
          >
            <Globe className="w-5 h-5 text-[#064A6C]" />
            <span className="text-gray-900 flex-1">Manage Domains</span>
            <ArrowRight className="w-4 h-4 text-gray-400 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 group-hover:text-[#064A6C] transition-all duration-200" />
          </Link>
          <Link
            to="/dashboard/hosting"
            className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group"
          >
            <Server className="w-5 h-5 text-[#064A6C]" />
            <span className="text-gray-900 flex-1">Manage Hosting</span>
            <ArrowRight className="w-4 h-4 text-gray-400 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 group-hover:text-[#064A6C] transition-all duration-200" />
          </Link>
          <Link
            to="/dashboard/billing"
            className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group"
          >
            <DollarSign className="w-5 h-5 text-[#064A6C]" />
            <span className="text-gray-900 flex-1">Billing & Credits</span>
            <ArrowRight className="w-4 h-4 text-gray-400 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 group-hover:text-[#064A6C] transition-all duration-200" />
          </Link>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="bg-white border border-gray-200 rounded-[7px] p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Recent Orders</h2>
          <Link to="/dashboard/orders" className="text-[#064A6C] text-sm hover:text-[#053A55]">
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
