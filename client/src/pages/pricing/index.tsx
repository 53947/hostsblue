import { Link } from 'react-router-dom';
import { Globe, Server, Mail, Shield, Lock, CheckCircle, ArrowRight } from 'lucide-react';

const serviceCategories = [
  {
    icon: Globe,
    title: 'Domain Registration',
    description: 'Register and manage your perfect domain name with WHOIS privacy included.',
    startingAt: '$12.99/yr',
    plans: [
      { name: '.com', price: '$12.99/yr' },
      { name: '.net', price: '$14.99/yr' },
      { name: '.org', price: '$12.99/yr' },
      { name: '.io', price: '$39.99/yr' },
      { name: '.co', price: '$29.99/yr' },
      { name: '.dev', price: '$16.99/yr' },
    ],
    link: '/domains/search',
    linkText: 'Search Domains',
  },
  {
    icon: Server,
    title: 'WordPress Hosting',
    description: 'Fast, secure WordPress hosting with automatic updates and daily backups.',
    startingAt: '$9.99/mo',
    plans: [
      { name: 'Starter', price: '$9/mo', desc: '1 site, 10GB storage' },
      { name: 'Pro', price: '$24/mo', desc: '5 sites, 50GB storage', popular: true },
      { name: 'Business', price: '$59/mo', desc: '20 sites, 200GB storage' },
    ],
    link: '/hosting',
    linkText: 'View Hosting Plans',
  },
  {
    icon: Mail,
    title: 'Email Hosting',
    description: 'Professional email for your domain with spam filtering and mobile access.',
    startingAt: '$2.99/mo',
    plans: [
      { name: 'Starter', price: '$2.99/mo', desc: '5 accounts, 10GB' },
      { name: 'Business', price: '$5.99/mo', desc: '25 accounts, 50GB', popular: true },
      { name: 'Enterprise', price: '$9.99/mo', desc: 'Unlimited, 100GB' },
    ],
    link: '/email',
    linkText: 'View Email Plans',
  },
  {
    icon: Lock,
    title: 'SSL Certificates',
    description: 'Encrypt your website and build customer trust with SSL certificates.',
    startingAt: 'Free',
    plans: [
      { name: 'Domain Validated (DV)', price: 'Free' },
      { name: 'Organization Validated (OV)', price: '$49.99/yr', popular: true },
      { name: 'Extended Validation (EV)', price: '$149.99/yr' },
      { name: 'Wildcard SSL', price: '$99.99/yr' },
    ],
    link: '/security',
    linkText: 'View SSL Options',
  },
  {
    icon: Shield,
    title: 'SiteLock Security',
    description: 'Protect your website from malware, vulnerabilities, and cyber threats.',
    startingAt: '$4.99/mo',
    plans: [
      { name: 'Basic', price: '$4.99/mo', desc: 'Daily scans, trust seal' },
      { name: 'Professional', price: '$14.99/mo', desc: 'Auto removal, WAF, CDN', popular: true },
      { name: 'Enterprise', price: '$29.99/mo', desc: 'Full protection, PCI' },
    ],
    link: '/security',
    linkText: 'View Security Plans',
  },
];

export function PricingPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-16">
      {/* Header */}
      <div className="text-center mb-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Simple, Transparent Pricing</h1>
        <p className="text-gray-500 max-w-2xl mx-auto">
          Everything you need to build and grow your online presence. No hidden fees, no surprises.
        </p>
      </div>

      {/* Service Categories */}
      <div className="space-y-0">
        {serviceCategories.map((category, index) => {
          const Icon = category.icon;
          return (
            <div key={category.title}>
              {index > 0 && <hr className="section-divider" />}
              <section className="py-12">
                <div className="flex flex-col md:flex-row md:items-start gap-8">
                  {/* Category Info */}
                  <div className="md:w-1/3">
                    <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center mb-4">
                      <Icon className="w-6 h-6 text-[#1844A6]" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">{category.title}</h2>
                    <p className="text-gray-500 mb-3">{category.description}</p>
                    <p className="text-sm text-gray-700 font-medium mb-4">Starting at <span className="text-[#1844A6]">{category.startingAt}</span></p>
                    <Link to={category.link} className="text-[#1844A6] font-medium text-sm flex items-center gap-1 hover:gap-2 transition-all">
                      {category.linkText} <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>

                  {/* Plans Grid */}
                  <div className="md:w-2/3">
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {category.plans.map((plan: any) => (
                        <div
                          key={plan.name}
                          className={`bg-white border rounded-[7px] p-4 ${plan.popular ? 'border-[#1844A6] shadow-sm' : 'border-gray-200'}`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <h3 className="font-medium text-gray-900">{plan.name}</h3>
                            {plan.popular && (
                              <span className="text-[10px] font-medium bg-blue-50 text-[#1844A6] px-2 py-0.5 rounded-full">Popular</span>
                            )}
                          </div>
                          <p className="text-lg font-bold text-gray-900">{plan.price}</p>
                          {plan.desc && <p className="text-xs text-gray-500 mt-1">{plan.desc}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            </div>
          );
        })}
      </div>

      <hr className="section-divider" />

      {/* Bundle CTA */}
      <section className="py-16">
        <div className="bg-gray-50 border border-gray-200 rounded-[7px] p-12 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Build Your Complete Package</h2>
          <p className="text-gray-500 max-w-2xl mx-auto mb-8">
            Combine domains, hosting, email, and security for a complete web presence. Create an account to get started and customize your services.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 mb-8">
            {['Domain + Hosting', 'Email + Security', 'Full Stack Bundle'].map((bundle) => (
              <div key={bundle} className="flex items-center gap-2 text-sm text-gray-600">
                <CheckCircle className="w-4 h-4 text-green-500" />
                {bundle}
              </div>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register" className="bg-[#1844A6] hover:bg-[#133A8A] text-white font-semibold px-8 py-3 rounded-[7px] transition-colors">
              Create Free Account
            </Link>
            <Link to="/domains/search" className="border border-gray-300 text-gray-700 font-semibold px-8 py-3 rounded-[7px] hover:bg-gray-50 transition-colors">
              Start with a Domain
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
