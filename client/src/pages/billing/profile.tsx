import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  CreditCard, Receipt, MapPin, Loader2, Save, ExternalLink,
  Building2, Phone, Mail, User,
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '';

async function fetchKamatera<T>(endpoint: string, data?: string, options: RequestInit = {}): Promise<T> {
  const separator = endpoint.includes('?') ? '&' : '?';
  const url = `${API_URL}/api/v1/kamatera${endpoint}${data ? `${separator}data=${encodeURIComponent(data)}` : ''}`;
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Request failed');
  return json.data;
}

export function BillingProfilePage() {
  const [searchParams] = useSearchParams();
  const data = searchParams.get('data') || '';
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const { data: profile, isLoading, error } = useQuery({
    queryKey: ['kamatera', 'billing-profile', data],
    queryFn: () => fetchKamatera<any>('/billing/profile', data),
    enabled: !!data,
  });

  const updateMutation = useMutation({
    mutationFn: (body: Record<string, string>) =>
      fetchKamatera<any>('/billing/profile', data, {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kamatera', 'billing-profile'] });
      setEditing(false);
    },
  });

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white border border-gray-200 rounded-[7px] p-8 text-center max-w-md">
          <CreditCard className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-500">This page must be accessed from your cloud management panel.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#064A6C] animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white border border-gray-200 rounded-[7px] p-8 text-center max-w-md">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Unable to Load Profile</h2>
          <p className="text-gray-500">{(error as Error).message}</p>
        </div>
      </div>
    );
  }

  const customer = profile?.customer;
  const invoices = profile?.invoices || [];

  const startEditing = () => {
    setForm({
      firstName: customer?.firstName || '',
      lastName: customer?.lastName || '',
      companyName: customer?.companyName || '',
      phone: customer?.phone || '',
      address1: customer?.address1 || '',
      address2: customer?.address2 || '',
      city: customer?.city || '',
      state: customer?.state || '',
      postalCode: customer?.postalCode || '',
      countryCode: customer?.countryCode || 'US',
    });
    setEditing(true);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#09080E]">Billing Profile</h1>
          <p className="text-gray-500 mt-1">Manage your payment method and billing information</p>
        </div>

        {/* Customer Info Card */}
        <div className="bg-white border border-gray-200 rounded-[7px] p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-[#064A6C]/10 rounded-lg flex items-center justify-center">
              <User className="w-5 h-5 text-[#064A6C]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[#09080E]">Account Details</h2>
              <p className="text-sm text-gray-500">{customer?.email}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2 text-gray-600">
              <Mail className="w-4 h-4 text-gray-400" />
              <span>{customer?.email}</span>
            </div>
            {customer?.phone && (
              <div className="flex items-center gap-2 text-gray-600">
                <Phone className="w-4 h-4 text-gray-400" />
                <span>{customer.phone}</span>
              </div>
            )}
            {customer?.companyName && (
              <div className="flex items-center gap-2 text-gray-600">
                <Building2 className="w-4 h-4 text-gray-400" />
                <span>{customer.companyName}</span>
              </div>
            )}
          </div>
        </div>

        {/* Payment Method Card */}
        <div className="bg-white border border-gray-200 rounded-[7px] p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#064A6C]/10 rounded-lg flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-[#064A6C]" />
              </div>
              <h2 className="text-lg font-semibold text-[#09080E]">Payment Method</h2>
            </div>
            <a
              href="https://swipesblue.com"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary text-sm flex items-center gap-2"
            >
              Update Payment Method
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
          <p className="text-sm text-gray-500">
            Payment methods are managed through our secure payment processor. Click "Update Payment Method" to add or change your card on file.
          </p>
        </div>

        {/* Billing Address Card */}
        <div className="bg-white border border-gray-200 rounded-[7px] p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#064A6C]/10 rounded-lg flex items-center justify-center">
                <MapPin className="w-5 h-5 text-[#064A6C]" />
              </div>
              <h2 className="text-lg font-semibold text-[#09080E]">Billing Address</h2>
            </div>
            {!editing && (
              <button onClick={startEditing} className="btn-outline text-sm">
                Edit Address
              </button>
            )}
          </div>

          {editing ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                  <input
                    type="text"
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    className="w-full border border-gray-200 rounded-[7px] p-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#064A6C] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                  <input
                    type="text"
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    className="w-full border border-gray-200 rounded-[7px] p-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#064A6C] focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company (optional)</label>
                <input
                  type="text"
                  value={form.companyName}
                  onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                  className="w-full border border-gray-200 rounded-[7px] p-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#064A6C] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full border border-gray-200 rounded-[7px] p-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#064A6C] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 1</label>
                <input
                  type="text"
                  value={form.address1}
                  onChange={(e) => setForm({ ...form, address1: e.target.value })}
                  className="w-full border border-gray-200 rounded-[7px] p-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#064A6C] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2 (optional)</label>
                <input
                  type="text"
                  value={form.address2}
                  onChange={(e) => setForm({ ...form, address2: e.target.value })}
                  className="w-full border border-gray-200 rounded-[7px] p-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#064A6C] focus:border-transparent"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                  <input
                    type="text"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    className="w-full border border-gray-200 rounded-[7px] p-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#064A6C] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">State / Province</label>
                  <input
                    type="text"
                    value={form.state}
                    onChange={(e) => setForm({ ...form, state: e.target.value })}
                    className="w-full border border-gray-200 rounded-[7px] p-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#064A6C] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code</label>
                  <input
                    type="text"
                    value={form.postalCode}
                    onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
                    className="w-full border border-gray-200 rounded-[7px] p-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#064A6C] focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Country Code</label>
                <input
                  type="text"
                  value={form.countryCode}
                  onChange={(e) => setForm({ ...form, countryCode: e.target.value.toUpperCase() })}
                  maxLength={2}
                  className="w-full border border-gray-200 rounded-[7px] p-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#064A6C] focus:border-transparent"
                />
              </div>
              {updateMutation.isError && (
                <p className="text-red-500 text-sm">Failed to update billing address. Please try again.</p>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setEditing(false)} className="btn-outline text-sm">
                  Cancel
                </button>
                <button
                  onClick={() => updateMutation.mutate(form)}
                  disabled={updateMutation.isPending}
                  className="btn-primary text-sm flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {updateMutation.isPending ? 'Saving...' : 'Save Address'}
                </button>
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-600 space-y-1">
              {customer?.address1 ? (
                <>
                  <p>{customer.firstName} {customer.lastName}</p>
                  {customer.companyName && <p>{customer.companyName}</p>}
                  <p>{customer.address1}</p>
                  {customer.address2 && <p>{customer.address2}</p>}
                  <p>{customer.city}{customer.state ? `, ${customer.state}` : ''} {customer.postalCode}</p>
                  <p>{customer.countryCode}</p>
                </>
              ) : (
                <p className="text-gray-400">No billing address on file. Click "Edit Address" to add one.</p>
              )}
            </div>
          )}
        </div>

        {/* Invoice History */}
        <div className="bg-white border border-gray-200 rounded-[7px] p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-[#064A6C]/10 rounded-lg flex items-center justify-center">
              <Receipt className="w-5 h-5 text-[#064A6C]" />
            </div>
            <h2 className="text-lg font-semibold text-[#09080E]">Invoice History</h2>
          </div>

          {invoices.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-2 text-gray-500 font-medium">Order ID</th>
                    <th className="text-left py-3 px-2 text-gray-500 font-medium">Date</th>
                    <th className="text-left py-3 px-2 text-gray-500 font-medium">Status</th>
                    <th className="text-right py-3 px-2 text-gray-500 font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice: any) => (
                    <tr key={invoice.id} className="border-b border-gray-100">
                      <td className="py-3 px-2 text-gray-900 font-mono">#{invoice.id}</td>
                      <td className="py-3 px-2 text-gray-600">
                        {invoice.createdAt ? new Date(invoice.createdAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="py-3 px-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-[7px] text-xs font-medium ${
                          invoice.status === 'completed' ? 'bg-green-50 text-green-700' :
                          invoice.status === 'pending_payment' ? 'bg-yellow-50 text-yellow-700' :
                          invoice.status === 'failed' ? 'bg-red-50 text-red-700' :
                          'bg-gray-50 text-gray-700'
                        }`}>
                          {invoice.status?.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-right text-gray-900 font-medium">
                        ${invoice.totalCents ? (invoice.totalCents / 100).toFixed(2) : '0.00'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-400 text-sm">No invoices found for the last 12 months.</p>
          )}
        </div>
      </div>
    </div>
  );
}
