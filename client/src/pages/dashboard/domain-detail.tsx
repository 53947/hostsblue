import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { domainApi } from '@/lib/api';
import {
  Globe,
  ArrowLeft,
  Loader2,
  Lock,
  RefreshCw,
  Shield,
  Trash2,
  Edit2,
  X,
  Check,
  ShoppingCart,
} from 'lucide-react';

const DNS_TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV'] as const;

const DNS_TYPE_HELP: Record<string, string> = {
  A: 'Points domain to an IPv4 address',
  AAAA: 'Points domain to an IPv6 address',
  CNAME: 'Alias to another domain name',
  MX: 'Mail server for receiving email',
  TXT: 'Text record (SPF, DKIM, verification)',
  NS: 'Delegates a subdomain to other nameservers',
  SRV: 'Service location record',
};

const DNS_CONTENT_PLACEHOLDER: Record<string, string> = {
  A: '192.168.1.1',
  AAAA: '2001:db8::1',
  CNAME: 'example.com',
  MX: 'mail.example.com',
  TXT: 'v=spf1 include:...',
  NS: 'ns1.example.com',
  SRV: '0 5 5060 sipserver.example.com',
};

interface DnsRecord {
  id: number;
  type: string;
  name: string;
  content: string;
  ttl: number;
  priority: number | null;
  syncedToOpensrs?: boolean;
  syncError?: string;
  lastSyncAt?: string;
}

