import { useState } from 'react';
import { Mail, Copy, Check, Send } from 'lucide-react';
import { Button } from '../../components/ui/button';
import ToolLayout from './ToolLayout';

const RELATIONSHIPS = [
  { value: 'manager', label: 'Former Manager' },
  { value: 'colleague', label: 'Colleague' },
  { value: 'professor', label: 'Professor' },
  { value: 'mentor', label: 'Mentor' },
  { value: 'client', label: 'Client' },
];

const TONES = [
  { value: 'formal', label: 'Formal' },
  { value: 'friendly', label: 'Friendly Professional' },
  { value: 'casual', label: 'Casual' },
];

const GREETINGS = {
  formal: { manager: 'Dear', colleague: 'Dear', professor: 'Dear Professor', mentor: 'Dear', client: 'Dear' },
  friendly: { manager: 'Hi', colleague: 'Hi', professor: 'Dear Professor', mentor: 'Hi', client: 'Hi' },
  casual: { manager: 'Hey', colleague: 'Hey', professor: 'Hi Professor', mentor: 'Hey', client: 'Hey' },
};

const CLOSINGS = {
  formal: 'Sincerely',
  friendly: 'Best regards',
  casual: 'Thanks so much',
};

const OPENERS = {
  formal: {
    manager: 'I hope this message finds you well. I am reaching out because I am currently applying for the position of {position}, and I would be honored if you would consider serving as a professional reference on my behalf.',
    colleague: 'I hope this message finds you well. I am reaching out because I am currently applying for the position of {position}, and I would be grateful if you would consider being a professional reference for me.',
    professor: 'I hope this message finds you well. I am writing to respectfully ask if you would be willing to serve as a professional reference for me as I apply for the position of {position}.',
    mentor: 'I hope this message finds you well. I am currently applying for the position of {position}, and your guidance has been so instrumental to my growth that I would be honored if you would consider being a reference for me.',
    client: 'I hope this message finds you well. I am reaching out because I am applying for the position of {position}, and I believe your perspective on our professional collaboration would be very meaningful to potential employers.',
  },
  friendly: {
    manager: 'I hope you\'re doing well! I\'m reaching out because I\'m applying for a {position} role, and I\'d really appreciate it if you\'d be willing to serve as a reference for me.',
    colleague: 'I hope you\'re doing well! I\'m applying for a {position} position and was hoping you\'d be open to being a reference for me.',
    professor: 'I hope you\'re doing well! I\'m applying for a {position} role and I was hoping you might be willing to serve as a reference for me.',
    mentor: 'I hope you\'re doing well! I\'m excited to share that I\'m applying for a {position} role, and I would love it if you\'d be willing to be a reference for me.',
    client: 'I hope you\'re doing well! I\'m currently exploring a new opportunity as a {position}, and I was wondering if you\'d be open to serving as a reference based on our work together.',
  },
  casual: {
    manager: 'Hope all is well with you! I\'m throwing my hat in the ring for a {position} role and wanted to see if you\'d be up for being a reference.',
    colleague: 'Hope you\'re doing great! Quick question: I\'m applying for a {position} position and was wondering if you\'d be willing to be a reference for me.',
    professor: 'Hope you\'re doing well! I\'m applying for a {position} role and would love to list you as a reference if you\'re open to it.',
    mentor: 'Hope all is well! I\'m going after a {position} role and you\'re the first person I thought of to ask for a reference.',
    client: 'Hope you\'re doing well! I\'m exploring a {position} opportunity and was wondering if you\'d be comfortable being a reference based on our work together.',
  },
};

const ACCOMPLISHMENT_INTROS = {
  formal: {
    manager: 'During my time working under your leadership, I believe some of my key contributions included:',
    colleague: 'During our time working together, some of the accomplishments I am most proud of include:',
    professor: 'During my studies with you, some of the work I am most proud of includes:',
    mentor: 'Thanks to your mentorship, some accomplishments I am particularly proud of include:',
    client: 'During our professional engagement, some of the outcomes I was most proud to deliver include:',
  },
  friendly: {
    manager: 'To help jog your memory, here are a few things I\'m especially proud of from our time working together:',
    colleague: 'In case it\'s helpful, here are a few things I\'d highlight from our time working together:',
    professor: 'To give you some context, here are a few things from my time in your class that I\'m proud of:',
    mentor: 'Here are a few accomplishments I\'d love for you to speak to, if you\'re comfortable:',
    client: 'Here are a few outcomes from our work together that I think highlight my strengths:',
  },
  casual: {
    manager: 'Just to refresh your memory, here are a couple of things I\'d love for you to speak to:',
    colleague: 'Here are some highlights from our time working together that might be useful:',
    professor: 'Here\'s a quick refresher on some things from my time in your class:',
    mentor: 'Here are a few things I\'d love for you to mention if it comes up:',
    client: 'Here\'s a quick recap of some highlights from our work together:',
  },
};

