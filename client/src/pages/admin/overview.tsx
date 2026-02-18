import {
  Users,
  Globe,
  Server,
  DollarSign,
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  Headphones,
} from 'lucide-react';

const stats = [
  {
    label: 'Total Customers',
    value: '0',
    change: '+0%',
    trend: 'up' as const,
    icon: Users,
    iconBg: 'bg-blue-50',
    iconColor: 'text-[#1844A6]',
  },
  {
    label: 'Active Domains',
    value: '0',
    change: '+0%',
    trend: 'up' as const,
    icon: Globe,
    iconBg: 'bg-teal-50',
    iconColor: 'text-[#064A6C]',
  },
  {
    label: 'Hosting Accounts',
    value: '0',
    change: '+0%',
    trend: 'up' as const,
    icon: Server,
    iconBg: 'bg-green-50',
    iconColor: 'text-[#10B981]',
  },
  {
    label: 'Monthly Revenue',
    value: '$0.00',
    change: '+0%',
    trend: 'up' as const,
    icon: DollarSign,
    iconBg: 'bg-yellow-50',
    iconColor: 'text-[#FFD700]',
  },
];

export function AdminOverviewPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#09080E]">Overview</h1>
        <p className="text-[#4B5563]">Welcome to the hostsblue admin dashboard</p>
      </div>

      {/* Stat Cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="bg-white border border-[#E5E7EB] rounded-[7px] p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`w-10 h-10 ${stat.iconBg} rounded-lg flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${stat.iconColor}`} />
                </div>
                <div className="flex items-center gap-1 text-sm">
                  {stat.trend === 'up' ? (
                    <TrendingUp className="w-4 h-4 text-[#10B981]" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-[#DC2626]" />
                  )}
                  <span className={stat.trend === 'up' ? 'text-[#10B981]' : 'text-[#DC2626]'}>
                    {stat.change}
                  </span>
                </div>
              </div>
              <h3 className="text-3xl font-bold text-[#09080E] mb-1">{stat.value}</h3>
              <p className="text-[#4B5563] text-sm">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {/* Recent Orders */}
      <div className="bg-white border border-[#E5E7EB] rounded-[7px] p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-teal-50 rounded-lg flex items-center justify-center">
            <ShoppingCart className="w-5 h-5 text-[#064A6C]" />
          </div>
          <h2 className="text-lg font-semibold text-[#09080E]">Recent Orders</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-[#4B5563] border-b border-[#E5E7EB]">
                <th className="pb-3 font-medium">Order #</th>
                <th className="pb-3 font-medium">Customer</th>
                <th className="pb-3 font-medium">Items</th>
                <th className="pb-3 font-medium">Total</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={6} className="text-center py-12 text-[#4B5563]">
                  No orders yet
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Support Tickets */}
      <div className="bg-white border border-[#E5E7EB] rounded-[7px] p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-teal-50 rounded-lg flex items-center justify-center">
            <Headphones className="w-5 h-5 text-[#064A6C]" />
          </div>
          <h2 className="text-lg font-semibold text-[#09080E]">Recent Support Tickets</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-[#4B5563] border-b border-[#E5E7EB]">
                <th className="pb-3 font-medium">Ticket #</th>
                <th className="pb-3 font-medium">Subject</th>
                <th className="pb-3 font-medium">Customer</th>
                <th className="pb-3 font-medium">Priority</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={6} className="text-center py-12 text-[#4B5563]">
                  No tickets
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
