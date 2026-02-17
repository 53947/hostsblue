import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sslApi } from '@/lib/api';
import { ShieldCheck, Plus, Loader2, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';

export function SslPage() {
  const queryClient = useQueryClient();

  const { data: certificates, isLoading } = useQuery({
    queryKey: ['ssl', 'certificates'],
    queryFn: sslApi.getCertificates,
  });

  const renewMutation = useMutation({
    mutationFn: (id: number) => sslApi.renewCertificate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ssl', 'certificates'] });
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
          <h1 className="text-2xl font-bold text-gray-900">SSL Certificates</h1>
          <p className="text-gray-500">Manage your SSL certificates and website security</p>
        </div>
        <Link to="/security" className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Certificate
        </Link>
      </div>

      {/* Certificates List */}
      {certificates && certificates.length > 0 ? (
        <div className="grid gap-4">
          {certificates.map((cert: any) => {
            const isExpiring = cert.expiresAt && new Date(cert.expiresAt) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            return (
              <div key={cert.id} className="bg-white border border-gray-200 rounded-[7px] p-6 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                      <ShieldCheck className="w-5 h-5 text-[#1844A6]" />
                    </div>
                    <div>
                      <h3 className="text-gray-900 font-medium">{cert.domain}</h3>
                      <div className="flex items-center gap-3 text-sm text-gray-500">
                        <span className={`badge badge-${
                          cert.status === 'active' ? 'success' :
                          cert.status === 'pending' ? 'warning' :
                          cert.status === 'expired' ? 'error' : 'neutral'
                        } text-xs`}>
                          {cert.status}
                        </span>
                        <span>{cert.type || 'Standard SSL'}</span>
                        {cert.expiresAt && (
                          <span className={isExpiring ? 'text-red-500' : ''}>
                            Expires {new Date(cert.expiresAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => renewMutation.mutate(cert.id)}
                      disabled={renewMutation.isPending}
                      className="btn-outline text-sm flex items-center gap-2"
                    >
                      <RefreshCw className={`w-4 h-4 ${renewMutation.isPending ? 'animate-spin' : ''}`} />
                      Renew
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-[7px] text-center py-16 px-6">
          <ShieldCheck className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No SSL certificates yet</h3>
          <p className="text-gray-500 mb-6">Secure your websites with SSL encryption</p>
          <Link to="/security" className="btn-primary">
            Get SSL Certificate
          </Link>
        </div>
      )}
    </div>
  );
}