const CLOSING_PARAGRAPHS = {
  formal: {
    manager: 'I completely understand if you are unable to do so, and I appreciate your consideration regardless. If you are willing, I am happy to provide any additional details about the role or my recent experience that might be helpful.',
    colleague: 'I understand if this is not something you are able to do, and I appreciate you considering it. Please let me know if you need any additional information about the position.',
    professor: 'I understand you receive many such requests, and I appreciate your time and consideration regardless of your decision. I would be happy to provide my updated resume or any other information that might be helpful.',
    mentor: 'I value your mentorship tremendously, and I completely understand if you are not comfortable or available. If you are willing, I am happy to share more details about the role.',
    client: 'I completely understand if you are unable to accommodate this request. If you are willing, I would be happy to provide any additional context about the role or our work together.',
  },
  friendly: {
    manager: 'Totally understand if the timing doesn\'t work or if you\'d rather not. No pressure at all! If you\'re up for it, I\'m happy to send over more details about the role.',
    colleague: 'No worries at all if you\'re not comfortable with it. If you\'re open to it, I can send over the job description and any other details that might be helpful.',
    professor: 'I totally understand if you\'re too busy or would prefer not to. If you\'re willing, I\'m happy to send my updated resume and details about the position.',
    mentor: 'No pressure at all. If you\'re open to it though, I\'d really appreciate it and I\'m happy to share more about the role.',
    client: 'Completely understand if that\'s not something you\'re comfortable with. If you are, I\'m happy to provide any additional context.',
  },
  casual: {
    manager: 'No worries at all if you can\'t. Just thought I\'d ask! Let me know either way and I\'m happy to fill you in on the details.',
    colleague: 'Totally fine if you\'d rather not. Just figured I\'d ask since we worked so well together. Let me know!',
    professor: 'No pressure at all! If you\'re able to, just let me know and I\'ll send over all the details.',
    mentor: 'Absolutely no pressure. You\'ve already helped me so much. If you\'re game, I\'ll send more details your way.',
    client: 'No worries at all if that doesn\'t work for you. Just thought I\'d reach out. Let me know!',
  },
};

const FOLLOWUP_INTROS = {
  formal: 'I wanted to follow up on my previous message regarding serving as a professional reference for my application to the {position} position.',
  friendly: 'Just wanted to follow up on my earlier message about being a reference for the {position} role I\'m applying for.',
  casual: 'Hey! Just bumping my earlier email about being a reference for that {position} role. Totally understand if you missed it.',
};

const FOLLOWUP_BODIES = {
  formal: 'I understand you may be busy, and I appreciate your time. If you are willing to serve as a reference, I wanted to let you know that the hiring process is moving forward and they may be reaching out within the next week or so. Please do not hesitate to let me know if you have any questions or if there is anything I can provide to make this easier for you.',
  friendly: 'I know things get busy, so no worries! I just wanted to give you a heads-up that the hiring process is moving along and they might reach out soon. If you\'re able to be a reference, I\'m happy to send over a quick summary of the role and what they might ask about.',
  casual: 'I know your inbox is probably overflowing! Just a heads-up that things are moving along with the hiring process and they might be in touch soon. If you\'re still up for it, let me know and I\'ll send over the details.',
};

function fill(template, data) {
  return template.replace(/\{(\w+)\}/g, (_, key) => data[key] || `{${key}}`);
}

