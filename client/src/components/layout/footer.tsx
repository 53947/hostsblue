import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="bg-gray-50 border-t border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Services */}
          <div>
            <h3 className="text-gray-900 font-semibold mb-4">Services</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/domains/search" className="text-gray-500 hover:text-gray-900 transition-colors">Domain Registration</Link></li>
              <li><Link to="/hosting" className="text-gray-500 hover:text-gray-900 transition-colors">WordPress Hosting</Link></li>
              <li><Link to="/email" className="text-gray-500 hover:text-gray-900 transition-colors">Professional Email</Link></li>
              <li><Link to="/security" className="text-gray-500 hover:text-gray-900 transition-colors">SSL Certificates</Link></li>
              <li><Link to="/security" className="text-gray-500 hover:text-gray-900 transition-colors">SiteLock Security</Link></li>
              <li><Link to="/website-builder" className="text-gray-500 hover:text-gray-900 transition-colors">Website Builder</Link></li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="text-gray-900 font-semibold mb-4">Resources</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/support" className="text-gray-500 hover:text-gray-900 transition-colors">Help Center</Link></li>
              <li><Link to="/pricing" className="text-gray-500 hover:text-gray-900 transition-colors">Pricing</Link></li>
              <li><a href="#" className="text-gray-500 hover:text-gray-900 transition-colors">System Status</a></li>
              <li><a href="#" className="text-gray-500 hover:text-gray-900 transition-colors">API Documentation</a></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-gray-900 font-semibold mb-4">Company</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/about" className="text-gray-500 hover:text-gray-900 transition-colors">About Us</Link></li>
              <li><a href="#" className="text-gray-500 hover:text-gray-900 transition-colors">Blog</a></li>
              <li><a href="#" className="text-gray-500 hover:text-gray-900 transition-colors">Careers</a></li>
              <li><a href="mailto:support@hostsblue.com" className="text-gray-500 hover:text-gray-900 transition-colors">Contact</a></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-gray-900 font-semibold mb-4">Legal</h3>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="text-gray-500 hover:text-gray-900 transition-colors">Terms of Service</a></li>
              <li><a href="#" className="text-gray-500 hover:text-gray-900 transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="text-gray-500 hover:text-gray-900 transition-colors">Acceptable Use Policy</a></li>
              <li><a href="#" className="text-gray-500 hover:text-gray-900 transition-colors">SLA</a></li>
            </ul>
          </div>
        </div>

        {/* Ecosystem Divider */}
        <hr className="my-8 border-gray-200" style={{ opacity: 0.6 }} />

        {/* Ecosystem */}
        <div className="flex flex-wrap items-center justify-center gap-8 py-4">
          <a href="https://swipesblue.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm opacity-70 hover:opacity-100 transition-opacity">
            <img src="/swipesblue_favicon_wbg.png" alt="" className="w-5 h-5" />
            <span><span className="text-gray-600 font-medium">swipes</span><span className="text-[#0000FF] font-medium">blue</span></span>
          </a>
          <a href="https://hostsblue.com" className="flex items-center gap-2 text-sm opacity-70 hover:opacity-100 transition-opacity">
            <img src="/hostsblue_web_browser_favicon.png" alt="" className="w-5 h-5" />
            <span><span className="text-[#008060] font-medium">hosts</span><span className="text-[#0000FF] font-medium">blue</span></span>
          </a>
          <a href="https://businessblueprint.io" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm opacity-70 hover:opacity-100 transition-opacity">
            <img src="/businessblueprint_icon.png" alt="" className="w-5 h-5" />
            <span><span className="text-[#FF6B00] font-medium">business</span><span className="text-[#0000FF] font-medium">blueprint</span></span>
          </a>
          <a href="https://scansblue.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm opacity-70 hover:opacity-100 transition-opacity">
            <img src="/scansblue_favicon.png" alt="" className="w-5 h-5" />
            <span><span className="text-[#A00028] font-medium">scans</span><span className="text-[#0000FF] font-medium">blue</span></span>
          </a>
        </div>

        {/* Copyright Divider */}
        <hr className="my-8 border-gray-200" style={{ opacity: 0.6 }} />

        {/* Copyright */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <p>&copy; 2026 HostsBlue. A TriadBlue Company.</p>
          <p>Secure payments by <span className="text-gray-600 font-medium">swipes</span><span className="text-[#0000FF] font-medium">blue</span></p>
        </div>
      </div>
    </footer>
  );
}
