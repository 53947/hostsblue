import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Send, Loader2, ArrowLeft, Mail } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '';

async function fetchKamatera<T>(endpoint: string, data: string, options: RequestInit = {}): Promise<T> {
  const separator = endpoint.includes('?') ? '&' : '?';
  const url = `${API_URL}/api/v1/kamatera${endpoint}${separator}data=${encodeURIComponent(data)}`;
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Request failed');
  return json.data;
}

export function CreateTicketPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const data = searchParams.get('data') || '';

  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('general');
  const [priority, setPriority] = useState('normal');
  const [description, setDescription] = useState('');
  const [validationError, setValidationError] = useState('');

  // Fetch customer email for display
  const { data: helpData } = useQuery({
    queryKey: ['kamatera', 'help', data],
    queryFn: () => fetchKamatera<any>('/help', data),
    enabled: !!data,
  });

  const createMutation = useMutation({
    mutationFn: (body: { subject: string; category: string; priority: string; description: string }) =>
      fetchKamatera<any>('/support/tickets', data, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      navigate(`/support/tickets?data=${encodeURIComponent(data)}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');

    if (!subject.trim()) {
      setValidationError('Subject is required');
      return;
    }
    if (!category) {
      setValidationError('Category is required');
      return;
    }
    if (!priority) {
      setValidationError('Priority is required');
      return;
    }
    if (!description.trim()) {
      setValidationError('Description is required');
      return;
    }
    if (description.trim().length < 20) {
      setValidationError('Description must be at least 20 characters');
      return;
    }

    createMutation.mutate({
      subject: subject.trim(),
      category,
      priority,
      description: description.trim(),
    });
  };

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white border border-gray-200 rounded-[7px] p-8 text-center max-w-md">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-500">This page must be accessed from your cloud management panel.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* Back link */}
        <button
          onClick={() => navigate(`/support/tickets?data=${encodeURIComponent(data)}`)}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to My Tickets
        </button>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#09080E]">Create New Ticket</h1>
          <p className="text-gray-500 mt-1">Describe your issue and our team will get back to you</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-[7px] p-6 space-y-5">
          {/* Customer Email (read-only) */}
          {helpData?.customerEmail && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <div className="flex items-center gap-2 w-full border border-gray-200 rounded-[7px] p-3 bg-gray-50 text-sm text-gray-500">
                <Mail className="w-4 h-4 text-gray-400" />
                {helpData.customerEmail}
              </div>
            </div>
          )}

          {/* Subject */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Brief description of your issue"
              className="w-full border border-gray-200 rounded-[7px] p-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#064A6C] focus:border-transparent"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category <span className="text-red-500">*</span></label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full border border-gray-200 rounded-[7px] p-3 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#064A6C] focus:border-transparent"
            >
              <option value="general">General</option>
              <option value="billing">Billing</option>
              <option value="technical">Technical</option>
              <option value="domains">Domains</option>
              <option value="hosting">Hosting</option>
            </select>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Priority <span className="text-red-500">*</span></label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full border border-gray-200 rounded-[7px] p-3 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#064A6C] focus:border-transparent"
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description <span className="text-red-500">*</span></label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Please describe your issue in detail (minimum 20 characters)..."
              rows={6}
              className="w-full border border-gray-200 rounded-[7px] p-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#064A6C] focus:border-transparent resize-none"
            />
            <p className="text-xs text-gray-400 mt-1">{description.length}/20 minimum characters</p>
          </div>

          {/* Errors */}
          {(validationError || createMutation.isError) && (
            <p className="text-red-500 text-sm">
              {validationError || (createMutation.error as Error).message}
            </p>
          )}

          {/* Submit */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate(`/support/tickets?data=${encodeURIComponent(data)}`)}
              className="btn-outline text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="btn-primary text-sm flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              {createMutation.isPending ? 'Submitting...' : 'Submit Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
