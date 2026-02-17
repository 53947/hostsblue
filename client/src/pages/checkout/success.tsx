import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle, ArrowRight, LayoutDashboard } from 'lucide-react';

export function CheckoutSuccessPage() {
  const [searchParams] = useSearchParams();
  const orderUuid = searchParams.get('order');

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10 text-green-500" />
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Payment Successful!
        </h1>
        <p className="text-gray-500 mb-8">
          Thank you for your purchase. Your order is being processed and
          you will receive a confirmation email shortly.
        </p>

        <div className="bg-white border border-gray-200 rounded-[7px] p-4 mb-8">
          <h2 className="text-sm font-medium text-gray-500 mb-2">Order Reference</h2>
          <p className="text-gray-900 font-mono">{orderUuid || 'N/A'}</p>
        </div>

        <div className="space-y-3">
          <Link
            to="/dashboard"
            className="w-full bg-[#1844A6] hover:bg-[#133A8A] text-white font-medium py-3 rounded-[7px] transition-colors flex items-center justify-center gap-2"
          >
            <LayoutDashboard className="w-4 h-4" />
            Go to Dashboard
          </Link>
          <Link
            to="/dashboard/orders"
            className="w-full border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium py-3 rounded-[7px] transition-colors flex items-center justify-center gap-2"
          >
            View Order Details
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
