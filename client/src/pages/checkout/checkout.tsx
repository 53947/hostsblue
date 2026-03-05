import { useSearchParams, Navigate, useOutletContext } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { orderApi } from '@/lib/api';
import { Loader2, CreditCard, Lock, CheckCircle, AlertTriangle } from 'lucide-react';
import { useState, useEffect } from 'react';
import type { CartItem } from '@/hooks/use-cart';

interface CartContext {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  clearCart: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  domain_registration: 'Domain Registration',
  domain_transfer: 'Domain Transfer',
  hosting_plan: 'WordPress Hosting',
  email_service: 'Professional Email',
  ssl_certificate: 'SSL Certificate',
  sitelock: 'SiteLock Security',
  website_builder: 'Website Builder',
  privacy_protection: 'WHOIS Privacy',
};

function mapCartItemsToOrderItems(items: CartItem[]) {
  return items.map(item => {
    const base: any = {
      type: item.type,
      termYears: item.termMonths >= 12 ? Math.round(item.termMonths / 12) : item.termMonths,
    };

    const config = item.configuration || {};

    if (['domain_registration', 'domain_transfer', 'domain_renewal', 'privacy_protection'].includes(item.type)) {
      base.domain = config.domain || config.sld || '';
      base.tld = config.tld || '';
      if (config.authCode) base.options = { authCode: config.authCode };
      if (config.domainId) base.options = { ...base.options, domainId: config.domainId };
    }

    if (['hosting_plan', 'email_service'].includes(item.type) && config.planId) {
      base.planId = config.planId;
      if (config.domain) base.domain = config.domain;
      if (config.username) base.options = { username: config.username };
    }

    if (item.type === 'ssl_certificate') {
      base.domain = config.domain || '';
      base.options = {
        price: item.price,
        productType: config.productType || 'dv',
        provider: config.provider || 'sectigo',
        productId: config.productId,
        approverEmail: config.approverEmail,
      };
    }

    if (item.type === 'sitelock') {
      base.domain = config.domain || '';
      base.options = {
        price: item.price,
        planSlug: config.planSlug || 'basic',
        domainId: config.domainId,
      };
    }

    return base;
  });
}

export function CheckoutPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const orderUuid = searchParams.get('order');
  const [isProcessing, setIsProcessing] = useState(false);

  // Get cart from outlet context (provided by RootLayout)
  let cart: CartContext | null = null;
  try {
    cart = useOutletContext<CartContext>();
  } catch {
    // Not in an outlet context (shouldn't happen, but safe fallback)
  }

  const hasCartItems = cart && cart.itemCount > 0 && !orderUuid;

  // Create order from cart items
  const createOrderMutation = useMutation({
    mutationFn: (items: CartItem[]) => {
      const orderItems = mapCartItemsToOrderItems(items);
      return orderApi.createOrder({ items: orderItems });
    },
    onSuccess: (data) => {
      cart?.clearCart();
      setSearchParams({ order: data.order.uuid }, { replace: true });
    },
  });

  // Auto-create order from cart when page loads with cart items
  useEffect(() => {
    if (hasCartItems && !createOrderMutation.isPending && !createOrderMutation.isSuccess) {
      createOrderMutation.mutate(cart!.items);
    }
  }, [hasCartItems]);

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', orderUuid],
    queryFn: () => orderApi.getOrder(orderUuid!),
    enabled: !!orderUuid,
  });

  const checkoutMutation = useMutation({
    mutationFn: () => orderApi.checkout(orderUuid!),
    onSuccess: (data) => {
      window.location.href = data.paymentUrl;
    },
  });

  // Show loading while creating order from cart
  if (hasCartItems || createOrderMutation.isPending) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-[#064A6C] animate-spin" />
        <p className="text-gray-500">Creating your order...</p>
      </div>
    );
  }

  // No order UUID and no cart items — nothing to checkout
  if (!orderUuid && !hasCartItems) {
    return <Navigate to="/" replace />;
  }

  // Order creation failed
  if (createOrderMutation.isError) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Unable to create order</h2>
        <p className="text-gray-500 text-center max-w-md">
          {(createOrderMutation.error as any)?.message || 'Something went wrong. Please try again.'}
        </p>
        <button
          onClick={() => window.history.back()}
          className="btn-primary mt-2"
        >
          Go Back
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#064A6C] animate-spin" />
      </div>
    );
  }

  const handleCheckout = () => {
    setIsProcessing(true);
    checkoutMutation.mutate();
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] py-12">
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
                        {TYPE_LABELS[item.type] || item.type}
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
                  <span className="text-gray-900">${((order?.subtotal || 0) / 100).toFixed(2)}</span>
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
                  <span className="text-gray-900">${((order?.total || 0) / 100).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Payment Method */}
            <div className="bg-white border border-gray-200 rounded-[7px] p-6 mt-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment Method</h2>
              <div className="flex items-center gap-4 p-4 bg-white rounded-[7px] border border-gray-200">
                <div className="w-12 h-8 bg-[#064A6C] rounded flex items-center justify-center">
                  <span className="text-white font-bold text-xs">SB</span>
                </div>
                <div>
                  <p className="text-gray-900 font-medium">swipesblue Secure Checkout</p>
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
                    ${((order?.total || 0) / 100).toFixed(2)}
                  </span>
                </div>
                <p className="text-xs text-gray-400">
                  Including applicable taxes
                </p>
              </div>

              <button
                onClick={handleCheckout}
                disabled={isProcessing || !orderUuid}
                className="w-full bg-[#064A6C] hover:bg-[#053A55] text-white font-medium py-4 rounded-[7px] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
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

              {checkoutMutation.isError && (
                <p className="text-red-500 text-sm text-center mt-3">
                  {(checkoutMutation.error as any)?.message || 'Payment failed. Please try again.'}
                </p>
              )}

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
