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
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
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
          <h1 className="text-2xl font-bold text-white">My Orders</h1>
          <p className="text-zinc-400">View your order history</p>
        </div>
      </div>

      {/* Orders List */}
      {orders && orders.length > 0 ? (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left border-b border-zinc-800">
                  <th className="pb-4 pt-2 px-6 font-medium text-zinc-400">Order #</th>
                  <th className="pb-4 pt-2 px-6 font-medium text-zinc-400">Date</th>
                  <th className="pb-4 pt-2 px-6 font-medium text-zinc-400">Items</th>
                  <th className="pb-4 pt-2 px-6 font-medium text-zinc-400">Total</th>
                  <th className="pb-4 pt-2 px-6 font-medium text-zinc-400">Status</th>
                  <th className="pb-4 pt-2 px-6 font-medium text-zinc-400"></th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order: any) => (
                  <tr key={order.id} className="border-b border-zinc-800/50 last:border-0">
                    <td className="py-4 px-6">
                      <span className="text-white font-mono">{order.orderNumber}</span>
                    </td>
                    <td className="py-4 px-6 text-zinc-400">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-4 px-6 text-zinc-400">
                      {order.items?.length || 0} items
                    </td>
                    <td className="py-4 px-6 text-white">
                      ${(order.total / 100).toFixed(2)}
                    </td>
                    <td className="py-4 px-6">
                      {getStatusBadge(order.status)}
                    </td>
                    <td className="py-4 px-6">
                      <Link
                        to={`/dashboard/orders/${order.uuid}`}
                        className="text-purple-400 hover:text-purple-300 flex items-center gap-1 text-sm"
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
        <div className="card text-center py-16">
          <ShoppingCart className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No orders yet</h3>
          <p className="text-zinc-400 mb-6">Your order history will appear here</p>
          <Link to="/domains/search" className="btn-primary">
            Start Shopping
          </Link>
        </div>
      )}
    </div>
  );
}
