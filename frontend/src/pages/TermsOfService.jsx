import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import useDocumentTitle from '../hooks/useDocumentTitle';

export default function TermsOfService() {
  useDocumentTitle('Terms of Service');
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>

        <h1 className="text-3xl font-bold font-['Outfit'] mb-2">Terms of Service</h1>
        <p className="text-muted-foreground mb-8">Last updated: March 14, 2026</p>

        <div className="prose prose-invert max-w-none space-y-6 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-bold font-['Outfit'] mb-3">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground">
              By accessing or using Hireabble ("Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, do not use the Service. We may update these Terms from time to time and your continued use constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold font-['Outfit'] mb-3">2. Eligibility</h2>
            <p className="text-muted-foreground">
              You must be at least 16 years old to use Hireabble. By using the Service, you represent and warrant that you meet this requirement. If you are under the age of majority in your jurisdiction, you confirm that you have your parent or guardian's consent to use the Service. Accounts registered by automated means are not permitted.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold font-['Outfit'] mb-3">3. Your Account</h2>
            <p className="text-muted-foreground">
              You are responsible for maintaining the confidentiality of your login credentials and for all activities under your account. You agree to provide accurate, current, and complete information during registration and to update such information as necessary. We reserve the right to suspend or terminate accounts that contain false information.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold font-['Outfit'] mb-3">4. Use of the Service</h2>
            <p className="text-muted-foreground mb-2">You agree not to:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Use the Service for any unlawful purpose or in violation of any applicable laws</li>
              <li>Post false, misleading, or fraudulent job listings or profile information</li>
              <li>Harass, abuse, or harm other users</li>
              <li>Impersonate any person or entity</li>
              <li>Attempt to gain unauthorized access to accounts, systems, or networks</li>
              <li>Use automated means (bots, scrapers) to access the Service</li>
              <li>Distribute spam, viruses, or malicious code</li>
              <li>Interfere with or disrupt the integrity of the Service</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold font-['Outfit'] mb-3">5. Content</h2>
            <p className="text-muted-foreground">
              You retain ownership of content you submit to Hireabble (resumes, job listings, messages, photos). By posting content, you grant Hireabble a non-exclusive, worldwide, royalty-free license to use, display, and distribute such content as necessary to operate the Service. You are solely responsible for your content and must ensure it does not violate any third-party rights.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold font-['Outfit'] mb-3">6. Subscriptions and Payments</h2>
            <p className="text-muted-foreground mb-3">
              Hireabble offers free and paid subscription tiers. Paid subscriptions are billed in advance on a recurring basis (weekly, monthly, or semi-annually). We reserve the right to change subscription pricing with reasonable notice.
            </p>
            <p className="text-muted-foreground mb-2"><strong>Auto-Renewal:</strong></p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1 mb-3">
              <li>Payment will be charged to your Apple ID account (for iOS app purchases), Google Play account (for Android app purchases), or your payment method on file (for web purchases) at confirmation of purchase.</li>
              <li>Your subscription automatically renews for the same duration and price unless auto-renew is turned off at least 24 hours before the end of the current period.</li>
              <li>Your account will be charged for renewal within 24 hours prior to the end of the current period at the same rate.</li>
              <li>Any unused portion of a free trial period, if offered, will be forfeited when you purchase a subscription.</li>
            </ul>
            <p className="text-muted-foreground mb-2"><strong>Managing Subscriptions:</strong></p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1 mb-3">
              <li>You can manage or cancel your subscription at any time. For iOS, go to Settings &gt; [Your Name] &gt; Subscriptions. For Android, go to Google Play &gt; Subscriptions. For web purchases, manage your subscription in your Hireabble account settings.</li>
              <li>Cancellation takes effect at the end of the current billing period. You will continue to have access to paid features until the period ends.</li>
              <li>Refunds are not provided for partial billing periods, except as required by applicable law or the policies of the platform (Apple App Store, Google Play) through which you purchased the subscription.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold font-['Outfit'] mb-3">7. Matching and Communication</h2>
            <p className="text-muted-foreground">
              Hireabble provides a matching platform connecting job seekers with recruiters. We do not guarantee employment outcomes, the accuracy of user profiles, or the quality of any match. All hiring decisions are made independently by the parties involved. Hireabble is not an employment agency and does not act as an employer or recruiter.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold font-['Outfit'] mb-3">8. Intellectual Property</h2>
            <p className="text-muted-foreground">
              The Hireabble name, logo, features, and design are the exclusive property of Hireabble. You may not copy, modify, distribute, or create derivative works from any part of the Service without our prior written consent. All trademarks, service marks, and trade names are owned by their respective holders.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold font-['Outfit'] mb-3">9. Termination</h2>
            <p className="text-muted-foreground">
              We may suspend or terminate your account at our sole discretion, without prior notice, for conduct that we determine violates these Terms, is harmful to other users, or is otherwise objectionable. You may delete your account at any time through your profile settings. Upon termination, your right to use the Service ceases immediately.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold font-['Outfit'] mb-3">10. Disclaimers</h2>
            <p className="text-muted-foreground">
              THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. HIREABBLE DOES NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE. WE DISCLAIM ALL WARRANTIES INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold font-['Outfit'] mb-3">11. Limitation of Liability</h2>
            <p className="text-muted-foreground">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, HIREABBLE SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF THE SERVICE. OUR TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT YOU PAID TO HIREABBLE IN THE TWELVE MONTHS PRECEDING THE CLAIM.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold font-['Outfit'] mb-3">12. Dispute Resolution</h2>
            <p className="text-muted-foreground">
              Any disputes arising from these Terms or the Service shall be resolved through binding arbitration in accordance with applicable arbitration rules. You agree to waive your right to participate in class action lawsuits or class-wide arbitration. This does not limit your right to bring claims in small claims court.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold font-['Outfit'] mb-3">13. Governing Law</h2>
            <p className="text-muted-foreground">
              These Terms shall be governed by and construed in accordance with the laws of the State of Delaware, United States, without regard to conflict of law principles.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold font-['Outfit'] mb-3">14. Account Deletion</h2>
            <p className="text-muted-foreground mb-2">
              You may delete your account at any time from within the app by navigating to Profile &gt; Delete Account. Upon deletion:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>All personal data (profile, photos, messages, swipe history, matches) will be permanently removed within 30 days.</li>
              <li>If you have an active subscription purchased through the Apple App Store or Google Play, deleting your account does <strong>not</strong> automatically cancel your subscription. You must cancel your subscription separately through your device settings to avoid further charges.</li>
              <li>Transaction records may be retained for up to 7 years as required by financial regulations.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold font-['Outfit'] mb-3">15. End User License Agreement (EULA)</h2>
            <p className="text-muted-foreground mb-3">
              This End User License Agreement ("EULA") is a binding agreement between you and Hireabble governing your use of the Hireabble application ("Licensed Application").
            </p>
            <p className="text-muted-foreground mb-2"><strong>License Grant:</strong></p>
            <p className="text-muted-foreground mb-3">
              Hireabble grants you a limited, non-exclusive, non-transferable, revocable license to use the Licensed Application on any Apple-branded device that you own or control, subject to the Usage Rules set forth in the Apple Media Services Terms and Conditions. This license does not allow you to use the Licensed Application on any device that you do not own or control, and you may not distribute or make the Licensed Application available over a network where it could be used by multiple devices at the same time.
            </p>
            <p className="text-muted-foreground mb-2"><strong>Third-Party Terms:</strong></p>
            <p className="text-muted-foreground mb-3">
              You must comply with applicable third-party terms of agreement when using the Licensed Application, including your wireless data service agreement.
            </p>
            <p className="text-muted-foreground mb-2"><strong>Third-Party Beneficiary:</strong></p>
            <p className="text-muted-foreground mb-3">
              You acknowledge and agree that Apple, and Apple's subsidiaries, are third-party beneficiaries of this EULA, and that, upon your acceptance of the terms and conditions of this EULA, Apple will have the right (and will be deemed to have accepted the right) to enforce this EULA against you as a third-party beneficiary thereof.
            </p>
            <p className="text-muted-foreground mb-2"><strong>Maintenance and Support:</strong></p>
            <p className="text-muted-foreground mb-3">
              Hireabble is solely responsible for providing maintenance and support services for the Licensed Application. Apple has no obligation whatsoever to furnish any maintenance and support services with respect to the Licensed Application.
            </p>
            <p className="text-muted-foreground mb-2"><strong>Warranty:</strong></p>
            <p className="text-muted-foreground mb-3">
              In the event of any failure of the Licensed Application to conform to any applicable warranty, you may notify Apple, and Apple will refund the purchase price (if any) for the Licensed Application. To the maximum extent permitted by applicable law, Apple will have no other warranty obligation whatsoever with respect to the Licensed Application. Any other claims, losses, liabilities, damages, costs, or expenses attributable to any failure to conform to any warranty will be the sole responsibility of Hireabble.
            </p>
            <p className="text-muted-foreground mb-2"><strong>Product Claims:</strong></p>
            <p className="text-muted-foreground mb-3">
              Hireabble, not Apple, is responsible for addressing any claims relating to the Licensed Application or your possession and/or use of the Licensed Application, including but not limited to: (i) product liability claims; (ii) any claim that the Licensed Application fails to conform to any applicable legal or regulatory requirement; and (iii) claims arising under consumer protection, privacy, or similar legislation.
            </p>
            <p className="text-muted-foreground mb-2"><strong>Intellectual Property:</strong></p>
            <p className="text-muted-foreground">
              In the event of any third-party claim that the Licensed Application or your possession and use of the Licensed Application infringes that third party's intellectual property rights, Hireabble, not Apple, will be solely responsible for the investigation, defense, settlement, and discharge of any such intellectual property infringement claim.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold font-['Outfit'] mb-3">16. Contact</h2>
            <p className="text-muted-foreground">
              If you have questions about these Terms, please contact us at legal@hireabble.com.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-border flex gap-4 text-xs text-muted-foreground">
          <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
          <Link to="/cookie-policy" className="hover:text-foreground transition-colors">Cookie Policy</Link>
        </div>
      </div>
    </div>
  );
}
