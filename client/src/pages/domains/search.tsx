import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { domainApi, orderApi } from '@/lib/api';
import { Search, Loader2, Check, X, Globe, ShoppingCart } from 'lucide-react';
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
              className="w-full pl-12 pr-4 py-4 border border-gray-200 rounded-[7px] text-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1844A6] focus:border-transparent"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || !query}
            className="bg-[#1844A6] hover:bg-[#133A8A] text-white font-medium px-6 py-4 rounded-[7px] flex items-center gap-2 whitespace-nowrap transition-colors disabled:opacity-50"
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
                                : 'bg-[#1844A6] hover:bg-[#133A8A] text-white'
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
              <ShoppingCart className="w-5 h-5 text-[#1844A6]" />
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
                  className="w-full bg-[#1844A6] hover:bg-[#133A8A] text-white font-medium py-3 rounded-[7px] transition-colors mt-4"
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
    </div>
  );
}
