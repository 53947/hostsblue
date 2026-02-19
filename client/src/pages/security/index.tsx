import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Shield, Lock, ChevronDown, Globe, AlertTriangle } from 'lucide-react';

const sslCerts = [
  {
    type: 'Domain Validated (DV)',
    price: 'FREE',
    priceNote: 'Included with hosting',
    description: 'Basic encryption for personal sites and blogs. Verifies domain ownership only.',
    features: [
      'Domain validation',
      '256-bit encryption',
      'Quick issuance (minutes)',
      'Free with any hosting plan',
      'Auto-renewal',
    ],
    popular: false,
    isFree: true,
  },
  {
    type: 'Organization Validated (OV)',
    price: '$49.99',
    priceNote: '/yr',
    description: 'Business identity verification for companies and organizations that need higher trust.',
    features: [
      'Organization validation',
      '256-bit encryption',
      'Company name in certificate',
      'Higher trust level',
      'Issuance in 1-3 days',
      '1-year validity',
    ],
    popular: false,
    isFree: false,
  },
  {
    type: 'Extended Validation (EV)',
    price: '$149.99',
    priceNote: '/yr',
    description: 'The highest level of trust and validation. Ideal for e-commerce and financial sites.',
    features: [
      'Extended validation',
      '256-bit encryption',
      'Company name displayed in browser',
      'Maximum customer trust',
      'Issuance in 3-5 days',
      '$1.75M warranty',
    ],
    popular: true,
    isFree: false,
  },
  {
    type: 'Wildcard SSL',
    price: '$199.99',
    priceNote: '/yr',
    description: 'Protect your main domain and all subdomains with a single certificate.',
    features: [
      'Unlimited subdomains',
      '256-bit encryption',
      'Single certificate management',
      'Domain validation',
      'Quick issuance',
      'Easy management',
    ],
    popular: false,
    isFree: false,
  },
];

const sitelockPlans = [
  {
    name: 'Basic',
    monthly: 9.99,
    features: [
      'Daily Malware Scanning',
      'Vulnerability Detection',
      'Trust Seal',
      'Email Notifications',
      'Basic Reports',
    ],
    popular: false,
  },
  {
    name: 'Professional',
    monthly: 24.99,
    features: [
      'Daily Malware Scanning',
      'Automatic Malware Removal',
      'WAF Protection',
      'CDN Acceleration',
      'Trust Seal',
      'Database Scanning',
      'Spam Blacklist Monitoring',
    ],
    popular: true,
  },
  {
    name: 'Enterprise',
    monthly: 49.99,
    features: [
      'Continuous Malware Scanning',
      'Automatic Malware Removal',
      'WAF Protection',
      'CDN Acceleration',
      'Trust Seal',
      'Database Protection',
      'PCI Compliance',
      'Spam Blacklist Monitoring',
      'Priority Support',
    ],
    popular: false,
  },
];

const faqs = [
  {
    q: 'Do I need an SSL certificate?',
    a: 'Yes. An SSL certificate encrypts data between your visitors and your website, protecting sensitive information. Search engines also rank HTTPS sites higher. All hostsblue hosting plans include a free DV SSL certificate.',
  },
  {
    q: 'What is the difference between DV, OV, and EV SSL?',
    a: 'DV (Domain Validated) verifies domain ownership only. OV (Organization Validated) also verifies your business identity. EV (Extended Validation) provides the highest level of verification and displays your company name in the browser, maximizing customer trust.',
  },
  {
    q: 'What does SiteLock do?',
    a: 'SiteLock scans your website daily for malware, vulnerabilities, and other security threats. Professional and Enterprise plans automatically remove detected malware and include a Web Application Firewall (WAF) for real-time protection.',
  },
  {
    q: 'How long does SSL installation take?',
    a: 'DV certificates are issued within minutes. OV certificates take 1-3 business days as they require organization verification. EV certificates take 3-5 business days due to the extended validation process.',
  },
  {
    q: 'Can I use a Wildcard SSL for all my subdomains?',
    a: 'Yes. A Wildcard SSL certificate covers your main domain and all first-level subdomains (e.g., blog.example.com, shop.example.com, app.example.com) with a single certificate.',
  },
  {
    q: 'Is the trust seal included with SiteLock?',
    a: 'Yes. All SiteLock plans include a trust seal that you can display on your website to show visitors that your site is scanned and secured. This can increase customer confidence and conversion rates.',
  },
];

