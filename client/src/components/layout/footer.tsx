import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="bg-[#F9FAFB] border-t border-[#E5E7EB]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
          {/* Brand */}
          <div className="lg:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-3">
              <img src="/HostsBlue_Logo_Image.png?v=2" alt="hostsblue" className="h-6 w-auto" style={{ filter: 'drop-shadow(0.5px 0.5px 0px #09080E)' }} />
              <span className="text-xl leading-none">
                <span className="logo-hosts">hosts</span>
                <span className="logo-blue">blue</span>
              </span>
            </Link>
            <p className="text-sm text-[#4B5563] leading-relaxed">
              Domains, hosting, email, and security — everything your business needs online.
            </p>
          </div>

          {/* Products */}
          <div>
            <h3 className="text-[#09080E] font-semibold text-sm mb-4">Products</h3>
            <ul className="space-y-2.5 text-sm">
              <li><Link to="/domains/search" className="text-[#4B5563] hover:text-[#09080E] transition-colors">Domain Registration</Link></li>
              <li><Link to="/hosting" className="text-[#4B5563] hover:text-[#09080E] transition-colors">WordPress Hosting</Link></li>
              <li><Link to="/email" className="text-[#4B5563] hover:text-[#09080E] transition-colors">Professional Email</Link></li>
              <li><Link to="/security" className="text-[#4B5563] hover:text-[#09080E] transition-colors">SSL Certificates</Link></li>
              <li><Link to="/security" className="text-[#4B5563] hover:text-[#09080E] transition-colors">SiteLock Security</Link></li>
              <li><Link to="/website-builder" className="text-[#4B5563] hover:text-[#09080E] transition-colors">Website Builder</Link></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="text-[#09080E] font-semibold text-sm mb-4">Support</h3>
            <ul className="space-y-2.5 text-sm">
              <li><Link to="/support" className="text-[#4B5563] hover:text-[#09080E] transition-colors">Help Center</Link></li>
              <li><a href="#" className="text-[#4B5563] hover:text-[#09080E] transition-colors">System Status</a></li>
              <li><Link to="/pricing" className="text-[#4B5563] hover:text-[#09080E] transition-colors">Pricing</Link></li>
              <li><a href="#" className="text-[#4B5563] hover:text-[#09080E] transition-colors">Documentation</a></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-[#09080E] font-semibold text-sm mb-4">Company</h3>
            <ul className="space-y-2.5 text-sm">
              <li><Link to="/about" className="text-[#4B5563] hover:text-[#09080E] transition-colors">About Us</Link></li>
              <li><a href="#" className="text-[#4B5563] hover:text-[#09080E] transition-colors">Careers</a></li>
              <li><a href="mailto:support@hostsblue.com" className="text-[#4B5563] hover:text-[#09080E] transition-colors">Contact</a></li>
            </ul>
          </div>

          {/* TRIADBLUE Ecosystem */}
          <div>
            <h3 className="text-[#09080E] font-semibold text-sm mb-4">TRIADBLUE Ecosystem</h3>
            <ul className="space-y-3">
              <li>
                <a href="https://swipesblue.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm opacity-70 hover:opacity-100 transition-opacity">
                  <img src="/swipesblue_favicon_wbg.png" alt="" className="w-4.5 h-4.5" />
                  <span><span className="text-[#374151] font-semibold">swipes</span><span className="text-[#0000FF] font-semibold">blue</span></span>
                </a>
              </li>
              <li>
                <a href="https://hostsblue.com" className="flex items-center gap-2 text-sm opacity-70 hover:opacity-100 transition-opacity">
                  <img src="/hostsblue_web_browser_favicon.png" alt="" className="w-4.5 h-4.5" />
                  <span><span className="text-[#008060] font-semibold">hosts</span><span className="text-[#0000FF] font-semibold">blue</span></span>
                </a>
              </li>
              <li>
                <a href="https://businessblueprint.io" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm opacity-70 hover:opacity-100 transition-opacity">
                  <img src="/businessblueprint_icon.png" alt="" className="w-4.5 h-4.5" />
                  <span><span className="text-[#FF6B00] font-semibold">business</span><span className="text-[#0000FF] font-semibold">blueprint</span></span>
                </a>
              </li>
              <li>
                <a href="https://scansblue.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm opacity-70 hover:opacity-100 transition-opacity">
                  <img src="/scansblue_favicon.png" alt="" className="w-4.5 h-4.5" />
                  <span><span className="text-[#A00028] font-semibold">scans</span><span className="text-[#0000FF] font-semibold">blue</span></span>
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <hr className="my-8 border-[#E5E7EB]" style={{ opacity: 0.6 }} />

        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Legal Links */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-[#4B5563]">
            <a href="#" className="hover:text-[#09080E] transition-colors">Terms of Service</a>
            <span className="text-[#E5E7EB]">|</span>
            <a href="#" className="hover:text-[#09080E] transition-colors">Privacy Policy</a>
            <span className="text-[#E5E7EB]">|</span>
            <a href="#" className="hover:text-[#09080E] transition-colors">Acceptable Use</a>
            <span className="text-[#E5E7EB]">|</span>
            <a href="#" className="hover:text-[#09080E] transition-colors">SLA</a>
          </div>

          {/* Copyright */}
          <div className="flex flex-col sm:flex-row items-center gap-2 text-xs text-[#4B5563]">
            <p className="flex items-center gap-1">
              &copy; 2026 HostsBlue. A{' '}
              <span className="inline-flex items-center gap-0.5 font-semibold">
                <span className="text-[#374151]">Triad</span>
                <img src="/TriadBlue_Logo_Image_Trans.png" alt="" className="h-3.5 w-auto inline" />
                <span className="text-[#0000FF]">Blue</span>
              </span>{' '}
              Company.
            </p>
            <span className="hidden sm:inline text-[#E5E7EB]">|</span>
            <p>Secure payments by <span className="text-[#374151] font-semibold">swipes</span><span className="text-[#0000FF] font-semibold">blue</span></p>
          </div>
        </div>
      </div>
    </footer>
  );
}
