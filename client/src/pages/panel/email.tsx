import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, MoreHorizontal, Ban, CheckCircle, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { panelApi } from '@/lib/api';

const statusColors: Record<string, string> = {
  active: 'bg-[#10B981] text-white',
  suspended: 'bg-[#FFD700] text-[#09080E]',
};

const statusLabel: Record<string, string> = {
  active: 'Active',
  suspended: 'Suspended',
};

export function PanelEmailPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [openActions, setOpenActions] = useState<number | null>(null);
  const limit = 15;

  const { data, isLoading } = useQuery({
    queryKey: ['panel', 'email', { search: searchQuery, page, limit }],
    queryFn: () =>
      panelApi.getEmail({
        search: searchQuery || undefined,
        page,
        limit,
      }),
  });

  const suspendMutation = useMutation({
    mutationFn: (id: number) => panelApi.suspendEmail(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['panel', 'email'] });
      setOpenActions(null);
    },
  });

  const activateMutation = useMutation({
    mutationFn: (id: number) => panelApi.activateEmail(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['panel', 'email'] });
      setOpenActions(null);
    },
  });

  const accounts = data?.accounts || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#09080E]">Email Accounts</h1>
        <p className="text-[#4B5563]">Manage all customer email accounts</p>
      </div>

      {/* Search */}
      <div className="bg-white border border-[#E5E7EB] rounded-[7px] p-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search email addresses, domains, or customers..."
            className="w-full pl-10 pr-4 py-2.5 border border-[#E5E7EB] rounded-[7px] text-[#09080E] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#064A6C] focus:border-transparent text-sm"
          />
        </div>
      </div>

      {/* Loading */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 text-[#064A6C] animate-spin" />
        </div>
      ) : (
        <>
          {/* Email Table */}
          <div className="bg-white border border-[#E5E7EB] rounded-[7px] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-[#4B5563] border-b border-[#E5E7EB] bg-[#F9FAFB]">
                    <th className="px-6 py-3 font-medium">Email Address</th>
                    <th className="px-6 py-3 font-medium">Domain</th>
                    <th className="px-6 py-3 font-medium">Customer</th>
                    <th className="px-6 py-3 font-medium">Plan</th>
                    <th className="px-6 py-3 font-medium min-w-[180px]">Storage</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-[#4B5563]">
                        No email accounts found
                      </td>
                    </tr>
                  ) : (
                    accounts.map((email: any) => {
                      const usedMB = email.storageUsedMB || 0;
                      const limitMB = email.storageLimitMB || 1;
                      const pct = Math.round((usedMB / limitMB) * 100);
                      const barColor = pct > 80 ? 'bg-[#DC2626]' : pct > 60 ? 'bg-[#FFD700]' : 'bg-[#10B981]';
                      const usedLabel = usedMB >= 1024 ? `${(usedMB / 1024).toFixed(1)} GB` : `${usedMB} MB`;
                      const limitLabel = limitMB >= 1024 ? `${(limitMB / 1024).toFixed(1)} GB` : `${limitMB} MB`;

                      return (
                        <tr key={email.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-3 text-sm font-medium text-[#064A6C]">{email.emailAddress}</td>
                          <td className="px-6 py-3 text-sm text-[#4B5563]">{email.domain}</td>
                          <td className="px-6 py-3">
                            <div className="text-sm text-[#09080E]">{email.customerName}</div>
                            <div className="text-xs text-[#4B5563]">{email.customerEmail}</div>
                          </td>
                          <td className="px-6 py-3">
                            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-[#1844A6]">
                              {email.plan}
                            </span>
                          </td>
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                              </div>
                              <span className="text-xs text-[#4B5563] whitespace-nowrap">
                                {usedLabel} / {limitLabel}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-3">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[email.status] || 'bg-gray-200 text-[#4B5563]'}`}>
                              {statusLabel[email.status] || email.status}
                            </span>
                          </td>
                          <td className="px-6 py-3 relative">
                            <button
                              onClick={() => setOpenActions(openActions === email.id ? null : email.id)}
                              className="p-1 hover:bg-gray-100 rounded"
                            >
                              <MoreHorizontal className="w-4 h-4 text-[#4B5563]" />
                            </button>
                            {openActions === email.id && (
                              <div className="absolute right-6 top-10 bg-white border border-[#E5E7EB] rounded-[7px] shadow-lg py-1 z-10 w-44">
                                {email.status === 'active' ? (
                                  <button
                                    onClick={() => suspendMutation.mutate(email.id)}
                                    disabled={suspendMutation.isPending}
                                    className="w-full text-left px-4 py-2 text-sm text-[#4B5563] hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"
                                  >
                                    {suspendMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
                                    Suspend
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => activateMutation.mutate(email.id)}
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
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between bg-white border border-[#E5E7EB] rounded-[7px] px-6 py-3">
              <p className="text-sm text-[#4B5563]">
                Showing {(page - 1) * limit + 1}--{Math.min(page * limit, total)} of {total} accounts
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
