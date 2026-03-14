import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { panelApi } from '@/lib/api';
import {
  DollarSign, Users, AlertTriangle, TrendingDown, CalendarDays,
  Loader2, Search, MoreVertical, Pause, RotateCcw, XCircle, Receipt,
} from 'lucide-react';

const statusStyles: Record<string, string> = {
  active: 'bg-[#10B981]/10 text-[#10B981]',
  past_due: 'bg-yellow-100 text-yellow-700',
  suspended: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-600',
};

const statusLabels: Record<string, string> = {
  active: 'Active',
  past_due: 'Past Due',
  suspended: 'Suspended',
  cancelled: 'Cancelled',
};

export function PanelSubscriptionsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [actionMenu, setActionMenu] = useState<number | null>(null);
  const [viewHistory, setViewHistory] = useState<number | null>(null);

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['panel', 'subscriptions-summary'],
    queryFn: () => panelApi.getSubscriptionSummary(),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['panel', 'subscriptions', search, statusFilter, page],
    queryFn: () => panelApi.getSubscriptions({ search, status: statusFilter, page, limit: 20 }),
  });

  const { data: historyData } = useQuery({
    queryKey: ['panel', 'subscription-history', viewHistory],
    queryFn: () => viewHistory ? panelApi.getSubscriptionHistory(viewHistory) : null,
    enabled: viewHistory !== null,
  });

  const suspendMutation = useMutation({
    mutationFn: (id: number) => panelApi.suspendSubscription(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['panel', 'subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['panel', 'subscriptions-summary'] });
      setActionMenu(null);
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: (id: number) => panelApi.reactivateSubscription(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['panel', 'subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['panel', 'subscriptions-summary'] });
      setActionMenu(null);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: number) => panelApi.cancelSubscription(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['panel', 'subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['panel', 'subscriptions-summary'] });
      setActionMenu(null);
    },
  });

  const subscriptionsList = (data as any)?.subscriptions || [];
  const totalPages = (data as any)?.totalPages || 1;

  if (summaryLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-[#064A6C] animate-spin" />
      </div>
    );
  }

  const summaryCards = [
    {
      label: 'MRR',
      value: `$${((summary?.mrr || 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      icon: DollarSign,
      iconBg: 'bg-emerald-50',
      iconColor: 'text-[#10B981]',
    },
    {
      label: 'Active',
      value: summary?.activeCount || 0,
      icon: Users,
      iconBg: 'bg-teal-50',
      iconColor: 'text-[#064A6C]',
    },
    {
      label: 'Past Due',
      value: summary?.pastDueCount || 0,
      icon: AlertTriangle,
      iconBg: 'bg-yellow-50',
      iconColor: 'text-[#D97706]',
    },
    {
      label: 'Churned This Month',
      value: summary?.churnedThisMonth || 0,
      icon: TrendingDown,
      iconBg: 'bg-red-50',
      iconColor: 'text-[#DC2626]',
    },
    {
      label: 'Upcoming (7 days)',
      value: summary?.upcomingRenewals || 0,
      icon: CalendarDays,
      iconBg: 'bg-blue-50',
      iconColor: 'text-[#1844A6]',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#09080E]">Subscriptions</h1>
        <p className="text-[#4B5563]">Manage recurring subscriptions across all customers</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white border border-[#E5E7EB] rounded-[7px] p-5">
              <div className={`w-9 h-9 ${card.iconBg} rounded-lg flex items-center justify-center mb-3`}>
                <Icon className={`w-4.5 h-4.5 ${card.iconColor}`} />
              </div>
              <h3 className="text-2xl font-bold text-[#09080E] mb-0.5">{card.value}</h3>
              <p className="text-[#4B5563] text-xs">{card.label}</p>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4B5563]" />
          <input
            type="text"
            placeholder="Search by customer or plan..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2 text-sm border border-[#E5E7EB] rounded-[7px] bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#064A6C]/20 focus:border-[#064A6C]"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 text-sm border border-[#E5E7EB] rounded-[7px] bg-white focus:outline-none focus:ring-2 focus:ring-[#064A6C]/20"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="past_due">Past Due</option>
          <option value="suspended">Suspended</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#E5E7EB] rounded-[7px] overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-6 h-6 text-[#064A6C] animate-spin" />
          </div>
        ) : subscriptionsList.length === 0 ? (
          <div className="text-center py-12 text-[#4B5563]">No subscriptions found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-[#4B5563] border-b border-[#E5E7EB] bg-gray-50">
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Plan</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Next Renewal</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                  <th className="px-4 py-3 font-medium w-12"></th>
                </tr>
              </thead>
              <tbody>
                {subscriptionsList.map((sub: any) => (
                  <tr key={sub.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-[#09080E]">{sub.customerName}</div>
                      <div className="text-xs text-[#4B5563]">{sub.customerEmail}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-[#09080E]">{sub.planName}</td>
                    <td className="px-4 py-3 text-sm font-medium text-[#09080E]">
                      ${(sub.amount / 100).toFixed(2)}/{sub.billingInterval === 'yearly' ? 'yr' : 'mo'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusStyles[sub.status] || 'bg-gray-100 text-gray-600'}`}>
                        {statusLabels[sub.status] || sub.status}
                      </span>
                      {sub.cancelAtPeriodEnd && sub.status === 'active' && (
                        <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-orange-100 text-orange-700">
                          Cancelling
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-[#4B5563]">
                      {sub.status === 'cancelled' ? '\u2014' : new Date(sub.currentPeriodEnd).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-[#4B5563]">
                      {new Date(sub.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 relative">
                      <button
                        onClick={() => setActionMenu(actionMenu === sub.id ? null : sub.id)}
                        className="p-1 rounded hover:bg-gray-100 transition-colors"
                      >
                        <MoreVertical className="w-4 h-4 text-[#4B5563]" />
                      </button>
                      {actionMenu === sub.id && (
                        <div className="absolute right-4 top-full mt-1 bg-white border border-[#E5E7EB] rounded-[7px] shadow-lg z-20 w-44">
                          <button
                            onClick={() => { setViewHistory(sub.id); setActionMenu(null); }}
                            className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2"
                          >
                            <Receipt className="w-4 h-4 text-[#4B5563]" /> View History
                          </button>
                          {(sub.status === 'active' || sub.status === 'past_due') && (
                            <button
                              onClick={() => suspendMutation.mutate(sub.id)}
                              className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2 text-yellow-700"
                            >
                              <Pause className="w-4 h-4" /> Suspend
                            </button>
                          )}
                          {(sub.status === 'suspended' || sub.status === 'past_due') && (
                            <button
                              onClick={() => reactivateMutation.mutate(sub.id)}
                              className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2 text-[#10B981]"
                            >
                              <RotateCcw className="w-4 h-4" /> Reactivate
                            </button>
                          )}
                          {sub.status !== 'cancelled' && (
                            <button
                              onClick={() => cancelMutation.mutate(sub.id)}
                              className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2 text-red-600"
                            >
                              <XCircle className="w-4 h-4" /> Cancel
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#E5E7EB] bg-gray-50">
            <span className="text-sm text-[#4B5563]">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-sm border border-[#E5E7EB] rounded-[7px] disabled:opacity-50 hover:bg-white"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 text-sm border border-[#E5E7EB] rounded-[7px] disabled:opacity-50 hover:bg-white"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* History Slide-Over */}
      {viewHistory !== null && (
        <div className="fixed inset-0 bg-black/50 flex justify-end z-50" onClick={() => setViewHistory(null)}>
          <div className="w-full max-w-lg bg-white h-full overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-[#E5E7EB] flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[#09080E]">Billing History</h3>
              <button onClick={() => setViewHistory(null)} className="text-[#4B5563] hover:text-[#09080E]">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* Cycles */}
              <div>
                <h4 className="text-sm font-semibold text-[#4B5563] uppercase tracking-wider mb-3">Charges</h4>
                {((historyData as any)?.cycles || []).length === 0 ? (
                  <p className="text-sm text-[#4B5563]">No billing cycles yet</p>
                ) : (
                  <div className="space-y-2">
                    {((historyData as any)?.cycles || []).map((c: any) => (
                      <div key={c.id} className="border border-gray-100 rounded-[7px] p-3 text-sm">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-[#09080E]">${(c.amount / 100).toFixed(2)}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            c.status === 'paid' ? 'bg-[#10B981]/10 text-[#10B981]' :
                            c.status === 'failed' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {c.status}
                          </span>
                        </div>
                        <div className="text-xs text-[#4B5563]">
                          {new Date(c.createdAt).toLocaleString()}
                          {c.attemptCount > 1 && ` (attempt ${c.attemptCount})`}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Events */}
              <div>
                <h4 className="text-sm font-semibold text-[#4B5563] uppercase tracking-wider mb-3">Events</h4>
                {((historyData as any)?.events || []).length === 0 ? (
                  <p className="text-sm text-[#4B5563]">No events yet</p>
                ) : (
                  <div className="space-y-2">
                    {((historyData as any)?.events || []).map((e: any) => (
                      <div key={e.id} className="border-l-2 border-[#064A6C]/20 pl-3 py-1 text-sm">
                        <div className="font-medium text-[#09080E]">{e.eventType.replace(/_/g, ' ')}</div>
                        {e.previousStatus && e.newStatus && (
                          <div className="text-xs text-[#4B5563]">{e.previousStatus} &rarr; {e.newStatus}</div>
                        )}
                        <div className="text-xs text-[#4B5563]">{new Date(e.createdAt).toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
