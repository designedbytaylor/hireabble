import { useState } from 'react';
import { Heart, Copy, Check, RefreshCw } from 'lucide-react';
import { Button } from '../../components/ui/button';
import ToolLayout from './ToolLayout';

const STAGES = [
  { value: 'application', label: 'After Application' },
  { value: 'phone', label: 'After Phone Screen' },
  { value: 'interview', label: 'After Interview' },
  { value: 'final', label: 'After Final Round' },
  { value: 'offer', label: 'After Offer Negotiation' },
];

const REASONS = [
  { value: 'filled', label: 'Position filled' },
  { value: 'another', label: 'Went with another candidate' },
  { value: 'experience', label: 'Not enough experience' },
  { value: 'culture', label: 'Culture fit' },
  { value: 'salary', label: 'Salary mismatch' },
  { value: 'unknown', label: 'Unknown / Not provided' },
];

const ENCOURAGING_STATS = [
  'The average job seeker applies to 100-200 positions before landing a role. Every "no" brings you closer to your "yes."',
  'Studies show that 75% of job seekers face rejection before finding the right fit. You are not alone in this.',
  'Many successful professionals were rejected from their dream companies, only to find even better opportunities elsewhere.',
  'On average, a corporate job posting attracts 250 resumes. Being considered at all puts you ahead of most applicants.',
  'Research shows that resilience in job searching is the single biggest predictor of landing a great role.',
];

function generateEmail({ stage, reason, askFeedback, company, role }) {
  const companyName = company || '[Company]';
  const roleName = role || '[Role]';
  let greeting = `Dear Hiring Team at ${companyName},`;
  let opening = '';
  let body = '';
  let feedbackAsk = '';
  let closing = '';

  switch (stage) {
    case 'application':
      opening = `Thank you for letting me know about the status of my application for the ${roleName} position.`;
      body = `I appreciate you taking the time to review my application and getting back to me. I understand how competitive the hiring process can be, and I respect your decision.`;
      break;
    case 'phone':
      opening = `Thank you for the update regarding the ${roleName} position and for taking the time to speak with me during our phone conversation.`;
      body = `I enjoyed learning more about ${companyName} and the team. While I'm disappointed to hear this news, I genuinely appreciate the time you invested in our conversation.`;
      break;
    case 'interview':
      opening = `Thank you for informing me about your decision regarding the ${roleName} role. I truly valued the opportunity to interview with your team.`;
      body = `The conversations I had during the interview process gave me a great appreciation for the work being done at ${companyName}. I was impressed by the team's passion and the company's direction.`;
      break;
    case 'final':
      opening = `Thank you for letting me know about the outcome of the ${roleName} position. Having gone through the full interview process, I have deep respect for your team and the thoughtfulness of your hiring approach.`;
      body = `I invested a lot of heart in this process because I genuinely believe in what ${companyName} is building. While this is hard to hear, I understand that these decisions are never easy on your end either.`;
      break;
    case 'offer':
      opening = `Thank you for the candid conversations around the ${roleName} offer. I appreciate the time and consideration your team put into the negotiation process.`;
      body = `I have great respect for ${companyName} and understand that compensation structures have many factors. I hope we might find alignment in the future as circumstances evolve.`;
      break;
    default:
      opening = `Thank you for the update regarding the ${roleName} position at ${companyName}.`;
      body = `I appreciate your time and consideration throughout the process.`;
  }

  if (askFeedback) {
    feedbackAsk = `\n\nIf you have a moment, I would be very grateful for any feedback you could share about my ${stage === 'application' ? 'application' : stage === 'phone' ? 'phone screen' : 'interview performance'}. Understanding where I can improve would be incredibly valuable to me as I continue my search.`;
  }

  closing = `\n\nI remain very interested in ${companyName} and would love to be considered for future opportunities that might be a good fit. Please don't hesitate to reach out if anything comes up.\n\nWishing you and the team all the best.\n\nWarm regards,\n[Your Name]`;

  return `${greeting}\n\n${opening}\n\n${body}${feedbackAsk}${closing}`;
}

function getNextSteps(reason) {
  const steps = {
    filled: [
      'Ask the recruiter to keep you in mind for future openings at the company.',
      'Connect with the hiring manager on LinkedIn with a brief, warm note.',
      'Set a Google Alert for new job postings at the company so you can apply early next time.',
      'Apply to similar roles at competing companies while the market is active.',
    ],
    another: [
      'Request specific feedback on what the successful candidate brought to the table.',
      'Review your interview answers and identify areas where you could have been more specific or impactful.',
      'Practice telling your story more concisely using the STAR method.',
      'Strengthen your portfolio or case studies to showcase measurable results.',
    ],
    experience: [
      'Identify the specific skills or experience gaps mentioned and create a 90-day learning plan.',
      'Look for contract or freelance work that could help you build the missing experience.',
      'Consider applying for a role one level below to get your foot in the door at similar companies.',
      'Take relevant online courses or certifications and add them to your resume.',
      'Contribute to open-source projects or volunteer work related to the role.',
    ],
    culture: [
      'Reflect honestly on the company culture signals you noticed during interviews. Was it truly a match for you?',
      'Research company culture more deeply before future interviews (Glassdoor, LinkedIn, team content).',
      'Practice articulating your work style and values more clearly in interviews.',
      'Remember: culture fit is mutual. A mismatch here might have led to unhappiness down the road.',
    ],
    salary: [
      'Research market rates more thoroughly using tools like our Salary Calculator before your next negotiation.',
      'Consider whether the total compensation package (benefits, equity, flexibility) changes the picture.',
      'Practice salary negotiation conversations with a trusted friend or mentor.',
      'Think about what your true minimum is and whether there is room for creative compensation structures.',
    ],
    unknown: [
      'Follow up politely in 1-2 weeks to ask if any feedback is available.',
      'Review your resume and cover letter for the role. Could they have been more tailored?',
      'Ask a mentor or career coach to do a mock interview and give honest feedback.',
      'Keep applying. Without specific feedback, the best strategy is volume and consistency.',
      'Journal what went well and what felt uncertain in each stage to build self-awareness.',
    ],
  };
  return steps[reason] || steps.unknown;
}

