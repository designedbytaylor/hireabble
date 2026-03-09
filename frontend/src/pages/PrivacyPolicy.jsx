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
        <p className="text-muted-foreground mb-8">Last updated: March 9, 2026</p>

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
            <h2 className="text-lg font-bold font-['Outfit'] mb-3">4. Data Storage and Security</h2>
            <p className="text-muted-foreground">
              We use industry-standard security measures to protect your data, including encryption in transit (TLS/SSL) and secure cloud hosting. However, no method of transmission over the Internet is 100% secure. Your data is stored on secure servers and retained as long as your account is active or as needed to provide the Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold font-['Outfit'] mb-3">5. Your Rights and Choices</h2>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li><strong>Access:</strong> You can access your profile data at any time through the app</li>
              <li><strong>Update:</strong> You can update your profile information through your account settings</li>
              <li><strong>Delete:</strong> You can delete your account through profile settings, which will remove your personal data</li>
              <li><strong>Notifications:</strong> You can opt out of push notifications through your device settings</li>
              <li><strong>Data Export:</strong> You can download your profile data as a PDF resume</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold font-['Outfit'] mb-3">6. Children's Privacy</h2>
            <p className="text-muted-foreground">
              Hireabble is not intended for anyone under the age of 18. We do not knowingly collect personal information from children. If we learn we have collected data from a child under 18, we will promptly delete that information.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold font-['Outfit'] mb-3">7. California Privacy Rights (CCPA)</h2>
            <p className="text-muted-foreground">
              California residents have the right to know what personal information is collected, request deletion of personal information, and opt out of the sale of personal information. We do not sell personal information. To exercise these rights, contact us at privacy@hireabble.com.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold font-['Outfit'] mb-3">8. International Users (GDPR)</h2>
            <p className="text-muted-foreground">
              If you are in the European Economic Area (EEA), you have rights under GDPR including the right to access, rectify, port, and erase your data, and the right to restrict or object to processing. Our legal basis for processing is contract performance (to provide the Service), legitimate interest (to improve and secure the Service), and consent (for marketing communications).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold font-['Outfit'] mb-3">9. Changes to This Policy</h2>
            <p className="text-muted-foreground">
              We may update this Privacy Policy periodically. We will notify you of material changes by posting the new policy on the app and updating the "Last updated" date. Your continued use of the Service after changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold font-['Outfit'] mb-3">10. Contact Us</h2>
            <p className="text-muted-foreground">
              For privacy-related questions or to exercise your data rights, contact us at privacy@hireabble.com.
            </p>
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
