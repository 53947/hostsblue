import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { panelApi } from '@/lib/api';
import { DollarSign, TrendingUp, TrendingDown, BarChart3, Users, Loader2 } from 'lucide-react';

const SERVICE_COLORS: Record<string, string> = {
  domain_registration: '#064A6C',
  hosting_plan: '#1844A6',
  email_service: '#10B981',
  ssl_certificate: '#FFD700',
  website_builder: '#8B5CF6',
  cloud_hosting: '#3B82F6',
  ai_credits: '#F97316',
  other: '#9CA3AF',
};

const SERVICE_LABELS: Record<string, string> = {
  domain_registration: 'Domains',
  hosting_plan: 'Hosting',
  email_service: 'Email',
  ssl_certificate: 'SSL',
  website_builder: 'Builder',
  cloud_hosting: 'Cloud',
  ai_credits: 'AI Credits',
  other: 'Other',
};

const PERIODS = [
  { value: '30d', label: '30 Days' },
  { value: '90d', label: '90 Days' },
  { value: '12m', label: '12 Months' },
  { value: 'all', label: 'All Time' },
];

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function PanelRevenuePage() {
  const [period, setPeriod] = useState('30d');

  const { data, isLoading } = useQuery({
    queryKey: ['panel-revenue', period],
    queryFn: () => panelApi.getRevenue(period),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-[#064A6C] animate-spin" />
      </div>
    );
  }

  const mrr = data?.mrr ?? 0;
  const mrrChange = data?.mrrChange ?? 0;
  const arr = data?.arr ?? 0;
  const arpc = data?.arpc ?? 0;
  const churnRate = data?.churnRate ?? 0;
  const chartData: { date: string; revenue: number }[] = data?.chartData ?? [];
  const byService: { type: string; revenue: number }[] = data?.byService ?? [];
  const transactions: {
    id: number;
    orderNumber: string;
    total: number;
    status: string;
    createdAt: string;
    customerName: string;
  }[] = data?.transactions ?? [];

  const maxRevenue = chartData.length > 0 ? Math.max(...chartData.map((d) => d.revenue)) : 1;
  const totalServiceRevenue = byService.reduce((sum, s) => sum + s.revenue, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#09080E]">Revenue</h1>
          <p className="text-[#4B5563]">Financial overview and analytics</p>
        </div>
        <div className="flex items-center gap-1 bg-white border border-[#E5E7EB] rounded-[7px] p-1">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1.5 text-sm font-medium rounded-[5px] transition-colors ${
                period === p.value
                  ? 'bg-[#064A6C] text-white'
                  : 'text-[#4B5563] hover:bg-gray-100'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid md:grid-cols-5 gap-4">
        {/* MRR */}
        <div className="bg-white border border-[#E5E7EB] rounded-[7px] p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 bg-teal-50 rounded-lg flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-[#064A6C]" />
            </div>
            {mrrChange !== 0 && (
              <div className="flex items-center gap-1 text-xs">
                {mrrChange > 0 ? (
                  <>
                    <TrendingUp className="w-3.5 h-3.5 text-[#10B981]" />
                    <span className="text-[#10B981]">+{mrrChange}%</span>
                  </>
                ) : (
                  <>
                    <TrendingDown className="w-3.5 h-3.5 text-[#DC2626]" />
                    <span className="text-[#DC2626]">{mrrChange}%</span>
                  </>
                )}
              </div>
            )}
          </div>
          <h3 className="text-2xl font-bold text-[#09080E]">{formatCents(mrr)}</h3>
          <p className="text-xs text-[#4B5563] mt-1">Monthly Recurring Revenue</p>
        </div>

        {/* MRR Change */}
        <div className="bg-white border border-[#E5E7EB] rounded-[7px] p-5">
          <div className="flex items-center justify-between mb-2">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${mrrChange >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
              {mrrChange >= 0 ? (
                <TrendingUp className="w-4 h-4 text-[#10B981]" />
              ) : (
                <TrendingDown className="w-4 h-4 text-[#DC2626]" />
              )}
            </div>
          </div>
          <h3 className={`text-2xl font-bold ${mrrChange >= 0 ? 'text-[#10B981]' : 'text-[#DC2626]'}`}>
            {mrrChange >= 0 ? '+' : ''}{mrrChange}%
          </h3>
          <p className="text-xs text-[#4B5563] mt-1">MRR Change</p>
        </div>

        {/* ARR */}
        <div className="bg-white border border-[#E5E7EB] rounded-[7px] p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 bg-teal-50 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-[#064A6C]" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-[#09080E]">{formatCents(arr)}</h3>
          <p className="text-xs text-[#4B5563] mt-1">Annual Run Rate</p>
        </div>

        {/* ARPC */}
        <div className="bg-white border border-[#E5E7EB] rounded-[7px] p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
              <Users className="w-4 h-4 text-[#1844A6]" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-[#09080E]">{formatCents(arpc)}</h3>
          <p className="text-xs text-[#4B5563] mt-1">Avg Revenue Per Customer</p>
        </div>

        {/* Churn Rate */}
        <div className="bg-white border border-[#E5E7EB] rounded-[7px] p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 bg-red-50 rounded-lg flex items-center justify-center">
              <TrendingDown className="w-4 h-4 text-[#DC2626]" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-[#09080E]">{churnRate}%</h3>
          <p className="text-xs text-[#4B5563] mt-1">Churn Rate</p>
        </div>
      </div>

      {/* Revenue Chart */}
      <div className="bg-white border border-[#E5E7EB] rounded-[7px] p-6">
        <h2 className="text-lg font-semibold text-[#09080E] mb-6">Revenue Over Time</h2>
        {chartData.length > 0 ? (
          <div className="flex items-end gap-2" style={{ height: '240px' }}>
            {chartData.map((d, i) => {
              const barHeight = (d.revenue / maxRevenue) * 200;
              const isCurrent = i === chartData.length - 1;
              return (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1" style={{ height: '100%', justifyContent: 'flex-end' }}>
                  <span className="text-[10px] font-medium text-[#09080E]">
                    {formatCents(d.revenue)}
                  </span>
                  <div className="w-full flex justify-center">
                    <div
                      className="w-full max-w-[40px] rounded-t-md transition-all"
                      style={{
                        height: `${barHeight}px`,
                        backgroundColor: isCurrent ? '#064A6C' : '#99CCD9',
                      }}
                    />
                  </div>
                  <span className={`text-[10px] ${isCurrent ? 'font-bold text-[#064A6C]' : 'text-[#4B5563]'}`}>
                    {formatShortDate(d.date)}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-[#4B5563]">No chart data available for this period.</p>
        )}
      </div>

      {/* Revenue by Service */}
      <div className="bg-white border border-[#E5E7EB] rounded-[7px] p-6">
        <h2 className="text-lg font-semibold text-[#09080E] mb-6">Revenue by Service</h2>
        {byService.length > 0 ? (
          <div className="space-y-4">
            {byService.map((s) => {
              const pct = totalServiceRevenue > 0 ? (s.revenue / totalServiceRevenue) * 100 : 0;
              const color = SERVICE_COLORS[s.type] || SERVICE_COLORS.other;
              const label = SERVICE_LABELS[s.type] || s.type;
              return (
                <div key={s.type} className="flex items-center gap-4">
                  <span className="text-sm font-medium text-[#09080E] w-24 shrink-0">{label}</span>
                  <div className="flex-1 h-6 bg-gray-100 rounded-[7px] overflow-hidden">
                    <div
                      className="h-full rounded-[7px]"
                      style={{ width: `${pct}%`, backgroundColor: color }}
                    />
                  </div>
                  <span className="text-sm text-[#4B5563] w-32 text-right shrink-0">
                    {formatCents(s.revenue)} ({pct.toFixed(1)}%)
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-[#4B5563]">No service breakdown available for this period.</p>
        )}
      </div>

      {/* Recent Transactions */}
      <div className="bg-white border border-[#E5E7EB] rounded-[7px] p-6">
        <h2 className="text-lg font-semibold text-[#09080E] mb-6">Recent Transactions</h2>
        {transactions.length > 0 ? (
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
                {transactions.map((txn) => {
                  const statusColors: Record<string, string> = {
                    completed: 'bg-[#10B981] text-white',
                    paid: 'bg-[#10B981] text-white',
                    pending: 'bg-yellow-100 text-yellow-800',
                    refunded: 'bg-red-100 text-[#DC2626]',
                    failed: 'bg-red-100 text-[#DC2626]',
                    cancelled: 'bg-gray-100 text-[#4B5563]',
                  };
                  const badge = statusColors[txn.status] || 'bg-gray-100 text-[#4B5563]';
                  return (
                    <tr key={txn.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="py-3 text-sm font-medium text-[#064A6C]">{txn.orderNumber}</td>
                      <td className="py-3 text-sm text-[#09080E]">{txn.customerName}</td>
                      <td className="py-3 text-sm font-medium text-[#09080E]">{formatCents(txn.total)}</td>
                      <td className="py-3">
                        <span className={`px-2.5 py-1 rounded-[7px] text-xs font-medium capitalize ${badge}`}>
                          {txn.status}
                        </span>
                      </td>
                      <td className="py-3 text-sm text-[#4B5563]">{formatDate(txn.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-[#4B5563]">No transactions found for this period.</p>
        )}
      </div>
    </div>
  );
}
