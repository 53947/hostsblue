import { useQuery } from '@tanstack/react-query';
import { emailApi } from '@/lib/api';
import { Mail, Plus, Loader2, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function EmailPage() {
  const queryClient = useQueryClient();

  const { data: accounts, isLoading } = useQuery({
    queryKey: ['email', 'accounts'],
    queryFn: emailApi.getAccounts,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => emailApi.deleteAccount(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email', 'accounts'] });
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
          {accounts.map((account: any) => (
            <div key={account.id} className="bg-white border border-gray-200 rounded-[7px] p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                    <Mail className="w-5 h-5 text-[#1844A6]" />
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
                  {/* Storage usage */}
                  {account.storageUsed !== undefined && account.storageLimit !== undefined && (
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-gray-500 mb-1">Storage</p>
                      <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#1844A6] rounded-full"
                          style={{ width: `${Math.min((account.storageUsed / account.storageLimit) * 100, 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {account.storageUsed} MB / {account.storageLimit} MB
                      </p>
                    </div>
                  )}
                  <button
                    onClick={() => {
                      if (confirm('Are you sure you want to delete this email account?')) {
                        deleteMutation.mutate(account.id);
                      }
                    }}
                    className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                    title="Delete account"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
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
