import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Filter, MoreHorizontal, ArrowUpCircle, Ban, RotateCcw, FileText,
  Server, Cloud, MapPin, Globe, Power, PowerOff, Trash2, Loader2,
  Camera, Key, AlertTriangle, X,
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '';
async function adminFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}/api/v1${endpoint}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers as Record<string, string> || {}) },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch');
  return data.data;
}

// ============================================================================
// SHARED HOSTING TAB (sample data — same as before)
// ============================================================================

const planFilters = ['All Plans', 'Starter', 'Business', 'Enterprise'];
const statusFilters = ['All', 'Active', 'Suspended', 'Cancelled'];

interface HostingAccount {
  id: number;
  domain: string;
  customer: string;
  plan: string;
  storageUsed: number;
  storageTotal: number;
  status: 'Active' | 'Suspended' | 'Cancelled';
}

const accounts: HostingAccount[] = [
  { id: 1, domain: 'mitchelldesign.com', customer: 'Sarah Mitchell', plan: 'Business', storageUsed: 12.4, storageTotal: 50, status: 'Active' },
  { id: 2, domain: 'chentech.io', customer: 'James Chen', plan: 'Enterprise', storageUsed: 68.2, storageTotal: 200, status: 'Active' },
  { id: 3, domain: 'brightpixel.co', customer: 'Emily Rodriguez', plan: 'Business', storageUsed: 23.7, storageTotal: 50, status: 'Active' },
  { id: 4, domain: 'lagosdigital.ng', customer: 'Michael Okonkwo', plan: 'Starter', storageUsed: 3.2, storageTotal: 10, status: 'Active' },
  { id: 5, domain: 'greenleafstudio.com', customer: 'Priya Sharma', plan: 'Business', storageUsed: 41.8, storageTotal: 50, status: 'Active' },
  { id: 6, domain: 'kimstartups.com', customer: 'David Kim', plan: 'Enterprise', storageUsed: 95.1, storageTotal: 200, status: 'Suspended' },
  { id: 7, domain: 'bennettlaw.com', customer: 'Laura Bennett', plan: 'Business', storageUsed: 8.9, storageTotal: 50, status: 'Active' },
  { id: 8, domain: 'mendezgroup.mx', customer: 'Carlos Mendez', plan: 'Enterprise', storageUsed: 142.5, storageTotal: 200, status: 'Active' },
  { id: 9, domain: 'wrightphoto.com', customer: 'Thomas Wright', plan: 'Business', storageUsed: 38.6, storageTotal: 50, status: 'Active' },
  { id: 10, domain: 'tanakamedia.jp', customer: 'Robert Tanaka', plan: 'Business', storageUsed: 27.3, storageTotal: 50, status: 'Active' },
];

const hostingStatusColors: Record<string, string> = {
  Active: 'bg-[#10B981] text-white',
  Suspended: 'bg-[#FFD700] text-[#09080E]',
  Cancelled: 'bg-[#DC2626] text-white',
};

const cloudStatusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  provisioning: 'bg-yellow-100 text-yellow-700',
  stopped: 'bg-red-100 text-red-700',
  terminated: 'bg-gray-100 text-gray-500',
  failed: 'bg-red-100 text-red-700',
};

// ============================================================================
// MAIN PAGE
// ============================================================================

