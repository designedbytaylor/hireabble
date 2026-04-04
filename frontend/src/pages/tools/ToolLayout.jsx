import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Share2, Check, Link2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { useAuth } from '../../context/AuthContext';

export default function ToolLayout({ title, description, children, seoContent }) {
  const { user } = useAuth();
  const [shared, setShared] = useState(false);
  useDocumentTitle(title);

  useEffect(() => {
    const meta = document.querySelector('meta[name="description"]');
    const prev = meta?.getAttribute('content');
    if (meta) meta.setAttribute('content', description);
    else {
      const tag = document.createElement('meta');
      tag.name = 'description';
      tag.content = description;
      document.head.appendChild(tag);
    }

    // OG tags
    const setMeta = (property, content) => {
      let el = document.querySelector(`meta[property="${property}"]`);
      if (!el) { el = document.createElement('meta'); el.setAttribute('property', property); document.head.appendChild(el); }
      el.setAttribute('content', content);
    };
    setMeta('og:title', `${title} | Hireabble`);
    setMeta('og:description', description);
    setMeta('og:url', window.location.href);
    setMeta('og:type', 'website');

    return () => {
      if (prev && meta) meta.setAttribute('content', prev);
    };
  }, [description, title]);

  const handleShare = async () => {
    const shareData = { title: `${title} — Hireabble`, text: description, url: window.location.href };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      }
    } catch {
      // User cancelled share
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-20 no-print">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/tools" className="flex items-center gap-2">
            <img src="/logo.svg" alt="Hireabble" className="w-8 h-8 rounded-lg" />
            <span className="text-lg font-bold font-['Outfit']">hireabble</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/tools">
              <Button variant="ghost" size="sm" className="gap-1">
                <ArrowLeft className="w-4 h-4" /> All Tools
              </Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={handleShare} className="gap-1">
              {shared ? <><Check className="w-4 h-4" /> Copied</> : <><Share2 className="w-4 h-4" /> Share</>}
            </Button>
            {user ? (
              <Link to={user.role === 'seeker' ? '/dashboard' : '/recruiter'}>
                <Button size="sm" className="bg-gradient-to-r from-primary to-secondary text-white">
                  Dashboard
                </Button>
              </Link>
            ) : (
              <Link to="/register/seeker">
                <Button size="sm" className="bg-gradient-to-r from-primary to-secondary text-white">
                  Sign Up Free
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      <div className="bg-gradient-to-b from-primary/5 to-transparent px-4 py-8 no-print">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-3xl md:text-4xl font-bold font-['Outfit'] mb-2">
            {title}
          </h1>
          <p className="text-muted-foreground">{description}</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 pb-24">
        {children}

        {seoContent && (
          <div className="mt-12 border-t border-border/50 pt-8 no-print">
            <div className="max-w-2xl space-y-3 text-sm text-muted-foreground leading-relaxed">
              {seoContent}
            </div>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 inset-x-0 bg-background/90 backdrop-blur-sm border-t border-border/50 py-3 px-4 no-print">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <p className="text-sm text-muted-foreground hidden sm:block">
            {user ? 'Explore more tools to boost your career.' : 'Ready to find your next opportunity?'}
          </p>
          {user ? (
            <Link to="/tools">
              <Button variant="outline" size="sm">Browse All Tools</Button>
            </Link>
          ) : (
            <Link to="/register/seeker">
              <Button size="sm" className="bg-gradient-to-r from-primary to-secondary text-white">
                Join Hireabble — It's Free
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
