import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle, ArrowRight, LayoutDashboard } from 'lucide-react';

export function CheckoutSuccessPage() {
  const [searchParams] = useSearchParams();
  const orderUuid = searchParams.get('order');

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10 text-green-400" />
        </div>

        <h1 className="text-3xl font-bold text-white mb-4">
          Payment Successful!
        </h1>
        <p className="text-zinc-400 mb-8">
          Thank you for your purchase. Your order is being processed and 
          you will receive a confirmation email shortly.
        </p>

        <div className="card mb-8">
          <h2 className="text-sm font-medium text-zinc-400 mb-2">Order Reference</h2>
          <p className="text-white font-mono">{orderUuid || 'N/A'}</p>
        </div>

        <div className="space-y-3">
          <Link
            to="/dashboard"
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            <LayoutDashboard className="w-4 h-4" />
            Go to Dashboard
          </Link>
          <Link
            to="/dashboard/orders"
            className="btn-outline w-full flex items-center justify-center gap-2"
          >
            View Order Details
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
