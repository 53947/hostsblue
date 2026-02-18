import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { hostingApi } from '@/lib/api';
import { Server, ArrowLeft, Loader2, Settings, ExternalLink, Database } from 'lucide-react';

export function HostingDetailPage() {
  const { uuid } = useParams<{ uuid: string }>();

  const { data: account, isLoading } = useQuery({
    queryKey: ['hosting', uuid],
    queryFn: () => hostingApi.getAccount(uuid!),
    enabled: !!uuid,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-[#064A6C] animate-spin" />
      </div>
    );
  }

  if (!account) {
    return (
      <div className="bg-white border border-gray-200 rounded-[7px] text-center py-16 px-6">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Hosting account not found</h3>
        <Link to="/dashboard/hosting" className="text-[#064A6C] hover:text-[#053A55]">
          Back to hosting
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link to="/dashboard/hosting" className="hover:text-gray-900 flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" />
          Back to Hosting
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-teal-50 rounded-lg flex items-center justify-center">
            <Server className="w-6 h-6 text-[#064A6C]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{account.siteName}</h1>
            <div className="flex items-center gap-3">
              <span className={`badge badge-${
                account.status === 'active' ? 'success' :
                account.status === 'provisioning' ? 'warning' :
                account.status === 'suspended' ? 'error' : 'neutral'
              }`}>
                {account.status}
              </span>
              {account.plan && (
                <span className="badge badge-neutral">{account.plan.name}</span>
              )}
            </div>
          </div>
        </div>
        <button className="btn-outline flex items-center gap-2">
          <Settings className="w-4 h-4" />
          Manage
        </button>
      </div>

      {/* Site Info */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-[7px] p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Site Details</h2>
          <div className="space-y-4">
            <div className="flex justify-between py-2 border-b border-gray-200">
              <span className="text-gray-500">Primary Domain</span>
              <span className="text-gray-900">{account.primaryDomain || 'Not set'}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-200">
              <span className="text-gray-500">Created</span>
              <span className="text-gray-900">
                {account.createdAt
                  ? new Date(account.createdAt).toLocaleDateString()
                  : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-200">
              <span className="text-gray-500">Billing Cycle</span>
              <span className="text-gray-900 capitalize">{account.billingCycle}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-200">
              <span className="text-gray-500">Auto-Renew</span>
              <span className={account.autoRenew ? 'text-green-600' : 'text-gray-500'}>
                {account.autoRenew ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-500">SSL Status</span>
              <span className={account.sslStatus === 'active' ? 'text-green-600' : 'text-gray-500'}>
                {account.sslStatus === 'active' ? 'Active' : 'Pending'}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-[7px] p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Access Details</h2>
          <div className="space-y-4">
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500 mb-1">WordPress Admin</p>
              {account.primaryDomain ? (
                <a
                  href={`https://${account.primaryDomain}/wp-admin`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#064A6C] flex items-center gap-1 hover:text-[#053A55]"
                >
                  Open WP Admin
                  <ExternalLink className="w-3 h-3" />
                </a>
              ) : (
                <p className="text-gray-400">Not available</p>
              )}
            </div>

            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500 mb-1">SFTP Access</p>
              <div className="text-sm text-gray-600">
                <p>Host: {account.sftpHost || 'N/A'}</p>
                <p>Username: {account.sftpUsername || 'N/A'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white border border-gray-200 rounded-[7px] p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          {account.primaryDomain && (
            <a
              href={`https://${account.primaryDomain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-outline text-sm flex items-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Visit Site
            </a>
          )}
          <button
            onClick={() => alert('Backups functionality coming soon')}
            className="btn-outline text-sm flex items-center gap-2"
          >
            <Database className="w-4 h-4" />
            View Backups
          </button>
        </div>
      </div>
    </div>
  );
}
