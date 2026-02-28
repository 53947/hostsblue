import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { orderApi, dashboardApi, aiCreditsApi, aiSettingsApi } from '@/lib/api';
import {
  CreditCard, Loader2, Receipt, DollarSign, TrendingUp, Plus,
  BarChart3, Zap, AlertTriangle, X, ArrowRight, Clock, RefreshCw,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export function BillingPage() {
  const queryClient = useQueryClient();
  const [showAddCredits, setShowAddCredits] = useState(false);
  const [txPage, setTxPage] = useState(0);

  const { data: balance, isLoading: balanceLoading } = useQuery({
    queryKey: ['ai-credits-balance'],
    queryFn: aiCreditsApi.getBalance,
  });

  const { data: orders } = useQuery({
    queryKey: ['orders'],
    queryFn: orderApi.getOrders,
  });

  const { data: stats } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: dashboardApi.getStats,
  });

  const { data: dailyUsage } = useQuery({
    queryKey: ['ai-credits-daily'],
    queryFn: () => aiCreditsApi.getDailyUsage(30),
  });

  const { data: modelBreakdown } = useQuery({
    queryKey: ['ai-credits-models'],
    queryFn: () => aiCreditsApi.getModelBreakdown(30),
  });

  const { data: transactions } = useQuery({
    queryKey: ['ai-credits-transactions', txPage],
    queryFn: () => aiCreditsApi.getTransactions(20, txPage * 20),
  });

  const { data: modelsData } = useQuery({
    queryKey: ['ai-models'],
    queryFn: aiSettingsApi.getModels,
  });

  if (balanceLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-[#064A6C] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Billing</h1>
          <p className="text-gray-500">AI credits, usage analytics, and payment history</p>
        </div>
      </div>

      {/* Section 1: Balance Card */}
      <BalanceCard balance={balance} onAddCredits={() => setShowAddCredits(true)} />

      {/* Section 2: Usage Overview */}
      <UsageOverview dailyUsage={(dailyUsage || []) as any[]} balance={balance} />

      {/* Section 3: Daily Usage Chart */}
      {dailyUsage && (dailyUsage as any[]).length > 0 && (
        <DailyUsageChart data={dailyUsage as any[]} />
      )}

      {/* Section 4: Per-Model Cost Breakdown */}
      {modelBreakdown && (modelBreakdown as any[]).length > 0 && (
        <ModelBreakdownTable data={modelBreakdown as any[]} />
      )}

      {/* Section 5: Transaction History */}
      <TransactionHistory
        transactions={(transactions || []) as any[]}
        page={txPage}
        onPageChange={setTxPage}
      />

      {/* Section 6: Auto-Top-Up */}
      <AutoTopupSettings balance={balance} />

      {/* Section 7: Spending Limit */}
      <SpendingLimitSettings balance={balance} />

      {/* Section 8: Model Pricing */}
      {modelsData && (
        <PricingTable models={modelsData.models} pricing={modelsData.pricing} />
      )}

      {/* Section 9: Legacy Payment History */}
      <LegacyPaymentHistory orders={orders} stats={stats} />

      {/* Add Credits Modal */}
      {showAddCredits && (
        <AddCreditsModal
          onClose={() => setShowAddCredits(false)}
          onSuccess={() => {
            setShowAddCredits(false);
            queryClient.invalidateQueries({ queryKey: ['ai-credits-balance'] });
          }}
        />
      )}
    </div>
  );
}

// ============================================================================
// BALANCE CARD
// ============================================================================

