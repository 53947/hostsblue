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
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
          Find Your Perfect Domain
        </h1>
        <p className="text-zinc-400">Search for available domain names</p>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="max-w-2xl mx-auto mb-12">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter domain name (e.g., mybusiness)"
              className="input pl-12 text-lg"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || !query}
            className="btn-primary flex items-center gap-2 whitespace-nowrap"
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
              <h2 className="text-lg font-semibold text-white mb-4">
                Results for "{searchResults.query}"
              </h2>
              {searchResults.results.map((result: any) => {
                const isInCart = cart.some(item => item.domain === result.domain && item.tld === result.tld);
                return (
                  <div
                    key={result.domain}
                    className="card flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        result.available ? 'bg-green-500/10' : 'bg-red-500/10'
                      }`}>
                        {result.available ? (
                          <Check className="w-5 h-5 text-green-400" />
                        ) : (
                          <X className="w-5 h-5 text-red-400" />
                        )}
                      </div>
                      <div>
                        <h3 className="text-white font-medium">{result.domain}</h3>
                        <p className="text-sm text-zinc-400">
                          {result.available ? 'Available' : 'Not available'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {result.available && (
                        <>
                          <span className="text-white font-semibold">
                            ${(result.price / 100).toFixed(2)}/yr
                          </span>
                          <button
                            onClick={() => addToCart(result.domain, result.tld, result.price)}
                            disabled={isInCart}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                              isInCart
                                ? 'bg-green-500/20 text-green-400 cursor-default'
                                : 'bg-purple-500 hover:bg-purple-600 text-white'
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
            <div className="card text-center py-12">
              <p className="text-zinc-400">No results found. Try a different search term.</p>
            </div>
          )}
        </div>

        {/* Cart */}
        <div className="lg:col-span-1">
          <div className="card sticky top-24">
            <div className="flex items-center gap-2 mb-4">
              <ShoppingCart className="w-5 h-5 text-purple-400" />
              <h2 className="text-lg font-semibold text-white">Your Cart</h2>
              <span className="ml-auto badge badge-neutral">{cart.length} items</span>
            </div>

            {cart.length > 0 ? (
              <>
                <div className="space-y-3 mb-6">
                  {cart.map((item, index) => (
                    <div key={index} className="flex items-center justify-between py-2 border-b border-zinc-800">
                      <div>
                        <p className="text-white text-sm">{item.domain}</p>
                        <p className="text-zinc-500 text-xs">1 year registration</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-white text-sm">
                          ${(item.price / 100).toFixed(2)}
                        </span>
                        <button
                          onClick={() => removeFromCart(index)}
                          className="text-zinc-500 hover:text-red-400 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between py-4 border-t border-zinc-800">
                  <span className="text-white font-semibold">Total</span>
                  <span className="text-2xl font-bold text-white">
                    ${(cartTotal / 100).toFixed(2)}
                  </span>
                </div>

                <button
                  onClick={() => createOrderMutation.mutate()}
                  disabled={createOrderMutation.isPending}
                  className="btn-primary w-full mt-4"
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
              <p className="text-zinc-500 text-center py-8">Your cart is empty</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
