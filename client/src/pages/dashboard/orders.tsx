import { useQuery } from '@tanstack/react-query';
import { orderApi } from '@/lib/api';
import { ShoppingCart, Loader2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

export function OrdersPage() {
  const { data: orders, isLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: orderApi.getOrders,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-[#064A6C] animate-spin" />
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
          <h1 className="text-2xl font-bold text-gray-900">My Orders</h1>
          <p className="text-gray-500">View your order history</p>
        </div>
      </div>

      {/* Orders List */}
      {orders && orders.length > 0 ? (
        <div className="bg-white border border-gray-200 rounded-[7px] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left border-b border-gray-200">
                  <th className="pb-4 pt-4 px-6 font-medium text-gray-500">Order #</th>
                  <th className="pb-4 pt-4 px-6 font-medium text-gray-500">Date</th>
                  <th className="pb-4 pt-4 px-6 font-medium text-gray-500">Items</th>
                  <th className="pb-4 pt-4 px-6 font-medium text-gray-500">Total</th>
                  <th className="pb-4 pt-4 px-6 font-medium text-gray-500">Status</th>
                  <th className="pb-4 pt-4 px-6 font-medium text-gray-500"></th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order: any) => (
                  <tr key={order.id} className="border-b border-gray-100 last:border-0">
                    <td className="py-4 px-6">
                      <span className="text-gray-900 font-mono">{order.orderNumber}</span>
                    </td>
                    <td className="py-4 px-6 text-gray-500">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-4 px-6 text-gray-500">
                      {order.items?.length || 0} items
                    </td>
                    <td className="py-4 px-6 text-gray-900">
                      ${(order.total / 100).toFixed(2)}
                    </td>
                    <td className="py-4 px-6">
                      {getStatusBadge(order.status)}
                    </td>
                    <td className="py-4 px-6">
                      <Link
                        to={`/dashboard/orders/${order.uuid}`}
                        className="text-[#064A6C] hover:text-[#053A55] flex items-center gap-1 text-sm"
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
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-[7px] text-center py-16 px-6">
          <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No orders yet</h3>
          <p className="text-gray-500 mb-6">Your order history will appear here</p>
          <Link to="/domains/search" className="btn-primary">
            Start Shopping
          </Link>
        </div>
      )}
    </div>
  );
}
