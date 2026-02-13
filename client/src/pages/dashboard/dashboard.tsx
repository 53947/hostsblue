import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/lib/api';
import { 
  Globe, 
  Server, 
  ShoppingCart, 
  AlertTriangle,
  ArrowRight,
  Loader2
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
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-zinc-400">Overview of your domains, hosting, and recent activity</p>
      </div>

      {/* Stats Cards */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="card card-hover">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
              <Globe className="w-5 h-5 text-purple-400" />
            </div>
            <span className="badge badge-neutral">{stats?.domains.total || 0} Total</span>
          </div>
          <h3 className="text-3xl font-bold text-white mb-1">
            {stats?.domains.total || 0}
          </h3>
          <p className="text-zinc-400 text-sm">Active Domains</p>
          {stats?.domains.expiringSoon?.length > 0 && (
            <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <div className="flex items-center gap-2 text-yellow-400 text-sm">
                <AlertTriangle className="w-4 h-4" />
                <span>{stats.domains.expiringSoon.length} domain(s) expiring soon</span>
              </div>
            </div>
          )}
        </div>

        <div className="card card-hover">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
              <Server className="w-5 h-5 text-blue-400" />
            </div>
            <span className="badge badge-neutral">{stats?.hosting.total || 0} Total</span>
          </div>
          <h3 className="text-3xl font-bold text-white mb-1">
            {stats?.hosting.total || 0}
          </h3>
          <p className="text-zinc-400 text-sm">Hosting Accounts</p>
        </div>

        <div className="card card-hover">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-green-400" />
            </div>
          </div>
          <h3 className="text-3xl font-bold text-white mb-1">
            {stats?.recentOrders?.length || 0}
          </h3>
          <p className="text-zinc-400 text-sm">Recent Orders</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            to="/domains/search"
            className="flex items-center gap-3 p-4 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 transition-colors group"
          >
            <Globe className="w-5 h-5 text-purple-400" />
            <span className="text-white flex-1">Search Domains</span>
            <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors" />
          </Link>
          <Link
            to="/hosting"
            className="flex items-center gap-3 p-4 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 transition-colors group"
          >
            <Server className="w-5 h-5 text-blue-400" />
            <span className="text-white flex-1">View Hosting Plans</span>
            <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors" />
          </Link>
          <Link
            to="/dashboard/domains"
            className="flex items-center gap-3 p-4 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 transition-colors group"
          >
            <Globe className="w-5 h-5 text-green-400" />
            <span className="text-white flex-1">Manage Domains</span>
            <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors" />
          </Link>
          <Link
            to="/dashboard/hosting"
            className="flex items-center gap-3 p-4 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 transition-colors group"
          >
            <Server className="w-5 h-5 text-orange-400" />
            <span className="text-white flex-1">Manage Hosting</span>
            <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors" />
          </Link>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Recent Orders</h2>
          <Link to="/dashboard/orders" className="text-purple-400 text-sm hover:text-purple-300">
            View All
          </Link>
        </div>
        {stats?.recentOrders?.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-zinc-500 border-b border-zinc-800">
                  <th className="pb-3 font-medium">Order #</th>
                  <th className="pb-3 font-medium">Date</th>
                  <th className="pb-3 font-medium">Total</th>
                  <th className="pb-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {stats.recentOrders.slice(0, 5).map((order: any) => (
                  <tr key={order.id} className="border-b border-zinc-800/50">
                    <td className="py-4 text-white">{order.orderNumber}</td>
                    <td className="py-4 text-zinc-400">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-4 text-white">
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
          <p className="text-zinc-500 text-center py-8">No orders yet</p>
        )}
      </div>
    </div>
  );
}
