import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Briefcase, User } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Chat() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const pollInterval = useRef(null);

  useEffect(() => {
    fetchMatchAndMessages();
    // Poll for new messages every 3 seconds
    pollInterval.current = setInterval(fetchMessages, 3000);
    return () => clearInterval(pollInterval.current);
  }, [matchId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchMatchAndMessages = async () => {
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

  const fetchMessages = async () => {
    try {
      const response = await axios.get(`${API}/messages/${matchId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessages(response.data);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      await axios.post(`${API}/messages`, 
        { match_id: matchId, content: newMessage.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setNewMessage('');
      fetchMessages();
    } catch (error) {
      console.error('Failed to send message:', error);
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
      </header>

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
