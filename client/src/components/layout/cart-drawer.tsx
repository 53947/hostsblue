import { Link } from 'react-router-dom';
import { X, ShoppingCart, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CartItem } from '@/hooks/use-cart';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  subtotal: number;
  onRemoveItem: (id: string) => void;
  onClearCart: () => void;
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function CartDrawer({ isOpen, onClose, items, subtotal, onRemoveItem, onClearCart }: CartDrawerProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-[#1844A6]" />
            <h2 className="text-lg font-semibold text-gray-900">Your Cart</h2>
            <span className="bg-[#1844A6] text-white text-xs font-medium px-2 py-0.5 rounded-full">
              {items.length}
            </span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {items.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Your cart is empty</p>
              <p className="text-sm text-gray-400 mt-1">Add services to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map(item => (
                <div key={item.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{item.name}</p>
                    <p className="text-sm text-gray-500 truncate">{item.description}</p>
                    <p className="text-sm font-medium text-[#1844A6] mt-1">
                      {formatPrice(item.price)}
                      {item.termMonths > 0 && (
                        <span className="text-gray-400 font-normal">
                          /{item.termMonths >= 12 ? 'yr' : 'mo'}
                        </span>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={() => onRemoveItem(item.id)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-gray-200 px-6 py-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Subtotal</span>
              <span className="text-lg font-semibold text-gray-900">{formatPrice(subtotal)}</span>
            </div>
            <Link to="/checkout" onClick={onClose}>
              <Button variant="primary" size="lg" className="w-full">
                Proceed to Checkout
              </Button>
            </Link>
            <button
              onClick={onClearCart}
              className="w-full text-sm text-gray-500 hover:text-gray-700 text-center py-1"
            >
              Clear Cart
            </button>
          </div>
        )}
      </div>
    </>
  );
}
