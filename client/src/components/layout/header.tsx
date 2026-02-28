import { useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { Menu, X, ChevronDown, Search, Globe, Server, Mail, Shield, Sparkles, Check, ShoppingCart } from 'lucide-react';
import { Brandsignature } from '@/components/ui/brandsignature';

type MenuKey = 'domains' | 'hosting' | 'email' | 'security' | 'builder' | null;

interface HeaderProps {
  cartItemCount?: number;
  onCartClick?: () => void;
}

export function Header({ cartItemCount = 0, onCartClick }: HeaderProps = {}) {
  const { isAuthenticated, customer, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState<MenuKey>(null);
  const [mobileExpanded, setMobileExpanded] = useState<MenuKey>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openMenu = useCallback((menu: MenuKey) => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    setActiveMenu(menu);
  }, []);

  const startClose = useCallback(() => {
    closeTimerRef.current = setTimeout(() => setActiveMenu(null), 150);
  }, []);

  const cancelClose = useCallback(() => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
  }, []);

  const navItems: { key: MenuKey; label: string }[] = [
    { key: 'domains', label: 'Domains' },
    { key: 'hosting', label: 'Hosting' },
    { key: 'email', label: 'Email' },
    { key: 'security', label: 'Security' },
    { key: 'builder', label: 'Website Builder' },
  ];

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-[#E5E7EB]" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center h-16">
          {/* Logo — left side only */}
          <Brandsignature brand="hostsblue" showTld={false} size={24} linkTo="/" />

          {/* Desktop Nav + Auth — right-aligned */}
          <nav className="hidden lg:flex items-center gap-1 ml-auto">
            {navItems.map(({ key, label }) => (
              <div
                key={key}
                className="relative"
                onMouseEnter={() => openMenu(key)}
                onMouseLeave={startClose}
              >
                <button className={`flex items-center gap-1 px-3 py-2 text-sm font-medium transition-colors ${activeMenu === key ? 'text-[#064A6C]' : 'text-[#4B5563] hover:text-[#09080E]'}`}>
                  {label}
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${activeMenu === key ? 'rotate-180' : ''}`} />
                </button>
              </div>
            ))}
            <Link to="/pricing" className="px-3 py-2 text-sm font-medium text-[#4B5563] hover:text-[#09080E] transition-colors">
              Pricing
            </Link>

            {/* Cart */}
            {cartItemCount > 0 && (
              <button
                onClick={onCartClick}
                className="relative p-2 text-[#4B5563] hover:text-[#064A6C] transition-colors"
                title="View cart"
              >
                <ShoppingCart className="w-5 h-5" />
                <span className="absolute -top-0.5 -right-0.5 bg-[#064A6C] text-white text-[10px] font-bold w-4.5 h-4.5 flex items-center justify-center rounded-full min-w-[18px] min-h-[18px]">
                  {cartItemCount}
                </span>
              </button>
            )}

            {/* Thin separator */}
            <div className="w-px h-6 bg-[#E5E7EB] mx-2" />

            {/* Auth */}
            {isAuthenticated ? (
              <>
                <Link to="/dashboard" className="text-sm font-medium text-[#064A6C] hover:text-[#053A55] transition-colors px-2">Dashboard</Link>
                <span className="text-sm text-[#4B5563] px-2">{customer?.firstName || customer?.email}</span>
                <button onClick={logout} className="text-sm text-[#4B5563] hover:text-[#DC2626] transition-colors px-2">Sign Out</button>
              </>
            ) : (
              <>
                <Link to="/login" className="text-sm font-medium text-[#064A6C] hover:text-[#053A55] transition-colors px-2">Login</Link>
                <Link to="/register" className="bg-[#064A6C] hover:bg-[#053A55] text-white font-medium text-sm px-5 py-2.5 rounded-[7px] transition-all btn-arrow-hover ml-2">
                  Get Started
                </Link>
              </>
            )}
          </nav>

          {/* Mobile Hamburger */}
          <button className="lg:hidden ml-auto p-2 text-[#4B5563]" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mega Menu Panels */}
      {activeMenu && (
        <div
          className="hidden lg:block absolute left-0 right-0 bg-white border-t border-[#E5E7EB]"
          style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.08)', zIndex: 49 }}
          onMouseEnter={cancelClose}
          onMouseLeave={startClose}
        >
          <div className="max-w-[1200px] mx-auto px-8 py-8">
            {activeMenu === 'domains' && (
              <div>
                <div className="flex">
                  <div className="flex-1 pr-8 border-r border-[#E5E7EB]/60">
                    <h3 className="text-base font-bold text-[#064A6C] mb-3">Register New</h3>
                    <form onSubmit={(e) => { e.preventDefault(); }} className="flex gap-2 mb-3">
                      <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input type="text" placeholder="Find your dream domain" className="w-full pl-9 pr-3 py-2 text-sm border border-[#E5E7EB] rounded-[7px] focus:outline-none focus:border-[#064A6C]" />
                      </div>
                      <button className="bg-[#064A6C] hover:bg-[#053A55] text-white text-sm font-medium px-4 py-2 rounded-[7px] transition-colors btn-arrow-hover">Search</button>
                    </form>
                    <p className="text-xs text-[#4B5563]">700+ TLDs available</p>
                    <Link to="/domains/search" className="text-sm font-medium text-[#064A6C] mt-3 inline-flex items-center gap-1 arrow-link">Search Domains <span className="arrow">&rarr;</span></Link>
                  </div>
                  <div className="flex-1 px-8 border-r border-[#E5E7EB]/60">
                    <h3 className="text-base font-bold text-[#064A6C] mb-3">Transfer Existing</h3>
                    <p className="text-sm text-[#4B5563] mb-3">Bring your domain home. Free WHOIS privacy, no downtime.</p>
                    <p className="text-xs text-[#4B5563] mb-3">Enter your domain + authorization code to start</p>
                    <div className="border-l-2 border-[#064A6C] bg-[#F9FAFB] rounded-r-[7px] p-3 mb-3">
                      <p className="text-xs font-medium text-[#09080E]">Transfer Bundle</p>
                      <p className="text-xs text-[#4B5563] mt-1">Add hosting &rarr; 20% off. Add email &rarr; 3 months free.</p>
                    </div>
                    <Link to="/domains/transfer" className="text-sm font-medium text-[#064A6C] inline-flex items-center gap-1 arrow-link">Start Transfer <span className="arrow">&rarr;</span></Link>
                  </div>
                  <div className="flex-1 pl-8">
                    <h3 className="text-base font-bold text-[#064A6C] mb-3">Renew Existing</h3>
                    <p className="text-sm text-[#4B5563] mb-3">Keep the dream alive. Bulk renewal, auto-renew setup.</p>
                    <ul className="space-y-1.5 text-sm text-[#4B5563] mb-3">
                      <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[#064A6C]" /> Bulk renewal</li>
                      <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[#064A6C]" /> Auto-renew</li>
                      <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[#064A6C]" /> Expiry notifications</li>
                    </ul>
                    <Link to="/dashboard/domains" className="text-sm font-medium text-[#064A6C] inline-flex items-center gap-1 arrow-link">Manage Renewals <span className="arrow">&rarr;</span></Link>
                  </div>
                </div>
                <div className="mt-6 pt-4 border-t border-[#E5E7EB] bg-[#F9FAFB] -mx-8 px-8 py-3 -mb-8 rounded-b-lg">
                  <div className="flex items-center justify-center gap-6 text-sm text-[#4B5563]">
                    {[
                      { tld: '.com', price: '$12.99' }, { tld: '.net', price: '$14.99' }, { tld: '.org', price: '$13.99' },
                      { tld: '.io', price: '$39.99' }, { tld: '.co', price: '$29.99' }, { tld: '.dev', price: '$16.99' }, { tld: '.app', price: '$19.99' },
                    ].map(({ tld, price }) => (
                      <span key={tld}><span className="font-medium text-[#09080E]">{tld}</span> {price}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeMenu === 'hosting' && (
              <div>
                <div className="flex">
                  <div className="flex-1 pr-8 border-r border-[#E5E7EB]/60">
                    <h3 className="text-base font-bold text-[#064A6C] mb-1">WordPress Hosting</h3>
                    <p className="text-xs text-[#4B5563] mb-3">Managed WordPress, optimized for speed</p>
                    <div className="space-y-2.5">
                      {[
                        { name: 'Starter', detail: '1 site, 10GB, 25K visits', price: '$9.99/mo', popular: false },
                        { name: 'Growth', detail: '5 sites, 50GB, 100K visits, staging', price: '$24.99/mo', popular: true },
                        { name: 'Business', detail: '20 sites, 200GB, 500K visits', price: '$49.99/mo', popular: false },
                        { name: 'Enterprise', detail: 'Unlimited sites, 500GB', price: '$99.99/mo', popular: false },
                      ].map((p) => (
                        <div key={p.name} className="flex items-center justify-between text-sm">
                          <div>
                            <span className="font-medium text-[#09080E]">{p.name}</span>
                            {p.popular && <span className="ml-2 badge badge-popular text-[10px]">POPULAR</span>}
                            <p className="text-xs text-[#4B5563]">{p.detail}</p>
                          </div>
                          <span className="font-medium text-[#09080E] whitespace-nowrap">{p.price}</span>
                        </div>
                      ))}
                    </div>
                    <Link to="/hosting" className="text-sm font-medium text-[#064A6C] mt-3 inline-flex items-center gap-1 arrow-link">Compare WordPress Plans <span className="arrow">&rarr;</span></Link>
                  </div>
                  <div className="flex-1 px-8 border-r border-[#E5E7EB]/60">
                    <h3 className="text-base font-bold text-[#064A6C] mb-1">Cloud Hosting</h3>
                    <p className="text-xs text-[#4B5563] mb-3">Deploy apps with managed infrastructure</p>
                    <div className="space-y-2.5">
                      {[
                        { name: 'Developer', detail: '1 vCPU, 2GB RAM, 10GB', price: '$12/mo' },
                        { name: 'Startup', detail: '2 vCPU, 4GB RAM, 25GB', price: '$29/mo' },
                        { name: 'Scale', detail: '4 vCPU, 8GB RAM, 50GB', price: '$59/mo' },
                        { name: 'Enterprise', detail: '8 vCPU, 16GB RAM, 200GB', price: 'Custom' },
                      ].map((p) => (
                        <div key={p.name} className="flex items-center justify-between text-sm">
                          <div>
                            <span className="font-medium text-[#09080E]">{p.name}</span>
                            <p className="text-xs text-[#4B5563]">{p.detail}</p>
                          </div>
                          <span className="font-medium text-[#09080E] whitespace-nowrap">{p.price}</span>
                        </div>
                      ))}
                    </div>
                    <Link to="/hosting/cloud" className="text-sm font-medium text-[#064A6C] mt-3 inline-flex items-center gap-1 arrow-link">Explore Cloud Hosting <span className="arrow">&rarr;</span></Link>
                  </div>
                  <div className="flex-1 pl-8">
                    <h3 className="text-base font-bold text-[#064A6C] mb-1">Managed VPS</h3>
                    <p className="text-xs text-[#4B5563] mb-3">Root-level control with expert support</p>
                    <p className="text-sm text-[#4B5563] mb-3">Full server access with managed security, updates, and monitoring.</p>
                    <ul className="space-y-1.5 text-sm text-[#4B5563]">
                      <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[#064A6C]" /> Root SSH access</li>
                      <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[#064A6C]" /> Managed security patches</li>
                      <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[#064A6C]" /> Custom software stacks</li>
                      <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[#064A6C]" /> Dedicated resources</li>
                    </ul>
                    <Link to="/hosting/vps" className="text-sm font-medium text-[#064A6C] mt-3 inline-flex items-center gap-1 arrow-link">Learn About VPS <span className="arrow">&rarr;</span></Link>
                  </div>
                </div>
                <div className="mt-6 pt-4 border-t border-[#E5E7EB] bg-[#F9FAFB] -mx-8 px-8 py-3 -mb-8 rounded-b-lg">
                  <p className="text-sm text-[#4B5563] text-center">All plans include free SSL, daily backups, and 99.9% uptime guarantee</p>
                </div>
              </div>
            )}

            {activeMenu === 'email' && (
              <div className="flex">
                <div className="flex-1 pr-8 border-r border-[#E5E7EB]/60">
                  <h3 className="text-base font-bold text-[#064A6C] mb-1">Business Email</h3>
                  <p className="text-xs text-[#4B5563] mb-3">Professional email on your domain</p>
                  <div className="space-y-2.5">
                    {[
                      { name: 'Starter', detail: '1 mailbox, 10GB', price: '$2.99/mo', popular: false },
                      { name: 'Business', detail: '5 mailboxes, 25GB', price: '$9.99/mo', popular: true },
                      { name: 'Enterprise', detail: '25 mailboxes, 50GB', price: '$24.99/mo', popular: false },
                    ].map((p) => (
                      <div key={p.name} className="flex items-center justify-between text-sm">
                        <div>
                          <span className="font-medium text-[#09080E]">{p.name}</span>
                          {p.popular && <span className="ml-2 badge badge-popular text-[10px]">POPULAR</span>}
                          <p className="text-xs text-[#4B5563]">{p.detail}</p>
                        </div>
                        <span className="font-medium text-[#09080E]">{p.price}</span>
                      </div>
                    ))}
                  </div>
                  <Link to="/email" className="text-sm font-medium text-[#064A6C] mt-3 inline-flex items-center gap-1 arrow-link">Choose Email Plan <span className="arrow">&rarr;</span></Link>
                </div>
                <div className="flex-1 px-8 border-r border-[#E5E7EB]/60">
                  <h3 className="text-base font-bold text-[#064A6C] mb-3">Features</h3>
                  <ul className="space-y-2 text-sm text-[#4B5563]">
                    {['Advanced spam filtering', 'Virus protection', 'Webmail access', 'Mobile sync (ActiveSync)', 'Shared calendar & contacts', 'Auto-responders & aliases', '99.9% uptime guarantee'].map((f) => (
                      <li key={f} className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[#064A6C]" /> {f}</li>
                    ))}
                  </ul>
                </div>
                <div className="flex-1 pl-8">
                  <h3 className="text-base font-bold text-[#064A6C] mb-3">Email Migration</h3>
                  <p className="text-sm text-[#4B5563] mb-3">Moving from Gmail, Outlook, or another provider? We migrate your email for free.</p>
                  <ul className="space-y-2 text-sm text-[#4B5563]">
                    <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[#064A6C]" /> Free from any provider</li>
                    <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[#064A6C]" /> Dedicated migration specialist</li>
                    <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[#064A6C]" /> Complete within 48 hours</li>
                  </ul>
                  <Link to="/email" className="text-sm font-medium text-[#064A6C] mt-3 inline-flex items-center gap-1 arrow-link">Start Free Migration <span className="arrow">&rarr;</span></Link>
                </div>
              </div>
            )}

            {activeMenu === 'security' && (
              <div className="flex">
                <div className="flex-1 pr-8 border-r border-[#E5E7EB]/60">
                  <h3 className="text-base font-bold text-[#064A6C] mb-3">SSL Certificates</h3>
                  <div className="space-y-2.5">
                    {[
                      { name: 'DV SSL', detail: 'Free with any hosting plan', price: 'FREE', badge: 'free' },
                      { name: 'OV SSL', detail: 'Business verification', price: '$49.99/yr', badge: null },
                      { name: 'EV SSL', detail: 'Highest trust level', price: '$149.99/yr', badge: null },
                      { name: 'Wildcard SSL', detail: 'All subdomains', price: '$199.99/yr', badge: null },
                    ].map((p) => (
                      <div key={p.name} className="flex items-center justify-between text-sm">
                        <div>
                          <span className="font-medium text-[#09080E]">{p.name}</span>
                          {p.badge === 'free' && <span className="ml-2 badge badge-free text-[10px]">FREE</span>}
                          <p className="text-xs text-[#4B5563]">{p.detail}</p>
                        </div>
                        <span className={`font-medium whitespace-nowrap ${p.price === 'FREE' ? 'text-[#10B981]' : 'text-[#09080E]'}`}>{p.price}</span>
                      </div>
                    ))}
                  </div>
                  <Link to="/security" className="text-sm font-medium text-[#064A6C] mt-3 inline-flex items-center gap-1 arrow-link">Compare SSL Options <span className="arrow">&rarr;</span></Link>
                </div>
                <div className="flex-1 px-8 border-r border-[#E5E7EB]/60">
                  <h3 className="text-base font-bold text-[#064A6C] mb-3">SiteLock Security</h3>
                  <div className="space-y-2.5">
                    {[
                      { name: 'Basic', detail: 'Daily scan, trust seal', price: '$9.99/mo', popular: false },
                      { name: 'Professional', detail: 'WAF, auto-removal, CDN', price: '$24.99/mo', popular: true },
                      { name: 'Enterprise', detail: 'DDoS, PCI compliance', price: '$49.99/mo', popular: false },
                    ].map((p) => (
                      <div key={p.name} className="flex items-center justify-between text-sm">
                        <div>
                          <span className="font-medium text-[#09080E]">{p.name}</span>
                          {p.popular && <span className="ml-2 badge badge-popular text-[10px]">POPULAR</span>}
                          <p className="text-xs text-[#4B5563]">{p.detail}</p>
                        </div>
                        <span className="font-medium text-[#09080E]">{p.price}</span>
                      </div>
                    ))}
                  </div>
                  <Link to="/security" className="text-sm font-medium text-[#064A6C] mt-3 inline-flex items-center gap-1 arrow-link">Protect Your Site <span className="arrow">&rarr;</span></Link>
                </div>
                <div className="flex-1 pl-8">
                  <h3 className="text-base font-bold text-[#064A6C] mb-3">Backup & Recovery</h3>
                  <ul className="space-y-2 text-sm text-[#4B5563]">
                    {['Daily automated backups', 'One-click restore', 'Off-site encrypted storage', '30-day retention', 'File-level recovery'].map((f) => (
                      <li key={f} className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[#064A6C]" /> {f}</li>
                    ))}
                  </ul>
                  <Link to="/security" className="text-sm font-medium text-[#064A6C] mt-3 inline-flex items-center gap-1 arrow-link">Learn About Backups <span className="arrow">&rarr;</span></Link>
                </div>
              </div>
            )}

            {activeMenu === 'builder' && (
              <div className="flex gap-0">
                <div className="flex-[1.1] pr-8 border-r border-[#E5E7EB]/60">
                  <span className="badge badge-ai text-[10px] mb-2">AI-POWERED</span>
                  <h3 className="text-base font-bold text-[#064A6C] mb-2">AI Website Builder</h3>
                  <p className="text-sm text-[#4B5563] mb-3">Tell our AI about your business. It designs your site, writes the copy, picks the images, and builds it — while you watch.</p>
                  <ul className="space-y-1.5 text-sm text-[#4B5563] mb-3">
                    <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[#064A6C]" /> AI setup in under 5 minutes</li>
                    <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[#064A6C]" /> Writes all your content</li>
                    <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[#064A6C]" /> Picks matching images & colors</li>
                    <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[#064A6C]" /> Live preview as it builds</li>
                  </ul>
                  <Link to="/website-builder" className="bg-[#064A6C] hover:bg-[#053A55] text-white text-sm font-medium px-4 py-2 rounded-[7px] transition-all btn-arrow-hover">Build My Site</Link>
                </div>
                <div className="flex-1 pl-8 flex gap-6">
                  <div className="flex-1">
                    <h3 className="text-base font-bold text-[#064A6C] mb-3">Plans</h3>
                    <div className="space-y-2.5">
                      {[
                        { name: 'Starter', detail: '1 site, 5 pages, AI-assisted', price: '$4.99/mo' },
                        { name: 'Business', detail: '3 sites, e-commerce', price: '$14.99/mo', popular: true },
                        { name: 'Professional', detail: '10 sites, white-label, API', price: '$29.99/mo' },
                        { name: 'Agency', detail: '50 sites, client dashboard', price: '$79.99/mo', isNew: true },
                      ].map((p: any) => (
                        <div key={p.name} className="flex items-center justify-between text-sm">
                          <div>
                            <span className="font-medium text-[#09080E]">{p.name}</span>
                            {p.popular && <span className="ml-2 badge badge-popular text-[10px]">POPULAR</span>}
                            {p.isNew && <span className="ml-2 badge badge-new text-[10px]">NEW</span>}
                            <p className="text-xs text-[#4B5563]">{p.detail}</p>
                          </div>
                          <span className="font-medium text-[#09080E]">{p.price}</span>
                        </div>
                      ))}
                    </div>
                    <Link to="/website-builder" className="text-sm font-medium text-[#064A6C] mt-3 inline-flex items-center gap-1 arrow-link">Compare Plans <span className="arrow">&rarr;</span></Link>
                  </div>
                  <div className="flex-shrink-0">
                    <h3 className="text-base font-bold text-[#064A6C] mb-3">200+ Templates</h3>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                      {['Business', 'Portfolio', 'Restaurant', 'Real Estate', 'E-Commerce', 'Blog', 'Agency', 'Health & Wellness', 'Education', 'Events', 'Photography', 'Landing Pages'].map((cat) => (
                        <Link key={cat} to="/website-builder" className="text-sm text-[#4B5563] hover:text-[#064A6C] transition-colors">{cat}</Link>
                      ))}
                    </div>
                    <Link to="/website-builder" className="text-sm font-medium text-[#064A6C] mt-3 inline-flex items-center gap-1 arrow-link">Browse Templates <span className="arrow">&rarr;</span></Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-[#E5E7EB] bg-white max-h-[80vh] overflow-y-auto">
          <div className="py-4 px-4 space-y-1">
            {navItems.map(({ key, label }) => (
              <div key={key}>
                <button
                  onClick={() => setMobileExpanded(mobileExpanded === key ? null : key)}
                  className="flex items-center justify-between w-full px-3 py-2.5 text-sm font-medium text-[#4B5563] hover:text-[#09080E] hover:bg-[#F9FAFB] rounded-lg"
                >
                  {label}
                  <ChevronDown className={`w-4 h-4 transition-transform ${mobileExpanded === key ? 'rotate-180' : ''}`} />
                </button>
                {mobileExpanded === key && (
                  <div className="pl-4 py-2 space-y-1">
                    {key === 'domains' && (
                      <>
                        <Link to="/domains/search" className="block px-3 py-2 text-sm text-[#4B5563] hover:bg-[#F9FAFB] rounded-lg" onClick={() => setMobileOpen(false)}>Search Domains</Link>
                        <Link to="/domains/transfer" className="block px-3 py-2 text-sm text-[#4B5563] hover:bg-[#F9FAFB] rounded-lg" onClick={() => setMobileOpen(false)}>Transfer Domain</Link>
                        <Link to="/dashboard/domains" className="block px-3 py-2 text-sm text-[#4B5563] hover:bg-[#F9FAFB] rounded-lg" onClick={() => setMobileOpen(false)}>Manage Renewals</Link>
                      </>
                    )}
                    {key === 'hosting' && (
                      <>
                        <Link to="/hosting" className="block px-3 py-2 text-sm text-[#4B5563] hover:bg-[#F9FAFB] rounded-lg" onClick={() => setMobileOpen(false)}>WordPress Hosting</Link>
                        <Link to="/hosting/cloud" className="block px-3 py-2 text-sm text-[#4B5563] hover:bg-[#F9FAFB] rounded-lg" onClick={() => setMobileOpen(false)}>Cloud Hosting</Link>
                        <Link to="/hosting/vps" className="block px-3 py-2 text-sm text-[#4B5563] hover:bg-[#F9FAFB] rounded-lg" onClick={() => setMobileOpen(false)}>Managed VPS</Link>
                      </>
                    )}
                    {key === 'email' && (
                      <>
                        <Link to="/email" className="block px-3 py-2 text-sm text-[#4B5563] hover:bg-[#F9FAFB] rounded-lg" onClick={() => setMobileOpen(false)}>Email Plans</Link>
                      </>
                    )}
                    {key === 'security' && (
                      <>
                        <Link to="/security" className="block px-3 py-2 text-sm text-[#4B5563] hover:bg-[#F9FAFB] rounded-lg" onClick={() => setMobileOpen(false)}>SSL Certificates</Link>
                        <Link to="/security" className="block px-3 py-2 text-sm text-[#4B5563] hover:bg-[#F9FAFB] rounded-lg" onClick={() => setMobileOpen(false)}>SiteLock Security</Link>
                      </>
                    )}
                    {key === 'builder' && (
                      <>
                        <Link to="/website-builder" className="block px-3 py-2 text-sm text-[#4B5563] hover:bg-[#F9FAFB] rounded-lg" onClick={() => setMobileOpen(false)}>AI Website Builder</Link>
                        <Link to="/website-builder" className="block px-3 py-2 text-sm text-[#4B5563] hover:bg-[#F9FAFB] rounded-lg" onClick={() => setMobileOpen(false)}>Templates</Link>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
            <Link to="/pricing" className="block px-3 py-2.5 text-sm font-medium text-[#4B5563] hover:bg-[#F9FAFB] rounded-lg" onClick={() => setMobileOpen(false)}>Pricing</Link>
            <hr className="my-2 border-[#E5E7EB]" />
            {isAuthenticated ? (
              <>
                <Link to="/dashboard" className="block px-3 py-2.5 text-sm font-medium text-[#064A6C]" onClick={() => setMobileOpen(false)}>Dashboard</Link>
                <button onClick={() => { logout(); setMobileOpen(false); }} className="block w-full text-left px-3 py-2.5 text-sm text-[#DC2626]">Sign Out</button>
              </>
            ) : (
              <>
                <Link to="/login" className="block px-3 py-2.5 text-sm font-medium text-[#064A6C]" onClick={() => setMobileOpen(false)}>Login</Link>
                <Link to="/register" className="block mx-3 text-center bg-[#064A6C] text-white py-2.5 rounded-[7px] font-medium text-sm" onClick={() => setMobileOpen(false)}>Get Started</Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
