import { useQuery, useMutation } from '@tanstack/react-query';
import { hostingApi, orderApi } from '@/lib/api';
import { Server, Check, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface Plan {
  id: number;
  slug: string;
  name: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  features: {
    storageGB: number;
    bandwidthGB: number;
    sites: number;
    visitors: number;
    ssl: boolean;
    cdn: boolean;
    backups: string;
    staging: boolean;
  };
  isPopular: boolean;
}

export function HostingPlansPage() {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const navigate = useNavigate();

  const { data: plans, isLoading } = useQuery({
    queryKey: ['hosting-plans'],
    queryFn: hostingApi.getPlans,
  });

  const createOrderMutation = useMutation({
    mutationFn: (planId: number) => {
      return orderApi.createOrder({
        items: [{
          type: 'hosting_plan',
          planId,
          termYears: billingCycle === 'yearly' ? 12 : 1,
        }],
      });
    },
    onSuccess: (data) => {
      navigate(`/checkout?order=${data.order.uuid}`);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-[#1844A6] animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
          WordPress Hosting Plans
        </h1>
        <p className="text-gray-500 max-w-2xl mx-auto">
          Fast, secure, and reliable WordPress hosting with automatic updates,
          daily backups, and 24/7 support.
        </p>

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-4 mt-8">
          <button
            onClick={() => setBillingCycle('monthly')}
            className={`px-4 py-2 rounded-[7px] font-medium transition-colors ${
              billingCycle === 'monthly'
                ? 'bg-[#1844A6] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingCycle('yearly')}
            className={`px-4 py-2 rounded-[7px] font-medium transition-colors ${
              billingCycle === 'yearly'
                ? 'bg-[#1844A6] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Yearly
            <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
              Save 20%
            </span>
          </button>
        </div>
      </div>

      {/* Plans */}
      <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {plans?.map((plan: Plan) => (
          <div
            key={plan.id}
            className={`bg-white border rounded-[7px] p-6 relative ${plan.isPopular ? 'border-[#1844A6] shadow-md' : 'border-gray-200'}`}
          >
            {plan.isPopular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-[#1844A6] text-white text-xs font-medium px-3 py-1 rounded-full">
                  Most Popular
                </span>
              </div>
            )}

            <div className="text-center mb-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">{plan.name}</h3>
              <p className="text-gray-500 text-sm">{plan.description}</p>
            </div>

            <div className="text-center mb-6">
              <span className="text-4xl font-bold text-gray-900">
                ${billingCycle === 'yearly'
                  ? Math.round(plan.yearlyPrice / 12 / 100)
                  : Math.round(plan.monthlyPrice / 100)
                }
              </span>
              <span className="text-gray-500">/month</span>
              {billingCycle === 'yearly' && (
                <p className="text-sm text-gray-400 mt-1">
                  ${(plan.yearlyPrice / 100).toFixed(2)} billed annually
                </p>
              )}
            </div>

            <ul className="space-y-3 mb-8">
              <li className="flex items-center gap-3 text-sm text-gray-600">
                <Check className="w-4 h-4 text-green-500" />
                {plan.features.sites} WordPress {plan.features.sites === 1 ? 'Site' : 'Sites'}
              </li>
              <li className="flex items-center gap-3 text-sm text-gray-600">
                <Check className="w-4 h-4 text-green-500" />
                {plan.features.storageGB}GB SSD Storage
              </li>
              <li className="flex items-center gap-3 text-sm text-gray-600">
                <Check className="w-4 h-4 text-green-500" />
                {plan.features.visitors.toLocaleString()} Monthly Visits
              </li>
              <li className="flex items-center gap-3 text-sm text-gray-600">
                <Check className="w-4 h-4 text-green-500" />
                {plan.features.ssl && 'Free SSL Certificate'}
              </li>
              <li className="flex items-center gap-3 text-sm text-gray-600">
                <Check className="w-4 h-4 text-green-500" />
                {plan.features.cdn && 'Global CDN'}
              </li>
              <li className="flex items-center gap-3 text-sm text-gray-600">
                <Check className="w-4 h-4 text-green-500" />
                {plan.features.backups} Backups
              </li>
              {plan.features.staging && (
                <li className="flex items-center gap-3 text-sm text-gray-600">
                  <Check className="w-4 h-4 text-green-500" />
                  Staging Environment
                </li>
              )}
            </ul>

            <button
              onClick={() => createOrderMutation.mutate(plan.id)}
              disabled={createOrderMutation.isPending}
              className={`w-full py-3 rounded-[7px] font-medium transition-colors ${
                plan.isPopular
                  ? 'bg-[#1844A6] hover:bg-[#133A8A] text-white'
                  : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {createOrderMutation.isPending && createOrderMutation.variables === plan.id
                ? 'Processing...'
                : 'Get Started'}
            </button>
          </div>
        ))}
      </div>

      {/* Features Comparison */}
      <div className="mt-20">
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">
          All Plans Include
        </h2>
        <div className="grid md:grid-cols-4 gap-6 max-w-4xl mx-auto">
          {[
            'WordPress Pre-installed',
            'Automatic Updates',
            'DDoS Protection',
            '24/7 Support',
            '99.9% Uptime SLA',
            'Free Migration',
            'Developer Tools',
            'Advanced Analytics',
          ].map((feature) => (
            <div key={feature} className="flex items-center gap-2 text-gray-600">
              <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
              <span className="text-sm">{feature}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