function generateEmail(inputs) {
  const { yourName, refName, refTitle, relationship, position, accomplishments, tone } = inputs;

  const greeting = GREETINGS[tone][relationship];
  const titleSuffix = refTitle ? `, ${refTitle}` : '';
  const salutation = relationship === 'professor' ? `${greeting} ${refName.split(' ').pop()}` : `${greeting} ${refName.split(' ')[0]}`;

  const opener = fill(OPENERS[tone][relationship], { position });
  const accomIntro = ACCOMPLISHMENT_INTROS[tone][relationship];
  const closingPara = CLOSING_PARAGRAPHS[tone][relationship];
  const closing = CLOSINGS[tone];

  const accomLines = accomplishments
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .map(l => `  - ${l}`)
    .join('\n');

  const subject = tone === 'formal'
    ? `Reference Request - ${yourName} for ${position} Position`
    : tone === 'friendly'
    ? `Quick favor - reference for ${position} role?`
    : `Reference request - ${position} role`;

  const email = `Subject: ${subject}

${salutation},

${opener}

${accomLines ? `${accomIntro}\n\n${accomLines}\n` : ''}
${closingPara}

${closing},
${yourName}`;

  // Follow-up email
  const followupSubject = tone === 'formal'
    ? `Follow-Up: Reference Request - ${yourName}`
    : tone === 'friendly'
    ? `Following up - reference request`
    : `Quick follow-up on reference`;

  const followupIntro = fill(FOLLOWUP_INTROS[tone], { position });
  const followupBody = FOLLOWUP_BODIES[tone];

  const followup = `Subject: ${followupSubject}

${salutation},

${followupIntro}

${followupBody}

Thank you again for considering this. I truly appreciate it.

${closing},
${yourName}`;

  return { email, followup };
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button variant="outline" size="sm" onClick={copy}>
      {copied ? <><Check className="w-3 h-3 mr-1" /> Copied</> : <><Copy className="w-3 h-3 mr-1" /> Copy</>}
    </Button>
  );
}

export default function ReferenceRequest() {
  const [inputs, setInputs] = useState({
    yourName: '',
    refName: '',
    refTitle: '',
    relationship: 'manager',
    position: '',
    accomplishments: '',
    tone: 'friendly',
  });
  const [result, setResult] = useState(null);

  const set = (k, v) => setInputs(p => ({ ...p, [k]: v }));

  const generate = (e) => {
    e.preventDefault();
    setResult(generateEmail(inputs));
  };

  const selectClass = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm';

  return (
    <ToolLayout title="Reference Request Generator" description="Generate professional reference request emails tailored to your relationship and tone.">
      <form onSubmit={generate} className="glass-card rounded-2xl p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Your Name</label>
            <input
              className={selectClass}
              placeholder="Taylor Smith"
              value={inputs.yourName}
              onChange={e => set('yourName', e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Reference's Name</label>
            <input
              className={selectClass}
              placeholder="Jordan Lee"
              value={inputs.refName}
              onChange={e => set('refName', e.target.value)}
              required
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Their Title (optional)</label>
            <input
              className={selectClass}
              placeholder="Engineering Manager at Acme Corp"
              value={inputs.refTitle}
              onChange={e => set('refTitle', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Relationship</label>
            <select className={selectClass} value={inputs.relationship} onChange={e => set('relationship', e.target.value)}>
              {RELATIONSHIPS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Position You're Applying For</label>
            <input
              className={selectClass}
              placeholder="Senior Product Manager"
              value={inputs.position}
              onChange={e => set('position', e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Tone</label>
            <select className={selectClass} value={inputs.tone} onChange={e => set('tone', e.target.value)}>
              {TONES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Key Accomplishments They'd Remember</label>
          <textarea
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm min-h-[100px]"
            placeholder={"Led the migration to microservices architecture\nMentored 3 junior developers who all got promoted\nDelivered the Q3 product launch 2 weeks ahead of schedule"}
            value={inputs.accomplishments}
            onChange={e => set('accomplishments', e.target.value)}
          />
          <p className="text-xs text-muted-foreground mt-1">One accomplishment per line (2-3 recommended)</p>
        </div>
        <Button type="submit" className="w-full">
          <Mail className="w-4 h-4 mr-2" /> Generate Reference Request
        </Button>
      </form>

      {result && (
        <div className="mt-6 space-y-6">
          {/* Main Email */}
          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold font-['Outfit'] flex items-center gap-2">
                <Send className="w-5 h-5 text-primary" /> Reference Request Email
              </h3>
              <CopyButton text={result.email} />
            </div>
            <div className="bg-background border border-border rounded-lg p-4">
              <pre className="whitespace-pre-wrap text-sm leading-relaxed font-['DM_Sans']">{result.email}</pre>
            </div>
          </div>

          {/* Follow-up Email */}
          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold font-['Outfit'] flex items-center gap-2">
                <Mail className="w-5 h-5 text-blue-400" /> Follow-Up Reminder Email
              </h3>
              <CopyButton text={result.followup} />
            </div>
            <p className="text-xs text-muted-foreground mb-3">Send this 5-7 days later if you haven't heard back.</p>
            <div className="bg-background border border-border rounded-lg p-4">
              <pre className="whitespace-pre-wrap text-sm leading-relaxed font-['DM_Sans']">{result.followup}</pre>
            </div>
          </div>
        </div>
      )}
    </ToolLayout>
  );
}
