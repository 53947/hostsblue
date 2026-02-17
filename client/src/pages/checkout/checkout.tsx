import { useSearchParams, Navigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { orderApi } from '@/lib/api';
import { Loader2, CreditCard, Lock, CheckCircle } from 'lucide-react';
import { useState } from 'react';

export function CheckoutPage() {
  const [searchParams] = useSearchParams();
  const orderUuid = searchParams.get('order');
  const [isProcessing, setIsProcessing] = useState(false);

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', orderUuid],
    queryFn: () => orderApi.getOrder(orderUuid!),
    enabled: !!orderUuid,
  });

  const checkoutMutation = useMutation({
    mutationFn: () => orderApi.checkout(orderUuid!),
    onSuccess: (data) => {
      // Redirect to SwipesBlue payment page
      window.location.href = data.paymentUrl;
    },
  });

  if (!orderUuid) {
    return <Navigate to="/" replace />;
  }

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#1844A6] animate-spin" />
      </div>
    );
  }

  const handleCheckout = () => {
    setIsProcessing(true);
    checkoutMutation.mutate();
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Checkout</h1>
          <p className="text-gray-500">Complete your purchase securely</p>
        </div>

        <div className="grid md:grid-cols-5 gap-8">
          {/* Order Summary */}
          <div className="md:col-span-3">
            <div className="bg-white border border-gray-200 rounded-[7px] p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Order Summary</h2>

              <div className="space-y-4">
                {order?.items?.map((item: any) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between py-4 border-b border-gray-200"
                  >
                    <div>
                      <h3 className="text-gray-900 font-medium">{item.description}</h3>
                      <p className="text-sm text-gray-500">
                        {item.type === 'domain_registration' && 'Domain Registration'}
                        {item.type === 'hosting_plan' && 'WordPress Hosting'}
                      </p>
                    </div>
                    <span className="text-gray-900 font-medium">
                      ${(item.totalPrice / 100).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="text-gray-900">${(order?.subtotal / 100).toFixed(2)}</span>
                </div>
                {order?.discountAmount > 0 && (
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-500">Discount</span>
                    <span className="text-green-600">
                      -${(order.discountAmount / 100).toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between text-lg font-semibold mt-4">
                  <span className="text-gray-900">Total</span>
                  <span className="text-gray-900">${(order?.total / 100).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Payment Method */}
            <div className="bg-white border border-gray-200 rounded-[7px] p-6 mt-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment Method</h2>
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-[7px] border border-gray-200">
                <div className="w-12 h-8 bg-[#1844A6] rounded flex items-center justify-center">
                  <span className="text-white font-bold text-xs">SB</span>
                </div>
                <div>
                  <p className="text-gray-900 font-medium">SwipesBlue Secure Checkout</p>
                  <p className="text-sm text-gray-500">Credit Card, Debit Card, or Bank Transfer</p>
                </div>
                <Lock className="w-5 h-5 text-green-500 ml-auto" />
              </div>
            </div>
          </div>

          {/* Checkout Button */}
          <div className="md:col-span-2">
            <div className="bg-white border border-gray-200 rounded-[7px] p-6 sticky top-24">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Complete Purchase</h2>

              <div className="space-y-4 mb-6">
                <div className="flex items-center gap-3 text-sm text-gray-500">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span>Secure payment processing</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-500">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span>Instant activation</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-500">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span>30-day money back guarantee</span>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4 mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-500">Order Total</span>
                  <span className="text-2xl font-bold text-gray-900">
                    ${(order?.total / 100).toFixed(2)}
                  </span>
                </div>
                <p className="text-xs text-gray-400">
                  Including applicable taxes
                </p>
              </div>

              <button
                onClick={handleCheckout}
                disabled={isProcessing}
                className="w-full bg-[#1844A6] hover:bg-[#133A8A] text-white font-medium py-4 rounded-[7px] transition-colors flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CreditCard className="w-5 h-5" />
                    Complete Purchase
                  </>
                )}
              </button>

              <p className="text-xs text-gray-400 text-center mt-4">
                By completing this purchase, you agree to our Terms of Service and Privacy Policy.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
