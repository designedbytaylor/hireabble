import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Briefcase, User, Wifi, WifiOff, Flag, Calendar } from 'lucide-react';
import ReportDialog from '../components/ReportDialog';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

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
  const messagesEndRef = useRef(null);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // WebSocket connection
  const connectWebSocket = useCallback(() => {
    if (!token || wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      wsRef.current = new WebSocket(`${WS_URL}/ws/${token}`);

      wsRef.current.onopen = () => {
        console.log('WebSocket connected');
        setWsConnected(true);
      };

      wsRef.current.onclose = () => {
        console.log('WebSocket disconnected');
        setWsConnected(false);
        // Reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      wsRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === 'new_message' && data.message.match_id === matchId) {
          setMessages(prev => [...prev, data.message]);
          scrollToBottom();
        } else if (data.type === 'message_sent' && data.message.match_id === matchId) {
          setMessages(prev => [...prev, data.message]);
          scrollToBottom();
        }
      };
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
    }
  }, [token, matchId, scrollToBottom]);

  // Fetch initial data
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
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [matchId, token, connectWebSocket]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    const messageContent = newMessage.trim();
    setNewMessage('');
    setSending(true);

    try {
      // Try WebSocket first
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'message',
          match_id: matchId,
          content: messageContent
        }));
      } else {
        // Fallback to HTTP
        const response = await axios.post(`${API}/messages`, 
          { match_id: matchId, content: messageContent },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setMessages(prev => [...prev, response.data]);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      setNewMessage(messageContent); // Restore message on error
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
            <p className="text-xs text-muted-foreground">{otherPerson?.subtitle}</p>
          </div>
        </div>

        <button
          onClick={() => navigate(`/interviews?match=${matchId}`)}
          className="p-2 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
          title="Schedule interview"
        >
          <Calendar className="w-4 h-4" />
        </button>

        <button
          onClick={() => setReportOpen(true)}
          className="p-2 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
          title="Report user"
        >
          <Flag className="w-4 h-4" />
        </button>

        {/* Connection status */}
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
      <main className="flex-1 overflow-y-auto p-4 space-y-4">
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
          messages.map((msg) => {
            const isOwn = msg.sender_id === user?.id;
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
                  <p className={`text-xs text-muted-foreground mt-1 ${isOwn ? 'text-right' : 'text-left'}`}>
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* Input */}
      <footer className="glass border-t border-border p-4">
        <form onSubmit={handleSend} className="flex gap-3">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 h-12 rounded-full bg-background border-border px-5"
            data-testid="message-input"
          />
          <Button
            type="submit"
            disabled={!newMessage.trim() || sending}
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
