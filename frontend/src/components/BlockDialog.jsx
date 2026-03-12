import { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import { ShieldBan } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function BlockDialog({ open, onOpenChange, blockedUserId, blockedUserName, onBlockSuccess }) {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleBlock = async () => {
    setLoading(true);
    try {
      await axios.post(`${API}/users/block/${blockedUserId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('User blocked');
      onOpenChange(false);
      onBlockSuccess?.();
    } catch {
      toast.error('Failed to block user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-['Outfit']">
            <ShieldBan className="w-5 h-5 text-red-500" />
            Block {blockedUserName || 'User'}?
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          They won't be able to see your profile, send you messages, or appear in your matches. You can unblock them later from your settings.
        </p>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
            Cancel
          </Button>
          <Button
            onClick={handleBlock}
            disabled={loading}
            className="rounded-xl bg-red-600 hover:bg-red-700 text-white"
          >
            {loading ? 'Blocking...' : 'Block'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
