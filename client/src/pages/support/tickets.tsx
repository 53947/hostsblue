import { useQuery } from '@tanstack/react-query';
import { useSearchParams, Link } from 'react-router-dom';
import { MessageSquare, Plus, Loader2, Clock } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '';

async function fetchKamatera<T>(endpoint: string, data: string): Promise<T> {
  const separator = endpoint.includes('?') ? '&' : '?';
  const url = `${API_URL}/api/v1/kamatera${endpoint}${separator}data=${encodeURIComponent(data)}`;
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Request failed');
  return json.data;
}

const statusStyles: Record<string, string> = {
  open: 'bg-blue-50 text-blue-700',
  in_progress: 'bg-orange-50 text-orange-700',
  waiting: 'bg-yellow-50 text-yellow-700',
  resolved: 'bg-green-50 text-green-700',
  closed: 'bg-gray-100 text-gray-600',
};

const priorityStyles: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600',
  normal: 'bg-blue-50 text-blue-600',
  high: 'bg-orange-50 text-orange-700',
  urgent: 'bg-red-50 text-red-700',
};

export function SupportTicketsPage() {
  const [searchParams] = useSearchParams();
  const data = searchParams.get('data') || '';

  const { data: tickets, isLoading, error } = useQuery({
    queryKey: ['kamatera', 'tickets', data],
    queryFn: () => fetchKamatera<any[]>('/support/tickets', data),
    enabled: !!data,
  });

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white border border-gray-200 rounded-[7px] p-8 text-center max-w-md">
          <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
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
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Unable to Load Tickets</h2>
          <p className="text-gray-500">{(error as Error).message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-[#09080E]">My Tickets</h1>
            <p className="text-gray-500 mt-1">View and manage your support requests</p>
          </div>
          <Link
            to={`/support/tickets/new?data=${encodeURIComponent(data)}`}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create New Ticket
          </Link>
        </div>

        {/* Tickets Table */}
        {tickets && tickets.length > 0 ? (
          <div className="bg-white border border-gray-200 rounded-[7px] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">ID</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Subject</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Status</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Priority</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Created</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((ticket: any) => (
                    <tr key={ticket.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4 text-gray-900 font-mono">#{ticket.id}</td>
                      <td className="py-3 px-4 text-gray-900 font-medium max-w-xs truncate">
                        {ticket.subject}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-[7px] text-xs font-medium ${
                          statusStyles[ticket.status] || 'bg-gray-100 text-gray-600'
                        }`}>
                          {ticket.status?.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-[7px] text-xs font-medium ${
                          priorityStyles[ticket.priority] || 'bg-gray-100 text-gray-600'
                        }`}>
                          {ticket.priority}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-500">
                        {ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="py-3 px-4 text-gray-500">
                        {ticket.updatedAt ? new Date(ticket.updatedAt).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-[7px] text-center py-16 px-6">
            <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No support tickets</h3>
            <p className="text-gray-500 mb-6">You haven't created any support tickets yet. Need help? We're here for you.</p>
            <Link
              to={`/support/tickets/new?data=${encodeURIComponent(data)}`}
              className="btn-primary inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create Your First Ticket
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
