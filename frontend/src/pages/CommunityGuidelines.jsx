import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import useDocumentTitle from '../hooks/useDocumentTitle';

export default function CommunityGuidelines() {
  useDocumentTitle('Community Guidelines');
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>

        <h1 className="text-3xl font-bold font-['Outfit'] mb-2">Community Guidelines</h1>
        <p className="text-muted-foreground mb-8">Last updated: March 20, 2026</p>

        <div className="prose prose-invert max-w-none space-y-6 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-bold font-['Outfit'] mb-3">Our Mission</h2>
            <p className="text-muted-foreground">
              Hireabble is a professional job-matching platform designed to connect job seekers with recruiters in a respectful, safe, and productive environment. These guidelines apply to all users and all content shared on the platform, including profiles, photos, videos, messages, and job postings.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold font-['Outfit'] mb-3">1. Be Respectful &amp; Professional</h2>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Treat everyone with dignity and respect, regardless of their background, identity, or role</li>
              <li>Do not harass, bully, threaten, intimidate, or stalk other users</li>
              <li>Personal attacks, name-calling, and hostile behavior are not tolerated</li>
              <li>Constructive feedback is welcome; destructive criticism is not</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold font-['Outfit'] mb-3">2. No Discrimination</h2>
            <p className="text-muted-foreground">
              Hireabble has zero tolerance for discrimination based on race, ethnicity, national origin, religion, gender, gender identity, sexual orientation, age, disability, veteran status, or any other protected characteristic. Job postings and hiring decisions must comply with applicable employment laws.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold font-['Outfit'] mb-3">3. Authentic Profiles</h2>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Use your real name and accurate information on your profile</li>
              <li>Profile photos must be of you (job seekers) or your company logo (recruiters)</li>
              <li>Do not impersonate another person or organization</li>
              <li>Do not create multiple accounts</li>
              <li>Misrepresenting qualifications, experience, or company information is prohibited</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold font-['Outfit'] mb-3">4. Appropriate Content</h2>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>No nudity, sexually explicit, or suggestive content</li>
              <li>No violent, graphic, or gory content</li>
              <li>No hate speech, hate symbols, or content promoting extremism</li>
              <li>No drug use or promotion of illegal substances</li>
              <li>No weapons or dangerous items in profile photos</li>
              <li>All photos and videos are automatically screened by AI moderation</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold font-['Outfit'] mb-3">5. Messaging Conduct</h2>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Keep messages professional and relevant to job opportunities</li>
              <li>Do not send spam, unsolicited promotions, or repeated unwanted messages</li>
              <li>Do not request or share personal financial information (bank accounts, SSN, etc.)</li>
              <li>Do not solicit personal relationships outside of professional context</li>
              <li>Messages are monitored for compliance with these guidelines</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold font-['Outfit'] mb-3">6. Job Posting Standards</h2>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Job postings must be for real, legitimate positions</li>
              <li>Do not post misleading or fraudulent job listings</li>
              <li>Compensation details must be accurate and transparent</li>
              <li>Postings requiring upfront payments from applicants are prohibited</li>
              <li>Multi-level marketing (MLM), pyramid schemes, and commission-only positions without disclosure are not allowed</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold font-['Outfit'] mb-3">7. Privacy &amp; Safety</h2>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Do not share other users' personal information without their consent</li>
              <li>Do not screenshot or distribute private messages or profiles outside the platform</li>
              <li>Report any suspicious activity, scams, or safety concerns immediately</li>
              <li>Do not attempt to circumvent platform security or moderation systems</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold font-['Outfit'] mb-3">8. No Spam or Scams</h2>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Do not use Hireabble for phishing, scams, or fraudulent activity</li>
              <li>Do not post links to malware, phishing sites, or malicious content</li>
              <li>Do not use automated tools or bots to interact with the platform</li>
              <li>Do not artificially inflate profile views, matches, or other metrics</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold font-['Outfit'] mb-3">9. Reporting &amp; Enforcement</h2>
            <p className="text-muted-foreground mb-2">
              If you encounter content or behavior that violates these guidelines, please report it using the in-app reporting feature or email us at <a href="mailto:safety@hireabble.com" className="text-primary hover:underline">safety@hireabble.com</a>.
            </p>
            <p className="text-muted-foreground mb-2">
              Violations may result in:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Warning or content removal</li>
              <li>Temporary account suspension</li>
              <li>Permanent account ban</li>
              <li>Reporting to law enforcement where required</li>
            </ul>
            <p className="text-muted-foreground mt-2">
              We review all reports and take action as appropriate. Repeated or severe violations will result in immediate account termination.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold font-['Outfit'] mb-3">10. Contact Us</h2>
            <p className="text-muted-foreground">
              Questions about these guidelines? Contact us at <a href="mailto:safety@hireabble.com" className="text-primary hover:underline">safety@hireabble.com</a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
