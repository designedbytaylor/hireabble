import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>

        <h1 className="text-3xl font-bold font-['Outfit'] mb-2">Terms of Service</h1>
        <p className="text-muted-foreground mb-8">Last updated: March 13, 2026</p>

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
              You must be at least 18 years old and legally able to enter into contracts to use Hireabble. By using the Service, you represent and warrant that you meet these requirements. Accounts registered by automated means are not permitted.
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
            <p className="text-muted-foreground">
              Hireabble offers free and paid subscription tiers. Paid subscriptions are billed in advance on a recurring basis (weekly, monthly, or semi-annually). You may cancel at any time, but refunds are not provided for partial billing periods. We reserve the right to change subscription pricing with reasonable notice. Free trial periods, if offered, will automatically convert to paid subscriptions unless cancelled before the trial ends.
            </p>
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
            <h2 className="text-lg font-bold font-['Outfit'] mb-3">14. Contact</h2>
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
