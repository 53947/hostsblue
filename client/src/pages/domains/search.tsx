import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { domainApi } from '@/lib/api';
import { Search, Loader2, Check, X, Globe, ShoppingCart, Shield, ArrowRight, CheckCircle, Lock, ChevronDown } from 'lucide-react';
import { Link, useOutletContext, useSearchParams } from 'react-router-dom';
import { MetaTags } from '@/components/seo/meta-tags';
import type { CartItem } from '@/hooks/use-cart';

interface CartContext {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  addItem: (item: Omit<CartItem, 'id'>) => void;
  openCart: () => void;
}

const INITIAL_SHOW = 20;

export function DomainSearchPage() {
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || searchParams.get('domain') || '';
  const [query, setQuery] = useState(initialQuery);
  const [searchTerm, setSearchTerm] = useState(initialQuery);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const q = searchParams.get('q') || searchParams.get('domain') || '';
    if (q && q !== searchTerm) {
      setQuery(q);
      setSearchTerm(q);
      setShowAll(false);
    }
  }, [searchParams]);
  const cart = useOutletContext<CartContext>();

  const { data: searchResults, isLoading } = useQuery({
    queryKey: ['domain-search', searchTerm],
    queryFn: () => domainApi.search(searchTerm),
    enabled: searchTerm.length > 0,
  });

  const { data: tlds } = useQuery({
    queryKey: ['tlds'],
    queryFn: domainApi.getTlds,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanQuery = query.toLowerCase().replace(/[^a-z0-9.-]/g, '');
    setSearchTerm(cleanQuery);
    setShowAll(false);
  };

  const isInCart = (domain: string, tld: string) =>
    cart.items.some(item =>
      item.type === 'domain_registration' &&
      item.configuration?.domain === domain.replace(tld, '') &&
      item.configuration?.tld === tld
    );

  const addDomainToCart = (domain: string, tld: string, price: number) => {
    const sld = domain.replace(tld, '');
    cart.addItem({
      type: 'domain_registration',
      name: domain,
      description: `${domain} — 1 year registration`,
      price,
      termMonths: 12,
      configuration: { domain: sld, tld, sld },
    });
  };

  // Split results into primary (first result) and alternatives
  const allResults = searchResults?.results || [];
  const primaryResult = allResults[0];
  const alternatives = allResults.slice(1);
  const availableAlts = alternatives.filter((r: any) => r.available);
  const unavailableAlts = alternatives.filter((r: any) => !r.available);
  const visibleAvailable = showAll ? availableAlts : availableAlts.slice(0, INITIAL_SHOW);
  const hiddenCount = availableAlts.length - visibleAvailable.length;

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <MetaTags title="Domain Search" description="Find and register the perfect domain name for your business. Competitive pricing on .com, .net, .org, and 500+ TLDs." />
      <div className="text-center mb-12">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
          Find Your Perfect Domain
        </h1>
        <p className="text-gray-500">Search for available domain names</p>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="max-w-2xl mx-auto mb-12">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter domain name (e.g., mybusiness)"
              className="w-full pl-12 pr-4 py-4 border border-gray-200 rounded-[7px] text-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#064A6C] focus:border-transparent"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || !query}
            className="bg-[#064A6C] hover:bg-[#053A55] text-white font-medium px-6 py-4 rounded-[7px] flex items-center gap-2 whitespace-nowrap transition-colors disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Search className="w-5 h-5" />
            )}
            Search
          </button>
        </div>
      </form>

      {/* Results */}
      {allResults.length > 0 && (
        <div className="max-w-4xl mx-auto mb-12">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Results for "{searchResults.query}"
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {availableAlts.length + (primaryResult?.available ? 1 : 0)} available of {allResults.length} checked
              </p>
            </div>
            {cart.itemCount > 0 && (
              <button
                onClick={cart.openCart}
                className="flex items-center gap-2 text-sm font-medium text-[#064A6C] hover:text-[#053A55] transition-colors"
              >
                <ShoppingCart className="w-4 h-4" />
                View Cart ({cart.itemCount})
              </button>
            )}
          </div>

          {/* Primary Result — large card */}
          {primaryResult && (
            <div className={`border-2 rounded-[7px] p-6 mb-6 ${
              primaryResult.available
                ? 'border-green-300 bg-green-50/50'
                : 'border-red-200 bg-red-50/30'
            }`}>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                    primaryResult.available ? 'bg-green-100' : 'bg-red-100'
                  }`}>
                    {primaryResult.available ? (
                      <Check className="w-6 h-6 text-green-600" />
                    ) : (
                      <X className="w-6 h-6 text-red-500" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{primaryResult.domain}</h3>
                    <p className={`text-sm font-medium ${primaryResult.available ? 'text-green-600' : 'text-red-500'}`}>
                      {primaryResult.available ? 'Available!' : 'Already taken'}
                    </p>
                  </div>
                </div>
                {primaryResult.available && (
                  <div className="flex items-center gap-4">
                    <span className="text-2xl font-bold text-gray-900">
                      ${(primaryResult.price / 100).toFixed(2)}<span className="text-sm font-normal text-gray-500">/yr</span>
                    </span>
                    <button
                      onClick={() => addDomainToCart(primaryResult.domain, primaryResult.tld, primaryResult.price)}
                      disabled={isInCart(primaryResult.domain, primaryResult.tld)}
                      className={`px-6 py-3 rounded-[7px] font-medium transition-colors ${
                        isInCart(primaryResult.domain, primaryResult.tld)
                          ? 'bg-green-100 text-green-700 cursor-default'
                          : 'bg-[#064A6C] hover:bg-[#053A55] text-white'
                      }`}
                    >
                      {isInCart(primaryResult.domain, primaryResult.tld) ? 'In Cart' : 'Add to Cart'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Available Alternatives — compact rows */}
          {visibleAvailable.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Available Alternatives
              </h3>
              <div className="border border-gray-200 rounded-[7px] divide-y divide-gray-100 bg-white">
                {visibleAvailable.map((result: any) => {
                  const inCart = isInCart(result.domain, result.tld);
                  return (
                    <div
                      key={result.domain}
                      className="px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                        <span className="text-gray-900 font-medium">{result.domain}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-gray-900 font-semibold text-sm">
                          ${(result.price / 100).toFixed(2)}/yr
                        </span>
                        <button
                          onClick={() => addDomainToCart(result.domain, result.tld, result.price)}
                          disabled={inCart}
                          className={`px-3 py-1.5 rounded-[7px] text-xs font-medium transition-colors ${
                            inCart
                              ? 'bg-green-50 text-green-600 cursor-default'
                              : 'bg-[#064A6C] hover:bg-[#053A55] text-white'
                          }`}
                        >
                          {inCart ? 'In Cart' : 'Add to Cart'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              {hiddenCount > 0 && (
                <button
                  onClick={() => setShowAll(true)}
                  className="mt-3 w-full py-2.5 text-sm font-medium text-[#064A6C] hover:text-[#053A55] bg-gray-50 hover:bg-gray-100 rounded-[7px] transition-colors flex items-center justify-center gap-1.5"
                >
                  <ChevronDown className="w-4 h-4" />
                  Show {hiddenCount} more available domains
                </button>
              )}
            </div>
          )}

          {/* Taken — just a count */}
          {unavailableAlts.length > 0 && (
            <p className="text-xs text-gray-400 mt-4">
              {availableAlts.length === 0
                ? `We checked ${allResults.length} extensions — none are currently available. Try a different name.`
                : `${unavailableAlts.length} other extension${unavailableAlts.length !== 1 ? 's' : ''} checked — not available`
              }
            </p>
          )}
        </div>
      )}

      {searchResults?.results?.length === 0 && (
        <div className="max-w-3xl mx-auto mb-12">
          <div className="bg-white border border-gray-200 rounded-[7px] text-center py-12">
            <p className="text-gray-500">No results found. Try a different search term.</p>
          </div>
        </div>
      )}

      {/* Divider */}
      <hr className="section-divider" />

      {/* TLD Pricing Table */}
      <section className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Domain Pricing</h2>
        <p className="text-gray-500 mb-8">Competitive pricing across 60+ extensions</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
          {[
            { tld: '.com', price: '$12.99/yr' },
            { tld: '.net', price: '$14.99/yr' },
            { tld: '.org', price: '$12.99/yr' },
            { tld: '.io', price: '$39.99/yr' },
            { tld: '.co', price: '$29.99/yr' },
            { tld: '.dev', price: '$16.99/yr' },
            { tld: '.app', price: '$16.99/yr' },
            { tld: '.ai', price: '$49.99/yr' },
            { tld: '.tech', price: '$9.99/yr' },
            { tld: '.cloud', price: '$12.99/yr' },
            { tld: '.shop', price: '$9.99/yr' },
            { tld: '.store', price: '$9.99/yr' },
            { tld: '.online', price: '$9.99/yr' },
            { tld: '.site', price: '$9.99/yr' },
            { tld: '.xyz', price: '$9.99/yr' },
            { tld: '.me', price: '$9.99/yr' },
            { tld: '.design', price: '$29.99/yr' },
            { tld: '.agency', price: '$9.99/yr' },
            { tld: '.studio', price: '$19.99/yr' },
            { tld: '.pro', price: '$9.99/yr' },
          ].map((item) => (
            <div
              key={item.tld}
              className="bg-white border border-gray-200 rounded-[7px] p-3"
            >
              <p className="text-base font-bold text-gray-900">{item.tld}</p>
              <p className="text-xs text-gray-500 mt-0.5">{item.price}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Divider */}
      <hr className="section-divider" />

      {/* Domain Transfer */}
      <section className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Transfer Your Domain</h2>
        <p className="text-gray-500 mb-8 max-w-2xl mx-auto">
          Already own a domain? Transfer it to hostsblue for centralized management, better pricing, and free WHOIS privacy.
        </p>
        <div className="grid sm:grid-cols-3 gap-6 mb-8">
          <div className="bg-white border border-gray-200 rounded-[7px] p-6 flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-[#064A6C]/10 flex items-center justify-center mb-4">
              <Lock className="w-6 h-6 text-[#064A6C]" />
            </div>
            <p className="text-sm font-semibold text-gray-900 mb-1">Step 1</p>
            <p className="text-sm text-gray-500">Unlock your domain</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-[7px] p-6 flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-[#064A6C]/10 flex items-center justify-center mb-4">
              <ArrowRight className="w-6 h-6 text-[#064A6C]" />
            </div>
            <p className="text-sm font-semibold text-gray-900 mb-1">Step 2</p>
            <p className="text-sm text-gray-500">Get authorization code</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-[7px] p-6 flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-[#064A6C]/10 flex items-center justify-center mb-4">
              <ArrowRight className="w-6 h-6 text-[#064A6C]" />
            </div>
            <p className="text-sm font-semibold text-gray-900 mb-1">Step 3</p>
            <p className="text-sm text-gray-500">Start transfer</p>
          </div>
        </div>
        <Link
          to="/register"
          className="bg-[#064A6C] hover:bg-[#053A55] text-white font-medium px-6 py-3 rounded-[7px] transition-all btn-arrow-hover"
        >
          Start Transfer
        </Link>
      </section>

      {/* Divider */}
      <hr className="section-divider" />

      {/* WHOIS Privacy & DNS Features */}
      <section>
        <div className="grid md:grid-cols-2 gap-6">
          {/* Free WHOIS Privacy */}
          <div className="bg-white border border-gray-200 rounded-[7px] p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-[#064A6C]/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-[#064A6C]" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Free WHOIS Privacy</h3>
            </div>
            <p className="text-gray-500 text-sm mb-4">
              Protect your personal information with free WHOIS privacy on all domains.
            </p>
            <ul className="space-y-3">
              {['Hide personal info', 'Reduce spam', 'Prevent identity theft', 'Included free'].map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-sm text-gray-700">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          {/* Advanced DNS Management */}
          <div className="bg-white border border-gray-200 rounded-[7px] p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-[#064A6C]/10 flex items-center justify-center">
                <Globe className="w-5 h-5 text-[#064A6C]" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Advanced DNS Management</h3>
            </div>
            <p className="text-gray-500 text-sm mb-4">
              Full control over your domain's DNS records with our intuitive management tools.
            </p>
            <ul className="space-y-3">
              {['A/AAAA/CNAME/MX records', 'Custom TTL', 'DNS templates', 'Instant propagation'].map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-sm text-gray-700">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
