import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supportApi } from '@/lib/api';
import { MessageSquare, Plus, Loader2, ArrowLeft, Send, X } from 'lucide-react';

export function SupportPage() {
  const queryClient = useQueryClient();
  const [selectedTicketUuid, setSelectedTicketUuid] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTicketSubject, setNewTicketSubject] = useState('');
  const [newTicketMessage, setNewTicketMessage] = useState('');
  const [newTicketPriority, setNewTicketPriority] = useState('medium');
  const [replyMessage, setReplyMessage] = useState('');

  const { data: tickets, isLoading: ticketsLoading } = useQuery({
    queryKey: ['support', 'tickets'],
    queryFn: supportApi.getTickets,
  });

  const { data: selectedTicket, isLoading: ticketLoading } = useQuery({
    queryKey: ['support', 'ticket', selectedTicketUuid],
    queryFn: () => supportApi.getTicket(selectedTicketUuid!),
    enabled: !!selectedTicketUuid,
  });

  const createTicketMutation = useMutation({
    mutationFn: (data: { subject: string; message: string; priority: string }) =>
      supportApi.createTicket(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support', 'tickets'] });
      setShowCreateForm(false);
      setNewTicketSubject('');
      setNewTicketMessage('');
      setNewTicketPriority('medium');
    },
  });

  const addMessageMutation = useMutation({
    mutationFn: ({ ticketUuid, body }: { ticketUuid: string; body: string }) =>
      supportApi.addMessage(ticketUuid, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support', 'ticket', selectedTicketUuid] });
      setReplyMessage('');
    },
  });

  if (ticketsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-[#1844A6] animate-spin" />
      </div>
    );
  }

  // Ticket detail view
  if (selectedTicketUuid) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <button
            onClick={() => setSelectedTicketUuid(null)}
            className="hover:text-gray-900 flex items-center gap-1"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Tickets
          </button>
        </div>

        {ticketLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-6 h-6 text-[#1844A6] animate-spin" />
          </div>
        ) : selectedTicket ? (
          <>
            <div className="bg-white border border-gray-200 rounded-[7px] p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h1 className="text-xl font-bold text-gray-900">{selectedTicket.subject}</h1>
                  <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                    <span className={`badge badge-${
                      selectedTicket.status === 'open' ? 'success' :
                      selectedTicket.status === 'pending' ? 'warning' :
                      selectedTicket.status === 'closed' ? 'neutral' : 'neutral'
                    } text-xs`}>
                      {selectedTicket.status}
                    </span>
                    <span className={`badge badge-${
                      selectedTicket.priority === 'high' ? 'error' :
                      selectedTicket.priority === 'medium' ? 'warning' : 'neutral'
                    } text-xs`}>
                      {selectedTicket.priority} priority
                    </span>
                    {selectedTicket.createdAt && (
                      <span>Created {new Date(selectedTicket.createdAt).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Messages thread */}
              <div className="space-y-4 mt-6">
                {selectedTicket.messages?.map((msg: any, index: number) => (
                  <div
                    key={index}
                    className={`p-4 rounded-[7px] ${
                      msg.fromStaff
                        ? 'bg-blue-50 border border-blue-100'
                        : 'bg-gray-50 border border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900 text-sm">
                        {msg.fromStaff ? 'Support Team' : 'You'}
                      </span>
                      {msg.createdAt && (
                        <span className="text-xs text-gray-500">
                          {new Date(msg.createdAt).toLocaleString()}
                        </span>
                      )}
                    </div>
                    <p className="text-gray-600 text-sm whitespace-pre-wrap">{msg.body}</p>
                  </div>
                )) || (
                  <p className="text-gray-500 text-sm">No messages yet.</p>
                )}
              </div>
            </div>

            {/* Reply form */}
            {selectedTicket.status !== 'closed' && (
              <div className="bg-white border border-gray-200 rounded-[7px] p-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Reply</h3>
                <textarea
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  placeholder="Type your reply..."
                  rows={4}
                  className="w-full border border-gray-200 rounded-[7px] p-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1844A6] focus:border-transparent text-sm resize-none"
                />
                <div className="flex justify-end mt-3">
                  <button
                    onClick={() => {
                      if (replyMessage.trim()) {
                        addMessageMutation.mutate({
                          ticketUuid: selectedTicketUuid,
                          body: replyMessage.trim(),
                        });
                      }
                    }}
                    disabled={!replyMessage.trim() || addMessageMutation.isPending}
                    className="btn-primary text-sm flex items-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    {addMessageMutation.isPending ? 'Sending...' : 'Send Reply'}
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="bg-white border border-gray-200 rounded-[7px] text-center py-16 px-6">
            <p className="text-gray-500">Ticket not found.</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Support</h1>
          <p className="text-gray-500">Get help from our support team</p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Ticket
        </button>
      </div>

      {/* Create Ticket Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[7px] w-full max-w-lg p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Create Support Ticket</h2>
              <button
                onClick={() => setShowCreateForm(false)}
                className="p-1 text-gray-400 hover:text-gray-900 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                <input
                  type="text"
                  value={newTicketSubject}
                  onChange={(e) => setNewTicketSubject(e.target.value)}
                  placeholder="Brief description of your issue"
                  className="w-full border border-gray-200 rounded-[7px] p-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1844A6] focus:border-transparent text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <select
                  value={newTicketPriority}
                  onChange={(e) => setNewTicketPriority(e.target.value)}
                  className="w-full border border-gray-200 rounded-[7px] p-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1844A6] focus:border-transparent text-sm bg-white"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                <textarea
                  value={newTicketMessage}
                  onChange={(e) => setNewTicketMessage(e.target.value)}
                  placeholder="Describe your issue in detail..."
                  rows={5}
                  className="w-full border border-gray-200 rounded-[7px] p-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1844A6] focus:border-transparent text-sm resize-none"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="btn-outline text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (newTicketSubject.trim() && newTicketMessage.trim()) {
                      createTicketMutation.mutate({
                        subject: newTicketSubject.trim(),
                        message: newTicketMessage.trim(),
                        priority: newTicketPriority,
                      });
                    }
                  }}
                  disabled={!newTicketSubject.trim() || !newTicketMessage.trim() || createTicketMutation.isPending}
                  className="btn-primary text-sm"
                >
                  {createTicketMutation.isPending ? 'Creating...' : 'Create Ticket'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tickets List */}
      {tickets && tickets.length > 0 ? (
        <div className="grid gap-4">
          {tickets.map((ticket: any) => (
            <button
              key={ticket.id}
              onClick={() => setSelectedTicketUuid(ticket.uuid)}
              className="bg-white border border-gray-200 rounded-[7px] p-6 hover:shadow-md transition-shadow text-left w-full"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-[#1844A6]" />
                  </div>
                  <div>
                    <h3 className="text-gray-900 font-medium">{ticket.subject}</h3>
                    <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                      <span className={`badge badge-${
                        ticket.status === 'open' ? 'success' :
                        ticket.status === 'pending' ? 'warning' :
                        ticket.status === 'closed' ? 'neutral' : 'neutral'
                      } text-xs`}>
                        {ticket.status}
                      </span>
                      <span className={`badge badge-${
                        ticket.priority === 'high' ? 'error' :
                        ticket.priority === 'medium' ? 'warning' : 'neutral'
                      } text-xs`}>
                        {ticket.priority}
                      </span>
                      {ticket.createdAt && (
                        <span>{new Date(ticket.createdAt).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                </div>
                <span className="text-[#1844A6] text-sm hidden sm:inline">View thread</span>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-[7px] text-center py-16 px-6">
          <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No support tickets yet</h3>
          <p className="text-gray-500 mb-6">Need help? Create a ticket and our team will assist you</p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="btn-primary"
          >
            Create a Ticket
          </button>
        </div>
      )}
    </div>
  );
}
