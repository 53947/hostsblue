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
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
          WordPress Hosting Plans
        </h1>
        <p className="text-zinc-400 max-w-2xl mx-auto">
          Fast, secure, and reliable WordPress hosting with automatic updates, 
          daily backups, and 24/7 support.
        </p>

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-4 mt-8">
          <button
            onClick={() => setBillingCycle('monthly')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              billingCycle === 'monthly'
                ? 'bg-purple-500 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingCycle('yearly')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              billingCycle === 'yearly'
                ? 'bg-purple-500 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            Yearly
            <span className="ml-2 text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">
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
            className={`card relative ${plan.isPopular ? 'border-purple-500/50' : ''}`}
          >
            {plan.isPopular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-purple-500 text-white text-xs font-medium px-3 py-1 rounded-full">
                  Most Popular
                </span>
              </div>
            )}

            <div className="text-center mb-6">
              <h3 className="text-xl font-semibold text-white mb-2">{plan.name}</h3>
              <p className="text-zinc-400 text-sm">{plan.description}</p>
            </div>

            <div className="text-center mb-6">
              <span className="text-4xl font-bold text-white">
                ${billingCycle === 'yearly' 
                  ? Math.round(plan.yearlyPrice / 12 / 100) 
                  : Math.round(plan.monthlyPrice / 100)
                }
              </span>
              <span className="text-zinc-500">/month</span>
              {billingCycle === 'yearly' && (
                <p className="text-sm text-zinc-500 mt-1">
                  ${(plan.yearlyPrice / 100).toFixed(2)} billed annually
                </p>
              )}
            </div>

            <ul className="space-y-3 mb-8">
              <li className="flex items-center gap-3 text-sm text-zinc-300">
                <Check className="w-4 h-4 text-green-400" />
                {plan.features.sites} WordPress {plan.features.sites === 1 ? 'Site' : 'Sites'}
              </li>
              <li className="flex items-center gap-3 text-sm text-zinc-300">
                <Check className="w-4 h-4 text-green-400" />
                {plan.features.storageGB}GB SSD Storage
              </li>
              <li className="flex items-center gap-3 text-sm text-zinc-300">
                <Check className="w-4 h-4 text-green-400" />
                {plan.features.visitors.toLocaleString()} Monthly Visits
              </li>
              <li className="flex items-center gap-3 text-sm text-zinc-300">
                <Check className="w-4 h-4 text-green-400" />
                {plan.features.ssl && 'Free SSL Certificate'}
              </li>
              <li className="flex items-center gap-3 text-sm text-zinc-300">
                <Check className="w-4 h-4 text-green-400" />
                {plan.features.cdn && 'Global CDN'}
              </li>
              <li className="flex items-center gap-3 text-sm text-zinc-300">
                <Check className="w-4 h-4 text-green-400" />
                {plan.features.backups} Backups
              </li>
              {plan.features.staging && (
                <li className="flex items-center gap-3 text-sm text-zinc-300">
                  <Check className="w-4 h-4 text-green-400" />
                  Staging Environment
                </li>
              )}
            </ul>

            <button
              onClick={() => createOrderMutation.mutate(plan.id)}
              disabled={createOrderMutation.isPending}
              className={`w-full py-3 rounded-lg font-medium transition-colors ${
                plan.isPopular
                  ? 'bg-purple-500 hover:bg-purple-600 text-white'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-white'
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
        <h2 className="text-2xl font-bold text-white text-center mb-8">
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
            <div key={feature} className="flex items-center gap-2 text-zinc-300">
              <Check className="w-4 h-4 text-green-400" />
              <span className="text-sm">{feature}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
