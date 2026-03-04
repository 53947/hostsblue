import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { emailApi } from '@/lib/api';
import {
  Mail,
  Plus,
  Loader2,
  Trash2,
  ChevronDown,
  Settings,
  Check,
  X,
  ExternalLink,
  Monitor,
  Server,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { EmailSetupModal } from '@/components/email-setup-modal';
import { MxRecordsModal } from '@/components/mx-records-modal';

export function EmailPage() {
  const queryClient = useQueryClient();
  const [expandedAccount, setExpandedAccount] = useState<string | null>(null);

  const { data: accounts, isLoading } = useQuery({
    queryKey: ['email', 'accounts'],
    queryFn: emailApi.getAccounts,
  });

  const deleteMutation = useMutation({
    mutationFn: (uuid: string) => emailApi.deleteAccount(uuid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email', 'accounts'] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-[#064A6C] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Email Accounts</h1>
          <p className="text-gray-500">Manage your professional email accounts</p>
        </div>
        <Link to="/email" className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Email Account
        </Link>
      </div>

      {/* Accounts List */}
      {accounts && accounts.length > 0 ? (
        <div className="grid gap-4">
          {accounts.map((account: any) => {
            const isExpanded = expandedAccount === account.uuid;

            return (
              <ExpandableEmail
                key={account.uuid}
                account={account}
                isExpanded={isExpanded}
                onToggle={() => setExpandedAccount(isExpanded ? null : account.uuid)}
                onDelete={() => {
                  if (confirm('Are you sure you want to delete this email account?')) {
                    deleteMutation.mutate(account.uuid);
                  }
                }}
                deletePending={deleteMutation.isPending}
              />
            );
          })}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-[7px] text-center py-16 px-6">
          <Mail className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No email accounts yet</h3>
          <p className="text-gray-500 mb-6">Set up professional email for your domains</p>
          <Link to="/email" className="btn-primary">
            Get Email Hosting
          </Link>
        </div>
      )}
    </div>
  );
}

function ExpandableEmail({
  account,
  isExpanded,
  onToggle,
  onDelete,
  deletePending,
}: {
  account: any;
  isExpanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  deletePending: boolean;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [forwardTo, setForwardTo] = useState(account.forwardTo || '');
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [showMxModal, setShowMxModal] = useState(false);

  const emailDomain = account.domain || account.email?.split('@')[1] || '';

  const { data: detail } = useQuery({
    queryKey: ['email', 'account', account.uuid],
    queryFn: () => emailApi.getAccount(account.uuid),
    enabled: isExpanded,
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => emailApi.updateAccount(account.uuid, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email', 'accounts'] });
      queryClient.invalidateQueries({ queryKey: ['email', 'account', account.uuid] });
      setEditing(false);
    },
  });

  const detailData = detail || account;

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-[7px] overflow-hidden hover:shadow-md transition-shadow">
        {/* Main Row */}
        <div className="p-6 flex items-center justify-between cursor-pointer" onClick={onToggle}>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-teal-50 rounded-lg flex items-center justify-center">
              <Mail className="w-5 h-5 text-[#064A6C]" />
            </div>
            <div>
              <h3 className="text-gray-900 font-medium">{account.email}</h3>
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
            {account.storageUsed !== undefined && account.storageLimit !== undefined && (
              <div className="text-right hidden sm:block">
                <p className="text-xs text-gray-500 mb-1">Storage</p>
                <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#064A6C] rounded-full"
                    style={{ width: `${Math.min((account.storageUsed / account.storageLimit) * 100, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {account.storageUsed} MB / {account.storageLimit} MB
                </p>
              </div>
            )}
            {account.status === 'active' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSetupModal(true);
                }}
                className="p-2 text-gray-400 hover:text-[#064A6C] hover:bg-gray-100 rounded-[7px] transition-colors"
                title="Email client setup"
              >
                <Monitor className="w-4 h-4" />
              </button>
            )}
            <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          </div>
        </div>

        {/* Expanded Detail */}
        {isExpanded && (
          <div className="border-t border-gray-200 px-6 py-5 bg-gray-50">
            <div className="grid sm:grid-cols-3 gap-6">
              {/* Account Details */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-900">Account Details</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Email</span>
                    <span className="text-gray-900 font-mono">{detailData.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Domain</span>
                    <span className="text-gray-900">{emailDomain}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Status</span>
                    <span className={`font-medium ${detailData.status === 'active' ? 'text-green-600' : 'text-gray-500'}`}>
                      {detailData.status}
                    </span>
                  </div>
                  {detailData.createdAt && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Created</span>
                      <span className="text-gray-900">{new Date(detailData.createdAt).toLocaleDateString()}</span>
                    </div>
                  )}
                  {detailData.storageUsed !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Storage Used</span>
                      <span className="text-gray-900">{detailData.storageUsed} MB / {detailData.storageLimit} MB</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Connection Info */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-900">Connection Info</h4>
                <div className="space-y-2">
                  <a
                    href={`https://webmail.${emailDomain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-[#064A6C] hover:bg-[#053A55] text-white text-sm font-medium px-4 py-2 rounded-[7px] flex items-center justify-center gap-2 transition-colors w-full"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open Webmail
                  </a>
                  <button
                    onClick={() => setShowSetupModal(true)}
                    className="btn-outline text-sm flex items-center gap-2 w-full justify-center"
                  >
                    <Monitor className="w-4 h-4" />
                    Email Client Setup
                  </button>
                  <button
                    onClick={() => setShowMxModal(true)}
                    className="btn-outline text-sm flex items-center gap-2 w-full justify-center"
                  >
                    <Server className="w-4 h-4" />
                    MX Records
                  </button>
                </div>
              </div>

              {/* Settings & Actions */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-900">Settings</h4>

                {editing ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Forward To</label>
                      <input
                        type="email"
                        value={forwardTo}
                        onChange={(e) => setForwardTo(e.target.value)}
                        placeholder="forward@example.com"
                        className="w-full border border-gray-200 rounded-[7px] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#064A6C]"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateMutation.mutate({ forwardTo: forwardTo || null })}
                        disabled={updateMutation.isPending}
                        className="bg-[#064A6C] hover:bg-[#053A55] text-white text-sm font-medium px-4 py-2 rounded-[7px] flex items-center gap-2 transition-colors disabled:opacity-50"
                      >
                        {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        Save
                      </button>
                      <button
                        onClick={() => setEditing(false)}
                        className="btn-outline text-sm flex items-center gap-2"
                      >
                        <X className="w-4 h-4" />
                        Cancel
                      </button>
                    </div>
                    {updateMutation.isSuccess && (
                      <p className="text-green-600 text-xs flex items-center gap-1">
                        <Check className="w-3 h-3" /> Settings updated
                      </p>
                    )}
                    {updateMutation.isError && (
                      <p className="text-red-500 text-xs flex items-center gap-1">
                        <X className="w-3 h-3" /> Update failed
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {detailData.forwardTo && (
                      <div className="p-3 bg-white border border-gray-200 rounded-[7px] text-sm">
                        <span className="text-gray-500">Forwarding to: </span>
                        <span className="text-gray-900 font-mono">{detailData.forwardTo}</span>
                      </div>
                    )}
                    <button
                      onClick={() => setEditing(true)}
                      className="btn-outline text-sm flex items-center gap-2 w-full justify-center"
                    >
                      <Settings className="w-4 h-4" />
                      Edit Settings
                    </button>
                    <button
                      onClick={onDelete}
                      disabled={deletePending}
                      className="text-red-500 hover:text-red-700 text-sm flex items-center gap-2 w-full justify-center border border-red-200 hover:border-red-300 rounded-[7px] px-4 py-2 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete Account
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showSetupModal && (
        <EmailSetupModal
          email={account.email}
          domain={emailDomain}
          onClose={() => setShowSetupModal(false)}
        />
      )}
      {showMxModal && (
        <MxRecordsModal
          domain={emailDomain}
          domainUuid={account.domainUuid}
          onClose={() => setShowMxModal(false)}
        />
      )}
    </>
  );
}