function BalanceCard({ balance, onAddCredits }: { balance: any; onAddCredits: () => void }) {
  return (
    <div className="bg-white border border-gray-200 rounded-[7px] p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 mb-1">AI Credit Balance</p>
          <p className="text-4xl font-bold text-gray-900">
            ${((balance?.balanceCents || 0) / 100).toFixed(2)}
          </p>
          <div className="flex items-center gap-4 mt-2">
            <span className="text-xs text-gray-500">
              {balance?.billingMode === 'credits' ? 'Credits mode' : 'BYOK mode'}
            </span>
            <span className="text-xs text-gray-400">
              Credits are refundable (non-transferable)
            </span>
          </div>
        </div>
        <button
          onClick={onAddCredits}
          className="btn-primary text-sm flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Credits
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// USAGE OVERVIEW CARDS
// ============================================================================

function UsageOverview({ dailyUsage, balance }: { dailyUsage: any[]; balance: any }) {
  const now = new Date();
  const thisMonth = now.toISOString().slice(0, 7); // YYYY-MM
  const today = now.toISOString().slice(0, 10); // YYYY-MM-DD

  const monthSpend = (dailyUsage || [])
    .filter((d: any) => d.date?.startsWith(thisMonth))
    .reduce((sum: number, d: any) => sum + (Number(d.totalCost) || 0), 0);

  const todaySpend = (dailyUsage || [])
    .filter((d: any) => d.date === today)
    .reduce((sum: number, d: any) => sum + (Number(d.totalCost) || 0), 0);

  const totalDays = (dailyUsage || []).length || 1;
  const totalSpend = (dailyUsage || []).reduce((sum: number, d: any) => sum + (Number(d.totalCost) || 0), 0);
  const avgPerDay = totalSpend / totalDays;

  return (
    <div className="grid md:grid-cols-3 gap-4">
      <div className="bg-white border border-gray-200 rounded-[7px] p-5">
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 className="w-4 h-4 text-[#064A6C]" />
          <span className="text-sm font-medium text-gray-500">This Month</span>
        </div>
        <p className="text-2xl font-bold text-gray-900">${(monthSpend / 100).toFixed(2)}</p>
      </div>
      <div className="bg-white border border-gray-200 rounded-[7px] p-5">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="w-4 h-4 text-[#064A6C]" />
          <span className="text-sm font-medium text-gray-500">Today</span>
        </div>
        <p className="text-2xl font-bold text-gray-900">${(todaySpend / 100).toFixed(2)}</p>
      </div>
      <div className="bg-white border border-gray-200 rounded-[7px] p-5">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="w-4 h-4 text-[#064A6C]" />
          <span className="text-sm font-medium text-gray-500">Avg / Day (30d)</span>
        </div>
        <p className="text-2xl font-bold text-gray-900">${(avgPerDay / 100).toFixed(2)}</p>
      </div>
    </div>
  );
}

// ============================================================================
// DAILY USAGE CHART (Pure CSS)
// ============================================================================

function DailyUsageChart({ data }: { data: any[] }) {
  const maxCost = Math.max(...data.map(d => Number(d.totalCost) || 0), 1);

  return (
    <div className="bg-white border border-gray-200 rounded-[7px] p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Daily Usage (30 days)</h2>
      <div className="flex items-end gap-1 h-40">
        {data.map((d: any, i: number) => {
          const cost = Number(d.totalCost) || 0;
          const height = (cost / maxCost) * 100;
          const date = d.date || '';
          return (
            <div
              key={i}
              className="flex-1 group relative"
              title={`${date}: $${(cost / 100).toFixed(2)} (${d.calls} calls)`}
            >
              <div
                className="bg-[#064A6C] hover:bg-[#053C58] rounded-t-sm transition-colors w-full"
                style={{ height: `${Math.max(height, 2)}%` }}
              />
              <div className="hidden group-hover:block absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                {date.slice(5)}: ${(cost / 100).toFixed(2)}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-2">
        <span className="text-xs text-gray-400">{data[0]?.date?.slice(5) || ''}</span>
        <span className="text-xs text-gray-400">{data[data.length - 1]?.date?.slice(5) || ''}</span>
      </div>
    </div>
  );
}

// ============================================================================
// MODEL BREAKDOWN TABLE
// ============================================================================

function ModelBreakdownTable({ data }: { data: any[] }) {
  const totalCalls = data.reduce((sum, row) => sum + Number(row.calls), 0);
  const totalCost = data.reduce((sum, row) => sum + Number(row.totalCost), 0);

  return (
    <div className="bg-white border border-gray-200 rounded-[7px] p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">AI Usage Breakdown (30d)</h2>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left border-b border-gray-200">
              <th className="pb-3 font-medium text-gray-500 text-sm">Usage</th>
              <th className="pb-3 font-medium text-gray-500 text-sm text-right">Requests</th>
              <th className="pb-3 font-medium text-gray-500 text-sm text-right">Cost</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row: any, i: number) => (
              <tr key={i} className="border-b border-gray-100 last:border-0">
                <td className="py-3 text-sm text-gray-900">AI Generation</td>
                <td className="py-3 text-sm text-gray-900 text-right">{Number(row.calls).toLocaleString()}</td>
                <td className="py-3 text-sm text-gray-900 font-medium text-right">${(Number(row.totalCost) / 100).toFixed(2)}</td>
              </tr>
            ))}
            {data.length > 1 && (
              <tr className="border-t border-gray-200">
                <td className="py-3 text-sm font-semibold text-gray-900">Total</td>
                <td className="py-3 text-sm font-semibold text-gray-900 text-right">{totalCalls.toLocaleString()}</td>
                <td className="py-3 text-sm font-semibold text-gray-900 text-right">${(totalCost / 100).toFixed(2)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================================
// TRANSACTION HISTORY
// ============================================================================

function TransactionHistory({ transactions, page, onPageChange }: { transactions: any[]; page: number; onPageChange: (p: number) => void }) {
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'purchase': case 'auto_topup': return 'text-green-600';
      case 'ai_usage': return 'text-red-500';
      case 'refund': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'purchase': return 'Purchase';
      case 'ai_usage': return 'AI Usage';
      case 'refund': return 'Refund';
      case 'auto_topup': return 'Auto Top-Up';
      case 'adjustment': return 'Adjustment';
      default: return type;
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-[7px] p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Transaction History</h2>
      {transactions && transactions.length > 0 ? (
        <>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left border-b border-gray-200">
                  <th className="pb-3 font-medium text-gray-500 text-sm">Date</th>
                  <th className="pb-3 font-medium text-gray-500 text-sm">Type</th>
                  <th className="pb-3 font-medium text-gray-500 text-sm">Description</th>
                  <th className="pb-3 font-medium text-gray-500 text-sm text-right">Amount</th>
                  <th className="pb-3 font-medium text-gray-500 text-sm text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx: any) => (
                  <tr key={tx.id} className="border-b border-gray-100 last:border-0">
                    <td className="py-3 text-sm text-gray-500">
                      {new Date(tx.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        tx.type === 'purchase' || tx.type === 'auto_topup' ? 'bg-green-50 text-green-700' :
                        tx.type === 'ai_usage' ? 'bg-red-50 text-red-600' :
                        tx.type === 'refund' ? 'bg-blue-50 text-blue-700' :
                        'bg-gray-50 text-gray-600'
                      }`}>
                        {getTypeLabel(tx.type)}
                      </span>
                    </td>
                    <td className="py-3 text-sm text-gray-700 max-w-xs truncate">{tx.description}</td>
                    <td className={`py-3 text-sm font-medium text-right ${getTypeColor(tx.type)}`}>
                      {tx.amountCents > 0 ? '+' : ''}{(tx.amountCents / 100).toFixed(2)}
                    </td>
                    <td className="py-3 text-sm text-gray-900 text-right">
                      ${(tx.balanceAfterCents / 100).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between mt-4">
            <button
              onClick={() => onPageChange(Math.max(0, page - 1))}
              disabled={page === 0}
              className="text-sm text-[#064A6C] hover:text-[#053C58] disabled:text-gray-300 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-sm text-gray-500">Page {page + 1}</span>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={!transactions || transactions.length < 20}
              className="text-sm text-[#064A6C] hover:text-[#053C58] disabled:text-gray-300 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </>
      ) : (
        <div className="text-center py-8">
          <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500 text-sm">No transactions yet</p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// AUTO TOP-UP SETTINGS
// ============================================================================

function AutoTopupSettings({ balance }: { balance: any }) {
  const queryClient = useQueryClient();
  const [enabled, setEnabled] = useState(balance?.autoTopupEnabled || false);
  const [threshold, setThreshold] = useState(String((balance?.autoTopupThresholdCents || 100) / 100));
  const [amount, setAmount] = useState(String((balance?.autoTopupAmountCents || 500) / 100));
  const [saved, setSaved] = useState(false);

  const mutation = useMutation({
    mutationFn: (data: any) => aiCreditsApi.updateAutoTopup(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-credits-balance'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  const handleSave = () => {
    mutation.mutate({
      enabled,
      thresholdCents: Math.round(parseFloat(threshold) * 100),
      amountCents: Math.round(parseFloat(amount) * 100),
    });
  };

  return (
    <div className="bg-white border border-gray-200 rounded-[7px] p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <RefreshCw className="w-5 h-5 text-[#064A6C]" />
          <h2 className="text-lg font-semibold text-gray-900">Auto Top-Up</h2>
        </div>
        <button
          onClick={() => { setEnabled(!enabled); }}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            enabled ? 'bg-[#064A6C]' : 'bg-gray-300'
          }`}
        >
          <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
            enabled ? 'translate-x-6' : 'translate-x-1'
          }`} />
        </button>
      </div>
      {enabled && (
        <div className="space-y-3 max-w-sm">
          <div>
            <label className="block text-sm text-gray-600 mb-1">When balance falls below</label>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">$</span>
              <input
                type="number"
                value={threshold}
                onChange={e => setThreshold(e.target.value)}
                min="1"
                step="1"
                className="w-24 border border-gray-200 rounded-[7px] p-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#064A6C]"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Add this amount</label>
            <select
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="border border-gray-200 rounded-[7px] p-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#064A6C]"
            >
              <option value="5">$5.00</option>
              <option value="10">$10.00</option>
              <option value="25">$25.00</option>
              <option value="50">$50.00</option>
              <option value="100">$100.00</option>
            </select>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleSave} disabled={mutation.isPending} className="btn-primary text-sm">
              {mutation.isPending ? 'Saving...' : 'Save'}
            </button>
            {saved && <span className="text-green-600 text-sm">Saved!</span>}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SPENDING LIMIT SETTINGS
// ============================================================================

function SpendingLimitSettings({ balance }: { balance: any }) {
  const queryClient = useQueryClient();
  const [enabled, setEnabled] = useState(balance?.spendingLimitCents != null);
  const [limit, setLimit] = useState(String((balance?.spendingLimitCents || 5000) / 100));
  const [period, setPeriod] = useState(balance?.spendingLimitPeriod || 'monthly');
  const [saved, setSaved] = useState(false);

  const mutation = useMutation({
    mutationFn: (data: any) => aiCreditsApi.updateSpendingLimit(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-credits-balance'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  const handleSave = () => {
    mutation.mutate({
      limitCents: enabled ? Math.round(parseFloat(limit) * 100) : null,
      period,
    });
  };

  const usagePercent = balance?.spendingLimitCents
    ? Math.min(100, (balance.currentPeriodUsageCents / balance.spendingLimitCents) * 100)
    : 0;

  return (
    <div className="bg-white border border-gray-200 rounded-[7px] p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-[#064A6C]" />
          <h2 className="text-lg font-semibold text-gray-900">Spending Limit</h2>
        </div>
        <button
          onClick={() => setEnabled(!enabled)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            enabled ? 'bg-[#064A6C]' : 'bg-gray-300'
          }`}
        >
          <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
            enabled ? 'translate-x-6' : 'translate-x-1'
          }`} />
        </button>
      </div>
      {enabled && (
        <div className="space-y-3 max-w-sm">
          <div className="flex items-center gap-3">
            <select
              value={period}
              onChange={e => setPeriod(e.target.value)}
              className="border border-gray-200 rounded-[7px] p-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#064A6C]"
            >
              <option value="monthly">Monthly</option>
              <option value="daily">Daily</option>
            </select>
            <div className="flex items-center gap-1">
              <span className="text-gray-500">$</span>
              <input
                type="number"
                value={limit}
                onChange={e => setLimit(e.target.value)}
                min="1"
                step="1"
                className="w-24 border border-gray-200 rounded-[7px] p-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#064A6C]"
              />
            </div>
          </div>
          {/* Progress bar */}
          {balance?.spendingLimitCents && (
            <div>
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>${(balance.currentPeriodUsageCents / 100).toFixed(2)} used</span>
                <span>${(balance.spendingLimitCents / 100).toFixed(2)} limit</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${usagePercent > 80 ? 'bg-red-500' : 'bg-[#064A6C]'}`}
                  style={{ width: `${usagePercent}%` }}
                />
              </div>
            </div>
          )}
          <div className="flex items-center gap-3">
            <button onClick={handleSave} disabled={mutation.isPending} className="btn-primary text-sm">
              {mutation.isPending ? 'Saving...' : 'Save'}
            </button>
            {saved && <span className="text-green-600 text-sm">Saved!</span>}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MODEL PRICING TABLE
// ============================================================================

function PricingTable({ models: _models, pricing: _pricing }: { models: any[]; pricing: any[] }) {
  return (
    <div className="bg-white border border-gray-200 rounded-[7px] p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">AI Pricing</h2>
      <p className="text-sm text-gray-500 mb-4">hostsblue uses prepaid credits for AI features. Usage is metered by request complexity.</p>
      <div className="grid md:grid-cols-3 gap-4">
        <div className="border border-gray-200 rounded-[7px] p-4">
          <div className="text-sm font-medium text-gray-900 mb-1">Simple Requests</div>
          <div className="text-xs text-gray-500">Text edits, short generation</div>
          <div className="text-lg font-semibold text-[#064A6C] mt-2">~$0.01</div>
        </div>
        <div className="border border-gray-200 rounded-[7px] p-4">
          <div className="text-sm font-medium text-gray-900 mb-1">Standard Requests</div>
          <div className="text-xs text-gray-500">Page generation, AI chat</div>
          <div className="text-lg font-semibold text-[#064A6C] mt-2">~$0.02–0.05</div>
        </div>
        <div className="border border-gray-200 rounded-[7px] p-4">
          <div className="text-sm font-medium text-gray-900 mb-1">Complex Requests</div>
          <div className="text-xs text-gray-500">Full site generation, SEO</div>
          <div className="text-lg font-semibold text-[#064A6C] mt-2">~$0.10–0.25</div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// LEGACY PAYMENT HISTORY
// ============================================================================

function LegacyPaymentHistory({ orders, stats }: { orders: any; stats: any }) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className="badge badge-success">{status}</span>;
      case 'pending_payment':
      case 'processing':
        return <span className="badge badge-warning">{status.replace('_', ' ')}</span>;
      case 'failed':
      case 'cancelled':
        return <span className="badge badge-error">{status}</span>;
      default:
        return <span className="badge badge-neutral">{status}</span>;
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-[7px] p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Order History</h2>
        <Link to="/dashboard/orders" className="text-[#064A6C] text-sm hover:text-[#053C58]">
          View All Orders
        </Link>
      </div>

      {orders && orders.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left border-b border-gray-200">
                <th className="pb-3 pt-1 font-medium text-gray-500 text-sm">Order #</th>
                <th className="pb-3 pt-1 font-medium text-gray-500 text-sm">Date</th>
                <th className="pb-3 pt-1 font-medium text-gray-500 text-sm">Items</th>
                <th className="pb-3 pt-1 font-medium text-gray-500 text-sm">Amount</th>
                <th className="pb-3 pt-1 font-medium text-gray-500 text-sm">Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.slice(0, 10).map((order: any) => (
                <tr key={order.id} className="border-b border-gray-100 last:border-0">
                  <td className="py-4">
                    <span className="text-gray-900 font-mono text-sm">{order.orderNumber}</span>
                  </td>
                  <td className="py-4 text-gray-500 text-sm">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-4 text-gray-600 text-sm">
                    {order.items?.length || 0} item(s)
                  </td>
                  <td className="py-4 text-gray-900 text-sm font-medium">
                    ${(order.total / 100).toFixed(2)}
                  </td>
                  <td className="py-4">
                    {getStatusBadge(order.status)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-8">
          <Receipt className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500 text-sm">No orders yet</p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// ADD CREDITS MODAL
// ============================================================================

function AddCreditsModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [amount, setAmount] = useState(1000); // $10 default
  const [customAmount, setCustomAmount] = useState('');
  const [isCustom, setIsCustom] = useState(false);

  const presets = [500, 1000, 2500, 5000, 10000]; // $5, $10, $25, $50, $100

  const purchaseMutation = useMutation({
    mutationFn: (amountCents: number) => aiCreditsApi.purchase(amountCents),
    onSuccess: async (data) => {
      // After creating the order, redirect to checkout
      if (data?.order?.uuid) {
        try {
          const checkout = await orderApi.checkout(data.order.uuid);
          if (checkout?.paymentUrl) {
            window.location.href = checkout.paymentUrl;
          }
        } catch {
          // If checkout fails, just close — they can pay from orders page
          onSuccess();
        }
      } else {
        onSuccess();
      }
    },
  });

  const handlePurchase = () => {
    const cents = isCustom ? Math.round(parseFloat(customAmount) * 100) : amount;
    if (cents < 500) return;
    purchaseMutation.mutate(cents);
  };

  const effectiveAmount = isCustom ? Math.round(parseFloat(customAmount || '0') * 100) : amount;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-[7px] w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Add AI Credits</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3 mb-6">
          {presets.map(cents => (
            <button
              key={cents}
              onClick={() => { setAmount(cents); setIsCustom(false); }}
              className={`w-full text-left p-3 border rounded-[7px] transition-colors ${
                !isCustom && amount === cents
                  ? 'border-[#064A6C] bg-teal-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <span className="text-gray-900 font-medium">${(cents / 100).toFixed(2)}</span>
            </button>
          ))}
          <button
            onClick={() => setIsCustom(true)}
            className={`w-full text-left p-3 border rounded-[7px] transition-colors ${
              isCustom ? 'border-[#064A6C] bg-teal-50' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <span className="text-gray-900 font-medium">Custom Amount</span>
          </button>
          {isCustom && (
            <div className="flex items-center gap-2 px-1">
              <span className="text-gray-500 text-lg">$</span>
              <input
                type="number"
                value={customAmount}
                onChange={e => setCustomAmount(e.target.value)}
                min="5"
                step="1"
                placeholder="5.00"
                autoFocus
                className="flex-1 border border-gray-200 rounded-[7px] p-3 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#064A6C]"
              />
            </div>
          )}
        </div>

        <button
          onClick={handlePurchase}
          disabled={purchaseMutation.isPending || effectiveAmount < 500}
          className="w-full btn-primary text-sm flex items-center justify-center gap-2"
        >
          {purchaseMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <CreditCard className="w-4 h-4" />
          )}
          {purchaseMutation.isPending ? 'Processing...' : `Purchase $${(effectiveAmount / 100).toFixed(2)} Credits`}
        </button>
        <p className="text-xs text-gray-400 mt-3 text-center">Minimum purchase: $5.00. Processed via SwipesBlue.</p>
      </div>
    </div>
  );
}
