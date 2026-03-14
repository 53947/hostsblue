import { useState } from 'react';
import { X, Zap, Loader2, ArrowRight } from 'lucide-react';
import { aiCreditsApi } from '@/lib/api';
import { Brandsignature } from '@/components/ui/brandsignature';

const CREDIT_AMOUNTS = [
  { cents: 500, label: '$5.00', desc: '~250 AI actions' },
  { cents: 1000, label: '$10.00', desc: '~500 AI actions' },
  { cents: 2500, label: '$25.00', desc: '~1,250 AI actions' },
  { cents: 5000, label: '$50.00', desc: '~2,500 AI actions' },
];

export function AddCreditsModal({ onClose }: { onClose: () => void }) {
  const [selected, setSelected] = useState(1000);
  const [purchasing, setPurchasing] = useState(false);

  const handlePurchase = async () => {
    if (purchasing) return;
    setPurchasing(true);
    try {
      const result = await aiCreditsApi.quickPurchase(selected);
      if (result.paymentUrl) {
        window.open(result.paymentUrl, '_blank');
      }
      onClose();
    } catch (err) {
      console.error('Purchase failed:', err);
      setPurchasing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-[7px] max-w-sm w-full" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-[#064A6C]" />
            <h2 className="text-lg font-semibold text-gray-900">Add AI Credits</h2>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Amount selection */}
        <div className="p-4 space-y-2">
          {CREDIT_AMOUNTS.map(amount => (
            <button
              key={amount.cents}
              onClick={() => setSelected(amount.cents)}
              className={`w-full flex items-center justify-between p-3 rounded-[7px] border transition-all ${
                selected === amount.cents
                  ? 'border-[#064A6C] bg-[#064A6C]/5 ring-1 ring-[#064A6C]'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="text-left">
                <span className="text-sm font-semibold text-gray-900">{amount.label}</span>
                <p className="text-xs text-gray-500">{amount.desc}</p>
              </div>
              {selected === amount.cents && (
                <div className="w-5 h-5 rounded-full bg-[#064A6C] flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full" />
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Purchase button */}
        <div className="p-4 pt-0">
          <button
            onClick={handlePurchase}
            disabled={purchasing}
            className="w-full py-3 bg-[#064A6C] hover:bg-[#053C58] text-white rounded-[7px] text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {purchasing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                Purchase ${(selected / 100).toFixed(2)}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
          <p className="text-[10px] text-gray-400 text-center mt-2 flex items-center justify-center gap-1">
            Powered by <Brandsignature brand="swipesblue" size={12} /> — secure payment
          </p>
        </div>
      </div>
    </div>
  );
}
