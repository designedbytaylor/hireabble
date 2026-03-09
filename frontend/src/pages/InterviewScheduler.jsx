import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Calendar, Clock, Video, Phone, MapPin,
  Plus, Check, X, Send, RefreshCw, AlertCircle
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '../components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import { toast } from 'sonner';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Navigation from '../components/Navigation';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const TYPE_ICONS = { video: Video, phone: Phone, in_person: MapPin };
const TYPE_LABELS = { video: 'Video Call', phone: 'Phone Call', in_person: 'In Person' };
const STATUS_COLORS = {
  pending: 'bg-yellow-500/10 text-yellow-500',
  accepted: 'bg-green-500/10 text-green-500',
  declined: 'bg-red-500/10 text-red-500',
  rescheduled: 'bg-blue-500/10 text-blue-500',
  cancelled: 'bg-gray-500/10 text-gray-400',
};

export default function InterviewScheduler() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedMatch = searchParams.get('match');
  const { user, token } = useAuth();
  const [interviews, setInterviews] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(!!preselectedMatch);
  const [selectedInterview, setSelectedInterview] = useState(null);
  const [respondingTo, setRespondingTo] = useState(null);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchData = async () => {
    try {
      const [interviewsRes, matchesRes] = await Promise.all([
        axios.get(`${API}/interviews`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/matches`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      setInterviews(interviewsRes.data);
      setMatches(matchesRes.data);
    } catch (error) {
      console.error('Failed to fetch:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRespond = async (interviewId, action, selectedTimeIndex, message) => {
    try {
      await axios.put(`${API}/interviews/${interviewId}/respond`,
        { action, selected_time_index: selectedTimeIndex, message },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(action === 'accept' ? 'Interview accepted!' : action === 'decline' ? 'Interview declined' : 'Reschedule requested');
      setRespondingTo(null);
      setSelectedInterview(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to respond');
    }
  };

  const handleCancel = async (interviewId) => {
    try {
      await axios.put(`${API}/interviews/${interviewId}/cancel`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Interview cancelled');
      setSelectedInterview(null);
      fetchData();
    } catch (error) {
      toast.error('Failed to cancel interview');
    }
  };

  const upcoming = interviews.filter(i => i.status === 'accepted' && i.selected_time);
  const pending = interviews.filter(i => i.status === 'pending' || i.status === 'rescheduled');
  const past = interviews.filter(i => i.status === 'declined' || i.status === 'cancelled');

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-10 p-6 md:p-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-accent transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold font-['Outfit']">Interviews</h1>
              <p className="text-muted-foreground text-sm">
                {user?.role === 'recruiter' ? 'Schedule and manage interviews' : 'View and manage your interviews'}
              </p>
            </div>
          </div>
          {user?.role === 'recruiter' && (
            <Button
              onClick={() => setShowCreate(true)}
              className="bg-gradient-to-r from-primary to-secondary rounded-full px-5"
            >
              <Plus className="w-5 h-5 mr-2" />
              Schedule
            </Button>
          )}
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="glass-card rounded-2xl p-4 text-center">
            <div className="text-2xl font-bold font-['Outfit'] text-green-500">{upcoming.length}</div>
            <div className="text-xs text-muted-foreground">Upcoming</div>
          </div>
          <div className="glass-card rounded-2xl p-4 text-center">
            <div className="text-2xl font-bold font-['Outfit'] text-yellow-500">{pending.length}</div>
            <div className="text-xs text-muted-foreground">Pending</div>
          </div>
          <div className="glass-card rounded-2xl p-4 text-center">
            <div className="text-2xl font-bold font-['Outfit']">{interviews.length}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </div>
        </div>
      </header>

      <main className="relative z-10 px-6 md:px-8 space-y-8">
        {/* Upcoming Interviews */}
        {upcoming.length > 0 && (
          <section>
            <h2 className="text-lg font-bold font-['Outfit'] mb-3 flex items-center gap-2">
              <Check className="w-5 h-5 text-green-500" /> Upcoming
            </h2>
            <div className="space-y-3">
              {upcoming.map(interview => (
                <InterviewCard
                  key={interview.id}
                  interview={interview}
                  user={user}
                  onClick={() => setSelectedInterview(interview)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Pending */}
        {pending.length > 0 && (
          <section>
            <h2 className="text-lg font-bold font-['Outfit'] mb-3 flex items-center gap-2">
              <Clock className="w-5 h-5 text-yellow-500" /> Awaiting Response
            </h2>
            <div className="space-y-3">
              {pending.map(interview => (
                <InterviewCard
                  key={interview.id}
                  interview={interview}
                  user={user}
                  onClick={() => {
                    if (interview.other_party_id === user?.id) {
                      setRespondingTo(interview);
                    } else {
                      setSelectedInterview(interview);
                    }
                  }}
                  showRespond={interview.other_party_id === user?.id}
                />
              ))}
            </div>
          </section>
        )}

        {/* Past */}
        {past.length > 0 && (
          <section>
            <h2 className="text-lg font-bold font-['Outfit'] mb-3 text-muted-foreground">Past</h2>
            <div className="space-y-3">
              {past.map(interview => (
                <InterviewCard
                  key={interview.id}
                  interview={interview}
                  user={user}
                  onClick={() => setSelectedInterview(interview)}
                />
              ))}
            </div>
          </section>
        )}

        {interviews.length === 0 && (
          <div className="glass-card rounded-3xl p-12 text-center">
            <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-6">
              <Calendar className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-2xl font-bold font-['Outfit'] mb-3">No Interviews Yet</h2>
            <p className="text-muted-foreground max-w-xs mx-auto mb-6">
              {user?.role === 'recruiter'
                ? 'Schedule your first interview with a match to get started.'
                : 'When a recruiter schedules an interview with you, it will appear here.'}
            </p>
            {user?.role === 'recruiter' && (
              <Button onClick={() => setShowCreate(true)} className="bg-gradient-to-r from-primary to-secondary rounded-full">
                <Plus className="w-5 h-5 mr-2" /> Schedule Interview
              </Button>
            )}
          </div>
        )}
      </main>

      {/* Create Interview Dialog */}
      <CreateInterviewDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        matches={matches}
        preselectedMatch={preselectedMatch}
        token={token}
        onSuccess={() => { setShowCreate(false); fetchData(); }}
      />

      {/* View Interview Detail */}
      <Dialog open={!!selectedInterview} onOpenChange={() => setSelectedInterview(null)}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-['Outfit']">{selectedInterview?.title}</DialogTitle>
          </DialogHeader>
          {selectedInterview && (
            <InterviewDetail
              interview={selectedInterview}
              user={user}
              onCancel={() => handleCancel(selectedInterview.id)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Respond Dialog */}
      <RespondDialog
        open={!!respondingTo}
        onClose={() => setRespondingTo(null)}
        interview={respondingTo}
        onRespond={handleRespond}
        token={token}
        onSuccess={fetchData}
      />

      <Navigation />
    </div>
  );
}

function InterviewCard({ interview, user, onClick, showRespond }) {
  const TypeIcon = TYPE_ICONS[interview.interview_type] || Video;
  const isCreator = interview.created_by === user?.id;
  const otherName = isCreator ? '' : interview.created_by_name;
  const selectedTime = interview.selected_time;

  return (
    <div
      onClick={onClick}
      className="glass-card rounded-2xl p-4 hover:border-primary/30 transition-colors cursor-pointer"
    >
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
          <TypeIcon className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-bold font-['Outfit'] truncate">{interview.title}</h3>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[interview.status]}`}>
              {interview.status}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{interview.job_title} at {interview.company}</p>
          {selectedTime && (
            <p className="text-sm text-primary mt-1 flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {new Date(selectedTime.start).toLocaleDateString()} at {new Date(selectedTime.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
          {!selectedTime && interview.proposed_times?.length > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              {interview.proposed_times.length} proposed time{interview.proposed_times.length > 1 ? 's' : ''}
            </p>
          )}
        </div>
      </div>
      {showRespond && (
        <div className="mt-3 pt-3 border-t border-border flex gap-2">
          <Button size="sm" variant="outline" className="flex-1 border-red-500/30 text-red-500 hover:bg-red-500/10 rounded-lg">
            <X className="w-4 h-4 mr-1" /> Decline
          </Button>
          <Button size="sm" className="flex-1 bg-gradient-to-r from-primary to-secondary rounded-lg">
            <Check className="w-4 h-4 mr-1" /> Respond
          </Button>
        </div>
      )}
    </div>
  );
}

function InterviewDetail({ interview, user, onCancel }) {
  const TypeIcon = TYPE_ICONS[interview.interview_type] || Video;
  const canCancel = interview.status !== 'cancelled' && interview.status !== 'declined';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
          <TypeIcon className="w-5 h-5 text-primary" />
        </div>
        <div>
          <div className="text-sm text-muted-foreground">{TYPE_LABELS[interview.interview_type]}</div>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[interview.status]}`}>
            {interview.status}
          </span>
        </div>
      </div>

      {interview.description && (
        <p className="text-sm text-muted-foreground">{interview.description}</p>
      )}

      <div className="p-3 rounded-xl bg-background border border-border">
        <div className="text-xs text-muted-foreground mb-1">Position</div>
        <div className="font-medium">{interview.job_title} at {interview.company}</div>
      </div>

      {interview.selected_time && (
        <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20">
          <div className="text-xs text-green-500 mb-1">Confirmed Time</div>
          <div className="font-medium text-green-500">
            {new Date(interview.selected_time.start).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
          <div className="text-sm text-green-400">
            {new Date(interview.selected_time.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(interview.selected_time.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      )}

      {!interview.selected_time && interview.proposed_times?.length > 0 && (
        <div>
          <div className="text-sm text-muted-foreground mb-2">Proposed Times</div>
          <div className="space-y-2">
            {interview.proposed_times.map((slot, i) => (
              <div key={i} className="p-3 rounded-xl bg-background border border-border">
                <div className="font-medium text-sm">
                  {new Date(slot.start).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(slot.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(slot.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {interview.location && (
        <div className="p-3 rounded-xl bg-background border border-border">
          <div className="text-xs text-muted-foreground mb-1">Location</div>
          <div className="font-medium flex items-center gap-1"><MapPin className="w-3 h-3" /> {interview.location}</div>
        </div>
      )}

      {interview.response_message && (
        <div className="p-3 rounded-xl bg-background border border-border">
          <div className="text-xs text-muted-foreground mb-1">Response</div>
          <div className="text-sm">{interview.response_message}</div>
        </div>
      )}

      {canCancel && (
        <Button
          variant="outline"
          className="w-full border-red-500/30 text-red-500 hover:bg-red-500/10"
          onClick={onCancel}
        >
          Cancel Interview
        </Button>
      )}
    </div>
  );
}

function CreateInterviewDialog({ open, onClose, matches, preselectedMatch, token, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [matchId, setMatchId] = useState(preselectedMatch || '');
  const [description, setDescription] = useState('');
  const [interviewType, setInterviewType] = useState('video');
  const [location, setLocation] = useState('');
  const [timeSlots, setTimeSlots] = useState([{ date: '', startTime: '' }]);

  // Generate 15-min interval time options (6 AM to 9 PM)
  const timeOptions = [];
  for (let h = 6; h <= 21; h++) {
    for (let m = 0; m < 60; m += 15) {
      const hour24 = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      const ampm = h >= 12 ? 'PM' : 'AM';
      const hour12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
      const label = `${hour12}:${String(m).padStart(2, '0')} ${ampm}`;
      timeOptions.push({ value: hour24, label });
    }
  }

  const addTimeSlot = () => {
    if (timeSlots.length < 5) {
      setTimeSlots([...timeSlots, { date: '', startTime: '' }]);
    }
  };

  const removeTimeSlot = (index) => {
    if (timeSlots.length > 1) {
      setTimeSlots(timeSlots.filter((_, i) => i !== index));
    }
  };

  const updateTimeSlot = (index, field, value) => {
    const updated = [...timeSlots];
    updated[index] = { ...updated[index], [field]: value };
    setTimeSlots(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!matchId) {
      toast.error('Please select a match');
      return;
    }

    const validSlots = timeSlots.filter(s => s.date && s.startTime);
    if (validSlots.length === 0) {
      toast.error('Please add at least one time slot');
      return;
    }

    const proposed_times = validSlots.map(s => {
      const start = new Date(`${s.date}T${s.startTime}`);
      const end = new Date(start.getTime() + 60 * 60 * 1000); // Auto 1-hour duration
      return { start: start.toISOString(), end: end.toISOString() };
    });

    setLoading(true);
    try {
      await axios.post(`${API}/interviews`, {
        match_id: matchId,
        description: description || null,
        proposed_times,
        interview_type: interviewType,
        location: location || null,
      }, { headers: { Authorization: `Bearer ${token}` } });

      toast.success('Interview scheduled!');
      onSuccess();
      // Reset form
      setMatchId('');
      setDescription('');
      setTimeSlots([{ date: '', startTime: '' }]);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to schedule interview');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-['Outfit'] text-xl">Schedule Interview</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label>Match *</Label>
            <Select value={matchId} onValueChange={setMatchId}>
              <SelectTrigger className="h-11 rounded-xl bg-background">
                <SelectValue placeholder="Select a match..." />
              </SelectTrigger>
              <SelectContent>
                {matches.map(m => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.seeker_name} — {m.job_title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              placeholder="What to expect, how to prepare..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[80px] rounded-xl bg-background resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={interviewType} onValueChange={setInterviewType}>
                <SelectTrigger className="h-11 rounded-xl bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="video">Video Call</SelectItem>
                  <SelectItem value="phone">Phone Call</SelectItem>
                  <SelectItem value="in_person">In Person</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {interviewType === 'in_person' && (
              <div className="space-y-2">
                <Label>Location</Label>
                <Input
                  placeholder="Office address..."
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="h-11 rounded-xl bg-background"
                />
              </div>
            )}
          </div>

          {/* Time Slots */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Proposed Times *</Label>
              {timeSlots.length < 5 && (
                <button type="button" onClick={addTimeSlot} className="text-xs text-primary hover:underline flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Add time
                </button>
              )}
            </div>
            {timeSlots.map((slot, i) => (
              <div key={i} className="flex gap-2 items-end">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs text-muted-foreground">Date</Label>
                  <Input
                    type="date"
                    value={slot.date}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => updateTimeSlot(i, 'date', e.target.value)}
                    className="h-10 rounded-lg bg-background text-sm"
                    onClick={(e) => e.target.showPicker?.()}
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <Label className="text-xs text-muted-foreground">Time</Label>
                  <Select value={slot.startTime} onValueChange={(val) => updateTimeSlot(i, 'startTime', val)}>
                    <SelectTrigger className="h-10 rounded-lg bg-background text-sm">
                      <SelectValue placeholder="Select time" />
                    </SelectTrigger>
                    <SelectContent className="max-h-48">
                      {timeOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {timeSlots.length > 1 && (
                  <button type="button" onClick={() => removeTimeSlot(i)} className="p-2 text-muted-foreground hover:text-red-500">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-xl bg-gradient-to-r from-primary to-secondary hover:opacity-90 text-lg"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Send className="w-5 h-5 mr-2" /> Send Interview Request
              </>
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RespondDialog({ open, onClose, interview, onRespond, token, onSuccess }) {
  const [selectedTime, setSelectedTime] = useState(null);
  const [message, setMessage] = useState('');
  const [showSuggest, setShowSuggest] = useState(false);
  const [suggestedSlots, setSuggestedSlots] = useState([{ date: '', startTime: '' }]);
  const [suggestLoading, setSuggestLoading] = useState(false);

  // Generate 15-min interval time options (6 AM to 9 PM)
  const timeOptions = [];
  for (let h = 6; h <= 21; h++) {
    for (let m = 0; m < 60; m += 15) {
      const hour24 = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      const ampm = h >= 12 ? 'PM' : 'AM';
      const hour12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
      const label = `${hour12}:${String(m).padStart(2, '0')} ${ampm}`;
      timeOptions.push({ value: hour24, label });
    }
  }

  const addSuggestedSlot = () => {
    if (suggestedSlots.length < 5) {
      setSuggestedSlots([...suggestedSlots, { date: '', startTime: '' }]);
    }
  };

  const removeSuggestedSlot = (index) => {
    if (suggestedSlots.length > 1) {
      setSuggestedSlots(suggestedSlots.filter((_, i) => i !== index));
    }
  };

  const updateSuggestedSlot = (index, field, value) => {
    const updated = [...suggestedSlots];
    updated[index] = { ...updated[index], [field]: value };
    setSuggestedSlots(updated);
  };

  const handleSuggestTimes = async () => {
    const validSlots = suggestedSlots.filter(s => s.date && s.startTime);
    if (validSlots.length === 0) {
      toast.error('Please add at least one suggested time');
      return;
    }

    const proposed_times = validSlots.map(s => {
      const start = new Date(`${s.date}T${s.startTime}`);
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      return { start: start.toISOString(), end: end.toISOString() };
    });

    setSuggestLoading(true);
    try {
      await axios.put(`${API}/interviews/${interview.id}/reschedule`, {
        proposed_times,
        message: message || null,
      }, { headers: { Authorization: `Bearer ${token}` } });

      toast.success('Alternative times suggested! The recruiter will be notified.');
      setShowSuggest(false);
      setSuggestedSlots([{ date: '', startTime: '' }]);
      setMessage('');
      onClose();
      if (onSuccess) onSuccess();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to suggest times');
    } finally {
      setSuggestLoading(false);
    }
  };

  if (!interview) return null;

  return (
    <Dialog open={open} onOpenChange={() => { onClose(); setShowSuggest(false); }}>
      <DialogContent className="max-w-md bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-['Outfit']">Respond to Interview</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-background border border-border">
            <div className="font-bold">{interview.title}</div>
            <div className="text-sm text-muted-foreground">{interview.job_title} at {interview.company}</div>
            <div className="text-sm text-muted-foreground">From: {interview.created_by_name}</div>
            {interview.interview_type && (
              <div className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                {interview.interview_type === 'video' && <Video className="w-3 h-3" />}
                {interview.interview_type === 'phone' && <Phone className="w-3 h-3" />}
                {interview.interview_type === 'in_person' && <MapPin className="w-3 h-3" />}
                {TYPE_LABELS[interview.interview_type]}
                {interview.location && ` — ${interview.location}`}
              </div>
            )}
          </div>

          {interview.description && (
            <p className="text-sm text-muted-foreground">{interview.description}</p>
          )}

          {!showSuggest ? (
            <>
              <div>
                <Label className="mb-2 block">
                  Tap a time slot to select it {selectedTime === null && <span className="text-primary animate-pulse ml-1">(required to accept)</span>}
                </Label>
                <div className="space-y-2">
                  {interview.proposed_times?.map((slot, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setSelectedTime(i)}
                      className={`w-full p-3 rounded-xl border text-left transition-all ${
                        selectedTime === i
                          ? 'border-primary bg-primary/10 ring-2 ring-primary/30'
                          : 'border-border bg-background hover:border-primary/30 hover:bg-primary/5'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                          selectedTime === i ? 'border-primary bg-primary' : 'border-muted-foreground'
                        }`}>
                          {selectedTime === i && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <div>
                          <div className="font-medium text-sm">
                            {new Date(slot.start).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(slot.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(slot.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Message (optional)</Label>
                <Textarea
                  placeholder="Any notes or questions..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="min-h-[60px] rounded-xl bg-background resize-none"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 border-red-500/30 text-red-500 hover:bg-red-500/10"
                  onClick={() => onRespond(interview.id, 'decline', null, message)}
                >
                  <X className="w-4 h-4 mr-1" /> Decline
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 border-blue-500/30 text-blue-500 hover:bg-blue-500/10"
                  onClick={() => setShowSuggest(true)}
                >
                  <RefreshCw className="w-4 h-4 mr-1" /> Suggest
                </Button>
                <Button
                  className="flex-1 bg-gradient-to-r from-primary to-secondary"
                  disabled={selectedTime === null}
                  onClick={() => onRespond(interview.id, 'accept', selectedTime, message)}
                >
                  <Check className="w-4 h-4 mr-1" /> Accept
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <div className="text-sm text-blue-500 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Suggest alternative times that work better for you. The recruiter will review and respond.
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Your Suggested Times *</Label>
                  {suggestedSlots.length < 5 && (
                    <button type="button" onClick={addSuggestedSlot} className="text-xs text-primary hover:underline flex items-center gap-1">
                      <Plus className="w-3 h-3" /> Add time
                    </button>
                  )}
                </div>
                {suggestedSlots.map((slot, i) => (
                  <div key={i} className="flex gap-2 items-end">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs text-muted-foreground">Date</Label>
                      <Input
                        type="date"
                        value={slot.date}
                        min={new Date().toISOString().split('T')[0]}
                        onChange={(e) => updateSuggestedSlot(i, 'date', e.target.value)}
                        className="h-10 rounded-lg bg-background text-sm"
                        onClick={(e) => e.target.showPicker?.()}
                      />
                    </div>
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs text-muted-foreground">Time</Label>
                      <Select value={slot.startTime} onValueChange={(val) => updateSuggestedSlot(i, 'startTime', val)}>
                        <SelectTrigger className="h-10 rounded-lg bg-background text-sm">
                          <SelectValue placeholder="Select time" />
                        </SelectTrigger>
                        <SelectContent className="max-h-48">
                          {timeOptions.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {suggestedSlots.length > 1 && (
                      <button type="button" onClick={() => removeSuggestedSlot(i)} className="p-2 text-muted-foreground hover:text-red-500">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Label>Message (optional)</Label>
                <Textarea
                  placeholder="Let them know why these times work better..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="min-h-[60px] rounded-xl bg-background resize-none"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowSuggest(false)}
                >
                  Back
                </Button>
                <Button
                  className="flex-1 bg-gradient-to-r from-blue-500 to-primary"
                  disabled={suggestLoading}
                  onClick={handleSuggestTimes}
                >
                  {suggestLoading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-1" /> Send Suggestion
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
