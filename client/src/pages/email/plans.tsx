import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronDown, Mail, ArrowRight } from 'lucide-react';

const emailPlans = [
  {
    name: 'Starter',
    monthly: 2.99,
    mailboxes: 1,
    storage: '10 GB',
    features: [
      '1 Mailbox',
      '10 GB Storage',
      'Custom Domain Email',
      'Spam Filtering',
      'Virus Protection',
      'Webmail Access',
      'Mobile Sync',
    ],
    popular: false,
  },
  {
    name: 'Business',
    monthly: 9.99,
    mailboxes: 5,
    storage: '25 GB',
    features: [
      '5 Mailboxes',
      '25 GB Storage per Mailbox',
      'Custom Domain Email',
      'Advanced Spam Filtering',
      'Virus Protection',
      'Webmail Access',
      'Mobile Sync',
      'Shared Calendars',
      'Auto-Responders',
      'Email Aliases',
    ],
    popular: true,
  },
  {
    name: 'Enterprise',
    monthly: 24.99,
    mailboxes: 25,
    storage: '50 GB',
    features: [
      '25 Mailboxes',
      '50 GB Storage per Mailbox',
      'Custom Domain Email',
      'Advanced Spam Filtering',
      'Virus Protection',
      'Webmail Access',
      'Mobile Sync',
      'Shared Calendars',
      'Auto-Responders',
      'Email Aliases',
      'Email Archiving',
      'eDiscovery',
      'Priority Support',
    ],
    popular: false,
  },
];

const faqs = [
  {
    q: 'Can I use my own domain for email?',
    a: 'Yes. All email plans use your custom domain (e.g., you@yourbusiness.com). If you already have a domain registered with hostsblue, we configure the DNS records automatically. If your domain is elsewhere, we provide simple DNS instructions.',
  },
  {
    q: 'What email clients are supported?',
    a: 'Our email works with all major clients including Outlook, Apple Mail, Thunderbird, Gmail (via IMAP), and any standard IMAP/POP3 client. You also get full webmail access from any browser.',
  },
  {
    q: 'How does spam filtering work?',
    a: 'All plans include spam filtering that automatically scans incoming messages and quarantines suspicious emails. Business and Enterprise plans include advanced filtering with machine learning and customizable rules.',
  },
  {
    q: 'Can I migrate from my current email provider?',
    a: 'Absolutely. We offer free email migration from any provider. Our team will transfer all your existing emails, contacts, and calendar data with zero downtime.',
  },
  {
    q: 'Is there a storage limit per mailbox?',
    a: 'Each mailbox has a dedicated storage allocation based on your plan: 10 GB for Starter, 25 GB for Business, and 50 GB for Enterprise. Storage is per mailbox, not shared across accounts.',
  },
  {
    q: 'Do you support shared calendars and contacts?',
    a: 'Shared calendars and contacts are available on the Business and Enterprise plans. Team members can view, create, and manage shared calendars for better collaboration.',
  },
];

export function EmailPlansPage() {
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
          Professional Email
        </h1>
        <p className="text-[#4B5563] max-w-2xl mx-auto text-lg">
          Secure, reliable email hosting for your business domain. Custom addresses, spam protection, and seamless mobile sync included with every plan.
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
      <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto mb-16">
        {emailPlans.map((plan) => (
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
              <Mail className="w-8 h-8 text-[#064A6C] mx-auto mb-3" />
              <h3 className="text-xl font-[800] text-gray-900 mb-1">{plan.name}</h3>
              <p className="text-sm text-gray-500">
                {plan.mailboxes} {plan.mailboxes === 1 ? 'mailbox' : 'mailboxes'} &middot; {plan.storage} each
              </p>
            </div>

            <div className="text-center mb-6">
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
              Get Started
            </Link>
          </div>
        ))}
      </div>

      {/* Email Migration */}
      <hr className="section-divider" />

      <section className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-[7px] p-8 md:p-12 text-center">
        <div className="max-w-2xl mx-auto">
          <div className="w-12 h-12 rounded-[7px] bg-[#064A6C]/10 flex items-center justify-center mx-auto mb-6">
            <ArrowRight className="w-6 h-6 text-[#064A6C]" />
          </div>
          <h2 className="text-2xl font-[800] text-gray-900 mb-4">Free Email Migration</h2>
          <p className="text-[#4B5563] mb-6">
            Switching from another email provider? We make it easy. Our team will migrate all your emails, contacts, and calendar data from any provider at no extra cost. Zero downtime, zero hassle.
          </p>
          <div className="flex flex-wrap justify-center gap-6 mb-8">
            {['Google Workspace', 'Microsoft 365', 'GoDaddy', 'Zoho Mail', 'Any IMAP Provider'].map((provider) => (
              <div key={provider} className="flex items-center gap-2 text-sm text-[#4B5563]">
                <Check className="w-4 h-4 text-[#10B981] flex-shrink-0" />
                {provider}
              </div>
            ))}
          </div>
          <Link
            to="/register"
            className="bg-[#064A6C] hover:bg-[#053A55] text-white font-medium px-8 py-3 rounded-[7px] transition-colors btn-arrow-hover inline-flex items-center"
          >
            Start Free Migration
          </Link>
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
