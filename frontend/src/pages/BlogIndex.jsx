import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Search, ChevronLeft, ChevronRight, MapPin, Briefcase, Calendar } from 'lucide-react';
import { Button } from '../components/ui/button';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PAGE_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'jobs_in_city', label: 'Jobs in City' },
  { value: 'salary_guide', label: 'Salary Guide' },
  { value: 'career_guide', label: 'Career Guide' },
  { value: 'interview_prep', label: 'Interview Prep' },
];

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

export default function BlogIndex() {
  useDocumentTitle('Blog — Career Guides, Salary Data & Job Market Insights');
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [typeFilter, setTypeFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 12 };
      if (typeFilter) params.page_type = typeFilter;
      const { data } = await axios.get(`${API}/blog/posts`, { params });
      setPosts(data.posts || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [page, typeFilter]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);
  useEffect(() => { setPage(1); }, [typeFilter]);

  // SEO meta tags
  useEffect(() => {
    const desc = 'Explore career guides, salary data, interview tips, and job market insights for cities across Canada and the US. Free resources from Hireabble.';
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', desc);

    const setMeta = (property, content) => {
      let el = document.querySelector(`meta[property="${property}"]`);
      if (!el) { el = document.createElement('meta'); el.setAttribute('property', property); document.head.appendChild(el); }
      el.setAttribute('content', content);
    };
    setMeta('og:title', 'Blog — Hireabble');
    setMeta('og:description', desc);
    setMeta('og:url', window.location.href);
    setMeta('og:type', 'website');

    // JSON-LD
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'blog-jsonld';
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Blog',
      name: 'Hireabble Blog',
      description: desc,
      url: 'https://hireabble.com/blog',
      publisher: {
        '@type': 'Organization',
        name: 'Hireabble',
        url: 'https://hireabble.com',
      },
    });
    document.head.appendChild(script);
    return () => { document.getElementById('blog-jsonld')?.remove(); };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo.svg" alt="Hireabble" className="w-8 h-8 rounded-lg" />
            <span className="text-lg font-bold font-['Outfit']">hireabble</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/tools">
              <Button variant="ghost" size="sm">Free Tools</Button>
            </Link>
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

      {/* Hero */}
      <div className="bg-gradient-to-b from-primary/5 to-transparent px-4 py-10">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-3xl md:text-4xl font-bold font-['Outfit'] mb-3">Career Insights & Guides</h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Salary guides, job market insights, career paths, and interview tips for cities across Canada and the US.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-6xl mx-auto px-4 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-2">
            {PAGE_TYPES.map(pt => (
              <button
                key={pt.value}
                onClick={() => setTypeFilter(pt.value)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  typeFilter === pt.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                }`}
              >
                {pt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Posts Grid */}
      <div className="max-w-6xl mx-auto px-4 pb-20">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-6 animate-pulse">
                <div className="h-4 bg-muted rounded w-20 mb-3" />
                <div className="h-6 bg-muted rounded w-full mb-2" />
                <div className="h-4 bg-muted rounded w-3/4 mb-4" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-lg">No blog posts found.</p>
            <p className="text-muted-foreground/60 text-sm mt-1">Check back soon for new content.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {posts.map(post => (
                <Link
                  key={post.id || post.slug}
                  to={`/blog/${post.slug}`}
                  className="group bg-card border border-border rounded-xl p-6 hover:border-primary/50 hover:shadow-lg transition-all"
                >
                  {/* Type badge */}
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium mb-3 ${PAGE_TYPE_COLORS[post.page_type] || 'bg-muted text-muted-foreground'}`}>
                    {PAGE_TYPE_LABELS[post.page_type] || post.page_type}
                  </span>

                  {/* Title */}
                  <h2 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors mb-2 line-clamp-2">
                    {post.title}
                  </h2>

                  {/* Excerpt */}
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                    {post.excerpt}
                  </p>

                  {/* Meta */}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground/60">
                    {post.city && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {post.city}
                      </span>
                    )}
                    {post.role && (
                      <span className="flex items-center gap-1">
                        <Briefcase className="w-3 h-3" /> {post.role}
                      </span>
                    )}
                    {post.published_at && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(post.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {pages > 1 && (
              <div className="flex items-center justify-center gap-4 mt-10">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-lg bg-muted/50 hover:bg-muted disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-sm text-muted-foreground">
                  Page {page} of {pages} ({total} posts)
                </span>
                <button
                  onClick={() => setPage(p => Math.min(pages, p + 1))}
                  disabled={page === pages}
                  className="p-2 rounded-lg bg-muted/50 hover:bg-muted disabled:opacity-30 transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* CTA Footer */}
      {!user && (
        <div className="fixed bottom-0 inset-x-0 bg-background/90 backdrop-blur-sm border-t border-border/50 py-3 px-4">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <p className="text-sm text-muted-foreground hidden sm:block">
              Ready to find your next opportunity?
            </p>
            <Link to="/register/seeker">
              <Button size="sm" className="bg-gradient-to-r from-primary to-secondary text-white">
                Join Hireabble — It's Free
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
