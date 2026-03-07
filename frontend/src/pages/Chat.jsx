import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Briefcase, User, Wifi, WifiOff, Flag, Calendar, CheckCheck, Check, Image, X } from 'lucide-react';
import ReportDialog from '../components/ReportDialog';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const WS_URL = process.env.REACT_APP_BACKEND_URL?.replace('https://', 'wss://').replace('http://', 'ws://');

export default function Chat() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const messagesEndRef = useRef(null);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const otherPersonId = match
    ? (user?.id === match.seeker_id ? match.recruiter_id : match.seeker_id)
    : null;

  const markAsRead = useCallback(async () => {
    try {
      await axios.post(`${API}/messages/${matchId}/read`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (e) { /* silent */ }
  }, [matchId, token]);

  // WebSocket connection
  const connectWebSocket = useCallback(() => {
    if (!token || wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      wsRef.current = new WebSocket(`${WS_URL}/ws/${token}`);

      wsRef.current.onopen = () => {
        setWsConnected(true);
      };

      wsRef.current.onclose = () => {
        setWsConnected(false);
        reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
      };

      wsRef.current.onerror = () => {};

      wsRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === 'new_message' && data.message.match_id === matchId) {
          setMessages(prev => [...prev, data.message]);
          setOtherTyping(false);
          scrollToBottom();
          markAsRead();
        } else if (data.type === 'message_sent' && data.message.match_id === matchId) {
          setMessages(prev => [...prev, data.message]);
          scrollToBottom();
        } else if (data.type === 'typing' && data.match_id === matchId) {
          setOtherTyping(data.is_typing);
          if (data.is_typing) {
            clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => setOtherTyping(false), 3000);
          }
        } else if (data.type === 'messages_read' && data.match_id === matchId) {
          setMessages(prev => prev.map(m =>
            m.sender_id === user?.id ? { ...m, is_read: true } : m
          ));
        }
      };
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
    }
  }, [token, matchId, scrollToBottom, user?.id, markAsRead]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [matchesRes, messagesRes] = await Promise.all([
          axios.get(`${API}/matches`, { headers: { Authorization: `Bearer ${token}` } }),
          axios.get(`${API}/messages/${matchId}`, { headers: { Authorization: `Bearer ${token}` } })
        ]);

        const currentMatch = matchesRes.data.find(m => m.id === matchId);
        setMatch(currentMatch);
        setMessages(messagesRes.data);
      } catch (error) {
        console.error('Failed to fetch:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    connectWebSocket();

    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [matchId, token, connectWebSocket]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleTyping = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN && otherPersonId) {
      wsRef.current.send(JSON.stringify({
        type: 'typing',
        receiver_id: otherPersonId,
        match_id: matchId,
        is_typing: true
      }));
    }
  }, [otherPersonId, matchId]);

  const handleInputChange = (e) => {
    setNewMessage(e.target.value);
    handleTyping();
  };

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    const hasText = newMessage.trim();
    const hasImage = imagePreview;
    if ((!hasText && !hasImage) || sending) return;

    let messageContent = newMessage.trim();
    if (hasImage) {
      messageContent = messageContent ? `[Image] ${messageContent}` : '[Image shared]';
    }

    setNewMessage('');
    setImagePreview(null);
    setSending(true);

    if (wsRef.current?.readyState === WebSocket.OPEN && otherPersonId) {
      wsRef.current.send(JSON.stringify({
        type: 'typing',
        receiver_id: otherPersonId,
        match_id: matchId,
        is_typing: false
      }));
    }

    try {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'message',
          match_id: matchId,
          content: messageContent
        }));
      } else {
        const response = await axios.post(`${API}/messages`,
          { match_id: matchId, content: messageContent },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setMessages(prev => [...prev, response.data]);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      setNewMessage(messageContent);
    } finally {
      setSending(false);
    }
  };

  const otherPerson = match ? (
    user?.role === 'seeker'
      ? { name: match.recruiter_name, subtitle: match.company }
      : { name: match.seeker_name, subtitle: match.job_title }
  ) : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Group messages by date
  const groupedMessages = [];
  let lastDate = '';
  messages.forEach(msg => {
    const msgDate = new Date(msg.created_at).toLocaleDateString();
    if (msgDate !== lastDate) {
      groupedMessages.push({ type: 'date', date: msgDate, id: `date-${msgDate}` });
      lastDate = msgDate;
    }
    groupedMessages.push({ type: 'message', ...msg });
  });

  return (
    <div className="h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="glass border-b border-border p-4 flex items-center gap-4">
        <button
          onClick={() => navigate('/matches')}
          className="p-2 rounded-xl hover:bg-accent transition-colors"
          data-testid="back-btn"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
            {user?.role === 'seeker' ? (
              <Briefcase className="w-5 h-5 text-white" />
            ) : (
              <User className="w-5 h-5 text-white" />
            )}
          </div>
          <div>
            <h2 className="font-bold font-['Outfit']">{otherPerson?.name}</h2>
            <p className="text-xs text-muted-foreground">
              {otherTyping ? (
                <span className="text-primary animate-pulse">typing...</span>
              ) : (
                otherPerson?.subtitle
              )}
            </p>
          </div>
        </div>

        {user?.role === 'recruiter' && (
          <button
            onClick={() => navigate(`/interviews?match=${matchId}`)}
            className="p-2 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
            title="Schedule interview"
          >
            <Calendar className="w-4 h-4" />
          </button>
        )}

        <button
          onClick={() => setReportOpen(true)}
          className="p-2 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
          title="Report user"
        >
          <Flag className="w-4 h-4" />
        </button>

        <div className={`p-2 rounded-lg ${wsConnected ? 'bg-success/10' : 'bg-muted'}`}>
          {wsConnected ? (
            <Wifi className="w-4 h-4 text-success" />
          ) : (
            <WifiOff className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </header>

      <ReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        reportedType="user"
        reportedId={user?.role === 'seeker' ? match?.recruiter_id : match?.seeker_id}
      />

      {/* Messages */}
      <main className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mb-4">
              <Send className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-bold font-['Outfit'] mb-2">Start the conversation!</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Say hello and introduce yourself. First impressions matter!
            </p>
          </div>
        ) : (
          groupedMessages.map((item, idx) => {
            if (item.type === 'date') {
              return (
                <div key={item.id} className="flex justify-center my-4">
                  <span className="px-3 py-1 rounded-full bg-accent text-xs text-muted-foreground">
                    {item.date === new Date().toLocaleDateString() ? 'Today' : item.date}
                  </span>
                </div>
              );
            }

            const msg = item;
            const isOwn = msg.sender_id === user?.id;
            const isLastOwn = isOwn && (idx === groupedMessages.length - 1 ||
              groupedMessages[idx + 1]?.sender_id !== user?.id);

            return (
              <div
                key={msg.id}
                className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[75%] ${isOwn ? 'order-2' : 'order-1'}`}>
                  <div
                    className={`px-4 py-3 rounded-2xl ${
                      isOwn
                        ? 'bg-gradient-to-r from-primary to-secondary text-white rounded-br-md'
                        : 'bg-card border border-border rounded-bl-md'
                    }`}
                  >
                    <p className="text-sm">{msg.content}</p>
                  </div>
                  <div className={`flex items-center gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                    <p className="text-xs text-muted-foreground">
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    {isOwn && isLastOwn && (
                      msg.is_read ? (
                        <CheckCheck className="w-3.5 h-3.5 text-primary" />
                      ) : (
                        <Check className="w-3.5 h-3.5 text-muted-foreground" />
                      )
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Typing indicator */}
        {otherTyping && (
          <div className="flex justify-start">
            <div className="px-4 py-3 rounded-2xl bg-card border border-border rounded-bl-md">
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* Image Preview */}
      {imagePreview && (
        <div className="px-4 py-2 border-t border-border">
          <div className="relative inline-block">
            <img src={imagePreview} alt="Preview" className="h-20 rounded-lg object-cover" />
            <button
              onClick={() => setImagePreview(null)}
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-destructive flex items-center justify-center"
            >
              <X className="w-3 h-3 text-white" />
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      <footer className="glass border-t border-border p-4">
        <form onSubmit={handleSend} className="flex gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="h-12 w-12 rounded-full bg-accent flex items-center justify-center hover:bg-accent/80 transition-colors flex-shrink-0"
          >
            <Image className="w-5 h-5 text-muted-foreground" />
          </button>
          <Input
            value={newMessage}
            onChange={handleInputChange}
            placeholder="Type a message..."
            className="flex-1 h-12 rounded-full bg-background border-border px-5"
            data-testid="message-input"
          />
          <Button
            type="submit"
            disabled={(!newMessage.trim() && !imagePreview) || sending}
            className="h-12 w-12 rounded-full bg-gradient-to-r from-primary to-secondary p-0"
            data-testid="send-btn"
          >
            <Send className="w-5 h-5" />
          </Button>
        </form>
      </footer>
    </div>
  );
}
