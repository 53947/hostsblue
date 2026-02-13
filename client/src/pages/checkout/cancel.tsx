import { Link, useSearchParams } from 'react-router-dom';
import { XCircle, ArrowLeft, CreditCard } from 'lucide-react';

export function CheckoutCancelPage() {
  const [searchParams] = useSearchParams();
  const orderUuid = searchParams.get('order');

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <XCircle className="w-10 h-10 text-yellow-400" />
        </div>

        <h1 className="text-3xl font-bold text-white mb-4">
          Payment Cancelled
        </h1>
        <p className="text-zinc-400 mb-8">
          Your payment was cancelled. Your cart has been saved and you can 
          complete your purchase at any time.
        </p>

        <div className="space-y-3">
          {orderUuid && (
            <Link
              to={`/checkout?order=${orderUuid}`}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <CreditCard className="w-4 h-4" />
              Try Again
            </Link>
          )}
          <Link
            to="/domains/search"
            className="btn-outline w-full flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Continue Shopping
          </Link>
        </div>
      </div>
    </div>
  );
}
