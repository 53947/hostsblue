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
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">My Hosting</h1>
          <p className="text-zinc-400">Manage your WordPress hosting accounts</p>
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
            <div key={account.id} className="card card-hover flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                  <Server className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-white font-medium">{account.siteName}</h3>
                  <div className="flex items-center gap-3 text-sm text-zinc-400">
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
                    <span className="text-purple-400">{account.plan?.name}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {account.primaryDomain && (
                  <a
                    href={`https://${account.primaryDomain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-zinc-400 hover:text-white transition-colors"
                    title="Visit site"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
                <Link
                  to={`/dashboard/hosting/${account.uuid}`}
                  className="p-2 text-zinc-400 hover:text-white transition-colors"
                  title="Manage"
                >
                  <Settings className="w-4 h-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card text-center py-16">
          <Server className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No hosting accounts yet</h3>
          <p className="text-zinc-400 mb-6">Set up your first WordPress site</p>
          <Link to="/hosting" className="btn-primary">
            View Hosting Plans
          </Link>
        </div>
      )}
    </div>
  );
}
