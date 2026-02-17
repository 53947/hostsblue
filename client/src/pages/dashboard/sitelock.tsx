import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sitelockApi } from '@/lib/api';
import { Shield, Loader2, ScanSearch } from 'lucide-react';
import { Link } from 'react-router-dom';

export function SitelockPage() {
  const queryClient = useQueryClient();

  const { data: accounts, isLoading } = useQuery({
    queryKey: ['sitelock', 'accounts'],
    queryFn: sitelockApi.getAccounts,
  });

  const scanMutation = useMutation({
    mutationFn: (id: number) => sitelockApi.triggerScan(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sitelock', 'accounts'] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-[#1844A6] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">SiteLock</h1>
          <p className="text-gray-500">Website security scanning and malware protection</p>
        </div>
      </div>

      {/* Accounts List */}
      {accounts && accounts.length > 0 ? (
        <div className="grid gap-4">
          {accounts.map((account: any) => (
            <div key={account.id} className="bg-white border border-gray-200 rounded-[7px] p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                    <Shield className="w-5 h-5 text-[#1844A6]" />
                  </div>
                  <div>
                    <h3 className="text-gray-900 font-medium">{account.domain}</h3>
                    <div className="flex items-center gap-3 text-sm text-gray-500">
                      <span className={`badge badge-${
                        account.status === 'active' ? 'success' :
                        account.status === 'suspended' ? 'error' : 'neutral'
                      } text-xs`}>
                        {account.status}
                      </span>
                      {account.plan && <span>{account.plan}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {/* Last Scan Results */}
                  {account.lastScan && (
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-gray-500">Last scan</p>
                      <p className="text-sm text-gray-900">
                        {new Date(account.lastScan.date).toLocaleDateString()}
                      </p>
                      <p className={`text-xs ${
                        account.lastScan.threatsFound === 0 ? 'text-green-600' : 'text-red-500'
                      }`}>
                        {account.lastScan.threatsFound === 0
                          ? 'No threats found'
                          : `${account.lastScan.threatsFound} threat(s) detected`}
                      </p>
                    </div>
                  )}
                  <button
                    onClick={() => scanMutation.mutate(account.id)}
                    disabled={scanMutation.isPending}
                    className="btn-outline text-sm flex items-center gap-2"
                  >
                    <ScanSearch className={`w-4 h-4 ${scanMutation.isPending ? 'animate-spin' : ''}`} />
                    Run Scan
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-[7px] text-center py-16 px-6">
          <Shield className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No SiteLock accounts yet</h3>
          <p className="text-gray-500 mb-6">Protect your websites with automated security scanning</p>
          <Link to="/security" className="btn-primary">
            Get SiteLock Protection
          </Link>
        </div>
      )}
    </div>
  );
}
