import { Link } from 'react-router-dom';
import { Brandsignature } from '@/components/ui/brandsignature';

export function Footer() {
  return (
    <footer className="bg-white border-t border-[#E5E7EB]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
          {/* Brand */}
          <div className="lg:col-span-1 lg:border-r lg:border-[#E5E7EB]/60 lg:pr-8">
            <div className="mb-3">
              <Brandsignature brand="hostsblue" size={20} linkTo="/" />
            </div>
            <p className="text-sm text-[#4B5563] leading-relaxed">
              Domains, hosting, email, and security — everything your business needs online.
            </p>
          </div>

          {/* Products */}
          <div className="lg:border-r lg:border-[#E5E7EB]/60 lg:pr-8">
            <h3 className="text-[#09080E] font-semibold text-sm mb-4">Products</h3>
            <ul className="space-y-2.5 text-sm">
              <li><Link to="/domains/search" className="text-[#4B5563] hover:text-[#064A6C] transition-colors">Domain Registration</Link></li>
              <li><Link to="/hosting" className="text-[#4B5563] hover:text-[#064A6C] transition-colors">WordPress Hosting</Link></li>
              <li><Link to="/email" className="text-[#4B5563] hover:text-[#064A6C] transition-colors">Professional Email</Link></li>
              <li><Link to="/security" className="text-[#4B5563] hover:text-[#064A6C] transition-colors">SSL Certificates</Link></li>
              <li><Link to="/security" className="text-[#4B5563] hover:text-[#064A6C] transition-colors">SiteLock Security</Link></li>
              <li><Link to="/website-builder" className="text-[#4B5563] hover:text-[#064A6C] transition-colors">Website Builder</Link></li>
            </ul>
          </div>

          {/* Support */}
          <div className="lg:border-r lg:border-[#E5E7EB]/60 lg:pr-8">
            <h3 className="text-[#09080E] font-semibold text-sm mb-4">Support</h3>
            <ul className="space-y-2.5 text-sm">
              <li><Link to="/support" className="text-[#4B5563] hover:text-[#064A6C] transition-colors">Help Center</Link></li>
              <li><a href="#" className="text-[#4B5563] hover:text-[#064A6C] transition-colors">System Status</a></li>
              <li><Link to="/pricing" className="text-[#4B5563] hover:text-[#064A6C] transition-colors">Pricing</Link></li>
              <li><a href="#" className="text-[#4B5563] hover:text-[#064A6C] transition-colors">Documentation</a></li>
            </ul>
          </div>

          {/* Company */}
          <div className="lg:border-r lg:border-[#E5E7EB]/60 lg:pr-8">
            <h3 className="text-[#09080E] font-semibold text-sm mb-4">Company</h3>
            <ul className="space-y-2.5 text-sm">
              <li><Link to="/about" className="text-[#4B5563] hover:text-[#064A6C] transition-colors">About hostsblue</Link></li>
              <li><a href="#" className="text-[#4B5563] hover:text-[#064A6C] transition-colors">Careers</a></li>
              <li><a href="#" className="text-[#4B5563] hover:text-[#064A6C] transition-colors">Press</a></li>
              <li><a href="mailto:support@hostsblue.com" className="text-[#4B5563] hover:text-[#064A6C] transition-colors">Contact</a></li>
              <li><Link to="/panel/login" className="text-[#4B5563] hover:text-[#064A6C] transition-colors">Panel Login</Link></li>
            </ul>
          </div>

          {/* TRIADBLUE Ecosystem */}
          <div>
            <h3 className="text-sm mb-4 flex items-center gap-1.5">
              <Brandsignature brand="triadblue" showTld={false} size={14} />
              <span className="text-[#09080E] font-semibold"> Ecosystem</span>
            </h3>
            <ul className="space-y-3">
              <li><Brandsignature brand="hostsblue" size={14} /></li>
              <li><Brandsignature brand="swipesblue" size={14} /></li>
              <li><Brandsignature brand="businessblueprint" size={14} /></li>
              <li><Brandsignature brand="scansblue" size={14} /></li>
              <li style={{ paddingLeft: `${14 * 1.6 + 14 * 0.3}px` }}><Brandsignature brand="triadblue" size={14} /></li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <hr className="my-8 border-[#E5E7EB]" style={{ opacity: 0.6 }} />

        {/* Legal Links — full row */}
        <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-[#4B5563] mb-4">
          <a href="#" className="hover:text-[#09080E] transition-colors">Terms of Service</a>
          <span className="text-[#E5E7EB]">|</span>
          <a href="#" className="hover:text-[#09080E] transition-colors">Privacy Policy</a>
          <span className="text-[#E5E7EB]">|</span>
          <a href="#" className="hover:text-[#09080E] transition-colors">Acceptable Use</a>
          <span className="text-[#E5E7EB]">|</span>
          <a href="#" className="hover:text-[#09080E] transition-colors">SLA</a>
          <span className="text-[#E5E7EB]">|</span>
          <a href="#" className="hover:text-[#09080E] transition-colors">Domain Registration Agreement</a>
          <span className="text-[#E5E7EB]">|</span>
          <a href="https://www.icann.org/resources/pages/benefits-2013-09-16-en" target="_blank" rel="noopener noreferrer" className="hover:text-[#09080E] transition-colors">ICANN Registrant Rights</a>
          <span className="text-[#E5E7EB]">|</span>
          <a href="https://www.icann.org/resources/pages/help/dndr/udrp-en" target="_blank" rel="noopener noreferrer" className="hover:text-[#09080E] transition-colors">UDRP Policy</a>
        </div>

        {/* Copyright — full row */}
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-[#4B5563]">
          <p className="flex items-center gap-1 flex-wrap">
            &copy; 2026 <Brandsignature brand="hostsblue" size={12} />
            . A <Brandsignature brand="triadblue" showTld={false} size={12} /> Company.
          </p>
          <span className="text-[#E5E7EB]">|</span>
          <p>Secure payments by Stripe</p>
        </div>
      </div>
    </footer>
  );
}
