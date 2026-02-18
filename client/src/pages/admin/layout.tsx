import { Link, Outlet, useLocation } from 'react-router-dom';
import {
  BarChart3,
  Users,
  ShoppingCart,
  Globe,
  Server,
  Mail,
  ShieldCheck,
  Headphones,
  Settings,
  LogOut,
} from 'lucide-react';

const sidebarLinks = [
  { to: '/admin', label: 'Overview', icon: BarChart3, exact: true },
  { to: '/admin/customers', label: 'Customers', icon: Users },
  { to: '/admin/orders', label: 'Orders', icon: ShoppingCart },
  { to: '/admin/domains', label: 'Domains', icon: Globe },
  { to: '/admin/hosting', label: 'Hosting', icon: Server },
  { to: '/admin/email', label: 'Email', icon: Mail },
  { to: '/admin/ssl', label: 'SSL', icon: ShieldCheck },
  { to: '/admin/support', label: 'Support', icon: Headphones },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
];

export function AdminLayout() {
  const location = useLocation();

  const isActive = (link: typeof sidebarLinks[0]) => {
    if (link.exact) {
      return location.pathname === link.to;
    }
    return location.pathname.startsWith(link.to);
  };

  return (
    <div className="min-h-screen flex bg-white">
      {/* Sidebar */}
      <aside className="w-[240px] bg-[#F9FAFB] border-r border-[#E5E7EB] flex flex-col fixed top-0 left-0 h-full z-30">
        {/* Logo */}
        <div className="p-6 border-b border-[#E5E7EB]">
          <Link to="/admin" className="flex items-center gap-2">
            <span className="text-xl">
              <span className="logo-hosts">hosts</span>
              <span className="logo-blue">blue</span>
            </span>
            <span className="text-xs font-semibold text-[#064A6C] bg-teal-50 px-2 py-0.5 rounded-[7px]">
              Admin
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
                className={`flex items-center gap-3 px-3 py-2.5 rounded-[7px] text-sm font-medium transition-colors ${
                  active
                    ? 'bg-teal-50 text-[#064A6C]'
                    : 'text-[#4B5563] hover:bg-gray-100 hover:text-[#09080E]'
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
            to="/admin/login"
            className="flex items-center gap-3 px-3 py-2.5 rounded-[7px] text-sm font-medium text-[#4B5563] hover:bg-gray-100 hover:text-[#09080E] transition-colors"
          >
            <LogOut className="w-5 h-5 text-[#4B5563]" />
            Sign Out
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
