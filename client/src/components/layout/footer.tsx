import { Link } from 'react-router-dom';
import { Globe, Server, Mail, Phone } from 'lucide-react';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-[var(--bg-secondary)] border-t border-[var(--border-color)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Link to="/" className="inline-block mb-4">
              <span className="text-2xl">
                <span className="logo-hosts">hosts</span>
                <span className="logo-blue">blue</span>
                <span className="logo-com">.com</span>
              </span>
            </Link>
            <p className="text-zinc-400 text-sm mb-4 max-w-sm">
              White-label domain registration and WordPress hosting platform. 
              Professional solutions for businesses of all sizes.
            </p>
            <div className="flex items-center gap-4 text-zinc-400 text-sm">
              <a href="mailto:support@hostsblue.com" className="hover:text-white transition-colors">
                <Mail className="w-4 h-4" />
              </a>
              <a href="tel:+1234567890" className="hover:text-white transition-colors">
                <Phone className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Products */}
          <div>
            <h3 className="text-white font-semibold mb-4">Products</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/domains/search" className="text-zinc-400 hover:text-white transition-colors">
                  Domain Search
                </Link>
              </li>
              <li>
                <Link to="/domains/transfer" className="text-zinc-400 hover:text-white transition-colors">
                  Domain Transfer
                </Link>
              </li>
              <li>
                <Link to="/hosting" className="text-zinc-400 hover:text-white transition-colors">
                  WordPress Hosting
                </Link>
              </li>
              <li>
                <Link to="/ssl" className="text-zinc-400 hover:text-white transition-colors">
                  SSL Certificates
                </Link>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-white font-semibold mb-4">Company</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="#about" className="text-zinc-400 hover:text-white transition-colors">
                  About Us
                </a>
              </li>
              <li>
                <a href="#blog" className="text-zinc-400 hover:text-white transition-colors">
                  Blog
                </a>
              </li>
              <li>
                <a href="#careers" className="text-zinc-400 hover:text-white transition-colors">
                  Careers
                </a>
              </li>
              <li>
                <a href="#contact" className="text-zinc-400 hover:text-white transition-colors">
                  Contact
                </a>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="text-white font-semibold mb-4">Support</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="#help" className="text-zinc-400 hover:text-white transition-colors">
                  Help Center
                </a>
              </li>
              <li>
                <a href="#status" className="text-zinc-400 hover:text-white transition-colors">
                  System Status
                </a>
              </li>
              <li>
                <a href="#privacy" className="text-zinc-400 hover:text-white transition-colors">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="#terms" className="text-zinc-400 hover:text-white transition-colors">
                  Terms of Service
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="border-t border-[var(--border-color)] mt-12 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-zinc-500 text-sm">
            © {currentYear} HostsBlue. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <span className="text-zinc-500 text-sm">Part of the TriadBlue ecosystem</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-600">swipesblue</span>
              <span className="text-zinc-600">•</span>
              <span className="text-xs text-zinc-600">sitesblue</span>
              <span className="text-zinc-600">•</span>
              <span className="text-xs text-zinc-600">hireblue</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
