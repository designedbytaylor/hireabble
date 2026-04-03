import { useState } from 'react';
import { Mail, Printer } from 'lucide-react';
import { Button } from '../../components/ui/button';
import ToolLayout from './ToolLayout';

export default function OfferLetter() {
  const [inputs, setInputs] = useState({
    candidateName: '', role: '', salary: '', startDate: '',
    benefits: '', companyName: '', signerName: '', signerTitle: '',
  });
  const [generated, setGenerated] = useState(false);

  const set = (k, v) => setInputs(p => ({ ...p, [k]: v }));

  const generate = (e) => {
    e.preventDefault();
    setGenerated(true);
  };

  const today = new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });
  const benefitsList = inputs.benefits.split(',').map(b => b.trim()).filter(Boolean);

  return (
    <ToolLayout title="Offer Letter Generator" description="Generate a professional job offer letter ready to customize and send.">
      <form onSubmit={generate} className="glass-card rounded-2xl p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Candidate Name</label>
            <input className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="Jane Doe" value={inputs.candidateName} onChange={e => set('candidateName', e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Job Title</label>
            <input className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="Software Developer" value={inputs.role} onChange={e => set('role', e.target.value)} required />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Annual Salary (CAD)</label>
            <input className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" type="number" placeholder="85000" value={inputs.salary} onChange={e => set('salary', e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Start Date</label>
            <input className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" type="date" value={inputs.startDate} onChange={e => set('startDate', e.target.value)} required />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Company Name</label>
            <input className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="Acme Corp" value={inputs.companyName} onChange={e => set('companyName', e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Benefits (comma-separated)</label>
            <input className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="Health insurance, RRSP matching, 3 weeks PTO" value={inputs.benefits} onChange={e => set('benefits', e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Signer Name</label>
            <input className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="Taylor Smith" value={inputs.signerName} onChange={e => set('signerName', e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Signer Title</label>
            <input className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="VP of People" value={inputs.signerTitle} onChange={e => set('signerTitle', e.target.value)} required />
          </div>
        </div>
        <Button type="submit" className="w-full">
          <Mail className="w-4 h-4 mr-2" /> Generate Offer Letter
        </Button>
      </form>

      {generated && (
        <div className="mt-6">
          <div className="flex justify-end mb-3">
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="w-3 h-3 mr-1" /> Print / Save as PDF
            </Button>
          </div>
          <div className="glass-card rounded-2xl p-8 printable-area">
            <div className="max-w-2xl mx-auto space-y-6 text-sm leading-relaxed" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              <div className="text-right text-muted-foreground">{today}</div>

              <div>
                <p className="font-semibold">{inputs.candidateName}</p>
              </div>

              <div>
                <p>Dear {inputs.candidateName},</p>
              </div>

              <p>
                We are pleased to offer you the position of <strong>{inputs.role}</strong> at <strong>{inputs.companyName}</strong>. After careful consideration, we believe your skills and experience are an excellent fit for our team.
              </p>

              <div>
                <p className="font-semibold mb-2">Position Details:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li><strong>Title:</strong> {inputs.role}</li>
                  <li><strong>Annual Salary:</strong> ${Number(inputs.salary).toLocaleString()} CAD</li>
                  <li><strong>Start Date:</strong> {inputs.startDate ? new Date(inputs.startDate + 'T12:00:00').toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' }) : '[Start Date]'}</li>
                  <li><strong>Employment Type:</strong> Full-Time, Permanent</li>
                </ul>
              </div>

              {benefitsList.length > 0 && (
                <div>
                  <p className="font-semibold mb-2">Benefits:</p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    {benefitsList.map((b, i) => <li key={i}>{b}</li>)}
                  </ul>
                </div>
              )}

              <p>
                This offer is contingent upon successful completion of any pre-employment requirements. This letter is not a contract of employment and does not guarantee employment for any specific duration. Your employment with {inputs.companyName} will be on an at-will basis.
              </p>

              <p>
                To accept this offer, please sign and return this letter by {new Date(Date.now() + 7 * 86400000).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })}. If you have any questions, please do not hesitate to reach out.
              </p>

              <p>We are excited about the possibility of you joining our team!</p>

              <div className="mt-8">
                <p>Sincerely,</p>
                <div className="mt-6 border-t border-border/50 pt-2 inline-block">
                  <p className="font-semibold">{inputs.signerName}</p>
                  <p className="text-muted-foreground">{inputs.signerTitle}, {inputs.companyName}</p>
                </div>
              </div>

              <div className="mt-12 pt-6 border-t border-border/50">
                <p className="font-semibold mb-4">Acceptance of Offer</p>
                <p>I, {inputs.candidateName}, accept the offer of employment as described above.</p>
                <div className="mt-6 flex gap-12">
                  <div className="flex-1">
                    <div className="border-b border-foreground/30 mb-1 h-8" />
                    <p className="text-xs text-muted-foreground">Signature</p>
                  </div>
                  <div className="w-40">
                    <div className="border-b border-foreground/30 mb-1 h-8" />
                    <p className="text-xs text-muted-foreground">Date</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </ToolLayout>
  );
}
