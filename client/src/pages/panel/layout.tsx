import { useState, useRef, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Brandsignature } from '@/components/ui/brandsignature';
import { panelApi } from '@/lib/api';
import {
  BarChart3,
  Users,
  ShoppingCart,
  Globe,
  Server,
  Cloud,
  Mail,
  ShieldCheck,
  Palette,
  Headphones,
  DollarSign,
  Settings,
  ArrowLeft,
  Search,
  Loader2,
} from 'lucide-react';

const sidebarLinks = [
  { to: '/panel', label: 'Overview', icon: BarChart3, exact: true },
  { to: '/panel/customers', label: 'Customers', icon: Users },
  { to: '/panel/orders', label: 'Orders', icon: ShoppingCart },
  { to: '/panel/domains', label: 'Domains', icon: Globe },
  { to: '/panel/hosting', label: 'Hosting', icon: Server },
  { to: '/panel/cloud', label: 'Cloud Servers', icon: Cloud },
  { to: '/panel/email', label: 'Email Accounts', icon: Mail },
  { to: '/panel/ssl', label: 'SSL Certificates', icon: ShieldCheck },
  { to: '/panel/builder', label: 'Website Builder', icon: Palette },
  { to: '/panel/support', label: 'Support Tickets', icon: Headphones },
  { to: '/panel/revenue', label: 'Revenue', icon: DollarSign },
  { to: '/panel/settings', label: 'Settings', icon: Settings },
];

export function PanelLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isActive = (link: (typeof sidebarLinks)[0]) => {
    if (link.exact) {
      return location.pathname === link.to;
    }
    return location.pathname.startsWith(link.to);
  };

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!searchQuery.trim()) {
      setSearchResults(null);
      setShowDropdown(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const results = await panelApi.search(searchQuery.trim());
        setSearchResults(results);
        setShowDropdown(true);
      } catch {
        setSearchResults(null);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      setSearchLoading(true);
      panelApi.search(searchQuery.trim())
        .then((results) => {
          setSearchResults(results);
          setShowDropdown(true);
        })
        .catch(() => setSearchResults(null))
        .finally(() => setSearchLoading(false));
    }
    if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  const handleResultClick = (path: string) => {
    setShowDropdown(false);
    setSearchQuery('');
    setSearchResults(null);
    navigate(path);
  };

  const customers = searchResults?.customers || [];
  const orders = searchResults?.orders || [];
  const domains = searchResults?.domains || [];
  const hasResults = customers.length > 0 || orders.length > 0 || domains.length > 0;

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar */}
      <aside className="w-[240px] bg-white border-r border-[#E5E7EB] flex flex-col fixed top-0 left-0 h-full z-30">
        {/* Logo */}
        <div className="p-6 border-b border-[#E5E7EB]">
          <Link to="/panel" className="flex items-center gap-2">
            <Brandsignature brand="hostsblue" showTld={false} size={20} />
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
        {/* Top Search Bar */}
        <div className="sticky top-0 z-20 bg-white border-b border-[#E5E7EB] px-8 py-3">
          <div className="relative max-w-xl" ref={dropdownRef}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4B5563]" />
              <input
                type="text"
                placeholder="Search customers, orders, domains..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                onFocus={() => {
                  if (searchResults && searchQuery.trim()) setShowDropdown(true);
                }}
                className="w-full pl-10 pr-10 py-2 text-sm border border-[#E5E7EB] rounded-[7px] bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#064A6C]/20 focus:border-[#064A6C] text-[#09080E] placeholder-[#4B5563]/60 transition-colors"
              />
              {searchLoading && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#064A6C] animate-spin" />
              )}
            </div>

            {/* Search Results Dropdown */}
            {showDropdown && searchResults && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#E5E7EB] rounded-[7px] shadow-lg max-h-80 overflow-y-auto z-50">
                {!hasResults && (
                  <div className="px-4 py-3 text-sm text-[#4B5563]">No results found</div>
                )}

                {customers.length > 0 && (
                  <div>
                    <div className="px-4 py-2 text-xs font-semibold text-[#4B5563] uppercase tracking-wider bg-gray-50 border-b border-[#E5E7EB]">
                      Customers
                    </div>
                    {customers.map((c: any) => (
                      <button
                        key={c.id}
                        onClick={() => handleResultClick(`/panel/customers/${c.id}`)}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors flex items-center gap-3 border-b border-gray-50"
                      >
                        <Users className="w-4 h-4 text-[#1844A6] shrink-0" />
                        <div>
                          <span className="font-medium text-[#09080E]">
                            {c.firstName} {c.lastName}
                          </span>
                          {c.email && (
                            <span className="ml-2 text-[#4B5563] text-xs">{c.email}</span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {orders.length > 0 && (
                  <div>
                    <div className="px-4 py-2 text-xs font-semibold text-[#4B5563] uppercase tracking-wider bg-gray-50 border-b border-[#E5E7EB]">
                      Orders
                    </div>
                    {orders.map((o: any) => (
                      <button
                        key={o.id}
                        onClick={() => handleResultClick(`/panel/orders/${o.id}`)}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors flex items-center gap-3 border-b border-gray-50"
                      >
                        <ShoppingCart className="w-4 h-4 text-[#064A6C] shrink-0" />
                        <span className="font-medium text-[#09080E]">{o.orderNumber}</span>
                        {o.status && (
                          <span className="ml-auto text-xs text-[#4B5563]">{o.status}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {domains.length > 0 && (
                  <div>
                    <div className="px-4 py-2 text-xs font-semibold text-[#4B5563] uppercase tracking-wider bg-gray-50 border-b border-[#E5E7EB]">
                      Domains
                    </div>
                    {domains.map((d: any) => (
                      <button
                        key={d.id}
                        onClick={() => handleResultClick(`/panel/domains`)}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors flex items-center gap-3 border-b border-gray-50"
                      >
                        <Globe className="w-4 h-4 text-[#064A6C] shrink-0" />
                        <span className="font-medium text-[#09080E]">{d.domainName}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
