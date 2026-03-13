import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>

        <h1 className="text-3xl font-bold font-['Outfit'] mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground mb-8">Last updated: March 13, 2026</p>

        <div className="prose prose-invert max-w-none space-y-6 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-bold font-['Outfit'] mb-3">1. Information We Collect</h2>
            <p className="text-muted-foreground mb-2">We collect information you provide directly:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li><strong>Account Information:</strong> Name, email address, password, phone number</li>
              <li><strong>Profile Information:</strong> Job title, skills, work history, education, certifications, bio, location, photos, videos</li>
              <li><strong>Resume Data:</strong> Information extracted from uploaded PDF resumes</li>
              <li><strong>Job Listings:</strong> Job details, requirements, salary ranges (recruiters)</li>
              <li><strong>Communications:</strong> Messages, interview scheduling details</li>
              <li><strong>Payment Information:</strong> Processed through our payment provider (Stripe); we do not store full card details</li>
            </ul>
            <p className="text-muted-foreground mt-3 mb-2">We automatically collect:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li><strong>Usage Data:</strong> Swipe activity, matches, feature usage, login times</li>
              <li><strong>Device Information:</strong> Browser type, operating system, device identifiers</li>
              <li><strong>Location Data:</strong> Approximate location based on IP address or device location (if permitted)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold font-['Outfit'] mb-3">2. How We Use Your Information</h2>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>To provide and operate the Service, including job matching and communication features</li>
              <li>To personalize your experience and improve match quality</li>
              <li>To process payments and manage subscriptions</li>
              <li>To send push notifications about matches, messages, and interviews</li>
              <li>To detect, prevent, and address fraud, abuse, and security issues</li>
              <li>To comply with legal obligations</li>
              <li>To communicate service updates and promotional offers (with your consent)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold font-['Outfit'] mb-3">3. How We Share Your Information</h2>
            <p className="text-muted-foreground mb-2">We share your information with:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li><strong>Other Users:</strong> Your profile information is visible to other users as part of the matching process. Recruiters can see seeker profiles; seekers can see job listings and recruiter profiles.</li>
              <li><strong>Service Providers:</strong> Third parties that help us operate the Service (hosting, analytics, payment processing, push notifications)</li>
              <li><strong>Legal Requirements:</strong> When required by law, legal process, or to protect our rights and safety</li>
              <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets</li>
            </ul>
            <p className="text-muted-foreground mt-2">We do not sell your personal information to third parties.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold font-['Outfit'] mb-3">4. Data Storage, Security &amp; Retention</h2>
            <p className="text-muted-foreground mb-3">
              We use industry-standard security measures to protect your data, including encryption in transit (TLS/SSL) and secure cloud hosting. However, no method of transmission over the Internet is 100% secure.
            </p>
            <p className="text-muted-foreground mb-2"><strong>Data Retention:</strong></p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li><strong>Active accounts:</strong> Data is retained as long as your account is active</li>
              <li><strong>Deleted accounts:</strong> Upon account deletion, your personal data (profile, photos, messages, swipe history) is permanently deleted within 30 days. Some anonymized, aggregated data may be retained for analytics</li>
              <li><strong>Chat messages:</strong> Messages are deleted when either party deletes their account</li>
              <li><strong>Payment records:</strong> Transaction records are retained for 7 years as required by financial regulations</li>
              <li><strong>Legal holds:</strong> Data may be retained longer if required by law or ongoing legal proceedings</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold font-['Outfit'] mb-3">5. Third-Party Services &amp; SDKs</h2>
            <p className="text-muted-foreground mb-2">We use the following third-party services that may process your data:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li><strong>Stripe:</strong> Payment processing for subscriptions. Stripe collects payment card details directly; we do not store full card numbers. See <a href="https://stripe.com/privacy" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">Stripe's Privacy Policy</a></li>
              <li><strong>Google OAuth:</strong> Optional sign-in via Google account. We receive your name, email, and profile photo. See <a href="https://policies.google.com/privacy" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">Google's Privacy Policy</a></li>
              <li><strong>Web Push (Browser Notifications):</strong> We use the Web Push API to deliver notifications about matches, messages, and interviews. Push subscription tokens are stored on our servers</li>
              <li><strong>OpenStreetMap (Nominatim):</strong> Reverse geocoding for location detection. Your coordinates are sent to the Nominatim service when you use "detect my location"</li>
              <li><strong>Google Fonts:</strong> Web fonts are loaded from Google's CDN. See <a href="https://policies.google.com/privacy" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">Google's Privacy Policy</a></li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold font-['Outfit'] mb-3">6. Tracking &amp; Advertising</h2>
            <p className="text-muted-foreground mb-2">
              <strong>We do not track you across other apps or websites.</strong> Hireabble does not use the Apple IDFA (Identifier for Advertisers), Google Advertising ID, or any cross-app tracking technology. We do not serve third-party advertisements.
            </p>
            <p className="text-muted-foreground">
              We may use first-party analytics (aggregated, non-personally-identifiable data) to improve the Service, such as understanding which features are most used. This data cannot be used to identify individual users.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold font-['Outfit'] mb-3">7. Your Rights and Choices</h2>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li><strong>Access:</strong> You can access your profile data at any time through the app</li>
              <li><strong>Update:</strong> You can update your profile information through your account settings</li>
              <li><strong>Delete:</strong> You can delete your account through Profile &gt; Settings &gt; Delete Account. Upon deletion, all personal data (profile, photos, messages, swipe history, matches) will be permanently removed within 30 days. You will receive a confirmation email when deletion is complete</li>
              <li><strong>Notifications:</strong> You can opt out of push notifications through your device settings</li>
              <li><strong>Data Export:</strong> You can download your profile data as a PDF resume</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold font-['Outfit'] mb-3">8. Children's Privacy</h2>
            <p className="text-muted-foreground">
              Hireabble is not intended for anyone under the age of 18. We do not knowingly collect personal information from children. If we learn we have collected data from a child under 18, we will promptly delete that information.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold font-['Outfit'] mb-3">9. California Privacy Rights (CCPA/CPRA)</h2>
            <p className="text-muted-foreground mb-2">
              If you are a California resident, you have the following rights under the California Consumer Privacy Act (CCPA) and the California Privacy Rights Act (CPRA):
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li><strong>Right to Know:</strong> You may request disclosure of the categories and specific pieces of personal information we have collected about you in the past 12 months</li>
              <li><strong>Right to Delete:</strong> You may request deletion of your personal information. You can do this directly via Profile &gt; Settings &gt; Delete Account, or by emailing us</li>
              <li><strong>Right to Correct:</strong> You may request correction of inaccurate personal information</li>
              <li><strong>Right to Opt Out of Sale/Sharing:</strong> <strong>We do not sell or share your personal information</strong> for cross-context behavioral advertising as defined by the CCPA/CPRA. Because we do not sell or share your data, no opt-out is necessary</li>
              <li><strong>Right to Non-Discrimination:</strong> We will not discriminate against you for exercising any of these rights</li>
            </ul>
            <p className="text-muted-foreground mt-2">
              <strong>Categories of information collected:</strong> Identifiers (name, email), professional information (resume, work history), commercial information (subscription purchases), internet activity (app usage, swipe history), geolocation data (approximate location).
            </p>
            <p className="text-muted-foreground mt-2">
              To exercise your rights, email <a href="mailto:privacy@hireabble.com" className="text-primary hover:underline">privacy@hireabble.com</a> or use the in-app account deletion feature. We will verify your identity and respond within 45 days.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold font-['Outfit'] mb-3">10. International Users (GDPR)</h2>
            <p className="text-muted-foreground">
              If you are in the European Economic Area (EEA), you have rights under GDPR including the right to access, rectify, port, and erase your data, and the right to restrict or object to processing. Our legal basis for processing is contract performance (to provide the Service), legitimate interest (to improve and secure the Service), and consent (for marketing communications).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold font-['Outfit'] mb-3">11. Changes to This Policy</h2>
            <p className="text-muted-foreground">
              We may update this Privacy Policy periodically. We will notify you of material changes by posting the new policy on the app and updating the "Last updated" date. Your continued use of the Service after changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold font-['Outfit'] mb-3">12. Contact Us</h2>
            <p className="text-muted-foreground mb-2">
              For privacy-related questions, data access requests, or to exercise your data rights:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li><strong>Email:</strong> privacy@hireabble.com</li>
              <li><strong>Response time:</strong> We will respond to all privacy requests within 30 days</li>
            </ul>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-border flex gap-4 text-xs text-muted-foreground">
          <Link to="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
          <Link to="/cookie-policy" className="hover:text-foreground transition-colors">Cookie Policy</Link>
        </div>
      </div>
    </div>
  );
}
