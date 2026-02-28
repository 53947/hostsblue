import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Users, Globe, Server, Cloud, Palette, DollarSign,
  ShoppingCart, Plus, Headphones, Loader2,
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '';
async function adminFetch<T>(endpoint: string): Promise<T> {
  const res = await fetch(`${API_URL}/api/v1${endpoint}`, { credentials: 'include' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch');
  return data.data;
}

export function PanelOverviewPage() {
  const { data: panelStats, isLoading } = useQuery({
    queryKey: ['panel', 'overview-stats'],
    queryFn: () => adminFetch<any>('/admin/overview'),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-[#064A6C] animate-spin" />
      </div>
    );
  }

  const stats = [
    {
      label: 'Customers',
      value: panelStats?.customers?.toLocaleString() || '0',
      icon: Users,
      iconBg: 'bg-blue-50',
      iconColor: 'text-[#1844A6]',
      link: '/panel/customers',
    },
    {
      label: 'Domains',
      value: panelStats?.domains?.toLocaleString() || '0',
      icon: Globe,
      iconBg: 'bg-teal-50',
      iconColor: 'text-[#064A6C]',
      link: '/panel/domains',
    },
    {
      label: 'Hosting',
      value: panelStats?.hosting?.toLocaleString() || '0',
      icon: Server,
      iconBg: 'bg-green-50',
      iconColor: 'text-[#10B981]',
      link: '/panel/hosting',
    },
    {
      label: 'Cloud Servers',
      value: panelStats?.cloudServers?.toLocaleString() || '0',
      icon: Cloud,
      iconBg: 'bg-purple-50',
      iconColor: 'text-purple-600',
      link: '/panel/cloud',
    },
    {
      label: 'Websites',
      value: panelStats?.builderProjects?.toLocaleString() || '0',
      icon: Palette,
      iconBg: 'bg-orange-50',
      iconColor: 'text-orange-600',
      link: '/panel/builder',
    },
    {
      label: 'Monthly Revenue',
      value: `$${((panelStats?.monthlyRevenue || 0) / 100).toFixed(0)}`,
      icon: DollarSign,
      iconBg: 'bg-yellow-50',
      iconColor: 'text-[#D97706]',
      link: '/panel/revenue',
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#09080E]">Overview</h1>
        <p className="text-[#4B5563]">Welcome to the hostsblue admin panel</p>
      </div>

      {/* Stat Cards */}
      <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link
              key={stat.label}
              to={stat.link}
              className="bg-white border border-[#E5E7EB] rounded-[7px] p-5 hover:shadow-md transition-shadow"
            >
              <div className={`w-9 h-9 ${stat.iconBg} rounded-lg flex items-center justify-center mb-3`}>
                <Icon className={`w-4.5 h-4.5 ${stat.iconColor}`} />
              </div>
              <h3 className="text-2xl font-bold text-[#09080E] mb-0.5">{stat.value}</h3>
              <p className="text-[#4B5563] text-xs">{stat.label}</p>
            </Link>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="flex items-center gap-3">
        <Link
          to="/panel/customers"
          className="bg-[#064A6C] hover:bg-[#053A55] text-white font-medium px-4 py-2.5 rounded-[7px] transition-colors flex items-center gap-2 text-sm"
        >
          <Plus className="w-4 h-4" />
          Add Customer
        </Link>
        <Link
          to="/panel/orders"
          className="bg-white border border-[#E5E7EB] hover:bg-gray-50 text-[#09080E] font-medium px-4 py-2.5 rounded-[7px] transition-colors flex items-center gap-2 text-sm"
        >
          <ShoppingCart className="w-4 h-4" />
          Create Order
        </Link>
        <Link
          to="/panel/support"
          className="bg-white border border-[#E5E7EB] hover:bg-gray-50 text-[#09080E] font-medium px-4 py-2.5 rounded-[7px] transition-colors flex items-center gap-2 text-sm"
        >
          <Headphones className="w-4 h-4" />
          View Support Queue
        </Link>
      </div>

      {/* Recent Orders */}
      {panelStats?.recentOrders && panelStats.recentOrders.length > 0 && (
        <div className="bg-white border border-[#E5E7EB] rounded-[7px] p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-teal-50 rounded-lg flex items-center justify-center">
                <ShoppingCart className="w-5 h-5 text-[#064A6C]" />
              </div>
              <h2 className="text-lg font-semibold text-[#09080E]">Recent Orders</h2>
            </div>
            <Link to="/panel/orders" className="text-sm text-[#064A6C] hover:text-[#053A55] font-medium">
              View All
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-[#4B5563] border-b border-[#E5E7EB]">
                  <th className="pb-3 font-medium">Order #</th>
                  <th className="pb-3 font-medium">Customer</th>
                  <th className="pb-3 font-medium">Total</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {panelStats.recentOrders.map((order: any) => (
                  <tr key={order.id || order.orderNumber} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="py-3 text-sm font-medium text-[#064A6C]">{order.orderNumber}</td>
                    <td className="py-3 text-sm text-[#09080E]">{order.customerEmail || '—'}</td>
                    <td className="py-3 text-sm font-medium text-[#09080E]">${((order.total || 0) / 100).toFixed(2)}</td>
                    <td className="py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        order.status === 'completed' ? 'bg-[#10B981] text-white' :
                        order.status === 'pending' || order.status === 'pending_payment' ? 'bg-[#FFD700] text-[#09080E]' :
                        order.status === 'failed' ? 'bg-[#DC2626] text-white' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {order.status?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 text-sm text-[#4B5563]">{order.createdAt ? new Date(order.createdAt).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