export function PanelHostingPage() {
  const [tab, setTab] = useState<'shared' | 'cloud'>('shared');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#09080E]">Hosting</h1>
        <p className="text-[#4B5563]">Manage all customer hosting accounts and cloud servers</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-[7px] p-1 w-fit">
        <button
          onClick={() => setTab('shared')}
          className={`px-4 py-2 text-sm font-medium rounded-[7px] transition-colors flex items-center gap-2 ${
            tab === 'shared' ? 'bg-white text-[#064A6C] shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Server className="w-4 h-4" /> Shared Hosting
        </button>
        <button
          onClick={() => setTab('cloud')}
          className={`px-4 py-2 text-sm font-medium rounded-[7px] transition-colors flex items-center gap-2 ${
            tab === 'cloud' ? 'bg-white text-[#064A6C] shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Cloud className="w-4 h-4" /> Cloud Servers
        </button>
      </div>

      {tab === 'shared' ? <SharedHostingTab /> : <CloudServersTab />}
    </div>
  );
}

// ============================================================================
// SHARED HOSTING TAB
// ============================================================================

function SharedHostingTab() {
  const [activePlan, setActivePlan] = useState('All Plans');
  const [activeStatus, setActiveStatus] = useState('All');
  const [openActions, setOpenActions] = useState<number | null>(null);

  const filtered = accounts.filter((a) => {
    const matchesPlan = activePlan === 'All Plans' || a.plan === activePlan;
    const matchesStatus = activeStatus === 'All' || a.status === activeStatus;
    return matchesPlan && matchesStatus;
  });

  return (
    <>
      <div className="bg-white border border-[#E5E7EB] rounded-[7px] p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-[#4B5563]" />
          <span className="text-sm text-[#4B5563] mr-1">Plan:</span>
          {planFilters.map((filter) => (
            <button
              key={filter}
              onClick={() => setActivePlan(filter)}
              className={`px-3 py-1.5 rounded-[7px] text-sm font-medium transition-colors ${
                activePlan === filter ? 'bg-teal-50 text-[#064A6C]' : 'text-[#4B5563] hover:bg-gray-100'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-[#4B5563]" />
          <span className="text-sm text-[#4B5563] mr-1">Status:</span>
          {statusFilters.map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveStatus(filter)}
              className={`px-3 py-1.5 rounded-[7px] text-sm font-medium transition-colors ${
                activeStatus === filter ? 'bg-teal-50 text-[#064A6C]' : 'text-[#4B5563] hover:bg-gray-100'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-[#E5E7EB] rounded-[7px] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="text-left text-sm text-[#4B5563] border-b border-[#E5E7EB] bg-[#F9FAFB]">
              <th className="px-6 py-3 font-medium">Domain</th>
              <th className="px-6 py-3 font-medium">Customer</th>
              <th className="px-6 py-3 font-medium">Plan</th>
              <th className="px-6 py-3 font-medium min-w-[200px]">Storage</th>
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((account) => {
              const pct = Math.round((account.storageUsed / account.storageTotal) * 100);
              const barColor = pct > 80 ? 'bg-[#DC2626]' : pct > 60 ? 'bg-[#FFD700]' : 'bg-[#10B981]';
              return (
                <tr key={account.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-3 text-sm font-medium text-[#064A6C]">{account.domain}</td>
                  <td className="px-6 py-3 text-sm text-[#09080E]">{account.customer}</td>
                  <td className="px-6 py-3">
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-[#1844A6]">{account.plan}</span>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-[#4B5563] whitespace-nowrap">{account.storageUsed} / {account.storageTotal} GB</span>
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${hostingStatusColors[account.status]}`}>{account.status}</span>
                  </td>
                  <td className="px-6 py-3 relative">
                    <button onClick={() => setOpenActions(openActions === account.id ? null : account.id)} className="p-1 hover:bg-gray-100 rounded">
                      <MoreHorizontal className="w-4 h-4 text-[#4B5563]" />
                    </button>
                    {openActions === account.id && (
                      <div className="absolute right-6 top-10 bg-white border border-[#E5E7EB] rounded-[7px] shadow-lg py-1 z-10 w-44">
                        <button className="w-full text-left px-4 py-2 text-sm text-[#4B5563] hover:bg-gray-50 flex items-center gap-2"><ArrowUpCircle className="w-4 h-4" /> Upgrade</button>
                        <button className="w-full text-left px-4 py-2 text-sm text-[#4B5563] hover:bg-gray-50 flex items-center gap-2"><Ban className="w-4 h-4" /> Suspend</button>
                        <button className="w-full text-left px-4 py-2 text-sm text-[#4B5563] hover:bg-gray-50 flex items-center gap-2"><RotateCcw className="w-4 h-4" /> Restart</button>
                        <button className="w-full text-left px-4 py-2 text-sm text-[#4B5563] hover:bg-gray-50 flex items-center gap-2"><FileText className="w-4 h-4" /> View Logs</button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ============================================================================
// CLOUD SERVERS TAB (Admin — full infrastructure detail)
// ============================================================================

function CloudServersTab() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<any>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: string; server: any } | null>(null);
  const [terminateName, setTerminateName] = useState('');

  const { data: servers, isLoading } = useQuery({
    queryKey: ['panel', 'cloud-servers'],
    queryFn: () => adminFetch<any[]>('/admin/cloud/servers'),
  });

  const powerMutation = useMutation({
    mutationFn: ({ uuid, action }: { uuid: string; action: string }) =>
      adminFetch(`/admin/cloud/servers/${uuid}/power`, { method: 'POST', body: JSON.stringify({ action }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['panel', 'cloud-servers'] });
      setConfirmAction(null);
    },
  });

  const terminateMutation = useMutation({
    mutationFn: (uuid: string) =>
      adminFetch(`/admin/cloud/servers/${uuid}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['panel', 'cloud-servers'] });
      setConfirmAction(null);
      setSelected(null);
      setTerminateName('');
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-[#064A6C] animate-spin" />
      </div>
    );
  }

  const activeCount = servers?.filter((s: any) => s.status === 'active').length || 0;
  const stoppedCount = servers?.filter((s: any) => s.status === 'stopped').length || 0;
  const provisioningCount = servers?.filter((s: any) => s.status === 'provisioning').length || 0;
  const totalMRR = servers?.filter((s: any) => s.status === 'active').reduce((sum: number, s: any) => sum + (s.monthlyPrice || 0), 0) || 0;

  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { label: 'Total Servers', value: servers?.length || 0 },
          { label: 'Active', value: activeCount },
          { label: 'Stopped', value: stoppedCount },
          { label: 'Provisioning', value: provisioningCount },
          { label: 'Cloud MRR', value: `$${(totalMRR / 100).toFixed(2)}` },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white border border-gray-200 rounded-[7px] p-4">
            <div className="text-xs text-gray-500">{label}</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{value}</div>
          </div>
        ))}
      </div>

      {/* Server list */}
      <div className="bg-white border border-gray-200 rounded-[7px] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Server</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Customer</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Plan</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Specs</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Datacenter</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Monthly</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {servers && servers.length > 0 ? servers.map((s: any) => (
              <tr key={s.uuid} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-gray-400" />
                    <div>
                      <div className="font-medium text-gray-900">{s.name}</div>
                      {s.ipv4 && <div className="text-xs text-gray-500 flex items-center gap-1"><Globe className="w-3 h-3" />{s.ipv4}</div>}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-600">{s.customerEmail || `#${s.customerId}`}</td>
                <td className="px-4 py-3 text-gray-600 capitalize">{s.planSlug?.replace('cloud-', '')}</td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {s.cpu} · {s.ramMB ? `${(s.ramMB / 1024).toFixed(0)}GB` : '—'} · {s.diskGB || '—'}GB
                </td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-1 text-gray-500 text-xs"><MapPin className="w-3 h-3" />{s.datacenter}</span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${cloudStatusColors[s.status] || 'bg-gray-100'}`}>
                    {s.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-medium text-gray-900">${((s.monthlyPrice || 0) / 100).toFixed(2)}</td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    {s.status === 'active' && (
                      <>
                        <button
                          onClick={() => setConfirmAction({ type: 'reboot', server: s })}
                          className="p-1.5 text-gray-400 hover:text-[#064A6C] rounded hover:bg-gray-100"
                          title="Reboot"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setConfirmAction({ type: 'off', server: s })}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-gray-100"
                          title="Stop"
                        >
                          <PowerOff className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                    {s.status === 'stopped' && (
                      <button
                        onClick={() => setConfirmAction({ type: 'on', server: s })}
                        className="p-1.5 text-gray-400 hover:text-green-600 rounded hover:bg-gray-100"
                        title="Start"
                      >
                        <Power className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {s.status !== 'terminated' && (
                      <button
                        onClick={() => setConfirmAction({ type: 'terminate', server: s })}
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-gray-100"
                        title="Terminate"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-gray-500">No cloud servers provisioned yet</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Confirm action dialog */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setConfirmAction(null)}>
          <div className="bg-white rounded-[7px] max-w-sm w-full p-6" onClick={e => e.stopPropagation()}>
            {confirmAction.type === 'terminate' ? (
              <>
                <div className="flex items-center gap-2 text-red-600 mb-3">
                  <AlertTriangle className="w-5 h-5" />
                  <h3 className="text-lg font-semibold">Terminate Server</h3>
                </div>
                <p className="text-sm text-gray-600 mb-3">
                  This will permanently delete <strong>{confirmAction.server.name}</strong> and all data. Type the server name to confirm:
                </p>
                <input
                  type="text"
                  value={terminateName}
                  onChange={e => setTerminateName(e.target.value)}
                  placeholder={confirmAction.server.name}
                  className="w-full border border-gray-200 rounded-[7px] px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
                <div className="flex items-center gap-3 justify-end">
                  <button onClick={() => { setConfirmAction(null); setTerminateName(''); }} className="px-4 py-2 text-sm border border-gray-200 rounded-[7px] hover:bg-gray-50">Cancel</button>
                  <button
                    onClick={() => terminateMutation.mutate(confirmAction.server.uuid)}
                    disabled={terminateName !== confirmAction.server.name || terminateMutation.isPending}
                    className="px-4 py-2 text-sm font-medium rounded-[7px] text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    {terminateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                    Terminate
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {confirmAction.type === 'on' ? 'Start' : confirmAction.type === 'off' ? 'Stop' : 'Reboot'} Server
                </h3>
                <p className="text-sm text-gray-600 mb-5">
                  {confirmAction.type === 'on' && `Start ${confirmAction.server.name}?`}
                  {confirmAction.type === 'off' && `Stop ${confirmAction.server.name}? Running processes will be terminated.`}
                  {confirmAction.type === 'reboot' && `Reboot ${confirmAction.server.name}? There will be a brief interruption.`}
                </p>
                <div className="flex items-center gap-3 justify-end">
                  <button onClick={() => setConfirmAction(null)} className="px-4 py-2 text-sm border border-gray-200 rounded-[7px] hover:bg-gray-50">Cancel</button>
                  <button
                    onClick={() => powerMutation.mutate({ uuid: confirmAction.server.uuid, action: confirmAction.type })}
                    disabled={powerMutation.isPending}
                    className={`px-4 py-2 text-sm font-medium rounded-[7px] text-white flex items-center gap-2 ${
                      confirmAction.type === 'off' ? 'bg-red-600 hover:bg-red-700' : 'bg-[#064A6C] hover:bg-[#053C58]'
                    } disabled:opacity-50`}
                  >
                    {powerMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                    {confirmAction.type === 'on' ? 'Start' : confirmAction.type === 'off' ? 'Stop' : 'Reboot'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
