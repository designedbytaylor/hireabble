/* eslint-disable no-console */
/**
 * Generate frontend/public/sitemap.xml with static URLs + all published blog posts.
 *
 * Runs automatically before `yarn build` (see package.json "prebuild" script) so
 * every Vercel deploy publishes an up-to-date sitemap. Can also be run manually:
 *
 *   REACT_APP_BACKEND_URL=https://your-backend.up.railway.app node scripts/generate-sitemap.js
 *
 * If REACT_APP_BACKEND_URL is missing or the API is unreachable, the script
 * leaves any existing sitemap.xml untouched and exits 0 so it never breaks a
 * build.
 */

const fs = require('fs');
const path = require('path');

const SITE_URL = 'https://hireabble.com';
const OUTPUT_PATH = path.join(__dirname, '..', 'public', 'sitemap.xml');
const BACKEND_URL = (process.env.REACT_APP_BACKEND_URL || '').replace(/\/$/, '');
const PAGE_SIZE = 50;
const MAX_PAGES = 1000; // safety cap (50k URLs)

// Static URLs — keep in sync with src/App.js routes that should be indexed.
const STATIC_URLS = [
  { loc: '/', changefreq: 'weekly', priority: '1.0' },
  { loc: '/browse', changefreq: 'daily', priority: '0.9' },
  { loc: '/blog', changefreq: 'daily', priority: '0.8' },
  { loc: '/tools', changefreq: 'weekly', priority: '0.9' },
  { loc: '/tools/resume-builder', changefreq: 'monthly', priority: '0.8' },
  { loc: '/tools/resume-score', changefreq: 'monthly', priority: '0.8' },
  { loc: '/tools/cover-letter-generator', changefreq: 'monthly', priority: '0.8' },
  { loc: '/tools/salary-calculator', changefreq: 'monthly', priority: '0.8' },
  { loc: '/tools/interview-prep', changefreq: 'monthly', priority: '0.8' },
  { loc: '/tools/job-tracker', changefreq: 'monthly', priority: '0.8' },
  { loc: '/tools/skills-gap', changefreq: 'monthly', priority: '0.8' },
  { loc: '/tools/typing-tune-up', changefreq: 'monthly', priority: '0.7' },
  { loc: '/tools/job-analyzer', changefreq: 'monthly', priority: '0.8' },
  { loc: '/tools/career-gap-explainer', changefreq: 'monthly', priority: '0.7' },
  { loc: '/tools/reference-request', changefreq: 'monthly', priority: '0.7' },
  { loc: '/tools/benefits-calculator', changefreq: 'monthly', priority: '0.8' },
  { loc: '/tools/after-rejection', changefreq: 'monthly', priority: '0.7' },
  { loc: '/tools/job-title-translator', changefreq: 'monthly', priority: '0.7' },
  { loc: '/tools/interview-planner', changefreq: 'monthly', priority: '0.7' },
  { loc: '/tools/work-style-quiz', changefreq: 'monthly', priority: '0.7' },
  { loc: '/tools/equity-calculator', changefreq: 'monthly', priority: '0.7' },
  { loc: '/tools/job-description-generator', changefreq: 'monthly', priority: '0.8' },
  { loc: '/tools/hiring-cost-calculator', changefreq: 'monthly', priority: '0.8' },
  { loc: '/tools/offer-letter', changefreq: 'monthly', priority: '0.7' },
  { loc: '/tools/employer-brand-score', changefreq: 'monthly', priority: '0.7' },
  { loc: '/tools/interview-scorecard', changefreq: 'monthly', priority: '0.7' },
  { loc: '/login', changefreq: 'monthly', priority: '0.7' },
  { loc: '/register', changefreq: 'monthly', priority: '0.7' },
  { loc: '/download', changefreq: 'monthly', priority: '0.6' },
  { loc: '/terms', changefreq: 'yearly', priority: '0.3' },
  { loc: '/privacy', changefreq: 'yearly', priority: '0.3' },
  { loc: '/cookie-policy', changefreq: 'yearly', priority: '0.3' },
];

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function urlEntry({ loc, lastmod, changefreq, priority }) {
  const parts = [`    <loc>${escapeXml(loc)}</loc>`];
  if (lastmod) parts.push(`    <lastmod>${escapeXml(lastmod)}</lastmod>`);
  if (changefreq) parts.push(`    <changefreq>${changefreq}</changefreq>`);
  if (priority) parts.push(`    <priority>${priority}</priority>`);
  return `  <url>\n${parts.join('\n')}\n  </url>`;
}

async function fetchAllPosts() {
  if (!BACKEND_URL) {
    console.warn('[sitemap] REACT_APP_BACKEND_URL not set — skipping blog posts.');
    return null;
  }
  if (typeof fetch !== 'function') {
    console.warn('[sitemap] global fetch unavailable (need Node 18+) — skipping blog posts.');
    return null;
  }

  const posts = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const url = `${BACKEND_URL}/api/blog/posts?page=${page}&limit=${PAGE_SIZE}`;
    let res;
    try {
      res = await fetch(url, { headers: { Accept: 'application/json' } });
    } catch (err) {
      console.warn(`[sitemap] fetch failed for page ${page}: ${err.message}`);
      return null;
    }
    if (!res.ok) {
      console.warn(`[sitemap] ${url} returned ${res.status} — stopping.`);
      return null;
    }
    const data = await res.json();
    const batch = Array.isArray(data.posts) ? data.posts : [];
    posts.push(...batch);
    const totalPages = data.pages || 1;
    if (page >= totalPages || batch.length === 0) break;
  }
  return posts;
}

function buildSitemap(posts) {
  const entries = STATIC_URLS.map(u => urlEntry({ ...u, loc: `${SITE_URL}${u.loc}` }));

  for (const post of posts || []) {
    if (!post.slug) continue;
    entries.push(urlEntry({
      loc: `${SITE_URL}/blog/${post.slug}`,
      lastmod: (post.updated_at || post.published_at || '').split('T')[0] || undefined,
      changefreq: 'monthly',
      priority: '0.6',
    }));
  }

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>\n`;
}

(async () => {
  try {
    const posts = await fetchAllPosts();
    if (posts === null) {
      if (fs.existsSync(OUTPUT_PATH)) {
        console.warn('[sitemap] keeping existing sitemap.xml.');
        return;
      }
      console.warn('[sitemap] writing static-only sitemap (no blog posts available).');
    } else {
      console.log(`[sitemap] fetched ${posts.length} published blog posts.`);
    }
    const xml = buildSitemap(posts);
    fs.writeFileSync(OUTPUT_PATH, xml, 'utf8');
    console.log(`[sitemap] wrote ${OUTPUT_PATH}`);
  } catch (err) {
    console.warn(`[sitemap] generation failed: ${err.message}`);
  }
})();
