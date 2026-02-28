import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Filter, MoreHorizontal, Loader2, Ban, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { panelApi } from '@/lib/api';

const statusFilters = [
  { label: 'All', value: '' },
  { label: 'Active', value: 'active' },
  { label: 'Expired', value: 'expired' },
  { label: 'Suspended', value: 'suspended' },
  { label: 'Pending Transfer', value: 'pending_transfer' },
];

const statusColors: Record<string, string> = {
  active: 'bg-[#10B981] text-white',
  expired: 'bg-[#DC2626] text-white',
  pending_transfer: 'bg-[#FFD700] text-[#09080E]',
  suspended: 'bg-gray-200 text-[#4B5563]',
};

const statusLabel: Record<string, string> = {
  active: 'Active',
  expired: 'Expired',
  pending_transfer: 'Pending Transfer',
  suspended: 'Suspended',
};

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '--';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function PanelDomainsPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [page, setPage] = useState(1);
  const [openActions, setOpenActions] = useState<number | null>(null);
  const limit = 15;

  const { data, isLoading } = useQuery({
    queryKey: ['panel', 'domains', { search: searchQuery, status: activeFilter, page, limit }],
    queryFn: () =>
      panelApi.getDomains({
        search: searchQuery || undefined,
        status: activeFilter || undefined,
        page,
        limit,
      }),
  });

  const suspendMutation = useMutation({
    mutationFn: (id: number) => panelApi.suspendDomain(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['panel', 'domains'] });
      setOpenActions(null);
    },
  });

  const activateMutation = useMutation({
    mutationFn: (id: number) => panelApi.activateDomain(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['panel', 'domains'] });
      setOpenActions(null);
    },
  });

  const domains = data?.domains || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;
  const expiringCount = data?.expiringCount || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#09080E]">Domains</h1>
        <p className="text-[#4B5563]">Manage all customer domains</p>
      </div>

      {/* Search & Filters */}
      <div className="bg-white border border-[#E5E7EB] rounded-[7px] p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search domains or customers..."
            className="w-full pl-10 pr-4 py-2.5 border border-[#E5E7EB] rounded-[7px] text-[#09080E] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#064A6C] focus:border-transparent text-sm"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-[#4B5563]" />
          {statusFilters.map((filter) => (
            <button
              key={filter.value}
              onClick={() => {
                setActiveFilter(filter.value);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-[7px] text-sm font-medium transition-colors ${
                activeFilter === filter.value
                  ? 'bg-teal-50 text-[#064A6C]'
                  : 'text-[#4B5563] hover:bg-gray-100'
              }`}
            >
              {filter.label}
            </button>
          ))}
          {expiringCount > 0 && (
            <span className="ml-2 px-2.5 py-1 rounded-[7px] text-xs font-medium bg-red-50 text-[#DC2626]">
              {expiringCount} expiring soon
            </span>
          )}
        </div>
      </div>

      {/* Loading */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 text-[#064A6C] animate-spin" />
        </div>
      ) : (
        <>
          {/* Domains Table */}
          <div className="bg-white border border-[#E5E7EB] rounded-[7px] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-[#4B5563] border-b border-[#E5E7EB] bg-[#F9FAFB]">
                    <th className="px-6 py-3 font-medium">Domain Name</th>
                    <th className="px-6 py-3 font-medium">Customer</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 font-medium">Registered</th>
                    <th className="px-6 py-3 font-medium">Expires</th>
                    <th className="px-6 py-3 font-medium">Auto-Renew</th>
                    <th className="px-6 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {domains.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-[#4B5563]">
                        No domains found
                      </td>
                    </tr>
                  ) : (
                    domains.map((domain: any) => (
                      <tr key={domain.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-3 text-sm font-medium text-[#064A6C]">{domain.domainName}</td>
                        <td className="px-6 py-3">
                          <div className="text-sm text-[#09080E]">{domain.customerName}</div>
                          <div className="text-xs text-[#4B5563]">{domain.customerEmail}</div>
                        </td>
                        <td className="px-6 py-3">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[domain.status] || 'bg-gray-200 text-[#4B5563]'}`}>
                            {statusLabel[domain.status] || domain.status}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-sm text-[#4B5563]">{formatDate(domain.registeredAt)}</td>
                        <td className="px-6 py-3 text-sm text-[#4B5563]">{formatDate(domain.expiresAt)}</td>
                        <td className="px-6 py-3">
                          <div className="relative">
                            <div className={`w-10 h-5 rounded-full transition-colors ${domain.autoRenew ? 'bg-[#064A6C]' : 'bg-gray-200'}`}>
                              <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${domain.autoRenew ? 'translate-x-5' : ''}`} />
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-3 relative">
                          <button
                            onClick={() => setOpenActions(openActions === domain.id ? null : domain.id)}
                            className="p-1 hover:bg-gray-100 rounded"
                          >
                            <MoreHorizontal className="w-4 h-4 text-[#4B5563]" />
                          </button>
                          {openActions === domain.id && (
                            <div className="absolute right-6 top-10 bg-white border border-[#E5E7EB] rounded-[7px] shadow-lg py-1 z-10 w-44">
                              {domain.status === 'active' ? (
                                <button
                                  onClick={() => suspendMutation.mutate(domain.id)}
                                  disabled={suspendMutation.isPending}
                                  className="w-full text-left px-4 py-2 text-sm text-[#4B5563] hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"
                                >
                                  {suspendMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
                                  Suspend
                                </button>
                              ) : (
                                <button
                                  onClick={() => activateMutation.mutate(domain.id)}
                                  disabled={activateMutation.isPending}
                                  className="w-full text-left px-4 py-2 text-sm text-[#4B5563] hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"
                                >
                                  {activateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                                  Activate
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between bg-white border border-[#E5E7EB] rounded-[7px] px-6 py-3">
              <p className="text-sm text-[#4B5563]">
                Showing {(page - 1) * limit + 1}--{Math.min(page * limit, total)} of {total} domains
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-[7px] border border-[#E5E7EB] hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4 text-[#4B5563]" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                  .map((p, idx, arr) => (
                    <span key={p}>
                      {idx > 0 && arr[idx - 1] !== p - 1 && (
                        <span className="px-1 text-[#4B5563]">...</span>
                      )}
                      <button
                        onClick={() => setPage(p)}
                        className={`w-8 h-8 rounded-[7px] text-sm font-medium transition-colors ${
                          p === page
                            ? 'bg-[#064A6C] text-white'
                            : 'text-[#4B5563] hover:bg-gray-100'
                        }`}
                      >
                        {p}
                      </button>
                    </span>
                  ))}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-2 rounded-[7px] border border-[#E5E7EB] hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4 text-[#4B5563]" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
