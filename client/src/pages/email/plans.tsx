import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Check, ArrowRight } from 'lucide-react';

const emailPlans = [
  {
    name: 'Starter',
    price: { monthly: 299, yearly: 2990 },
    storage: '10 GB',
    accounts: 5,
    features: ['Custom domain email', 'Spam filtering', 'Mobile access', 'Webmail'],
  },
  {
    name: 'Business',
    price: { monthly: 599, yearly: 5990 },
    storage: '50 GB',
    accounts: 25,
    features: ['Custom domain email', 'Advanced spam filtering', 'Mobile access', 'Webmail', 'Calendar & contacts', 'Email aliases'],
    popular: true,
  },
  {
    name: 'Enterprise',
    price: { monthly: 999, yearly: 9990 },
    storage: '100 GB',
    accounts: -1,
    features: ['Custom domain email', 'Advanced spam filtering', 'Mobile access', 'Webmail', 'Calendar & contacts', 'Email aliases', 'Archiving', 'eDiscovery', 'Priority support'],
  },
];

export function EmailPlansPage() {
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');

  return (
    <div className="max-w-7xl mx-auto px-4 py-16">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Professional Email Hosting</h1>
        <p className="text-gray-500 max-w-2xl mx-auto">Secure, reliable email for your business domain with spam protection and mobile access.</p>
        <div className="flex items-center justify-center gap-4 mt-8">
          <button onClick={() => setBilling('monthly')} className={`px-4 py-2 rounded-[7px] font-medium transition-colors ${billing === 'monthly' ? 'bg-[#1844A6] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Monthly</button>
          <button onClick={() => setBilling('yearly')} className={`px-4 py-2 rounded-[7px] font-medium transition-colors ${billing === 'yearly' ? 'bg-[#1844A6] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            Yearly <span className="ml-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Save 17%</span>
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
        {emailPlans.map((plan) => (
          <div key={plan.name} className={`bg-white border rounded-[7px] p-6 transition-all ${plan.popular ? 'border-[#1844A6] shadow-md relative' : 'border-gray-200'}`}>
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-[#1844A6] text-white text-xs font-medium px-3 py-1 rounded-full">Most Popular</span>
              </div>
            )}
            <div className="text-center mb-6">
              <Mail className="w-8 h-8 text-[#1844A6] mx-auto mb-3" />
              <h3 className="text-xl font-semibold text-gray-900">{plan.name}</h3>
            </div>
            <div className="text-center mb-6">
              <span className="text-4xl font-bold text-gray-900">${((billing === 'yearly' ? plan.price.yearly / 12 : plan.price.monthly) / 100).toFixed(2)}</span>
              <span className="text-gray-500">/mo</span>
              {billing === 'yearly' && <p className="text-sm text-gray-400 mt-1">${(plan.price.yearly / 100).toFixed(2)}/year</p>}
            </div>
            <p className="text-sm text-gray-500 text-center mb-4">{plan.storage} storage · {plan.accounts === -1 ? 'Unlimited' : plan.accounts} accounts</p>
            <ul className="space-y-2 mb-6">
              {plan.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0" /> {f}
                </li>
              ))}
            </ul>
            <Link to="/register" className={`block text-center py-3 rounded-[7px] font-medium transition-colors ${plan.popular ? 'bg-[#1844A6] hover:bg-[#133A8A] text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
              Get Started
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
