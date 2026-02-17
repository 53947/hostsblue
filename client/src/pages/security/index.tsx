import { Shield, Lock, CheckCircle, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const sslTypes = [
  { name: 'Domain Validated (DV)', price: 'Free', desc: 'Basic encryption for personal sites', features: ['Domain validation', 'Quick issuance', '256-bit encryption'] },
  { name: 'Organization Validated (OV)', price: '$49.99/yr', desc: 'Business identity verification', features: ['Organization validation', 'Company name in cert', 'Higher trust level'], popular: true },
  { name: 'Extended Validation (EV)', price: '$149.99/yr', desc: 'Highest level of trust', features: ['Extended validation', 'Green bar display', 'Maximum trust'] },
  { name: 'Wildcard SSL', price: '$99.99/yr', desc: 'Protect unlimited subdomains', features: ['Unlimited subdomains', 'Single certificate', 'Easy management'] },
];

const sitelockPlans = [
  { name: 'Basic', price: '$4.99/mo', features: ['Daily malware scan', 'Vulnerability detection', 'Trust seal'] },
  { name: 'Professional', price: '$14.99/mo', features: ['Daily malware scan', 'Auto malware removal', 'WAF protection', 'CDN acceleration', 'Trust seal'], popular: true },
  { name: 'Enterprise', price: '$29.99/mo', features: ['Continuous scanning', 'Auto removal', 'WAF + CDN', 'Database protection', 'PCI compliance', 'Priority support'] },
];

export function SecurityPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-16 space-y-20">
      {/* SSL Section */}
      <section>
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Security Solutions</h1>
          <p className="text-gray-500 max-w-2xl mx-auto">Protect your website and customers with SSL certificates and malware scanning.</p>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">SSL Certificates</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {sslTypes.map((ssl) => (
            <div key={ssl.name} className={`bg-white border rounded-[7px] p-6 ${ssl.popular ? 'border-[#1844A6] shadow-md' : 'border-gray-200'}`}>
              <Lock className="w-8 h-8 text-[#1844A6] mb-4" />
              <h3 className="font-semibold text-gray-900 mb-1">{ssl.name}</h3>
              <p className="text-2xl font-bold text-gray-900 mb-2">{ssl.price}</p>
              <p className="text-sm text-gray-500 mb-4">{ssl.desc}</p>
              <ul className="space-y-2">
                {ssl.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" /> {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <hr className="border-none h-px" style={{ backgroundColor: 'rgba(229,231,235,0.6)' }} />

      {/* SiteLock Section */}
      <section>
        <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">SiteLock Security</h2>
        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {sitelockPlans.map((plan) => (
            <div key={plan.name} className={`bg-white border rounded-[7px] p-6 ${plan.popular ? 'border-[#1844A6] shadow-md relative' : 'border-gray-200'}`}>
              {plan.popular && <div className="absolute -top-3 left-1/2 -translate-x-1/2"><span className="bg-[#1844A6] text-white text-xs font-medium px-3 py-1 rounded-full">Recommended</span></div>}
              <Shield className="w-8 h-8 text-[#1844A6] mb-4" />
              <h3 className="font-semibold text-gray-900 mb-1">{plan.name}</h3>
              <p className="text-2xl font-bold text-gray-900 mb-4">{plan.price}</p>
              <ul className="space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              <Link to="/register" className="block text-center mt-6 py-2.5 rounded-[7px] font-medium transition-colors border border-gray-300 text-gray-700 hover:bg-gray-50">Get Started</Link>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
