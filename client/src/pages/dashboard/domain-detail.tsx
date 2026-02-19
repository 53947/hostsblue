import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { domainApi } from '@/lib/api';
import { Globe, ArrowLeft, Loader2, Settings, Lock, RefreshCw } from 'lucide-react';

export function DomainDetailPage() {
  const { uuid } = useParams<{ uuid: string }>();

  const { data: domain, isLoading } = useQuery({
    queryKey: ['domain', uuid],
    queryFn: () => domainApi.getDomain(uuid!),
    enabled: !!uuid,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-[#064A6C] animate-spin" />
      </div>
    );
  }

  if (!domain) {
    return (
      <div className="bg-white border border-gray-200 rounded-[7px] text-center py-16 px-6">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Domain not found</h3>
        <Link to="/dashboard/domains" className="text-[#064A6C] hover:text-[#053A55]">
          Back to domains
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link to="/dashboard/domains" className="hover:text-gray-900 flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" />
          Back to Domains
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-teal-50 rounded-lg flex items-center justify-center">
            <Globe className="w-6 h-6 text-[#064A6C]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{domain.domainName}</h1>
            <div className="flex items-center gap-3">
              <span className={`badge badge-${
                domain.status === 'active' ? 'success' :
                domain.status === 'pending' ? 'warning' :
                domain.status === 'expired' ? 'error' : 'neutral'
              }`}>
                {domain.status}
              </span>
              {domain.privacyEnabled && (
                <span className="badge badge-info flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  Privacy Protected
                </span>
              )}
            </div>
          </div>
        </div>
        <button className="btn-outline flex items-center gap-2">
          <Settings className="w-4 h-4" />
          Manage
        </button>
      </div>

      {/* Domain Info */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-[7px] p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Registration Details</h2>
          <div className="space-y-4">
            <div className="flex justify-between py-2 border-b border-gray-200">
              <span className="text-gray-500">Registration Date</span>
              <span className="text-gray-900">
                {domain.registrationDate
                  ? new Date(domain.registrationDate).toLocaleDateString()
                  : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-200">
              <span className="text-gray-500">Expiry Date</span>
              <span className="text-gray-900">
                {domain.expiryDate
                  ? new Date(domain.expiryDate).toLocaleDateString()
                  : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-200">
              <span className="text-gray-500">Registration Period</span>
              <span className="text-gray-900">{domain.registrationPeriodYears} years</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-200">
              <span className="text-gray-500">Auto-Renew</span>
              <span className={domain.autoRenew ? 'text-green-600' : 'text-gray-500'}>
                {domain.autoRenew ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-500">Transfer Lock</span>
              <span className={domain.transferLock ? 'text-green-600' : 'text-gray-500'}>
                {domain.transferLock ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-[7px] p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Nameservers</h2>
          {domain.useHostsBlueNameservers ? (
            <>
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg mb-4">
                <p className="text-green-700 text-sm">
                  Using hostsblue Nameservers
                </p>
              </div>
              <ul className="space-y-2">
                {domain.nameservers?.map((ns: string, i: number) => (
                  <li key={i} className="font-mono text-gray-600 text-sm bg-gray-50 px-3 py-2 rounded-[7px]">
                    {ns}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-gray-500">Using custom nameservers</p>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white border border-gray-200 rounded-[7px] p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => alert('Initiating domain renewal...')}
            className="btn-outline text-sm flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Renew Domain
          </button>
          <button
            onClick={() => alert('Updating WHOIS privacy settings...')}
            className="btn-outline text-sm flex items-center gap-2"
          >
            <Lock className="w-4 h-4" />
            Toggle Privacy
          </button>
          <a
            href={`https://${domain.domainName}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-outline text-sm"
          >
            Visit Website
          </a>
        </div>
      </div>
    </div>
  );
}
