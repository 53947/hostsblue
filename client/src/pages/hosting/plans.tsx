import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Zap, Shield, Server, ChevronDown } from 'lucide-react';

const plans = [
  {
    name: 'Starter',
    monthly: 9.99,
    features: [
      '1 WordPress Site',
      '10 GB SSD Storage',
      '25,000 Monthly Visits',
      'Free SSL Certificate',
      'Daily Backups',
      '24/7 Support',
    ],
    cta: 'Get Started',
    popular: false,
  },
  {
    name: 'Growth',
    monthly: 24.99,
    features: [
      '5 WordPress Sites',
      '50 GB SSD Storage',
      '100,000 Monthly Visits',
      'Free SSL Certificate',
      'Daily Backups',
      'Staging Environment',
      'Global CDN',
      '24/7 Priority Support',
    ],
    cta: 'Get Started',
    popular: true,
  },
  {
    name: 'Business',
    monthly: 49.99,
    features: [
      '20 WordPress Sites',
      '200 GB SSD Storage',
      '500,000 Monthly Visits',
      'Free SSL Certificate',
      'Daily Backups',
      'Staging Environment',
      'Global CDN',
      'White-Label Reports',
      'Dedicated IP',
      '24/7 Priority Support',
    ],
    cta: 'Get Started',
    popular: false,
  },
  {
    name: 'Enterprise',
    monthly: 99.99,
    features: [
      'Unlimited WordPress Sites',
      '500 GB SSD Storage',
      'Unlimited Monthly Visits',
      'Free SSL Certificate',
      'Real-Time Backups',
      'Staging Environment',
      'Global CDN',
      'White-Label Reports',
      'Dedicated IP',
      'Custom Server Config',
      'Dedicated Account Manager',
    ],
    cta: 'Contact Sales',
    popular: false,
  },
];

const comparisonFeatures = [
  { feature: 'WordPress Sites', starter: '1', growth: '5', business: '20', enterprise: 'Unlimited' },
  { feature: 'SSD Storage', starter: '10 GB', growth: '50 GB', business: '200 GB', enterprise: '500 GB' },
  { feature: 'Monthly Visits', starter: '25K', growth: '100K', business: '500K', enterprise: 'Unlimited' },
  { feature: 'Free SSL', starter: true, growth: true, business: true, enterprise: true },
  { feature: 'Daily Backups', starter: true, growth: true, business: true, enterprise: true },
  { feature: 'Global CDN', starter: false, growth: true, business: true, enterprise: true },
  { feature: 'Staging Environment', starter: false, growth: true, business: true, enterprise: true },
  { feature: 'Dedicated IP', starter: false, growth: false, business: true, enterprise: true },
  { feature: 'White-Label Reports', starter: false, growth: false, business: true, enterprise: true },
  { feature: 'Dedicated Account Manager', starter: false, growth: false, business: false, enterprise: true },
];

const faqs = [
  {
    q: 'What is managed WordPress hosting?',
    a: 'Managed WordPress hosting means we handle all the technical details for you, including automatic WordPress updates, security patches, daily backups, and performance optimization. You focus on building your site while we keep it fast, secure, and online.',
  },
  {
    q: 'Can I migrate my existing WordPress site?',
    a: 'Yes. All plans include free migration. Our team will transfer your WordPress site, database, files, and emails with zero downtime. Simply provide your current hosting details and we handle the rest.',
  },
  {
    q: 'Do you offer a money-back guarantee?',
    a: 'Absolutely. All hosting plans come with a 30-day money-back guarantee. If you are not completely satisfied, contact our support team within 30 days for a full refund.',
  },
  {
    q: 'What kind of support do you provide?',
    a: 'All plans include 24/7 support via live chat and email. Growth plans and above receive priority support with faster response times. Enterprise plans include a dedicated account manager.',
  },
  {
    q: 'Can I upgrade or downgrade my plan?',
    a: 'Yes, you can change your plan at any time from your dashboard. Upgrades take effect immediately and you only pay the prorated difference. Downgrades apply at your next billing cycle.',
  },
  {
    q: 'Is staging included?',
    a: 'Staging environments are included with Growth, Business, and Enterprise plans. You can create a one-click copy of your live site to test changes before pushing them to production.',
  },
];

