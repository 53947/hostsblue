import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { domainApi, orderApi } from '@/lib/api';
import { Search, Loader2, Check, X, Globe, ShoppingCart, Shield, ArrowRight, CheckCircle, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function DomainSearchPage() {
  const [query, setQuery] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<Array<{ domain: string; tld: string; price: number }>>([]);
  const navigate = useNavigate();

  const { data: searchResults, isLoading } = useQuery({
    queryKey: ['domain-search', searchTerm],
    queryFn: () => domainApi.search(searchTerm),
    enabled: searchTerm.length > 0,
  });

  const { data: tlds } = useQuery({
    queryKey: ['tlds'],
    queryFn: domainApi.getTlds,
  });

  const createOrderMutation = useMutation({
    mutationFn: () => {
      const items = cart.map(item => ({
        type: 'domain_registration' as const,
        domain: item.domain.replace(item.tld, ''),
        tld: item.tld,
        termYears: 1,
      }));
      return orderApi.createOrder({ items });
    },
    onSuccess: (data) => {
      navigate(`/checkout?order=${data.order.uuid}`);
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanQuery = query.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setSearchTerm(cleanQuery);
  };

  const addToCart = (domain: string, tld: string, price: number) => {
    if (!cart.find(item => item.domain === domain && item.tld === tld)) {
      setCart([...cart, { domain, tld, price }]);
    }
  };

  const removeFromCart = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.price, 0);

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
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
            className="bg-[#064A6C] hover:bg-[#053C58] text-white font-medium px-6 py-4 rounded-[7px] flex items-center gap-2 whitespace-nowrap transition-colors disabled:opacity-50"
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

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Results */}
        <div className="lg:col-span-2">
          {searchResults?.results && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Results for "{searchResults.query}"
              </h2>
              {searchResults.results.map((result: any) => {
                const isInCart = cart.some(item => item.domain === result.domain && item.tld === result.tld);
                return (
                  <div
                    key={result.domain}
                    className="bg-white border border-gray-200 rounded-[7px] p-4 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        result.available ? 'bg-green-50' : 'bg-red-50'
                      }`}>
                        {result.available ? (
                          <Check className="w-5 h-5 text-green-500" />
                        ) : (
                          <X className="w-5 h-5 text-red-500" />
                        )}
                      </div>
                      <div>
                        <h3 className="text-gray-900 font-medium">{result.domain}</h3>
                        <p className="text-sm text-gray-500">
                          {result.available ? 'Available' : 'Not available'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {result.available && (
                        <>
                          <span className="text-gray-900 font-semibold">
                            ${(result.price / 100).toFixed(2)}/yr
                          </span>
                          <button
                            onClick={() => addToCart(result.domain, result.tld, result.price)}
                            disabled={isInCart}
                            className={`px-4 py-2 rounded-[7px] text-sm font-medium transition-colors ${
                              isInCart
                                ? 'bg-green-50 text-green-600 cursor-default'
                                : 'bg-[#064A6C] hover:bg-[#053C58] text-white'
                            }`}
                          >
                            {isInCart ? 'In Cart' : 'Add to Cart'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {searchResults?.results?.length === 0 && (
            <div className="bg-white border border-gray-200 rounded-[7px] text-center py-12">
              <p className="text-gray-500">No results found. Try a different search term.</p>
            </div>
          )}
        </div>

        {/* Cart */}
        <div className="lg:col-span-1">
          <div className="bg-white border border-gray-200 rounded-[7px] p-6 sticky top-24">
            <div className="flex items-center gap-2 mb-4">
              <ShoppingCart className="w-5 h-5 text-[#064A6C]" />
              <h2 className="text-lg font-semibold text-gray-900">Your Cart</h2>
              <span className="ml-auto text-xs font-medium bg-gray-100 text-gray-600 px-2 py-1 rounded-full">{cart.length} items</span>
            </div>

            {cart.length > 0 ? (
              <>
                <div className="space-y-3 mb-6">
                  {cart.map((item, index) => (
                    <div key={index} className="flex items-center justify-between py-2 border-b border-gray-200">
                      <div>
                        <p className="text-gray-900 text-sm">{item.domain}</p>
                        <p className="text-gray-500 text-xs">1 year registration</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-gray-900 text-sm">
                          ${(item.price / 100).toFixed(2)}
                        </span>
                        <button
                          onClick={() => removeFromCart(index)}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between py-4 border-t border-gray-200">
                  <span className="text-gray-900 font-semibold">Total</span>
                  <span className="text-2xl font-bold text-gray-900">
                    ${(cartTotal / 100).toFixed(2)}
                  </span>
                </div>

                <button
                  onClick={() => createOrderMutation.mutate()}
                  disabled={createOrderMutation.isPending}
                  className="w-full bg-[#064A6C] hover:bg-[#053C58] text-white font-medium py-3 rounded-[7px] transition-colors mt-4"
                >
                  {createOrderMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                      Processing...
                    </>
                  ) : (
                    'Proceed to Checkout'
                  )}
                </button>
              </>
            ) : (
              <p className="text-gray-500 text-center py-8">Your cart is empty</p>
            )}
          </div>
        </div>
      </div>

      {/* Divider */}
      <hr className="section-divider" />

      {/* TLD Pricing Table */}
      <section className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-8">Domain Pricing</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { tld: '.com', price: '$12.99/yr' },
            { tld: '.net', price: '$14.99/yr' },
            { tld: '.org', price: '$12.99/yr' },
            { tld: '.io', price: '$39.99/yr' },
            { tld: '.co', price: '$29.99/yr' },
            { tld: '.dev', price: '$16.99/yr' },
            { tld: '.app', price: '$16.99/yr' },
            { tld: '.ai', price: '$49.99/yr' },
          ].map((item) => (
            <div
              key={item.tld}
              className="bg-white border border-gray-200 rounded-[7px] p-4"
            >
              <p className="text-lg font-bold text-gray-900">{item.tld}</p>
              <p className="text-sm text-gray-500 mt-1">{item.price}</p>
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
          Already own a domain? Transfer it to HostsBlue for centralized management, better pricing, and free WHOIS privacy.
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
        <a
          href="/register"
          className="inline-flex items-center gap-2 bg-[#064A6C] hover:bg-[#053C58] text-white font-medium px-6 py-3 rounded-[7px] transition-colors"
        >
          Start Transfer
          <ArrowRight className="w-4 h-4" />
        </a>
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
