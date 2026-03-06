import { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from './ui/dialog';
import { Flag } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const REPORT_REASONS = [
  'Inappropriate content',
  'Spam or scam',
  'Harassment or bullying',
  'Fake profile or listing',
  'Discrimination',
  'Other',
];

export default function ReportDialog({ open, onOpenChange, reportedType, reportedId }) {
  const { token } = useAuth();
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!reason) {
      toast.error('Please select a reason');
      return;
    }
    setLoading(true);
    try {
      await axios.post(`${API}/reports`, {
        reported_type: reportedType,
        reported_id: reportedId,
        reason,
        details: details || null,
      }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Report submitted. We\'ll review it shortly.');
      onOpenChange(false);
      setReason('');
      setDetails('');
    } catch (e) {
      toast.error('Failed to submit report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-background border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="w-5 h-5 text-red-500" />
            Report {reportedType}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            {REPORT_REASONS.map((r) => (
              <button
                key={r}
                onClick={() => setReason(r)}
                className={`w-full text-left px-4 py-3 rounded-xl text-sm transition-all ${
                  reason === r
                    ? 'bg-primary/20 text-primary border border-primary/30'
                    : 'bg-accent/50 text-foreground hover:bg-accent border border-transparent'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          <Input
            placeholder="Additional details (optional)"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            className="bg-accent/50 border-border"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !reason}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {loading ? 'Submitting...' : 'Submit Report'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
