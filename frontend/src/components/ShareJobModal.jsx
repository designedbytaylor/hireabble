import { useState } from 'react';
import { Share2, Copy, Check, Printer, ExternalLink } from 'lucide-react';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { toast } from 'sonner';

const SHARE_PLATFORMS = [
  {
    name: 'LinkedIn',
    icon: () => (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
    getUrl: (url, text) =>
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
    color: 'hover:bg-[#0077B5]/10 hover:text-[#0077B5]',
  },
  {
    name: 'X / Twitter',
    icon: () => (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
    getUrl: (url, text) =>
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
    color: 'hover:bg-foreground/10',
  },
  {
    name: 'Facebook',
    icon: () => (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
    getUrl: (url) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    color: 'hover:bg-[#1877F2]/10 hover:text-[#1877F2]',
  },
  {
    name: 'WhatsApp',
    icon: () => (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
    ),
    getUrl: (url, text) =>
      `https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`,
    color: 'hover:bg-[#25D366]/10 hover:text-[#25D366]',
  },
];

export default function ShareJobModal({ job, open, onClose, onPrintPoster }) {
  const [copied, setCopied] = useState(false);

  if (!job) return null;

  const jobUrl = `${window.location.origin}/jobs/${job.id}`;
  const shareText = `We're hiring! ${job.title}${job.company ? ` at ${job.company}` : ''} — Apply now on Hireabble`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jobUrl);
      setCopied(true);
      toast.success('Link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const handleNativeShare = async () => {
    try {
      await navigator.share({ title: shareText, url: jobUrl });
    } catch (err) {
      if (err.name !== 'AbortError') {
        toast.error('Sharing failed');
      }
    }
  };

  const handlePlatformShare = (platform) => {
    const url = platform.getUrl(jobUrl, shareText);
    window.open(url, '_blank', 'noopener,noreferrer,width=600,height=500');
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-['Outfit'] flex items-center gap-2">
            <Share2 className="w-5 h-5 text-primary" />
            Share Job Posting
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Job info */}
          <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
            <p className="font-semibold text-sm">{job.title}</p>
            {job.company && (
              <p className="text-xs text-muted-foreground mt-0.5">{job.company}</p>
            )}
          </div>

          {/* Native share (mobile) */}
          {typeof navigator !== 'undefined' && navigator.share && (
            <Button
              onClick={handleNativeShare}
              className="w-full bg-gradient-to-r from-primary to-secondary text-white"
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </Button>
          )}

          {/* Social platforms */}
          <div className="grid grid-cols-2 gap-2">
            {SHARE_PLATFORMS.map((platform) => {
              const Icon = platform.icon;
              return (
                <button
                  key={platform.name}
                  onClick={() => handlePlatformShare(platform)}
                  className={`flex items-center gap-2.5 p-3 rounded-lg border border-border/50 text-sm font-medium transition-colors ${platform.color}`}
                >
                  <Icon />
                  {platform.name}
                  <ExternalLink className="w-3 h-3 ml-auto opacity-40" />
                </button>
              );
            })}
          </div>

          {/* Print poster */}
          {onPrintPoster && (
            <button
              onClick={() => onPrintPoster(job)}
              className="w-full flex items-center gap-2.5 p-3 rounded-lg border border-border/50 text-sm font-medium transition-colors hover:bg-accent"
            >
              <Printer className="w-5 h-5" />
              Print Hiring Poster
              <span className="ml-auto text-xs text-muted-foreground">PDF with QR code</span>
            </button>
          )}

          {/* Copy link */}
          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border border-border/50">
            <input
              readOnly
              value={jobUrl}
              className="flex-1 bg-transparent text-xs text-muted-foreground truncate outline-none"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={handleCopy}
              className="shrink-0 h-8 px-3"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="ml-1.5 text-xs">{copied ? 'Copied' : 'Copy'}</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