function getWhatToDoDifferently(reason) {
  const advice = {
    filled: 'This one likely had nothing to do with you. Positions sometimes get filled internally or by candidates already deep in the process. Focus your energy on new opportunities rather than dwelling on this outcome.',
    another: 'Consider what unique value you bring that might not have come across clearly. Before your next interview, prepare 2-3 specific stories that demonstrate your impact with concrete numbers and outcomes.',
    experience: 'Experience gaps are temporary. Focus on building the specific skills mentioned. Many hiring managers will reconsider candidates who show initiative in closing gaps. Reach back out in 6 months with updates.',
    culture: 'Culture mismatches are actually a blessing in disguise. Working somewhere that does not align with your values leads to burnout. Use this as a signal to focus on companies whose culture genuinely excites you.',
    salary: 'Salary mismatches happen when expectations are not aligned early. In future conversations, try to establish the range during the first call. This saves everyone time and prevents late-stage disappointment.',
    unknown: 'Without specific feedback, avoid the temptation to over-analyze. Focus on what you can control: tailoring each application, preparing thoroughly for interviews, and expanding your network.',
  };
  return advice[reason] || advice.unknown;
}

export default function RejectionResponse() {
  const [inputs, setInputs] = useState({
    stage: 'interview',
    reason: 'unknown',
    askFeedback: true,
    company: '',
    role: '',
  });
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const set = (k, v) => setInputs(p => ({ ...p, [k]: v }));

  const generate = (e) => {
    e.preventDefault();
    const email = generateEmail(inputs);
    const nextSteps = getNextSteps(inputs.reason);
    const stat = ENCOURAGING_STATS[Math.floor(Math.random() * ENCOURAGING_STATS.length)];
    const whatToDo = inputs.reason !== 'unknown' ? getWhatToDoDifferently(inputs.reason) : null;
    setResult({ email, nextSteps, stat, whatToDo });
    setCopied(false);
  };

  const copy = () => {
    navigator.clipboard.writeText(result.email);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const inputClass = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";

  return (
    <ToolLayout title="Rejection Response Generator" description="Craft a professional, graceful response to any job rejection and get actionable next steps.">
      <form onSubmit={generate} className="glass-card rounded-2xl p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Company Name</label>
            <input className={inputClass} placeholder="Acme Corp" value={inputs.company} onChange={e => set('company', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Role</label>
            <input className={inputClass} placeholder="Software Engineer" value={inputs.role} onChange={e => set('role', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Stage of Rejection</label>
            <select className={inputClass} value={inputs.stage} onChange={e => set('stage', e.target.value)}>
              {STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Reason (if provided)</label>
            <select className={inputClass} value={inputs.reason} onChange={e => set('reason', e.target.value)}>
              {REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={inputs.askFeedback}
            onChange={e => set('askFeedback', e.target.checked)}
            className="rounded border-border"
          />
          Ask for feedback in the response
        </label>
        <Button type="submit" className="w-full">
          <Heart className="w-4 h-4 mr-2" /> Generate Response
        </Button>
      </form>

      {result && (
        <div className="mt-6 space-y-6">
          <div className="glass-card rounded-2xl p-6 text-center bg-gradient-to-b from-primary/5 to-transparent">
            <p className="text-sm text-muted-foreground italic leading-relaxed max-w-xl mx-auto">
              {result.stat}
            </p>
          </div>

          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold font-['Outfit']">Your Response Email</h3>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={copy} className="gap-1">
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
                <Button variant="outline" size="sm" onClick={generate} className="gap-1">
                  <RefreshCw className="w-3 h-3" /> Regenerate
                </Button>
              </div>
            </div>
            <div className="bg-muted/30 rounded-lg p-4 text-sm leading-relaxed whitespace-pre-line font-mono">
              {result.email}
            </div>
          </div>

          <div className="glass-card rounded-2xl p-6">
            <h3 className="font-semibold font-['Outfit'] mb-3">Your Next Steps</h3>
            <div className="space-y-3">
              {result.nextSteps.map((step, i) => (
                <div key={i} className="flex gap-3 text-sm">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                    {i + 1}
                  </span>
                  <p className="text-muted-foreground leading-relaxed pt-0.5">{step}</p>
                </div>
              ))}
            </div>
          </div>

          {result.whatToDo && (
            <div className="glass-card rounded-2xl p-6">
              <h3 className="font-semibold font-['Outfit'] mb-3">What to Do Differently</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{result.whatToDo}</p>
            </div>
          )}

          <p className="text-xs text-muted-foreground text-center">
            Remember to personalize this response with specific details from your interactions. A thoughtful, genuine reply leaves the door open for future opportunities.
          </p>
        </div>
      )}
    </ToolLayout>
  );
}
