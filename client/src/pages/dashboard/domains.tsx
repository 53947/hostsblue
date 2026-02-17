import { useQuery } from '@tanstack/react-query';
import { domainApi } from '@/lib/api';
import { Globe, Plus, Loader2, ExternalLink, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';

export function DomainsPage() {
  const { data: domains, isLoading } = useQuery({
    queryKey: ['domains'],
    queryFn: domainApi.getDomains,
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
          <h1 className="text-2xl font-bold text-gray-900">My Domains</h1>
          <p className="text-gray-500">Manage your domain registrations</p>
        </div>
        <Link to="/domains/search" className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Register Domain
        </Link>
      </div>

      {/* Domains List */}
      {domains && domains.length > 0 ? (
        <div className="grid gap-4">
          {domains.map((domain: any) => (
            <div key={domain.id} className="bg-white border border-gray-200 rounded-[7px] p-6 hover:shadow-md transition-shadow flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                  <Globe className="w-5 h-5 text-[#1844A6]" />
                </div>
                <div>
                  <h3 className="text-gray-900 font-medium">{domain.domainName}</h3>
                  <div className="flex items-center gap-3 text-sm text-gray-500">
                    <span className={`badge badge-${
                      domain.status === 'active' ? 'success' :
                      domain.status === 'pending' ? 'warning' :
                      domain.status === 'expired' ? 'error' : 'neutral'
                    } text-xs`}>
                      {domain.status}
                    </span>
                    {domain.expiryDate && (
                      <span>
                        Expires {new Date(domain.expiryDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`https://${domain.domainName}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-gray-400 hover:text-gray-900 transition-colors"
                  title="Visit site"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
                <Link
                  to={`/dashboard/domains/${domain.uuid}`}
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
          <Globe className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No domains yet</h3>
          <p className="text-gray-500 mb-6">Search and register your first domain</p>
          <Link to="/domains/search" className="btn-primary">
            Search Domains
          </Link>
        </div>
      )}
    </div>
  );
}
