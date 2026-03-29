import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import useDocumentTitle from '../hooks/useDocumentTitle';

export default function CookiePolicy() {
  useDocumentTitle('Cookie Policy');
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>

        <h1 className="text-3xl font-bold font-['Outfit'] mb-2">Cookie Policy</h1>
        <p className="text-muted-foreground mb-8">Last updated: March 29, 2026</p>

        <div className="prose prose-invert max-w-none space-y-6 text-sm leading-relaxed">
          <section>
            <p className="text-muted-foreground mb-4">
              This Cookie Policy explains how Hireabble Inc. ("Company", "we", "us", "our") uses cookies and similar technologies on the Hireabble application and website ("Service").
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold font-['Outfit'] mb-3">1. What Are Cookies</h2>
            <p className="text-muted-foreground">
              Cookies are small text files stored on your device when you visit a website or use an app. They help us provide a better experience by remembering your preferences and login state. We also use similar technologies such as local storage and session storage.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold font-['Outfit'] mb-3">2. How We Use Cookies</h2>
            <p className="text-muted-foreground mb-3">We use the following types of cookies and storage:</p>

            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-card border border-border">
                <h3 className="font-semibold mb-1">Essential Cookies</h3>
                <p className="text-muted-foreground text-xs">
                  Required for the Service to function. These include authentication tokens (to keep you logged in) and session data. Without these, you cannot use Hireabble.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-card border border-border">
                <h3 className="font-semibold mb-1">Functional Storage</h3>
                <p className="text-muted-foreground text-xs">
                  We use browser local storage to cache your profile data for faster page loads and to store your theme preferences. This data stays on your device and is cleared when you log out.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-card border border-border">
                <h3 className="font-semibold mb-1">Push Notification Tokens</h3>
                <p className="text-muted-foreground text-xs">
                  If you opt in to push notifications, we store a push subscription token to send you real-time updates about matches, messages, and interviews. You can disable this through your device settings.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold font-['Outfit'] mb-3">3. Third-Party Cookies</h2>
            <p className="text-muted-foreground">
              Our payment processor (Stripe) may set cookies during payment transactions. These cookies are governed by Stripe's own privacy policy. We do not use advertising cookies or tracking pixels from ad networks.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold font-['Outfit'] mb-3">4. Managing Cookies</h2>
            <p className="text-muted-foreground">
              You can manage or delete cookies through your browser settings. Note that disabling essential cookies will prevent you from using the Service. Most browsers allow you to:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1 mt-2">
              <li>View and delete individual cookies</li>
              <li>Block cookies from specific sites</li>
              <li>Block all third-party cookies</li>
              <li>Clear all cookies when you close your browser</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold font-['Outfit'] mb-3">5. Updates</h2>
            <p className="text-muted-foreground">
              We may update this Cookie Policy to reflect changes in our practices. We encourage you to review this page periodically.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold font-['Outfit'] mb-3">6. Contact</h2>
            <p className="text-muted-foreground">
              For questions about our use of cookies, contact us at privacy@hireabble.com.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-border flex gap-4 text-xs text-muted-foreground">
          <Link to="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
          <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
        </div>
      </div>
    </div>
  );
}
