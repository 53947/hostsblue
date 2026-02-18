import { useState } from 'react';
import { Search, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const tlds = [
  { ext: '.com', price: '$12.99' },
  { ext: '.net', price: '$14.99' },
  { ext: '.org', price: '$13.99' },
  { ext: '.io', price: '$39.99' },
  { ext: '.co', price: '$29.99' },
];

type Tab = 'register' | 'transfer' | 'renew';

interface DomainSearchProps {
  variant?: 'hero' | 'page' | 'mega-menu';
}

export function DomainSearch({ variant = 'hero' }: DomainSearchProps) {
  const [activeTab, setActiveTab] = useState<Tab>('register');
  const [query, setQuery] = useState('');

  const isHero = variant === 'hero';
  const isMega = variant === 'mega-menu';

  const containerClass = isHero
    ? 'max-w-[640px] mx-auto bg-white rounded-[12px] border border-[#E5E7EB] p-1.5'
    : isMega
    ? 'bg-white rounded-[7px] p-1'
    : 'max-w-2xl mx-auto bg-white rounded-[12px] border border-[#E5E7EB] p-1.5';

  const containerShadow = isMega ? '' : 'shadow-[0_4px_20px_rgba(0,0,0,0.08)]';

  const tabs: { key: Tab; label: string }[] = [
    { key: 'register', label: 'Register New' },
    { key: 'transfer', label: 'Transfer Existing' },
    { key: 'renew', label: 'Renew Existing' },
  ];

  return (
    <div className={`${containerClass} ${containerShadow}`}>
      {/* Tabs */}
      <div className="flex border-b border-[#E5E7EB] mb-3 relative">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 pb-2.5 pt-2 text-sm font-medium transition-colors relative ${
              activeTab === tab.key ? 'text-[#064A6C]' : 'text-[#4B5563] hover:text-[#09080E]'
            }`}
          >
            {tab.label}
            {activeTab === tab.key && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#064A6C] transition-all duration-200" />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="px-1 pb-1">
        {activeTab === 'register' && (
          <div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (query.trim()) window.location.href = `/domains/search?q=${encodeURIComponent(query.trim())}`;
              }}
              className="flex gap-2"
            >
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Find your dream domain"
                  className={`w-full pl-10 pr-4 bg-transparent text-[#09080E] placeholder-gray-400 focus:outline-none ${isHero ? 'py-3 text-base' : 'py-2.5 text-sm'}`}
                />
              </div>
              <button type="submit" className="bg-[#064A6C] hover:bg-[#053A55] text-white font-medium px-5 rounded-[7px] text-sm transition-all btn-arrow-hover whitespace-nowrap">
                Search
              </button>
            </form>
            {!isMega && (
              <div className="flex flex-wrap items-center justify-center gap-3 mt-3 pb-1">
                {tlds.map(({ ext, price }) => (
                  <span key={ext} className="text-xs text-[#4B5563]">
                    <span className="font-medium text-[#09080E]">{ext}</span> {price}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'transfer' && (
          <div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (query.trim()) window.location.href = `/domains/transfer?domain=${encodeURIComponent(query.trim())}`;
              }}
              className="flex gap-2"
            >
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Enter your domain name"
                  className={`w-full px-4 bg-transparent text-[#09080E] placeholder-gray-400 focus:outline-none ${isHero ? 'py-3 text-base' : 'py-2.5 text-sm'}`}
                />
              </div>
              <button type="submit" className="bg-[#064A6C] hover:bg-[#053A55] text-white font-medium px-5 rounded-[7px] text-sm transition-all btn-arrow-hover whitespace-nowrap">
                Start Transfer
              </button>
            </form>
            <p className="text-xs text-[#4B5563] mt-2 pb-1">Have your authorization code ready</p>
            {!isMega && (
              <div className="mt-3 border-l-2 border-[#064A6C] bg-[#F9FAFB] rounded-r-[7px] p-3">
                <p className="text-xs font-medium text-[#09080E]">Bundle &amp; Save</p>
                <p className="text-xs text-[#4B5563] mt-1">Transfer + Hosting = 20% off first year. Transfer + Email = 3 months free.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'renew' && (
          <div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (query.trim()) window.location.href = '/dashboard/domains';
              }}
              className="flex gap-2"
            >
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Enter your domain to check status"
                  className={`w-full px-4 bg-transparent text-[#09080E] placeholder-gray-400 focus:outline-none ${isHero ? 'py-3 text-base' : 'py-2.5 text-sm'}`}
                />
              </div>
              <button type="submit" className="bg-[#064A6C] hover:bg-[#053A55] text-white font-medium px-5 rounded-[7px] text-sm transition-all btn-arrow-hover whitespace-nowrap">
                Check Status
              </button>
            </form>
            <p className="text-xs text-[#4B5563] mt-2 pb-1">Manage bulk renewals and auto-renew from your dashboard</p>
          </div>
        )}
      </div>
    </div>
  );
}