export function DomainDetailPage() {
  const { uuid } = useParams<{ uuid: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [editingRecord, setEditingRecord] = useState<number | null>(null);
  const [deletingRecord, setDeletingRecord] = useState<number | null>(null);
  const [dnsForm, setDnsForm] = useState({ type: 'A', name: '', content: '', ttl: 3600, priority: 0 });
  const [editForm, setEditForm] = useState({ content: '', ttl: 3600, priority: 0 });

  const { data: domain, isLoading } = useQuery({
    queryKey: ['domain', uuid],
    queryFn: () => domainApi.getDomain(uuid!),
    enabled: !!uuid,
  });

  const { data: dnsRecords, isLoading: dnsLoading } = useQuery({
    queryKey: ['domain', uuid, 'dns'],
    queryFn: () => domainApi.getDnsRecords(uuid!),
    enabled: !!uuid,
  });

  // Domain update mutation (privacy, autoRenew, transferLock)
  const updateDomain = useMutation({
    mutationFn: (data: { privacyEnabled?: boolean; autoRenew?: boolean; transferLock?: boolean }) =>
      domainApi.updateDomain(uuid!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['domain', uuid] });
    },
  });

  // DNS mutations
  const createDns = useMutation({
    mutationFn: (data: { type: string; name: string; content: string; ttl?: number; priority?: number }) =>
      domainApi.createDnsRecord(uuid!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['domain', uuid, 'dns'] });
      setDnsForm({ type: 'A', name: '', content: '', ttl: 3600, priority: 0 });
    },
  });

  const updateDns = useMutation({
    mutationFn: ({ recordId, data }: { recordId: string; data: { content?: string; ttl?: number; priority?: number } }) =>
      domainApi.updateDnsRecord(uuid!, recordId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['domain', uuid, 'dns'] });
      setEditingRecord(null);
    },
  });

  const deleteDns = useMutation({
    mutationFn: (recordId: string) => domainApi.deleteDnsRecord(uuid!, recordId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['domain', uuid, 'dns'] });
      setDeletingRecord(null);
    },
  });

  const syncDns = useMutation({
    mutationFn: () => domainApi.syncDns(uuid!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['domain', uuid, 'dns'] });
    },
  });

  const handleAddDns = (e: React.FormEvent) => {
    e.preventDefault();
    createDns.mutate({
      type: dnsForm.type,
      name: dnsForm.name || '@',
      content: dnsForm.content,
      ttl: dnsForm.ttl,
      ...(dnsForm.type === 'MX' || dnsForm.type === 'SRV' ? { priority: dnsForm.priority } : {}),
    });
  };

  const handleEditDns = (record: DnsRecord) => {
    updateDns.mutate({
      recordId: String(record.id),
      data: {
        content: editForm.content,
        ttl: editForm.ttl,
        ...(record.type === 'MX' || record.type === 'SRV' ? { priority: editForm.priority } : {}),
      },
    });
  };

  const startEdit = (record: DnsRecord) => {
    setEditingRecord(record.id);
    setDeletingRecord(null);
    setEditForm({ content: record.content, ttl: record.ttl, priority: record.priority || 0 });
  };

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
        <a
          href={`https://${domain.domainName}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-outline text-sm"
        >
          Visit Website
        </a>
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
            <div className="flex items-center justify-between py-2 border-b border-gray-200">
              <span className="text-gray-500">Auto-Renew</span>
              <button
                onClick={() => updateDomain.mutate({ autoRenew: !domain.autoRenew })}
                disabled={updateDomain.isPending}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  domain.autoRenew ? 'bg-[#064A6C]' : 'bg-gray-300'
                }`}
              >
                <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                  domain.autoRenew ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-200">
              <span className="text-gray-500">Transfer Lock</span>
              <button
                onClick={() => updateDomain.mutate({ transferLock: !domain.transferLock })}
                disabled={updateDomain.isPending}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  domain.transferLock ? 'bg-[#064A6C]' : 'bg-gray-300'
                }`}
              >
                <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                  domain.transferLock ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-gray-500">WHOIS Privacy</span>
              <button
                onClick={() => updateDomain.mutate({ privacyEnabled: !domain.privacyEnabled })}
                disabled={updateDomain.isPending}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  domain.privacyEnabled ? 'bg-[#064A6C]' : 'bg-gray-300'
                }`}
              >
                <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                  domain.privacyEnabled ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
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
            <>
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg mb-4">
                <p className="text-gray-600 text-sm">Using custom nameservers</p>
              </div>
              {domain.nameservers?.length > 0 && (
                <ul className="space-y-2">
                  {domain.nameservers.map((ns: string, i: number) => (
                    <li key={i} className="font-mono text-gray-600 text-sm bg-gray-50 px-3 py-2 rounded-[7px]">
                      {ns}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white border border-gray-200 rounded-[7px] p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => navigate(`/domains/search?renew=${domain.domainName}`)}
            className="btn-outline text-sm flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Renew Domain
          </button>
          <button
            onClick={() => updateDomain.mutate({ privacyEnabled: !domain.privacyEnabled })}
            disabled={updateDomain.isPending}
            className="btn-outline text-sm flex items-center gap-2"
          >
            <Shield className={`w-4 h-4 ${updateDomain.isPending ? 'animate-spin' : ''}`} />
            {domain.privacyEnabled ? 'Disable Privacy' : 'Enable Privacy'}
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
        {updateDomain.isSuccess && (
          <p className="text-green-600 text-sm mt-3">Settings updated successfully.</p>
        )}
        {updateDomain.isError && (
          <p className="text-red-500 text-sm mt-3">Failed to update. Please try again.</p>
        )}
      </div>

      {/* DNS Records */}
      <div className="bg-white border border-gray-200 rounded-[7px] p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">DNS Records</h2>
          <button
            onClick={() => syncDns.mutate()}
            disabled={syncDns.isPending}
            className="btn-outline text-sm flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${syncDns.isPending ? 'animate-spin' : ''}`} />
            Sync
          </button>
        </div>

        {/* Always-visible Add DNS form */}
        <form onSubmit={handleAddDns} className="bg-[#f8fafb] border border-gray-200 rounded-[7px] p-4 mb-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Add DNS Record</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
              <select
                value={dnsForm.type}
                onChange={(e) => setDnsForm({ ...dnsForm, type: e.target.value })}
                className="w-full border border-gray-200 rounded-[7px] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#064A6C]"
              >
                {DNS_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <p className="text-xs text-gray-400 italic mt-1">{DNS_TYPE_HELP[dnsForm.type]}</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
              <input
                type="text"
                value={dnsForm.name}
                onChange={(e) => setDnsForm({ ...dnsForm, name: e.target.value })}
                placeholder="@ or subdomain"
                className="w-full border border-gray-200 rounded-[7px] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#064A6C]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Content</label>
              <input
                type="text"
                value={dnsForm.content}
                onChange={(e) => setDnsForm({ ...dnsForm, content: e.target.value })}
                placeholder={DNS_CONTENT_PLACEHOLDER[dnsForm.type] || 'Value'}
                required
                className="w-full border border-gray-200 rounded-[7px] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#064A6C]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">TTL</label>
              <input
                type="number"
                value={dnsForm.ttl}
                onChange={(e) => setDnsForm({ ...dnsForm, ttl: parseInt(e.target.value) || 3600 })}
                className="w-full border border-gray-200 rounded-[7px] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#064A6C]"
              />
            </div>
            {(dnsForm.type === 'MX' || dnsForm.type === 'SRV') && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Priority</label>
                <input
                  type="number"
                  value={dnsForm.priority}
                  onChange={(e) => setDnsForm({ ...dnsForm, priority: parseInt(e.target.value) || 0 })}
                  className="w-full border border-gray-200 rounded-[7px] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#064A6C]"
                />
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 mt-3">
            <button
              type="submit"
              disabled={createDns.isPending}
              className="bg-[#064A6C] hover:bg-[#053A55] text-white text-sm font-medium px-4 py-2 rounded-[7px] flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              {createDns.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Add Record
            </button>
          </div>
          {createDns.isError && (
            <p className="text-red-500 text-sm mt-2">Failed to create record. Check your inputs.</p>
          )}
        </form>

        {/* DNS Records Table */}
        {dnsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-[#064A6C] animate-spin" />
          </div>
        ) : dnsRecords && dnsRecords.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500 border-b border-gray-200">
                  <th className="pb-3 font-medium">Type</th>
                  <th className="pb-3 font-medium">Name</th>
                  <th className="pb-3 font-medium">Content</th>
                  <th className="pb-3 font-medium">TTL</th>
                  <th className="pb-3 font-medium">Priority</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {dnsRecords.map((record: DnsRecord) => (
                  <tr key={record.id} className="border-b border-gray-100">
                    {editingRecord === record.id ? (
                      <>
                        <td className="py-3">
                          <span className="inline-block bg-gray-100 px-2 py-1 rounded text-xs font-mono">
                            {record.type}
                          </span>
                        </td>
                        <td className="py-3 font-mono text-gray-600">{record.name}</td>
                        <td className="py-3">
                          <input
                            type="text"
                            value={editForm.content}
                            onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                            className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#064A6C]"
                          />
                        </td>
                        <td className="py-3">
                          <input
                            type="number"
                            value={editForm.ttl}
                            onChange={(e) => setEditForm({ ...editForm, ttl: parseInt(e.target.value) || 3600 })}
                            className="w-20 border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#064A6C]"
                          />
                        </td>
                        <td className="py-3">
                          {(record.type === 'MX' || record.type === 'SRV') ? (
                            <input
                              type="number"
                              value={editForm.priority}
                              onChange={(e) => setEditForm({ ...editForm, priority: parseInt(e.target.value) || 0 })}
                              className="w-20 border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#064A6C]"
                            />
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="py-3">
                          <SyncStatusDot record={record} />
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleEditDns(record)}
                              disabled={updateDns.isPending}
                              className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setEditingRecord(null)}
                              className="p-1.5 text-gray-400 hover:bg-gray-100 rounded transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-3">
                          <span className="inline-block bg-gray-100 px-2 py-1 rounded text-xs font-mono">
                            {record.type}
                          </span>
                        </td>
                        <td className="py-3 font-mono text-gray-600">{record.name}</td>
                        <td className="py-3 font-mono text-gray-900 max-w-xs truncate">{record.content}</td>
                        <td className="py-3 text-gray-500">{record.ttl}</td>
                        <td className="py-3 text-gray-500">{record.priority ?? '—'}</td>
                        <td className="py-3">
                          <SyncStatusDot record={record} />
                        </td>
                        <td className="py-3 text-right">
                          {deletingRecord === record.id ? (
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => {
                                  deleteDns.mutate(String(record.id));
                                }}
                                disabled={deleteDns.isPending}
                                className="text-xs text-white bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded-[7px] transition-colors disabled:opacity-50"
                              >
                                {deleteDns.isPending ? 'Deleting...' : 'Delete'}
                              </button>
                              <button
                                onClick={() => setDeletingRecord(null)}
                                className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-[7px] border border-gray-200 hover:border-gray-300 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => startEdit(record)}
                                className="p-1.5 text-gray-400 hover:text-[#064A6C] hover:bg-gray-100 rounded transition-colors"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setDeletingRecord(record.id);
                                  setEditingRecord(null);
                                }}
                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <Globe className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No DNS records yet. Use the form above to add your first record.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function SyncStatusDot({ record }: { record: DnsRecord }) {
  if (record.syncError) {
    return (
      <span className="inline-flex items-center text-xs text-red-600" title={record.syncError}>
        <span className="w-2 h-2 rounded-full bg-red-500 inline-block mr-1.5" />
        Error
      </span>
    );
  }
  if (record.syncedToOpensrs) {
    return (
      <span className="inline-flex items-center text-xs text-green-600">
        <span className="w-2 h-2 rounded-full bg-green-500 inline-block mr-1.5" />
        Synced
      </span>
    );
  }
  return (
    <span className="inline-flex items-center text-xs text-yellow-600">
      <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block mr-1.5" />
      Pending
    </span>
  );
}
