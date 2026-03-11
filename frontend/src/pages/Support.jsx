import { useState, useEffect, useCallback } from 'react';
import { HelpCircle, Send, ArrowLeft, Plus, ChevronRight } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Navigation from '../components/Navigation';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CATEGORIES = [
  { value: 'account', label: 'Account Issue' },
  { value: 'billing', label: 'Billing & Subscription' },
  { value: 'technical', label: 'Technical Problem' },
  { value: 'report_bug', label: 'Report a Bug' },
  { value: 'feature_request', label: 'Feature Request' },
  { value: 'other', label: 'Other' },
];

const STATUS_CONFIG = {
  open: { label: 'Open', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  in_progress: { label: 'In Progress', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  waiting_on_user: { label: 'Awaiting Reply', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  resolved: { label: 'Resolved', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  closed: { label: 'Closed', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
};

export default function Support() {
  const { token } = useAuth();
  const [view, setView] = useState('list'); // 'list', 'new', 'detail'
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [total, setTotal] = useState(0);
  const [form, setForm] = useState({ category: '', subject: '', message: '' });
  const [replyMessage, setReplyMessage] = useState('');

  const authHeaders = () => ({ Authorization: `Bearer ${token}` });

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/support/tickets`, { headers: { Authorization: `Bearer ${token}` } });
      setTickets(res.data.tickets);
      setTotal(res.data.total);
    } catch {
      toast.error('Failed to load tickets');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.category || !form.subject.trim() || !form.message.trim()) {
      toast.error('Please fill in all fields');
      return;
    }
    setSubmitting(true);
    try {
      await axios.post(`${API}/support/tickets`, form, { headers: authHeaders() });
      toast.success('Ticket submitted! We\'ll get back to you soon.');
      setForm({ category: '', subject: '', message: '' });
      setView('list');
      fetchTickets();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to submit ticket');
    } finally {
      setSubmitting(false);
    }
  };

  const openTicket = async (ticketId) => {
    try {
      const res = await axios.get(`${API}/support/tickets/${ticketId}`, { headers: authHeaders() });
      setSelectedTicket(res.data.ticket);
      setView('detail');
    } catch {
      toast.error('Failed to load ticket');
    }
  };

  const handleReply = async () => {
    if (!replyMessage.trim()) return;
    try {
      await axios.post(`${API}/support/tickets/${selectedTicket.id}/reply`, { message: replyMessage }, { headers: authHeaders() });
      setReplyMessage('');
      // Refresh ticket
      const res = await axios.get(`${API}/support/tickets/${selectedTicket.id}`, { headers: authHeaders() });
      setSelectedTicket(res.data.ticket);
      toast.success('Reply sent');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to send reply');
    }
  };

  const formatDate = (dateStr) => {
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
    return d.toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-background pb-28">
      <div className="max-w-2xl mx-auto px-4 pt-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          {view !== 'list' ? (
            <button onClick={() => { setView('list'); setSelectedTicket(null); }} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Back</span>
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                <HelpCircle className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Support</h1>
                <p className="text-sm text-muted-foreground">{total} ticket{total !== 1 ? 's' : ''}</p>
              </div>
            </div>
          )}
          {view === 'list' && (
            <Button onClick={() => setView('new')} className="rounded-xl gap-2">
              <Plus className="w-4 h-4" />
              New Ticket
            </Button>
          )}
        </div>

        {/* New Ticket Form */}
        {view === 'new' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
              <h2 className="text-lg font-semibold text-foreground">Submit a Support Ticket</h2>

              <div>
                <Label className="text-sm font-medium mb-2 block">Category</Label>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, category: cat.value }))}
                      className={`px-3 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                        form.category === cat.value
                          ? 'bg-primary/20 text-primary border-primary/30'
                          : 'bg-background text-muted-foreground border-border hover:border-primary/30'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="subject" className="text-sm font-medium mb-2 block">Subject</Label>
                <Input
                  id="subject"
                  value={form.subject}
                  onChange={(e) => setForm(f => ({ ...f, subject: e.target.value }))}
                  placeholder="Brief description of your issue"
                  maxLength={200}
                  className="rounded-xl"
                />
              </div>

              <div>
                <Label htmlFor="message" className="text-sm font-medium mb-2 block">Message</Label>
                <Textarea
                  id="message"
                  value={form.message}
                  onChange={(e) => setForm(f => ({ ...f, message: e.target.value }))}
                  placeholder="Describe your issue in detail..."
                  rows={5}
                  maxLength={5000}
                  className="rounded-xl resize-none"
                />
                <p className="text-xs text-muted-foreground mt-1 text-right">{form.message.length}/5000</p>
              </div>

              <Button type="submit" disabled={submitting} className="w-full rounded-xl gap-2">
                {submitting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {submitting ? 'Submitting...' : 'Submit Ticket'}
              </Button>
            </div>
          </form>
        )}

        {/* Ticket List */}
        {view === 'list' && (
          <div className="space-y-3">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : tickets.length === 0 ? (
              <div className="text-center py-16">
                <HelpCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No tickets yet</h3>
                <p className="text-muted-foreground text-sm mb-6">Need help? Submit a support ticket and we'll get back to you.</p>
                <Button onClick={() => setView('new')} className="rounded-xl gap-2">
                  <Plus className="w-4 h-4" />
                  New Ticket
                </Button>
              </div>
            ) : (
              tickets.map((ticket) => {
                const status = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;
                const lastMsg = ticket.messages?.[0];
                return (
                  <button
                    key={ticket.id}
                    onClick={() => openTicket(ticket.id)}
                    className="w-full text-left bg-card border border-border rounded-2xl p-4 hover:border-primary/30 transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${status.color}`}>
                            {status.label}
                          </span>
                          <span className="text-xs text-muted-foreground capitalize">{ticket.category?.replace('_', ' ')}</span>
                        </div>
                        <h3 className="font-medium text-foreground truncate">{ticket.subject}</h3>
                        {lastMsg && (
                          <p className="text-sm text-muted-foreground truncate mt-1">
                            {lastMsg.sender_type === 'admin' ? 'Support: ' : ''}{lastMsg.message}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="text-xs text-muted-foreground">{formatDate(ticket.updated_at)}</span>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        )}

        {/* Ticket Detail */}
        {view === 'detail' && selectedTicket && (
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${(STATUS_CONFIG[selectedTicket.status] || STATUS_CONFIG.open).color}`}>
                  {(STATUS_CONFIG[selectedTicket.status] || STATUS_CONFIG.open).label}
                </span>
                <span className="text-xs text-muted-foreground capitalize">{selectedTicket.category?.replace('_', ' ')}</span>
              </div>
              <h2 className="text-lg font-semibold text-foreground">{selectedTicket.subject}</h2>
              <p className="text-xs text-muted-foreground mt-1">Created {formatDate(selectedTicket.created_at)}</p>
            </div>

            {/* Messages */}
            <div className="space-y-3">
              {selectedTicket.messages?.map((msg) => (
                msg.sender_type === 'system' ? (
                  <div key={msg.id} className="flex items-center gap-3 py-2 px-4">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-xs text-muted-foreground italic">{msg.message}</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                ) : (
                  <div
                    key={msg.id}
                    className={`rounded-2xl p-4 ${
                      msg.sender_type === 'admin'
                        ? 'bg-primary/10 border border-primary/20 ml-4'
                        : 'bg-card border border-border mr-4'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-foreground">
                        {msg.sender_type === 'admin' ? `${msg.sender_name} (Support)` : 'You'}
                      </span>
                      <span className="text-xs text-muted-foreground">{formatDate(msg.created_at)}</span>
                    </div>
                    <p className="text-sm text-foreground/90 whitespace-pre-wrap">{msg.message}</p>
                  </div>
                )
              ))}
            </div>

            {/* Reply box */}
            {selectedTicket.status !== 'closed' && (
              <div className="bg-card border border-border rounded-2xl p-4">
                <Textarea
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  placeholder="Type your reply..."
                  rows={3}
                  maxLength={5000}
                  className="rounded-xl resize-none mb-3"
                />
                <Button onClick={handleReply} disabled={!replyMessage.trim()} className="rounded-xl gap-2">
                  <Send className="w-4 h-4" />
                  Send Reply
                </Button>
              </div>
            )}

            {selectedTicket.status === 'closed' && (
              <div className="text-center py-4 text-sm text-muted-foreground">
                This ticket has been closed. Create a new ticket if you need further help.
              </div>
            )}
          </div>
        )}
      </div>
      <Navigation />
    </div>
  );
}
