import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { Menu, X } from 'lucide-react';

export function Header() {
  const { isAuthenticated, customer, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 mr-auto">
            <img
              src="/HostsBlue_Logo_Image.png"
              alt=""
              className="h-8 w-auto"
              style={{ filter: 'drop-shadow(0.5px 0.5px 0px #09080E)' }}
            />
            <span className="text-2xl leading-none">
              <span className="logo-hosts">hosts</span>
              <span className="logo-blue">blue</span>
            </span>
          </Link>

          {/* Desktop: Nav + Auth — all inline, right-aligned */}
          <div className="hidden md:flex items-center gap-6">
            <Link to="/domains/search" className="text-gray-600 hover:text-[#064A6C] transition-colors font-medium text-sm">
              Domains
            </Link>
            <Link to="/hosting" className="text-gray-600 hover:text-[#064A6C] transition-colors font-medium text-sm">
              Hosting
            </Link>
            <Link to="/email" className="text-gray-600 hover:text-[#064A6C] transition-colors font-medium text-sm">
              Email
            </Link>
            <Link to="/security" className="text-gray-600 hover:text-[#064A6C] transition-colors font-medium text-sm">
              Security
            </Link>
            <Link to="/pricing" className="text-gray-600 hover:text-[#064A6C] transition-colors font-medium text-sm">
              Pricing
            </Link>

            <div className="w-px h-5 bg-gray-200" />

            {isAuthenticated ? (
              <>
                <Link to="/dashboard" className="text-gray-600 hover:text-[#064A6C] transition-colors font-medium text-sm">
                  Dashboard
                </Link>
                <span className="text-sm text-gray-500">
                  {customer?.firstName || customer?.email}
                </span>
                <button onClick={logout} className="text-sm text-gray-500 hover:text-red-500 transition-colors">
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="text-gray-600 hover:text-gray-900 transition-colors font-medium text-sm">
                  Login
                </Link>
                <Link to="/register" className="bg-[#064A6C] hover:bg-[#053C58] text-white font-medium text-sm px-5 py-2.5 rounded-[7px] transition-all inline-flex items-center btn-arrow-hover">
                  Get Started
                </Link>
              </>
            )}
          </div>

          {/* Mobile Hamburger */}
          <button className="md:hidden p-2 text-gray-600" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-gray-200 py-4 space-y-2">
            <Link to="/domains/search" className="block px-4 py-2 text-gray-600 hover:text-[#064A6C] hover:bg-gray-50 rounded-lg" onClick={() => setMobileOpen(false)}>Domains</Link>
            <Link to="/hosting" className="block px-4 py-2 text-gray-600 hover:text-[#064A6C] hover:bg-gray-50 rounded-lg" onClick={() => setMobileOpen(false)}>Hosting</Link>
            <Link to="/email" className="block px-4 py-2 text-gray-600 hover:text-[#064A6C] hover:bg-gray-50 rounded-lg" onClick={() => setMobileOpen(false)}>Email</Link>
            <Link to="/security" className="block px-4 py-2 text-gray-600 hover:text-[#064A6C] hover:bg-gray-50 rounded-lg" onClick={() => setMobileOpen(false)}>Security</Link>
            <Link to="/pricing" className="block px-4 py-2 text-gray-600 hover:text-[#064A6C] hover:bg-gray-50 rounded-lg" onClick={() => setMobileOpen(false)}>Pricing</Link>
            <hr className="my-2 border-gray-200" />
            {isAuthenticated ? (
              <>
                <Link to="/dashboard" className="block px-4 py-2 text-gray-600 hover:bg-gray-50 rounded-lg" onClick={() => setMobileOpen(false)}>Dashboard</Link>
                <button onClick={() => { logout(); setMobileOpen(false); }} className="block w-full text-left px-4 py-2 text-red-500 hover:bg-red-50 rounded-lg">Sign Out</button>
              </>
            ) : (
              <>
                <Link to="/login" className="block px-4 py-2 text-gray-600 hover:bg-gray-50 rounded-lg" onClick={() => setMobileOpen(false)}>Login</Link>
                <Link to="/register" className="block mx-4 text-center bg-[#064A6C] text-white py-2.5 rounded-[7px] font-medium" onClick={() => setMobileOpen(false)}>Get Started</Link>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
