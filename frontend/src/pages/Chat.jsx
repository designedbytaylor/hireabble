import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Briefcase, User, Wifi, WifiOff, Flag, Calendar, CheckCheck, Check, Image, X, Video, Square, Loader2, Clock, Phone, MapPin, FileText } from 'lucide-react';
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
  const [videoPreview, setVideoPreview] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const messagesEndRef = useRef(null);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

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

  const handleVideoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      toast.error('Please select a video file');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast.error('Video must be less than 50MB');
      return;
    }
    setVideoPreview(file);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'video/webm' });
      recordedChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const file = new File([blob], `video-message-${Date.now()}.webm`, { type: 'video/webm' });
        setVideoPreview(file);
        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      // Auto-stop after 60 seconds
      setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          stopRecording();
        }
      }, 60000);
    } catch (err) {
      toast.error('Could not access camera. Check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const uploadAndSendVideo = async () => {
    if (!videoPreview) return null;
    setUploadingVideo(true);
    try {
      const formData = new FormData();
      formData.append('file', videoPreview);
      const res = await axios.post(`${API}/upload/chat-video`, formData, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
      });
      return res.data.url;
    } catch (err) {
      toast.error('Failed to upload video');
      return null;
    } finally {
      setUploadingVideo(false);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    const hasText = newMessage.trim();
    const hasImage = imagePreview;
    const hasVideo = videoPreview;
    if ((!hasText && !hasImage && !hasVideo) || sending) return;

    let messageContent = newMessage.trim();

    // Upload video if present
    if (hasVideo) {
      const videoUrl = await uploadAndSendVideo();
      if (!videoUrl) return;
      messageContent = messageContent ? `[Video: ${videoUrl}] ${messageContent}` : `[Video: ${videoUrl}]`;
    } else if (hasImage) {
      messageContent = messageContent ? `[Image] ${messageContent}` : '[Image shared]';
    }

    setNewMessage('');
    setImagePreview(null);
    setVideoPreview(null);
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

  const handleInterviewRespond = async (interviewId, action, selectedTimeIndex) => {
    try {
      await axios.put(`${API}/interviews/${interviewId}/respond`,
        { action, selected_time_index: selectedTimeIndex },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(action === 'accept' ? 'Interview accepted!' : 'Interview declined');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to respond');
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

            // Special rendering for interview request messages
            if (msg.message_type === 'interview_request') {
              return (
                <InterviewRequestMessage
                  key={msg.id}
                  msg={msg}
                  user={user}
                  isOwn={isOwn}
                  onRespond={handleInterviewRespond}
                  navigate={navigate}
                />
              );
            }

            // Special rendering for reference request messages
            if (msg.message_type === 'reference_request') {
              return (
                <ReferenceRequestMessage
                  key={msg.id}
                  msg={msg}
                  user={user}
                  isOwn={isOwn}
                  token={token}
                />
              );
            }

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
                    {msg.content?.match(/\[Video: (https?:\/\/[^\]]+)\]/) ? (
                      <>
                        <video
                          src={msg.content.match(/\[Video: (https?:\/\/[^\]]+)\]/)[1]}
                          controls
                          playsInline
                          className="rounded-lg max-w-full mb-1"
                          style={{ maxHeight: '200px' }}
                        />
                        {msg.content.replace(/\[Video: https?:\/\/[^\]]+\]\s*/, '').trim() && (
                          <p className="text-sm">{msg.content.replace(/\[Video: https?:\/\/[^\]]+\]\s*/, '').trim()}</p>
                        )}
                      </>
                    ) : (
                      <p className="text-sm">{msg.content}</p>
                    )}
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

      {/* Media Preview */}
      {(imagePreview || videoPreview) && (
        <div className="px-4 py-2 border-t border-border">
          <div className="relative inline-block">
            {imagePreview && (
              <>
                <img src={imagePreview} alt="Preview" className="h-20 rounded-lg object-cover" />
                <button
                  onClick={() => setImagePreview(null)}
                  className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-destructive flex items-center justify-center"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </>
            )}
            {videoPreview && (
              <>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/30">
                  <Video className="w-4 h-4 text-primary" />
                  <span className="text-sm text-primary">{videoPreview.name || 'Recorded video'}</span>
                  <span className="text-xs text-muted-foreground">({(videoPreview.size / (1024 * 1024)).toFixed(1)}MB)</span>
                </div>
                <button
                  onClick={() => setVideoPreview(null)}
                  className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-destructive flex items-center justify-center"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </>
            )}
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
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            onChange={handleVideoSelect}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="h-10 w-10 rounded-full bg-accent flex items-center justify-center hover:bg-accent/80 transition-colors flex-shrink-0"
          >
            <Image className="w-4 h-4 text-muted-foreground" />
          </button>
          {isRecording ? (
            <button
              type="button"
              onClick={stopRecording}
              className="h-10 w-10 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-600 transition-colors flex-shrink-0 animate-pulse"
            >
              <Square className="w-4 h-4 text-white" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (videoPreview) { setVideoPreview(null); return; }
                // Show options: record or upload
                if (navigator.mediaDevices?.getUserMedia) {
                  startRecording();
                } else {
                  videoInputRef.current?.click();
                }
              }}
              onContextMenu={(e) => { e.preventDefault(); videoInputRef.current?.click(); }}
              className="h-10 w-10 rounded-full bg-accent flex items-center justify-center hover:bg-accent/80 transition-colors flex-shrink-0"
              title="Tap to record, long-press to upload"
            >
              <Video className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
          <Input
            value={newMessage}
            onChange={handleInputChange}
            placeholder="Type a message..."
            className="flex-1 h-12 rounded-full bg-background border-border px-5"
            data-testid="message-input"
          />
          <Button
            type="submit"
            disabled={(!newMessage.trim() && !imagePreview && !videoPreview) || sending || uploadingVideo}
            className="h-12 w-12 rounded-full bg-gradient-to-r from-primary to-secondary p-0"
            data-testid="send-btn"
          >
            {uploadingVideo ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </Button>
        </form>
      </footer>
    </div>
  );
}

function InterviewRequestMessage({ msg, user, isOwn, onRespond, navigate }) {
  const [selectedTime, setSelectedTime] = useState(null);
  const [responded, setResponded] = useState(false);
  const [showSuggestTime, setShowSuggestTime] = useState(false);
  const [suggestedDate, setSuggestedDate] = useState('');
  const [suggestedTime, setSuggestedTime] = useState('');
  const interviewId = msg.data?.interview_id;
  const isRecipient = !isOwn; // The seeker receives the interview request
  const interviewStatus = msg.data?.status;

  // Parse proposed times from message content
  const lines = msg.content?.split('\n') || [];
  const titleLine = lines[0] || '';
  const typeLine = lines.find(l => l.startsWith('Type:'));
  const timeLines = lines.filter(l => l.trim().startsWith('- '));

  const handleAccept = async () => {
    if (selectedTime === null || !interviewId) return;
    await onRespond(interviewId, 'accept', selectedTime);
    setResponded(true);
  };

  const handleDecline = async () => {
    if (!interviewId) return;
    await onRespond(interviewId, 'decline', null);
    setResponded(true);
  };

  const handleSuggestNewTime = () => {
    setShowSuggestTime(true);
  };

  const isAlreadyResolved = interviewStatus === 'accepted' || interviewStatus === 'declined';

  return (
    <div className="flex justify-center my-3">
      <div className="w-[90%] max-w-sm rounded-2xl border border-primary/30 bg-card overflow-hidden">
        {/* Header */}
        <div className="bg-primary/10 px-4 py-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm font-['Outfit'] truncate">{titleLine.replace('📅 ', '')}</p>
            {typeLine && <p className="text-xs text-muted-foreground">{typeLine}</p>}
          </div>
          {isAlreadyResolved && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              interviewStatus === 'accepted' ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'
            }`}>
              {interviewStatus === 'accepted' ? 'Accepted' : 'Declined'}
            </span>
          )}
        </div>

        {/* Time slots */}
        <div className="px-4 py-3 space-y-2">
          <p className="text-xs text-muted-foreground font-medium">
            {isRecipient && !responded && !isAlreadyResolved ? 'Select a time to accept:' : 'Proposed times:'}
          </p>
          {timeLines.map((line, i) => (
            <button
              key={i}
              type="button"
              disabled={!isRecipient || responded || isAlreadyResolved}
              onClick={() => setSelectedTime(i)}
              className={`w-full p-2.5 rounded-xl border text-left text-sm transition-colors ${
                selectedTime === i
                  ? 'border-primary bg-primary/10 text-primary'
                  : isRecipient && !responded && !isAlreadyResolved
                    ? 'border-border bg-background hover:border-primary/30'
                    : 'border-border bg-background'
              }`}
            >
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <span>{line.replace(/^\s*-\s*/, '')}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Action buttons for recipient (seeker) - Approve, Deny, Suggest New Time */}
        {isRecipient && !responded && !isAlreadyResolved && (
          <>
            {!showSuggestTime ? (
              <div className="px-4 pb-3 space-y-2">
                <div className="flex gap-2">
                  <button
                    onClick={handleDecline}
                    className="flex-1 py-2.5 rounded-xl border border-red-500/30 text-red-500 text-sm font-medium hover:bg-red-500/10 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <X className="w-4 h-4" /> Deny
                  </button>
                  <button
                    onClick={handleAccept}
                    disabled={selectedTime === null}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
                      selectedTime !== null
                        ? 'bg-gradient-to-r from-primary to-secondary text-white'
                        : 'bg-muted text-muted-foreground cursor-not-allowed'
                    }`}
                  >
                    <Check className="w-4 h-4" /> Approve
                  </button>
                </div>
                <button
                  onClick={handleSuggestNewTime}
                  className="w-full py-2.5 rounded-xl border border-amber-500/30 text-amber-500 text-sm font-medium hover:bg-amber-500/10 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Clock className="w-4 h-4" /> Suggest New Time
                </button>
              </div>
            ) : (
              <div className="px-4 pb-3 space-y-2">
                <p className="text-xs text-muted-foreground font-medium">Suggest an alternative:</p>
                <input
                  type="date"
                  value={suggestedDate}
                  onChange={(e) => setSuggestedDate(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-border bg-background text-sm"
                  min={new Date().toISOString().split('T')[0]}
                />
                <input
                  type="time"
                  value={suggestedTime}
                  onChange={(e) => setSuggestedTime(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-border bg-background text-sm"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowSuggestTime(false)}
                    className="flex-1 py-2.5 rounded-xl border border-border text-muted-foreground text-sm font-medium hover:bg-accent transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      if (!suggestedDate || !suggestedTime) {
                        toast.error('Please select both date and time');
                        return;
                      }
                      // Decline the current request and send a message suggesting new time
                      await onRespond(interviewId, 'decline', null);
                      setResponded(true);
                      setShowSuggestTime(false);
                      // The parent will need to send a follow-up message
                      toast.success(`New time suggested: ${suggestedDate} at ${suggestedTime}. Send a message to confirm.`);
                    }}
                    disabled={!suggestedDate || !suggestedTime}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-white text-sm font-medium disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" /> Send
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* View in interviews link */}
        {interviewId && (
          <div className="px-4 pb-3">
            <button
              onClick={() => navigate('/interviews')}
              className="w-full text-xs text-primary hover:underline text-center"
            >
              View in Interviews
            </button>
          </div>
        )}

        {responded && (
          <div className="px-4 pb-3">
            <div className="py-2 rounded-xl bg-green-500/10 text-green-500 text-sm text-center font-medium">
              Response sent
            </div>
          </div>
        )}

        {/* Timestamp */}
        <div className="px-4 pb-2">
          <p className="text-xs text-muted-foreground text-center">
            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>
    </div>
  );
}

function ReferenceRequestMessage({ msg, user, isOwn, token }) {
  const [responded, setResponded] = useState(false);
  const [responseStatus, setResponseStatus] = useState(null);
  const requestId = msg.data?.request_id;
  const isRecipient = !isOwn; // Seeker receives the reference request
  const recruiterName = msg.data?.recruiter_name || 'A recruiter';
  const company = msg.data?.company || '';

  const handleRespond = async (approve) => {
    if (!requestId) return;
    try {
      await axios.post(`${API}/references/respond/${requestId}`,
        { approve },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setResponded(true);
      setResponseStatus(approve ? 'approved' : 'denied');
      toast.success(approve ? 'References shared!' : 'Request declined');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to respond');
    }
  };

  return (
    <div className="flex justify-center my-3">
      <div className="w-[90%] max-w-sm rounded-2xl border border-secondary/30 bg-card overflow-hidden">
        {/* Header */}
        <div className="bg-secondary/10 px-4 py-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-secondary/20 flex items-center justify-center">
            <FileText className="w-5 h-5 text-secondary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm font-['Outfit']">Reference Request</p>
            <p className="text-xs text-muted-foreground">
              {isOwn ? `You requested references` : `${recruiterName}${company ? ` from ${company}` : ''}`}
            </p>
          </div>
          {responded && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              responseStatus === 'approved' ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'
            }`}>
              {responseStatus === 'approved' ? 'Shared' : 'Declined'}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="px-4 py-3">
          <p className="text-sm text-muted-foreground">
            {isOwn
              ? 'You requested to see their professional references.'
              : 'is requesting to see your professional references.'}
          </p>
        </div>

        {/* Action buttons for recipient (seeker) */}
        {isRecipient && !responded && requestId && (
          <div className="px-4 pb-3 flex gap-2">
            <button
              onClick={() => handleRespond(false)}
              className="flex-1 py-2.5 rounded-xl border border-red-500/30 text-red-500 text-sm font-medium hover:bg-red-500/10 transition-colors flex items-center justify-center gap-1.5"
            >
              <X className="w-4 h-4" /> Deny
            </button>
            <button
              onClick={() => handleRespond(true)}
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-primary to-secondary text-white text-sm font-medium transition-colors flex items-center justify-center gap-1.5 hover:opacity-90"
            >
              <Check className="w-4 h-4" /> Approve
            </button>
          </div>
        )}

        {/* Timestamp */}
        <div className="px-4 pb-2">
          <p className="text-xs text-muted-foreground text-center">
            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>
    </div>
  );
}
