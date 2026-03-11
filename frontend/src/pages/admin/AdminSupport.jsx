import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { Headphones, ChevronLeft, ChevronRight, Send, Search, ArrowLeft, User, Clock } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'waiting_on_user', label: 'Waiting on User' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

const PRIORITY_OPTIONS = [
  { value: '', label: 'All Priorities' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const STATUS_COLORS = {
  open: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  in_progress: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  waiting_on_user: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  resolved: 'bg-green-500/20 text-green-400 border-green-500/30',
  closed: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

const PRIORITY_COLORS = {
  urgent: 'bg-red-500/20 text-red-400 border-red-500/30',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  low: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

export default function AdminSupport() {
  const { token, admin } = useAdminAuth();
  const [tickets, setTickets] = useState([]);
  const [stats, setStats] = useState(null);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('open');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [sending, setSending] = useState(false);
  const authHeaders = () => ({ Authorization: `Bearer ${token}` });

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 20 });
      if (statusFilter) params.append('status', statusFilter);
      if (priorityFilter) params.append('priority', priorityFilter);
      if (search) params.append('search', search);
      const res = await axios.get(`${API}/admin/support/tickets?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      setTickets(res.data.tickets);
      setTotal(res.data.total);
      setPages(res.data.pages);
    } catch {
      toast.error('Failed to load tickets');
    } finally {
      setLoading(false);
    }
  }, [token, page, statusFilter, priorityFilter, search]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/admin/support/stats`, { headers: { Authorization: `Bearer ${token}` } });
      setStats(res.data);
    } catch { /* silent */ }
  }, [token]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  const openTicket = async (ticketId) => {
    try {
      const res = await axios.get(`${API}/admin/support/tickets/${ticketId}`, { headers: authHeaders() });
      setSelectedTicket(res.data.ticket);
    } catch {
      toast.error('Failed to load ticket');
    }
  };

  const handleReply = async () => {
    if (!replyMessage.trim() || !selectedTicket) return;
    setSending(true);
    try {
      await axios.post(`${API}/admin/support/tickets/${selectedTicket.id}/reply`, { message: replyMessage }, { headers: authHeaders() });
      setReplyMessage('');
      toast.success('Reply sent');
      // Refresh ticket
      const res = await axios.get(`${API}/admin/support/tickets/${selectedTicket.id}`, { headers: authHeaders() });
      setSelectedTicket(res.data.ticket);
      fetchTickets();
      fetchStats();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to send reply');
    } finally {
      setSending(false);
    }
  };

  const handleUpdateTicket = async (ticketId, changes) => {
    try {
      await axios.put(`${API}/admin/support/tickets/${ticketId}`, changes, { headers: authHeaders() });
      toast.success('Ticket updated');
      fetchTickets();
      fetchStats();
      if (selectedTicket?.id === ticketId) {
        const res = await axios.get(`${API}/admin/support/tickets/${ticketId}`, { headers: authHeaders() });
        setSelectedTicket(res.data.ticket);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Detail view
  if (selectedTicket) {
    return (
      <div>
        <button
          onClick={() => setSelectedTicket(null)}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to tickets
        </button>

        {/* Ticket header */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-4">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_COLORS[selectedTicket.status] || ''}`}>
              {selectedTicket.status?.replace('_', ' ')}
            </span>
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${PRIORITY_COLORS[selectedTicket.priority] || ''}`}>
              {selectedTicket.priority}
            </span>
            <span className="text-xs text-gray-500 capitalize">{selectedTicket.category?.replace('_', ' ')}</span>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">{selectedTicket.subject}</h2>
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400">
            <span className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" />
              {selectedTicket.user_name} ({selectedTicket.user_email})
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {formatDate(selectedTicket.created_at)}
            </span>
            {selectedTicket.assigned_name && (
              <span className="text-xs">Assigned to: <strong className="text-white">{selectedTicket.assigned_name}</strong></span>
            )}
          </div>

          {/* Quick actions */}
          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-800">
            <select
              value={selectedTicket.status}
              onChange={(e) => handleUpdateTicket(selectedTicket.id, { status: e.target.value })}
              className="bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-1.5"
            >
              {STATUS_OPTIONS.filter(s => s.value).map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <select
              value={selectedTicket.priority}
              onChange={(e) => handleUpdateTicket(selectedTicket.id, { priority: e.target.value })}
              className="bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-1.5"
            >
              {PRIORITY_OPTIONS.filter(p => p.value).map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            {!selectedTicket.assigned_to && (
              <button
                onClick={() => handleUpdateTicket(selectedTicket.id, { assigned_to: admin.id })}
                className="px-3 py-1.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-sm font-medium hover:bg-red-500/30 transition-colors"
              >
                Assign to me
              </button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="space-y-3 mb-4">
          {selectedTicket.messages?.map((msg) => (
            <div
              key={msg.id}
              className={`rounded-xl p-4 ${
                msg.sender_type === 'admin'
                  ? 'bg-red-500/10 border border-red-500/20 ml-8'
                  : 'bg-gray-900 border border-gray-800 mr-8'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-white">
                  {msg.sender_type === 'admin' ? `${msg.sender_name} (Staff)` : `${msg.sender_name} (User)`}
                </span>
                <span className="text-xs text-gray-500">{formatDate(msg.created_at)}</span>
              </div>
              <p className="text-sm text-gray-300 whitespace-pre-wrap">{msg.message}</p>
            </div>
          ))}
        </div>

        {/* Reply */}
        {selectedTicket.status !== 'closed' && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <textarea
              value={replyMessage}
              onChange={(e) => setReplyMessage(e.target.value)}
              placeholder="Type your reply to the user..."
              rows={4}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-gray-200 text-sm resize-none focus:outline-none focus:border-red-500/50 mb-3"
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">Replying as {admin?.name}</p>
              <button
                onClick={handleReply}
                disabled={!replyMessage.trim() || sending}
                className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {sending ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Send Reply
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // List view
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Support Tickets</h1>
        <p className="text-gray-400 mt-1">{total} ticket{total !== 1 ? 's' : ''}</p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Open', value: stats.open, color: 'text-blue-400' },
            { label: 'Resolved', value: stats.resolved, color: 'text-green-400' },
            { label: 'Total', value: stats.total, color: 'text-white' },
            { label: 'Urgent', value: stats.by_priority?.urgent || 0, color: 'text-red-400' },
          ].map((s) => (
            <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex gap-2 flex-wrap">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s.value}
              onClick={() => { setStatusFilter(s.value); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                statusFilter === s.value
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'text-gray-400 hover:text-white bg-gray-800 border border-gray-700'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <select
          value={priorityFilter}
          onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }}
          className="bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-1.5"
        >
          {PRIORITY_OPTIONS.map(p => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search tickets..."
            className="w-full bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg pl-9 pr-3 py-1.5 focus:outline-none focus:border-red-500/50"
          />
        </div>
      </div>

      {/* Ticket list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <Headphones className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium text-gray-400">No tickets found</p>
          <p className="text-sm">Try changing your filters</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tickets.map((ticket) => {
            const lastMsg = ticket.messages?.[0];
            return (
              <button
                key={ticket.id}
                onClick={() => openTicket(ticket.id)}
                className="w-full text-left bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[ticket.status] || ''}`}>
                        {ticket.status?.replace('_', ' ')}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${PRIORITY_COLORS[ticket.priority] || ''}`}>
                        {ticket.priority}
                      </span>
                      <span className="text-xs text-gray-500 capitalize">{ticket.category?.replace('_', ' ')}</span>
                    </div>
                    <h3 className="font-medium text-white truncate">{ticket.subject}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-500">{ticket.user_name}</span>
                      <span className="text-xs text-gray-600">·</span>
                      <span className="text-xs text-gray-500">{ticket.user_email}</span>
                    </div>
                    {lastMsg && (
                      <p className="text-sm text-gray-500 truncate mt-1">
                        {lastMsg.sender_type === 'admin' ? `${lastMsg.sender_name}: ` : ''}{lastMsg.message}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-xs text-gray-500">{formatDate(ticket.updated_at)}</span>
                    {ticket.assigned_name && (
                      <span className="text-xs text-gray-600">{ticket.assigned_name}</span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-2 rounded-lg bg-gray-800 text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-gray-400">Page {page} of {pages}</span>
          <button
            onClick={() => setPage(p => Math.min(pages, p + 1))}
            disabled={page === pages}
            className="p-2 rounded-lg bg-gray-800 text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
