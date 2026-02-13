import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { Globe, Server, LayoutDashboard, LogOut, User } from 'lucide-react';

export function Header() {
  const { isAuthenticated, customer, logout } = useAuth();

  return (
    <header className="sticky top-0 z-50 bg-[var(--bg-primary)]/80 backdrop-blur-lg border-b border-[var(--border-color)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center">
            <span className="text-2xl">
              <span className="logo-hosts">hosts</span>
              <span className="logo-blue">blue</span>
              <span className="logo-com">.com</span>
            </span>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            <Link to="/domains/search" className="nav-link flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Domains
            </Link>
            <Link to="/hosting" className="nav-link flex items-center gap-2">
              <Server className="w-4 h-4" />
              Hosting
            </Link>
            <a href="#pricing" className="nav-link">
              Pricing
            </a>
          </nav>

          {/* Auth Buttons */}
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <>
                <Link
                  to="/dashboard"
                  className="nav-link flex items-center gap-2"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  Dashboard
                </Link>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-zinc-400">
                    {customer?.firstName || customer?.email}
                  </span>
                  <button
                    onClick={logout}
                    className="p-2 text-zinc-400 hover:text-red-400 transition-colors"
                    title="Logout"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="nav-link"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="btn-primary text-sm"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
