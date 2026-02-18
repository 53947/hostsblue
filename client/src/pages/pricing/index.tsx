import { Link } from 'react-router-dom';
import { Check, Globe, Server, Mail, Lock, Shield, Palette } from 'lucide-react';

export function PricingPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-16">
      {/* Hero */}
      <div className="text-center mb-16">
        <h1 className="text-4xl md:text-5xl font-[800] text-gray-900 mb-4">
          Simple, Transparent Pricing
        </h1>
        <p className="text-[#4B5563] max-w-2xl mx-auto text-lg">
          Everything you need to build and grow your online presence. No hidden fees, no surprise renewals at inflated rates.
        </p>
      </div>

      {/* Domains */}
      <section>
        <div className="flex flex-col md:flex-row md:items-start gap-8">
          <div className="md:w-1/3">
            <div className="w-12 h-12 rounded-[7px] bg-[#064A6C]/10 flex items-center justify-center mb-4">
              <Globe className="w-6 h-6 text-[#064A6C]" />
            </div>
            <h2 className="text-2xl font-[800] text-gray-900 mb-2">Domain Registration</h2>
            <p className="text-gray-500 mb-3">Register and manage your perfect domain name with free WHOIS privacy included.</p>
            <p className="text-sm text-[#4B5563] font-medium mb-4">Starting at <span className="text-[#064A6C]">$12.99/yr</span></p>
            <Link to="/domains/search" className="text-[#064A6C] font-medium text-sm btn-arrow-hover">
              Search Domains
            </Link>
          </div>
          <div className="md:w-2/3">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { name: '.com', price: '$12.99/yr' },
                { name: '.net', price: '$14.99/yr' },
                { name: '.org', price: '$12.99/yr' },
                { name: '.io', price: '$39.99/yr' },
                { name: '.co', price: '$29.99/yr' },
                { name: '.dev', price: '$16.99/yr' },
                { name: '.app', price: '$16.99/yr' },
                { name: '.ai', price: '$49.99/yr' },
              ].map((tld) => (
                <div key={tld.name} className="bg-white border border-[#E5E7EB] rounded-[7px] p-4">
                  <h3 className="font-[800] text-gray-900">{tld.name}</h3>
                  <p className="text-lg font-[800] text-gray-900">{tld.price}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <hr className="section-divider" />

      {/* Hosting */}
      <section>
        <div className="flex flex-col md:flex-row md:items-start gap-8">
          <div className="md:w-1/3">
            <div className="w-12 h-12 rounded-[7px] bg-[#064A6C]/10 flex items-center justify-center mb-4">
              <Server className="w-6 h-6 text-[#064A6C]" />
            </div>
            <h2 className="text-2xl font-[800] text-gray-900 mb-2">WordPress Hosting</h2>
            <p className="text-gray-500 mb-3">Fast, secure WordPress hosting with automatic updates and daily backups.</p>
            <p className="text-sm text-[#4B5563] font-medium mb-4">Starting at <span className="text-[#064A6C]">$9.99/mo</span></p>
            <Link to="/hosting" className="text-[#064A6C] font-medium text-sm btn-arrow-hover">
              View Hosting Plans
            </Link>
          </div>
          <div className="md:w-2/3">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { name: 'Starter', price: '$9.99/mo', desc: '1 site, 10 GB storage' },
                { name: 'Growth', price: '$24.99/mo', desc: '5 sites, 50 GB storage', popular: true },
                { name: 'Business', price: '$49.99/mo', desc: '20 sites, 200 GB storage' },
                { name: 'Enterprise', price: '$99.99/mo', desc: 'Unlimited sites, 500 GB' },
              ].map((plan) => (
                <div key={plan.name} className={`bg-white border rounded-[7px] p-4 ${plan.popular ? 'border-[#064A6C] shadow-sm' : 'border-[#E5E7EB]'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-medium text-gray-900">{plan.name}</h3>
                    {plan.popular && (
                      <span className="text-[10px] font-[800] bg-[#FFD700] text-[#09080E] px-2 py-0.5 rounded-[7px]">POPULAR</span>
                    )}
                  </div>
                  <p className="text-lg font-[800] text-gray-900">{plan.price}</p>
                  <p className="text-xs text-gray-500 mt-1">{plan.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <hr className="section-divider" />

      {/* Email */}
      <section>
        <div className="flex flex-col md:flex-row md:items-start gap-8">
          <div className="md:w-1/3">
            <div className="w-12 h-12 rounded-[7px] bg-[#064A6C]/10 flex items-center justify-center mb-4">
              <Mail className="w-6 h-6 text-[#064A6C]" />
            </div>
            <h2 className="text-2xl font-[800] text-gray-900 mb-2">Email Hosting</h2>
            <p className="text-gray-500 mb-3">Professional email for your domain with spam filtering and mobile sync.</p>
            <p className="text-sm text-[#4B5563] font-medium mb-4">Starting at <span className="text-[#064A6C]">$2.99/mo</span></p>
            <Link to="/email" className="text-[#064A6C] font-medium text-sm btn-arrow-hover">
              View Email Plans
            </Link>
          </div>
          <div className="md:w-2/3">
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { name: 'Starter', price: '$2.99/mo', desc: '1 mailbox, 10 GB' },
                { name: 'Business', price: '$9.99/mo', desc: '5 mailboxes, 25 GB', popular: true },
                { name: 'Enterprise', price: '$24.99/mo', desc: '25 mailboxes, 50 GB' },
              ].map((plan) => (
                <div key={plan.name} className={`bg-white border rounded-[7px] p-4 ${plan.popular ? 'border-[#064A6C] shadow-sm' : 'border-[#E5E7EB]'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-medium text-gray-900">{plan.name}</h3>
                    {plan.popular && (
                      <span className="text-[10px] font-[800] bg-[#FFD700] text-[#09080E] px-2 py-0.5 rounded-[7px]">POPULAR</span>
                    )}
                  </div>
                  <p className="text-lg font-[800] text-gray-900">{plan.price}</p>
                  <p className="text-xs text-gray-500 mt-1">{plan.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <hr className="section-divider" />

      {/* Security */}
      <section>
        <div className="flex flex-col md:flex-row md:items-start gap-8">
          <div className="md:w-1/3">
            <div className="w-12 h-12 rounded-[7px] bg-[#064A6C]/10 flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 text-[#064A6C]" />
            </div>
            <h2 className="text-2xl font-[800] text-gray-900 mb-2">Security</h2>
            <p className="text-gray-500 mb-3">SSL certificates and SiteLock protection to keep your site and visitors safe.</p>
            <p className="text-sm text-[#4B5563] font-medium mb-4">SSL from <span className="text-[#10B981]">FREE</span> &middot; SiteLock from <span className="text-[#064A6C]">$9.99/mo</span></p>
            <Link to="/security" className="text-[#064A6C] font-medium text-sm btn-arrow-hover">
              View Security Options
            </Link>
          </div>
          <div className="md:w-2/3">
            <p className="text-sm font-[800] text-gray-900 mb-3">SSL Certificates</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {[
                { name: 'DV SSL', price: 'Free', desc: 'With hosting' },
                { name: 'OV SSL', price: '$49.99/yr', desc: 'Business validation' },
                { name: 'EV SSL', price: '$149.99/yr', desc: 'Extended validation' },
                { name: 'Wildcard', price: '$199.99/yr', desc: 'All subdomains' },
              ].map((ssl) => (
                <div key={ssl.name} className="bg-white border border-[#E5E7EB] rounded-[7px] p-4">
                  <h3 className="font-medium text-gray-900">{ssl.name}</h3>
                  <p className="text-lg font-[800] text-gray-900">{ssl.price}</p>
                  <p className="text-xs text-gray-500 mt-1">{ssl.desc}</p>
                </div>
              ))}
            </div>
            <p className="text-sm font-[800] text-gray-900 mb-3">SiteLock Security</p>
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { name: 'Basic', price: '$9.99/mo', desc: 'Daily scans, trust seal' },
                { name: 'Professional', price: '$24.99/mo', desc: 'Auto removal, WAF, CDN', popular: true },
                { name: 'Enterprise', price: '$49.99/mo', desc: 'Full protection, PCI' },
              ].map((plan) => (
                <div key={plan.name} className={`bg-white border rounded-[7px] p-4 ${plan.popular ? 'border-[#064A6C] shadow-sm' : 'border-[#E5E7EB]'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-medium text-gray-900">{plan.name}</h3>
                    {plan.popular && (
                      <span className="text-[10px] font-[800] bg-[#FFD700] text-[#09080E] px-2 py-0.5 rounded-[7px]">POPULAR</span>
                    )}
                  </div>
                  <p className="text-lg font-[800] text-gray-900">{plan.price}</p>
                  <p className="text-xs text-gray-500 mt-1">{plan.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <hr className="section-divider" />

      {/* Website Builder */}
      <section>
        <div className="flex flex-col md:flex-row md:items-start gap-8">
          <div className="md:w-1/3">
            <div className="w-12 h-12 rounded-[7px] bg-[#064A6C]/10 flex items-center justify-center mb-4">
              <Palette className="w-6 h-6 text-[#064A6C]" />
            </div>
            <h2 className="text-2xl font-[800] text-gray-900 mb-2">Website Builder</h2>
            <p className="text-gray-500 mb-3">AI-powered website builder with drag-and-drop editing and professional templates.</p>
            <p className="text-sm text-[#4B5563] font-medium mb-4">Starting at <span className="text-[#064A6C]">$4.99/mo</span></p>
            <Link to="/website-builder" className="text-[#064A6C] font-medium text-sm btn-arrow-hover">
              View Builder Plans
            </Link>
          </div>
          <div className="md:w-2/3">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { name: 'Starter', price: '$4.99/mo', desc: '1 site, 5 pages' },
                { name: 'Business', price: '$14.99/mo', desc: '3 sites, unlimited pages', popular: true },
                { name: 'Professional', price: '$29.99/mo', desc: '10 sites, e-commerce' },
                { name: 'Agency', price: '$79.99/mo', desc: 'Unlimited, white-label', badge: 'NEW' },
              ].map((plan) => (
                <div key={plan.name} className={`bg-white border rounded-[7px] p-4 ${plan.popular ? 'border-[#064A6C] shadow-sm' : 'border-[#E5E7EB]'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-medium text-gray-900">{plan.name}</h3>
                    {plan.popular && (
                      <span className="text-[10px] font-[800] bg-[#FFD700] text-[#09080E] px-2 py-0.5 rounded-[7px]">POPULAR</span>
                    )}
                    {plan.badge === 'NEW' && !plan.popular && (
                      <span className="text-[10px] font-[800] bg-[#FFD700] text-[#09080E] px-2 py-0.5 rounded-[7px]">NEW</span>
                    )}
                  </div>
                  <p className="text-lg font-[800] text-gray-900">{plan.price}</p>
                  <p className="text-xs text-gray-500 mt-1">{plan.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Bundle Deals */}
      <hr className="section-divider" />

      <section className="py-4">
        <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-[7px] p-12 text-center">
          <h2 className="text-3xl font-[800] text-gray-900 mb-4">Bundle & Save</h2>
          <p className="text-[#4B5563] max-w-2xl mx-auto mb-8">
            Combine domains, hosting, email, and security for a complete web presence. Create an account to build your custom bundle and save.
          </p>
          <div className="grid sm:grid-cols-3 gap-6 max-w-3xl mx-auto mb-10">
            {[
              { name: 'Starter Bundle', includes: 'Domain + Hosting + Email', save: 'Save 10%' },
              { name: 'Business Bundle', includes: 'Domain + Hosting + Email + SSL', save: 'Save 15%' },
              { name: 'Full Stack Bundle', includes: 'Domain + Hosting + Email + Security + Builder', save: 'Save 20%' },
            ].map((bundle) => (
              <div key={bundle.name} className="bg-white border border-[#E5E7EB] rounded-[7px] p-6">
                <h3 className="font-[800] text-gray-900 mb-1">{bundle.name}</h3>
                <p className="text-sm text-gray-500 mb-3">{bundle.includes}</p>
                <span className="text-sm font-[800] text-[#10B981]">{bundle.save}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register" className="bg-[#064A6C] hover:bg-[#053A55] text-white font-semibold px-8 py-3 rounded-[7px] transition-all btn-arrow-hover justify-center">
              Create Free Account
            </Link>
            <Link to="/domains/search" className="border border-gray-300 text-gray-700 hover:border-[#064A6C] hover:text-[#064A6C] font-semibold px-8 py-3 rounded-[7px] transition-colors btn-arrow-hover justify-center">
              Start with a Domain
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
