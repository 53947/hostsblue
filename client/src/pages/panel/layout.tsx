import { Link, Outlet, useLocation } from 'react-router-dom';
import {
  BarChart3,
  Users,
  ShoppingCart,
  Globe,
  Server,
  Mail,
  ShieldCheck,
  Palette,
  Headphones,
  DollarSign,
  Settings,
  ArrowLeft,
} from 'lucide-react';

const sidebarLinks = [
  { to: '/panel', label: 'Overview', icon: BarChart3, exact: true },
  { to: '/panel/customers', label: 'Customers', icon: Users },
  { to: '/panel/orders', label: 'Orders', icon: ShoppingCart },
  { to: '/panel/domains', label: 'Domains', icon: Globe },
  { to: '/panel/hosting', label: 'Hosting', icon: Server },
  { to: '/panel/email', label: 'Email Accounts', icon: Mail },
  { to: '/panel/ssl', label: 'SSL Certificates', icon: ShieldCheck },
  { to: '/panel/builder', label: 'Website Builder', icon: Palette },
  { to: '/panel/support', label: 'Support Tickets', icon: Headphones },
  { to: '/panel/revenue', label: 'Revenue', icon: DollarSign },
  { to: '/panel/settings', label: 'Settings', icon: Settings },
];

export function PanelLayout() {
  const location = useLocation();

  const isActive = (link: (typeof sidebarLinks)[0]) => {
    if (link.exact) {
      return location.pathname === link.to;
    }
    return location.pathname.startsWith(link.to);
  };

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar */}
      <aside className="w-[240px] bg-white border-r border-[#E5E7EB] flex flex-col fixed top-0 left-0 h-full z-30">
        {/* Logo */}
        <div className="p-6 border-b border-[#E5E7EB]">
          <Link to="/panel" className="flex items-center gap-2">
            <img src="/HostsBlue_Logo_Image_Trans.png" alt="hostsblue" className="h-6" />
            <span className="text-xl">
              <span className="logo-hosts">hosts</span>
              <span className="logo-blue">blue</span>
            </span>
            <span className="text-xs font-semibold text-[#064A6C] bg-teal-50 px-2 py-0.5 rounded-[7px]">
              Panel
            </span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {sidebarLinks.map((link) => {
            const Icon = link.icon;
            const active = isActive(link);
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-teal-50 text-[#064A6C] border-r-2 border-[#064A6C] rounded-l-[7px]'
                    : 'text-[#4B5563] hover:bg-gray-100 hover:text-[#09080E] rounded-[7px]'
                }`}
              >
                <Icon className={`w-5 h-5 ${active ? 'text-[#064A6C]' : 'text-[#4B5563]'}`} />
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-[#E5E7EB]">
          <Link
            to="/"
            className="flex items-center gap-3 px-3 py-2.5 rounded-[7px] text-sm font-medium text-[#4B5563] hover:bg-gray-100 hover:text-[#09080E] transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-[#4B5563]" />
            Back to Site
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-[240px]">
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
