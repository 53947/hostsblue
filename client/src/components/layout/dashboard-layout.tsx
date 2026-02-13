import { Link, useLocation, Outlet } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Globe, 
  Server, 
  ShoppingCart, 
  Settings, 
  HelpCircle,
  LogOut
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

const sidebarItems = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
  { icon: Globe, label: 'My Domains', href: '/dashboard/domains' },
  { icon: Server, label: 'My Hosting', href: '/dashboard/hosting' },
  { icon: ShoppingCart, label: 'Orders', href: '/dashboard/orders' },
  { icon: Settings, label: 'Settings', href: '/dashboard/settings' },
  { icon: HelpCircle, label: 'Support', href: '/dashboard/support' },
];

export function DashboardLayout() {
  const location = useLocation();
  const { customer, logout } = useAuth();

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return location.pathname === '/dashboard';
    }
    return location.pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex">
      {/* Sidebar */}
      <aside className="w-64 bg-[var(--bg-secondary)] border-r border-[var(--border-color)] flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-[var(--border-color)]">
          <Link to="/" className="inline-block">
            <span className="text-xl">
              <span className="logo-hosts">hosts</span>
              <span className="logo-blue">blue</span>
            </span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {sidebarItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`sidebar-link ${active ? 'sidebar-link-active' : ''}`}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User & Logout */}
        <div className="p-4 border-t border-[var(--border-color)]">
          <div className="flex items-center gap-3 mb-4 px-4">
            <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
              <span className="text-purple-400 text-sm font-medium">
                {customer?.firstName?.[0] || customer?.email?.[0] || '?'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {customer?.firstName} {customer?.lastName}
              </p>
              <p className="text-xs text-zinc-500 truncate">{customer?.email}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="sidebar-link w-full text-red-400 hover:text-red-300 hover:bg-red-500/10"
          >
            <LogOut className="w-5 h-5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <header className="lg:hidden bg-[var(--bg-secondary)] border-b border-[var(--border-color)] p-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="inline-block">
              <span className="text-lg">
                <span className="logo-hosts">hosts</span>
                <span className="logo-blue">blue</span>
              </span>
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
