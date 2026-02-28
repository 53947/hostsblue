import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cloudHostingApi } from '@/lib/api';
import {
  Loader2, Plus, Server, Power, PowerOff, RotateCcw,
  Globe, ChevronRight, ArrowLeft, Terminal, Copy, Check, X,
} from 'lucide-react';

const PLAN_LABELS: Record<string, string> = {
  'cloud-developer': 'Developer',
  'cloud-startup': 'Startup',
  'cloud-scale': 'Scale',
  'cloud-enterprise': 'Enterprise',
};

const statusDot: Record<string, string> = {
  active: 'bg-green-500',
  provisioning: 'bg-yellow-400 animate-pulse',
  stopped: 'bg-red-500',
  terminated: 'bg-gray-400',
  failed: 'bg-red-500',
};

const statusLabel: Record<string, string> = {
  active: 'Running',
  provisioning: 'Provisioning',
  stopped: 'Stopped',
  terminated: 'Terminated',
  failed: 'Failed',
};

export function ServersPage() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ action: string; uuid: string } | null>(null);

  const { data: servers, isLoading } = useQuery({
    queryKey: ['cloud-servers'],
    queryFn: cloudHostingApi.getServers,
  });

  const powerMutation = useMutation({
    mutationFn: ({ uuid, action }: { uuid: string; action: 'on' | 'off' | 'reboot' }) =>
      cloudHostingApi.powerAction(uuid, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cloud-servers'] });
      setConfirmAction(null);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-[#064A6C] animate-spin" />
      </div>
    );
  }

  if (selected) {
    return (
      <ServerDetail
        server={selected}
        onBack={() => { setSelected(null); queryClient.invalidateQueries({ queryKey: ['cloud-servers'] }); }}
        onPower={(action) => setConfirmAction({ action, uuid: selected.uuid })}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cloud Servers</h1>
          <p className="text-gray-500">Your cloud hosting infrastructure</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Deploy Server
        </button>
      </div>

      {servers && servers.length > 0 ? (
        <div className="grid gap-4">
          {servers.map((s: any) => (
            <div
              key={s.uuid}
              onClick={() => setSelected(s)}
              className="bg-white border border-gray-200 rounded-[7px] p-5 hover:border-[#064A6C]/30 transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-[#064A6C]/10 rounded-[7px] flex items-center justify-center">
                    <Server className="w-5 h-5 text-[#064A6C]" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{s.name}</h3>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                      <span className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${statusDot[s.status] || 'bg-gray-400'}`} />
                        {statusLabel[s.status] || s.status}
                      </span>
                      <span className="text-gray-300">|</span>
                      <span>{PLAN_LABELS[s.planSlug] || s.planSlug}</span>
                      {s.ipv4 && (
                        <>
                          <span className="text-gray-300">|</span>
                          <span className="flex items-center gap-1"><Globe className="w-3 h-3" />{s.ipv4}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium text-gray-700">${(s.monthlyPrice / 100).toFixed(2)}/mo</span>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-[7px] text-center py-16 px-6">
          <Server className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No cloud servers</h3>
          <p className="text-gray-500 mb-6">Deploy your first cloud server with root access and full control</p>
          <button onClick={() => setShowCreate(true)} className="btn-primary">Deploy Server</button>
        </div>
      )}

      {showCreate && <CreateServerModal onClose={() => setShowCreate(false)} />}

      {confirmAction && (
        <ConfirmDialog
          action={confirmAction.action}
          onConfirm={() => {
            powerMutation.mutate({ uuid: confirmAction.uuid, action: confirmAction.action as any });
          }}
          onCancel={() => setConfirmAction(null)}
          loading={powerMutation.isPending}
        />
      )}
    </div>
  );
}

function ServerDetail({ server, onBack, onPower }: {
  server: any;
  onBack: () => void;
  onPower: (action: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  const copyIp = () => {
    if (!server.ipv4) return;
    navigator.clipboard.writeText(server.ipv4);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-[#064A6C] hover:text-[#053C58]">
        <ArrowLeft className="w-4 h-4" /> Back to Servers
      </button>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{server.name}</h1>
          <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
            <span className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${statusDot[server.status] || 'bg-gray-400'}`} />
              {statusLabel[server.status] || server.status}
            </span>
            <span className="text-gray-300">|</span>
            <span>{PLAN_LABELS[server.planSlug] || server.planSlug} Plan</span>
            <span className="text-gray-300">|</span>
            <span>${(server.monthlyPrice / 100).toFixed(2)}/mo</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {server.status === 'stopped' && (
            <button onClick={() => onPower('on')} className="btn-primary flex items-center gap-2 text-sm">
              <Power className="w-4 h-4" /> Start
            </button>
          )}
          {server.status === 'active' && (
            <>
              <button onClick={() => onPower('reboot')} className="px-3 py-2 border border-gray-200 rounded-[7px] text-sm hover:bg-gray-50 flex items-center gap-2">
                <RotateCcw className="w-4 h-4" /> Restart
              </button>
              <button onClick={() => onPower('off')} className="px-3 py-2 border border-gray-200 rounded-[7px] text-sm hover:bg-gray-50 flex items-center gap-2">
                <PowerOff className="w-4 h-4" /> Stop
              </button>
            </>
          )}
        </div>
      </div>

      {/* Server Info */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-[7px] p-4">
          <div className="text-xs text-gray-500 mb-1">Plan</div>
          <div className="text-lg font-semibold text-gray-900">{PLAN_LABELS[server.planSlug] || server.planSlug}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-[7px] p-4">
          <div className="text-xs text-gray-500 mb-1">IP Address</div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold text-gray-900">{server.ipv4 || 'Pending'}</span>
            {server.ipv4 && (
              <button onClick={copyIp} className="p-1 text-gray-400 hover:text-[#064A6C]">
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-[7px] p-4">
          <div className="text-xs text-gray-500 mb-1">Monthly Cost</div>
          <div className="text-lg font-semibold text-gray-900">${(server.monthlyPrice / 100).toFixed(2)}</div>
        </div>
      </div>

      {/* SSH Info */}
      {server.ipv4 && server.status === 'active' && (
        <div className="bg-white border border-gray-200 rounded-[7px] p-5">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Terminal className="w-4 h-4" /> SSH Access
          </h3>
          <code className="block bg-gray-900 text-green-400 rounded-[7px] p-4 text-sm font-mono">
            ssh root@{server.ipv4}
          </code>
          <p className="text-xs text-gray-500 mt-2">Your root password was sent to your email when the server was provisioned.</p>
        </div>
      )}

      {/* Upgrade */}
      {server.status !== 'terminated' && (
        <div className="bg-white border border-gray-200 rounded-[7px] p-5">
          <h3 className="font-semibold text-gray-900 mb-2">Need more power?</h3>
          <p className="text-sm text-gray-500 mb-3">Contact support to upgrade your server to a larger plan without downtime.</p>
          <a href="/dashboard/support" className="text-sm text-[#064A6C] hover:text-[#053C58] font-medium">
            Contact Support →
          </a>
        </div>
      )}
    </div>
  );
}

function CreateServerModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ planSlug: 'cloud-developer', name: '' });

  const { data: options } = useQuery({
    queryKey: ['cloud-options'],
    queryFn: cloudHostingApi.getOptions,
  });

  const createMutation = useMutation({
    mutationFn: () => cloudHostingApi.createServer({
      ...form,
      datacenter: options?.datacenters?.[0]?.id || 'US-NY2',
      os: 'ubuntu_server_24.04_64-bit',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cloud-servers'] });
      onClose();
    },
  });

  const plans = options?.plans || [];
  const selectedPlan = plans.find((p: any) => p.slug === form.planSlug);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-[7px] max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Deploy Cloud Server</h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-5">
          {/* Plan selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Choose a Plan</label>
            <div className="grid grid-cols-2 gap-2">
              {plans.map((p: any) => (
                <button
                  key={p.slug}
                  onClick={() => setForm(f => ({ ...f, planSlug: p.slug }))}
                  className={`border rounded-[7px] p-3 text-left transition-colors ${form.planSlug === p.slug ? 'border-[#064A6C] bg-[#064A6C]/5' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <div className="font-medium text-sm text-gray-900">{p.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{p.features.slice(0, 2).join(' · ')}</div>
                  <div className="font-semibold text-[#064A6C] text-sm mt-1">${(p.monthlyPrice / 100).toFixed(2)}/mo</div>
                </button>
              ))}
            </div>
          </div>

          {/* Server name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Server Name</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="my-web-server"
              className="w-full border border-gray-200 rounded-[7px] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#064A6C]"
            />
          </div>

          {createMutation.isError && (
            <p className="text-sm text-red-600">{(createMutation.error as Error).message}</p>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-gray-200">
            <div className="text-sm text-gray-600">
              Total: <span className="font-semibold text-gray-900">${selectedPlan ? (selectedPlan.monthlyPrice / 100).toFixed(2) : '—'}/mo</span>
            </div>
            <button
              onClick={() => createMutation.mutate()}
              disabled={!form.name || createMutation.isPending}
              className="btn-primary flex items-center gap-2 disabled:opacity-50"
            >
              {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Deploy Server
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfirmDialog({ action, onConfirm, onCancel, loading }: {
  action: string; onConfirm: () => void; onCancel: () => void; loading: boolean;
}) {
  const labels: Record<string, { title: string; desc: string; btn: string; danger: boolean }> = {
    on: { title: 'Start Server', desc: 'This will power on the server.', btn: 'Start', danger: false },
    off: { title: 'Stop Server', desc: 'This will gracefully shut down the server. Running processes will be terminated.', btn: 'Stop', danger: true },
    reboot: { title: 'Restart Server', desc: 'This will restart the server. There will be a brief interruption.', btn: 'Restart', danger: false },
  };
  const l = labels[action] || labels.on;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-white rounded-[7px] max-w-sm w-full p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{l.title}</h3>
        <p className="text-sm text-gray-600 mb-5">{l.desc}</p>
        <div className="flex items-center gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 text-sm border border-gray-200 rounded-[7px] hover:bg-gray-50">Cancel</button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 text-sm font-medium rounded-[7px] text-white flex items-center gap-2 ${l.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-[#064A6C] hover:bg-[#053C58]'} disabled:opacity-50`}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {l.btn}
          </button>
        </div>
      </div>
    </div>
  );
}