export function HostingPlansPage() {
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const getPrice = (monthly: number) => {
    if (billing === 'annual') {
      return (monthly * 0.8).toFixed(2);
    }
    return monthly.toFixed(2);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-16">
      {/* Hero */}
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-[800] text-gray-900 mb-4">
          WordPress Hosting
        </h1>
        <p className="text-[#4B5563] max-w-2xl mx-auto text-lg">
          Fully managed WordPress hosting with automatic updates, daily backups, and blazing-fast performance. Focus on your content while we handle the rest.
        </p>

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-4 mt-8">
          <button
            onClick={() => setBilling('monthly')}
            className={`px-5 py-2.5 rounded-[7px] font-medium transition-colors ${
              billing === 'monthly'
                ? 'bg-[#064A6C] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBilling('annual')}
            className={`px-5 py-2.5 rounded-[7px] font-medium transition-colors ${
              billing === 'annual'
                ? 'bg-[#064A6C] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Annual
            <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-[7px]">
              Save 20%
            </span>
          </button>
        </div>
      </div>

      {/* Plan Cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={`bg-white rounded-[7px] p-6 flex flex-col relative ${
              plan.popular
                ? 'border-2 border-[#064A6C] shadow-lg'
                : 'border border-[#E5E7EB]'
            }`}
          >
            {plan.popular && (
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                <span className="bg-[#FFD700] text-[#09080E] text-xs font-[800] px-4 py-1 rounded-[7px]">
                  POPULAR
                </span>
              </div>
            )}

            <div className="text-center mb-6">
              <h3 className="text-xl font-[800] text-gray-900 mb-2">{plan.name}</h3>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-4xl font-[800] text-gray-900">
                  ${getPrice(plan.monthly)}
                </span>
                <span className="text-gray-500">/mo</span>
              </div>
              {billing === 'annual' && (
                <p className="text-sm text-gray-400 mt-1">
                  ${(plan.monthly * 0.8 * 12).toFixed(2)} billed annually
                </p>
              )}
            </div>

            <ul className="space-y-3 mb-8 flex-1">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-[#10B981] flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-[#4B5563]">{feature}</span>
                </li>
              ))}
            </ul>

            <Link
              to="/register"
              className={`block text-center font-medium px-6 py-3 rounded-[7px] transition-colors btn-arrow-hover justify-center ${
                plan.popular
                  ? 'bg-[#064A6C] hover:bg-[#053A55] text-white'
                  : 'border border-gray-300 text-gray-700 hover:border-[#064A6C] hover:text-[#064A6C]'
              }`}
            >
              {plan.cta}
            </Link>
          </div>
        ))}
      </div>

      {/* Features Comparison Table */}
      <hr className="section-divider" />

      <section>
        <h2 className="text-2xl font-[800] text-gray-900 text-center mb-8">
          Features Comparison
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full max-w-5xl mx-auto">
            <thead>
              <tr className="border-b border-[#E5E7EB]">
                <th className="text-left py-4 px-4 text-sm font-[800] text-gray-900">Feature</th>
                <th className="text-center py-4 px-4 text-sm font-[800] text-gray-900">Starter</th>
                <th className="text-center py-4 px-4 text-sm font-[800] text-[#064A6C]">Growth</th>
                <th className="text-center py-4 px-4 text-sm font-[800] text-gray-900">Business</th>
                <th className="text-center py-4 px-4 text-sm font-[800] text-gray-900">Enterprise</th>
              </tr>
            </thead>
            <tbody>
              {comparisonFeatures.map((row) => (
                <tr key={row.feature} className="border-b border-[#E5E7EB]">
                  <td className="py-3 px-4 text-sm text-[#4B5563]">{row.feature}</td>
                  {(['starter', 'growth', 'business', 'enterprise'] as const).map((plan) => (
                    <td key={plan} className="text-center py-3 px-4">
                      {typeof row[plan] === 'boolean' ? (
                        row[plan] ? (
                          <Check className="w-4 h-4 text-[#10B981] mx-auto" />
                        ) : (
                          <span className="text-gray-300">&mdash;</span>
                        )
                      ) : (
                        <span className="text-sm text-gray-900 font-medium">{row[plan]}</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* All Plans Include */}
      <hr className="section-divider" />

      <section>
        <h2 className="text-2xl font-[800] text-gray-900 text-center mb-8">
          All Plans Include
        </h2>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {[
            { icon: Shield, title: 'Free SSL', desc: 'Every site gets a free SSL certificate for secure HTTPS connections.' },
            { icon: Server, title: 'Daily Backups', desc: 'Automatic daily backups with one-click restore to keep your data safe.' },
            { icon: Zap, title: '99.9% Uptime', desc: 'Enterprise-grade infrastructure with a guaranteed 99.9% uptime SLA.' },
            { icon: Server, title: 'Free Migration', desc: 'Our team migrates your existing WordPress site at no extra cost.' },
            { icon: Shield, title: '24/7 Support', desc: 'Expert WordPress support available around the clock via chat and email.' },
            { icon: Server, title: 'Staging', desc: 'Test changes safely on a staging copy before pushing to production.' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-white border border-[#E5E7EB] rounded-[7px] p-6">
              <div className="w-10 h-10 rounded-[7px] bg-[#064A6C]/10 flex items-center justify-center mb-4">
                <Icon className="w-5 h-5 text-[#064A6C]" />
              </div>
              <h3 className="font-[800] text-gray-900 mb-1">{title}</h3>
              <p className="text-sm text-gray-500">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <hr className="section-divider" />

      <section>
        <h2 className="text-2xl font-[800] text-gray-900 text-center mb-8">
          Frequently Asked Questions
        </h2>
        <div className="max-w-3xl mx-auto space-y-3">
          {faqs.map((faq, index) => (
            <div key={index} className="bg-white border border-[#E5E7EB] rounded-[7px] overflow-hidden">
              <button
                onClick={() => setOpenFaq(openFaq === index ? null : index)}
                className="w-full flex items-center justify-between p-5 text-left"
              >
                <span className="font-medium text-gray-900 pr-4">{faq.q}</span>
                <ChevronDown
                  className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform ${
                    openFaq === index ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {openFaq === index && (
                <div className="px-5 pb-5">
                  <p className="text-[#4B5563] leading-relaxed">{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
