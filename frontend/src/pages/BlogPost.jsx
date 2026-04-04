import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Share2, Check, MapPin, Briefcase, Calendar, Clock, ChevronRight } from 'lucide-react';
import { Button } from '../components/ui/button';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PAGE_TYPE_LABELS = {
  jobs_in_city: 'Jobs Guide',
  salary_guide: 'Salary Guide',
  career_guide: 'Career Guide',
  interview_prep: 'Interview Prep',
};

const PAGE_TYPE_COLORS = {
  jobs_in_city: 'bg-blue-500/20 text-blue-400',
  salary_guide: 'bg-green-500/20 text-green-400',
  career_guide: 'bg-purple-500/20 text-purple-400',
  interview_prep: 'bg-orange-500/20 text-orange-400',
};

function markdownToHtml(md) {
  if (!md) return '';
  let html = md
    // Headers (must be before bold processing)
    .replace(/^### (.+)$/gm, '<h3 class="text-xl font-semibold mt-8 mb-3 text-foreground">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-2xl font-bold mt-10 mb-4 text-foreground">$1</h2>')
    // Bold and italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Unordered lists
    .replace(/^- (.+)$/gm, '<li class="ml-4 mb-1">$1</li>')
    // Paragraphs — wrap lines that aren't already HTML tags
    .split('\n')
    .map(line => {
      const trimmed = line.trim();
      if (!trimmed) return '';
      if (trimmed.startsWith('<h') || trimmed.startsWith('<li') || trimmed.startsWith('<ul') || trimmed.startsWith('</')) return trimmed;
      return `<p class="mb-4 leading-relaxed">${trimmed}</p>`;
    })
    .join('\n');

  // Wrap consecutive <li> items in <ul>
  html = html.replace(/((?:<li[^>]*>.*?<\/li>\n?)+)/g, '<ul class="list-disc pl-6 mb-6 space-y-1">$1</ul>');

  return html;
}

export default function BlogPost() {
  const { slug } = useParams();
  const { user } = useAuth();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [shared, setShared] = useState(false);

  useDocumentTitle(post?.meta_title || post?.title || 'Blog Post');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await axios.get(`${API}/blog/posts/${slug}`);
        setPost(data);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  // SEO meta tags
  useEffect(() => {
    if (!post) return;

    const desc = post.meta_description || post.excerpt || '';
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', desc);

    const setMeta = (property, content) => {
      let el = document.querySelector(`meta[property="${property}"]`);
      if (!el) { el = document.createElement('meta'); el.setAttribute('property', property); document.head.appendChild(el); }
      el.setAttribute('content', content);
    };
    setMeta('og:title', `${post.title} | Hireabble`);
    setMeta('og:description', desc);
    setMeta('og:url', window.location.href);
    setMeta('og:type', 'article');

    // JSON-LD Article
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'blog-post-jsonld';
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: post.title,
      description: desc,
      url: `https://hireabble.com/blog/${post.slug}`,
      datePublished: post.published_at,
      dateModified: post.updated_at || post.published_at,
      author: {
        '@type': 'Organization',
        name: 'Hireabble Research Team',
        url: 'https://hireabble.com',
      },
      publisher: {
        '@type': 'Organization',
        name: 'Hireabble',
        url: 'https://hireabble.com',
        logo: { '@type': 'ImageObject', url: 'https://hireabble.com/logo.svg' },
      },
      mainEntityOfPage: { '@type': 'WebPage', '@id': `https://hireabble.com/blog/${post.slug}` },
      wordCount: post.word_count,
    });
    document.head.appendChild(script);
    return () => { document.getElementById('blog-post-jsonld')?.remove(); };
  }, [post]);

  const handleShare = async () => {
    const shareData = { title: post?.title, text: post?.excerpt, url: window.location.href };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      }
    } catch { /* cancelled */ }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8 text-center">
        <h1 className="text-4xl font-bold mb-4">Post Not Found</h1>
        <p className="text-muted-foreground mb-6">This blog post doesn't exist or hasn't been published yet.</p>
        <Link to="/blog">
          <Button>Back to Blog</Button>
        </Link>
      </div>
    );
  }

  const related = post.related_posts || [];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo.svg" alt="Hireabble" className="w-8 h-8 rounded-lg" />
            <span className="text-lg font-bold font-['Outfit']">hireabble</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/blog">
              <Button variant="ghost" size="sm" className="gap-1">
                <ArrowLeft className="w-4 h-4" /> Blog
              </Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={handleShare} className="gap-1">
              {shared ? <><Check className="w-4 h-4" /> Copied</> : <><Share2 className="w-4 h-4" /> Share</>}
            </Button>
            {user ? (
              <Link to={user.role === 'seeker' ? '/dashboard' : '/recruiter'}>
                <Button size="sm" className="bg-gradient-to-r from-primary to-secondary text-white">Dashboard</Button>
              </Link>
            ) : (
              <Link to="/register/seeker">
                <Button size="sm" className="bg-gradient-to-r from-primary to-secondary text-white">Sign Up Free</Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Breadcrumbs */}
      <div className="max-w-4xl mx-auto px-4 pt-6">
        <nav className="flex items-center gap-1 text-sm text-muted-foreground">
          <Link to="/blog" className="hover:text-foreground transition-colors">Blog</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-muted-foreground/60">{PAGE_TYPE_LABELS[post.page_type] || post.page_type}</span>
          <ChevronRight className="w-3 h-3" />
          <span className="text-muted-foreground/60 truncate max-w-[200px]">{post.title}</span>
        </nav>
      </div>

      {/* Article */}
      <article className="max-w-4xl mx-auto px-4 py-8 pb-24">
        {/* Badge */}
        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium mb-4 ${PAGE_TYPE_COLORS[post.page_type] || 'bg-muted text-muted-foreground'}`}>
          {PAGE_TYPE_LABELS[post.page_type] || post.page_type}
        </span>

        {/* Title */}
        <h1 className="text-3xl md:text-4xl font-bold font-['Outfit'] mb-4 text-foreground">
          {post.title}
        </h1>

        {/* Meta info */}
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-8 pb-8 border-b border-border/50">
          {post.city && (
            <span className="flex items-center gap-1">
              <MapPin className="w-4 h-4" /> {post.city}, {post.country}
            </span>
          )}
          {post.role && (
            <span className="flex items-center gap-1">
              <Briefcase className="w-4 h-4" /> {post.role}
            </span>
          )}
          {post.published_at && (
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {new Date(post.published_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </span>
          )}
          {post.word_count && (
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" /> {Math.ceil(post.word_count / 200)} min read
            </span>
          )}
          <span className="text-xs text-muted-foreground/50">By Hireabble Research Team</span>
        </div>

        {/* Content */}
        <div
          className="prose prose-lg max-w-none text-foreground/90"
          dangerouslySetInnerHTML={{ __html: markdownToHtml(post.content) }}
        />

        {/* CTA */}
        <div className="mt-12 p-6 bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20 rounded-xl text-center">
          <h3 className="text-xl font-bold mb-2">
            {post.role && post.city
              ? `Find ${post.role} Jobs in ${post.city}`
              : 'Find Your Next Opportunity'}
          </h3>
          <p className="text-muted-foreground mb-4">
            Hireabble makes job searching easy with swipe-based matching. See relevant jobs in seconds.
          </p>
          <Link to="/register/seeker">
            <Button className="bg-gradient-to-r from-primary to-secondary text-white px-8">
              Get Started — It's Free
            </Button>
          </Link>
        </div>

        {/* Related Posts */}
        {related.length > 0 && (
          <div className="mt-12">
            <h3 className="text-xl font-bold mb-6">Related Articles</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {related.map(rp => (
                <Link
                  key={rp.id || rp.slug}
                  to={`/blog/${rp.slug}`}
                  className="group bg-card border border-border rounded-xl p-4 hover:border-primary/50 transition-all"
                >
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium mb-2 ${PAGE_TYPE_COLORS[rp.page_type] || 'bg-muted text-muted-foreground'}`}>
                    {PAGE_TYPE_LABELS[rp.page_type] || rp.page_type}
                  </span>
                  <h4 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2">
                    {rp.title}
                  </h4>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground/60 mt-2">
                    {rp.city && <span>{rp.city}</span>}
                    {rp.role && <span>{rp.role}</span>}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </article>
    </div>
  );
}
