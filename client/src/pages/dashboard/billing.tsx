import { useQuery } from '@tanstack/react-query';
import { orderApi } from '@/lib/api';
import { CreditCard, Loader2, ExternalLink, Receipt } from 'lucide-react';
import { Link } from 'react-router-dom';

export function BillingPage() {
  const { data: orders, isLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: orderApi.getOrders,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-[#1844A6] animate-spin" />
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className="badge badge-success">{status}</span>;
      case 'pending_payment':
      case 'processing':
        return <span className="badge badge-warning">{status}</span>;
      case 'failed':
      case 'cancelled':
        return <span className="badge badge-error">{status}</span>;
      default:
        return <span className="badge badge-neutral">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Billing</h1>
          <p className="text-gray-500">Manage your payments, subscriptions, and invoices</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="bg-white border border-gray-200 rounded-[7px] p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <Receipt className="w-5 h-5 text-[#1844A6]" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Total Orders</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{orders?.length || 0}</p>
          <p className="text-gray-500 text-sm mt-1">Lifetime orders</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-[7px] p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-[#1844A6]" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Active Subscriptions</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">
            {orders?.filter((o: any) => o.status === 'completed').length || 0}
          </p>
          <p className="text-gray-500 text-sm mt-1">Completed orders</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-[7px] p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-[#1844A6]" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Payment Methods</h3>
          </div>
          <p className="text-gray-500 text-sm">No payment methods saved</p>
          <button
            onClick={() => alert('Payment method management coming soon')}
            className="text-[#1844A6] hover:text-[#133A8A] text-sm mt-3 font-medium"
          >
            Add Payment Method
          </button>
        </div>
      </div>

      {/* Payment History */}
      <div className="bg-white border border-gray-200 rounded-[7px] p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Payment History</h2>
          <Link to="/dashboard/orders" className="text-[#1844A6] text-sm hover:text-[#133A8A]">
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
                  <th className="pb-3 pt-1 font-medium text-gray-500 text-sm">Description</th>
                  <th className="pb-3 pt-1 font-medium text-gray-500 text-sm">Amount</th>
                  <th className="pb-3 pt-1 font-medium text-gray-500 text-sm">Status</th>
                  <th className="pb-3 pt-1 font-medium text-gray-500 text-sm"></th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order: any) => (
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
                    <td className="py-4">
                      <Link
                        to={`/dashboard/orders/${order.uuid}`}
                        className="text-[#1844A6] hover:text-[#133A8A] flex items-center gap-1 text-sm"
                      >
                        View
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <Receipt className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No payment history yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
