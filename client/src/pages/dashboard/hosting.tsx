import { useQuery } from '@tanstack/react-query';
import { hostingApi } from '@/lib/api';
import { Server, Plus, Loader2, ExternalLink, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';

export function HostingPage() {
  const { data: accounts, isLoading } = useQuery({
    queryKey: ['hosting', 'accounts'],
    queryFn: hostingApi.getAccounts,
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
          <h1 className="text-2xl font-bold text-gray-900">My Hosting</h1>
          <p className="text-gray-500">Manage your WordPress hosting accounts</p>
        </div>
        <Link to="/hosting" className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          New Site
        </Link>
      </div>

      {/* Accounts List */}
      {accounts && accounts.length > 0 ? (
        <div className="grid gap-4">
          {accounts.map((account: any) => (
            <div key={account.id} className="bg-white border border-gray-200 rounded-[7px] p-6 hover:shadow-md transition-shadow flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                  <Server className="w-5 h-5 text-[#1844A6]" />
                </div>
                <div>
                  <h3 className="text-gray-900 font-medium">{account.siteName}</h3>
                  <div className="flex items-center gap-3 text-sm text-gray-500">
                    <span className={`badge badge-${
                      account.status === 'active' ? 'success' :
                      account.status === 'provisioning' ? 'warning' :
                      account.status === 'suspended' ? 'error' : 'neutral'
                    } text-xs`}>
                      {account.status}
                    </span>
                    {account.primaryDomain && (
                      <span>{account.primaryDomain}</span>
                    )}
                    <span className="text-[#1844A6]">{account.plan?.name}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {account.primaryDomain && (
                  <a
                    href={`https://${account.primaryDomain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-gray-400 hover:text-gray-900 transition-colors"
                    title="Visit site"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
                <Link
                  to={`/dashboard/hosting/${account.uuid}`}
                  className="p-2 text-gray-400 hover:text-gray-900 transition-colors"
                  title="Manage"
                >
                  <Settings className="w-4 h-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-[7px] text-center py-16 px-6">
          <Server className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No hosting accounts yet</h3>
          <p className="text-gray-500 mb-6">Set up your first WordPress site</p>
          <Link to="/hosting" className="btn-primary">
            View Hosting Plans
          </Link>
        </div>
      )}
    </div>
  );
}
