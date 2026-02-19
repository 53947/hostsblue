import { Link, useLocation, Outlet } from 'react-router-dom';
import {
  LayoutDashboard, Globe, Server, Mail, Shield, Lock, Palette, ShoppingCart,
  CreditCard, LifeBuoy, Settings, LogOut, ExternalLink
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

const mainItems = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
  { icon: Globe, label: 'Domains', href: '/dashboard/domains' },
  { icon: Server, label: 'Hosting', href: '/dashboard/hosting' },
  { icon: Mail, label: 'Email', href: '/dashboard/email' },
  { icon: Lock, label: 'SSL Certificates', href: '/dashboard/ssl' },
  { icon: Shield, label: 'SiteLock', href: '/dashboard/sitelock' },
  { icon: Palette, label: 'Website Builder', href: '/dashboard/website-builder' },
  { icon: ShoppingCart, label: 'Orders', href: '/dashboard/orders' },
  { icon: CreditCard, label: 'Billing', href: '/dashboard/billing' },
  { icon: LifeBuoy, label: 'Support', href: '/dashboard/support' },
  { icon: Settings, label: 'Settings', href: '/dashboard/settings' },
];

const platformLinks = [
  { label: 'swipesblue.com', href: 'https://swipesblue.com', colors: ['#374151', '#0000FF'] },
  { label: 'hostsblue.com', href: 'https://hostsblue.com', colors: ['#008060', '#0000FF'] },
  { label: 'businessblueprint.io', href: 'https://businessblueprint.io', colors: ['#FF6B00', '#0000FF'] },
];

export function DashboardLayout() {
  const location = useLocation();
  const { customer, logout } = useAuth();

  const isActive = (href: string) => {
    if (href === '/dashboard') return location.pathname === '/dashboard';
    return location.pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-64 bg-white border-r border-gray-200 flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-gray-200">
          <Link to="/" className="flex items-end gap-2">
            <img src="/HostsBlue_Logo_Image.png?v=2" alt="hostsblue" className="h-8 w-auto" style={{ filter: 'drop-shadow(0.5px 0.5px 0px #09080E)' }} />
            <span className="text-xl leading-none">
              <span className="logo-hosts">hosts</span>
              <span className="logo-blue">blue</span>
            </span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {mainItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all duration-200 ${
                  active
                    ? 'bg-teal-50 text-[#064A6C] font-medium border-r-2 border-[#064A6C]'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}

          {/* Platforms Section */}
          <hr className="my-4 border-gray-200" style={{ opacity: 0.6 }} />
          <p className="px-4 text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Platforms</p>
          {platformLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-50 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>{link.label}</span>
            </a>
          ))}
        </nav>

        {/* User & Logout */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-3 mb-3 px-2">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <span className="text-[#064A6C] text-sm font-medium">
                {customer?.firstName?.[0] || customer?.email?.[0] || '?'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {customer?.firstName} {customer?.lastName}
              </p>
              <p className="text-xs text-gray-500 truncate">{customer?.email}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-3 px-4 py-2.5 w-full text-sm text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <header className="lg:hidden bg-white border-b border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-end gap-2">
              <img src="/HostsBlue_Logo_Image.png?v=2" alt="hostsblue" className="h-7 w-auto" style={{ filter: 'drop-shadow(0.5px 0.5px 0px #09080E)' }} />
              <span className="text-lg leading-none">
                <span className="logo-hosts">hosts</span>
                <span className="logo-blue">blue</span>
              </span>
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