export function SecurityPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="max-w-7xl mx-auto px-4 py-16">
      {/* Hero */}
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-[800] text-gray-900 mb-4">
          Secure Your Website
        </h1>
        <p className="text-[#4B5563] max-w-2xl mx-auto text-lg">
          Protect your website and your customers with SSL certificates and comprehensive malware scanning. Build trust, improve SEO, and stay protected.
        </p>
      </div>

      {/* SSL Certificates */}
      <section>
        <h2 className="text-2xl font-[800] text-gray-900 text-center mb-8">
          SSL Certificates
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {sslCerts.map((ssl) => (
            <div
              key={ssl.type}
              className={`bg-white rounded-[7px] p-6 flex flex-col relative ${
                ssl.popular
                  ? 'border-2 border-[#064A6C] shadow-lg'
                  : 'border border-[#E5E7EB]'
              }`}
            >
              {ssl.popular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="bg-[#FFD700] text-[#09080E] text-xs font-[800] px-4 py-1 rounded-[7px]">
                    POPULAR
                  </span>
                </div>
              )}

              <div className="mb-4">
                <Lock className="w-8 h-8 text-[#064A6C] mb-3" />
                <h3 className="font-[800] text-gray-900 mb-1">{ssl.type}</h3>
                <p className="text-sm text-gray-500 mb-4">{ssl.description}</p>
              </div>

              <div className="mb-6">
                {ssl.isFree ? (
                  <div>
                    <span className="text-3xl font-[800] text-[#10B981]">FREE</span>
                    <p className="text-sm text-gray-400 mt-1">with any hosting plan</p>
                  </div>
                ) : (
                  <div>
                    <span className="text-3xl font-[800] text-gray-900">{ssl.price}</span>
                    <span className="text-gray-500">{ssl.priceNote}</span>
                  </div>
                )}
              </div>

              <ul className="space-y-2.5 mb-8 flex-1">
                {ssl.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-[#10B981] flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-[#4B5563]">{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                to="/register"
                className={`block text-center font-medium px-6 py-3 rounded-[7px] transition-colors btn-arrow-hover justify-center ${
                  ssl.popular
                    ? 'bg-[#064A6C] hover:bg-[#053A55] text-white'
                    : 'border border-gray-300 text-gray-700 hover:border-[#064A6C] hover:text-[#064A6C]'
                }`}
              >
                {ssl.isFree ? 'Get Free SSL' : 'Get Started'}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* SiteLock Security */}
      <hr className="section-divider" />

      <section>
        <h2 className="text-2xl font-[800] text-gray-900 text-center mb-2">
          SiteLock Security
        </h2>
        <p className="text-[#4B5563] text-center mb-8 max-w-xl mx-auto">
          Comprehensive website security with daily malware scanning, automatic removal, and firewall protection.
        </p>
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {sitelockPlans.map((plan) => (
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
                <Shield className="w-8 h-8 text-[#064A6C] mx-auto mb-3" />
                <h3 className="text-xl font-[800] text-gray-900 mb-1">{plan.name}</h3>
              </div>

              <div className="text-center mb-6">
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-4xl font-[800] text-gray-900">${plan.monthly.toFixed(2)}</span>
                  <span className="text-gray-500">/mo</span>
                </div>
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
      </section>

      {/* Why SSL Matters */}
      <hr className="section-divider" />

      <section>
        <h2 className="text-2xl font-[800] text-gray-900 text-center mb-8">
          Why SSL Matters
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
          {[
            {
              icon: Lock,
              title: 'Data Encryption',
              desc: 'SSL encrypts all data transferred between your visitors and your server, protecting passwords, credit cards, and personal info.',
            },
            {
              icon: Globe,
              title: 'SEO Ranking Boost',
              desc: 'Google uses HTTPS as a ranking signal. Sites with SSL certificates rank higher in search results than those without.',
            },
            {
              icon: Shield,
              title: 'Customer Trust',
              desc: 'The padlock icon and HTTPS in the address bar signal to visitors that your site is legitimate and their data is safe.',
            },
            {
              icon: AlertTriangle,
              title: 'Avoid Browser Warnings',
              desc: 'Modern browsers warn visitors when a site lacks SSL, displaying "Not Secure" in the address bar and discouraging engagement.',
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-white border border-[#E5E7EB] rounded-[7px] p-6 text-center">
              <div className="w-10 h-10 rounded-[7px] bg-[#064A6C]/10 flex items-center justify-center mx-auto mb-4">
                <Icon className="w-5 h-5 text-[#064A6C]" />
              </div>
              <h3 className="font-[800] text-gray-900 mb-2">{title}</h3>
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
