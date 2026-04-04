import { useState } from 'react';
import { FileText, Copy, Check, Sparkles } from 'lucide-react';
import { Button } from '../../components/ui/button';
import ToolLayout from './ToolLayout';

const GAP_DURATIONS = [
  { value: 'short', label: '< 6 months' },
  { value: 'medium', label: '6-12 months' },
  { value: 'long', label: '1-2 years' },
  { value: 'extended', label: '2+ years' },
];

const GAP_REASONS = [
  { value: 'layoff', label: 'Layoff' },
  { value: 'health', label: 'Health' },
  { value: 'caregiving', label: 'Caregiving' },
  { value: 'education', label: 'Education' },
  { value: 'sabbatical', label: 'Sabbatical / Travel' },
  { value: 'career_change', label: 'Career Change' },
  { value: 'business', label: 'Starting a Business' },
];

const RESUME_TEMPLATES = {
  layoff: [
    'Navigated company-wide restructuring with professionalism; used the transition period to sharpen skills in {activities} and pursue professional development.',
    'Following an organizational restructuring, dedicated time to {activities}, gaining fresh perspective and updated expertise.',
    'Leveraged transition period to complete training in {activities}, maintaining industry engagement through networking and self-directed projects.',
  ],
  health: [
    'Took a planned health-focused leave to address personal wellness; returned with renewed energy and commitment to professional growth.',
    'Managed a personal health matter while staying current with industry developments through {activities}.',
    'Prioritized personal health, using recovery time productively to engage in {activities} and prepare for a strong return to the workforce.',
  ],
  caregiving: [
    'Dedicated time to family caregiving responsibilities while maintaining professional skills through {activities}.',
    'Managed full-time caregiving duties, developing exceptional skills in time management, resource coordination, and problem-solving.',
    'Balanced caregiving commitments with ongoing professional development, including {activities}.',
  ],
  education: [
    'Pursued focused educational advancement in {activities}, building expertise directly applicable to target role.',
    'Invested in professional education and skill development, completing coursework and projects in {activities}.',
    'Took a deliberate career pause to deepen knowledge through formal education in {activities}, positioning for greater impact.',
  ],
  sabbatical: [
    'Completed a planned sabbatical focused on personal and professional enrichment, including {activities}.',
    'Took an intentional career pause for personal growth and exploration, engaging in {activities} that broadened perspective and skills.',
    'Pursued a meaningful sabbatical experience involving {activities}, returning with fresh ideas and renewed motivation.',
  ],
  career_change: [
    'Dedicated time to a thoughtful career transition, building foundational skills through {activities}.',
    'Invested in career exploration and retooling, completing {activities} to prepare for a new professional direction.',
    'Took a strategic pause to pivot careers, focusing on {activities} to build relevant skills and industry knowledge.',
  ],
  business: [
    'Founded and operated a business venture, gaining hands-on experience in {activities}, including leadership, budgeting, and strategic planning.',
    'Launched an entrepreneurial project focused on {activities}, developing skills in business operations, client relations, and self-management.',
    'Built a business from the ground up, managing all aspects including {activities}, before choosing to return to a collaborative team environment.',
  ],
};

const INTERVIEW_TEMPLATES = {
  layoff: [
    'My previous company went through a restructuring that affected my department. I saw it as an opportunity to reflect on what I really wanted in my next role, and I used the time to {activities}. I\'m now clearer than ever about where I can add the most value.',
    'The layoff was unexpected, but I chose to approach it constructively. I spent my time {activities}, and I can honestly say I\'m coming back stronger and more focused.',
    'Rather than rushing into the next thing, I took a measured approach after the layoff. I invested in {activities}, which gave me {learned}.',
  ],
  health: [
    'I took time off to focus on a health matter that\'s now fully resolved. During that period, I also managed to stay engaged by {activities}. I\'m ready and excited to bring my full energy to a new role.',
    'I needed to step back for health reasons, and I\'m glad I did. It gave me perspective, and I stayed productive by {activities}. The experience actually taught me {learned}.',
    'My health required attention, and I prioritized that. Now that it\'s behind me, I\'m eager to contribute. I kept my skills fresh through {activities}.',
  ],
  caregiving: [
    'I stepped away to care for a family member, which was one of the most demanding and rewarding things I\'ve done. The experience sharpened my organizational, problem-solving, and communication skills in ways no job could.',
    'Caregiving was a full-time commitment that required me to manage complex logistics daily. I also made time for {activities}, and I learned {learned}.',
    'While caregiving, I developed incredible skills in multitasking and prioritization. I kept my professional skills current through {activities} and I\'m excited to bring all of that to my next role.',
  ],
  education: [
    'I made a deliberate decision to go back and study {activities}. It was an investment in myself that I believe makes me a stronger candidate for this role because {learned}.',
    'I wanted to deepen my expertise, so I dedicated time to formal education in {activities}. What I learned directly applies to this position, especially {learned}.',
    'Education was the right move at that point in my career. I gained {learned} through {activities}, and I\'m ready to put that knowledge into practice.',
  ],
  sabbatical: [
    'I planned a sabbatical to recharge and explore new perspectives. I spent my time {activities}, and it gave me {learned}. I\'m coming back with fresh energy and new ideas.',
    'After several years of intense work, I took a deliberate pause. I used the time for {activities}, which helped me {learned}. I\'m more motivated now than I\'ve been in years.',
    'My sabbatical wasn\'t idle time; it was an intentional investment. I focused on {activities} and discovered {learned}. That clarity is exactly why I\'m excited about this role.',
  ],
  career_change: [
    'I decided to pivot my career, and I wanted to do it right. I spent time building skills in {activities}, and I learned {learned}. My previous experience combined with these new skills gives me a unique perspective.',
    'Changing careers was a thoughtful decision. I used the gap to prepare properly through {activities}. My background brings {learned} that most candidates in this field don\'t have.',
    'I realized I wanted to move in a new direction, so I invested time in {activities}. The combination of my previous experience and {learned} is something I\'m really excited to bring to this role.',
  ],
  business: [
    'I started my own business, which taught me more about {learned} than any single role ever could. I handled everything from strategy to execution, including {activities}. I\'m now looking to apply those skills within a larger team.',
    'Running my own venture gave me incredible breadth of experience. I managed {activities} and learned {learned}. I\'m excited to bring that entrepreneurial mindset to a collaborative environment.',
    'My business experience was a crash course in leadership, resilience, and resourcefulness. I focused on {activities} and discovered {learned}. Now I want to channel that drive into a role where I can make an even bigger impact.',
  ],
};

const REFRAME_TEMPLATES = {
  layoff: 'A layoff says nothing about your abilities and everything about business circumstances. Companies restructure for reasons that have nothing to do with individual performance. You used this time wisely to grow, and that says a lot about your character. Employers know that talent gets caught up in layoffs all the time, and the best ones will appreciate how you handled it.',
  health: 'Taking care of your health is not a weakness; it\'s one of the most responsible things you can do. You showed wisdom in prioritizing your well-being, and you\'re now in a position to give your best to an employer. Many hiring managers have gone through similar experiences or know someone who has. Your honesty and resilience will resonate.',
  caregiving: 'Caregiving is real, demanding work that builds skills employers desperately need: crisis management, patience, multitasking, and empathy. You stepped up for someone who needed you, and that reflects strength of character. The skills you developed during this time are transferable and valuable in any workplace.',
  education: 'Investing in education shows initiative, commitment to growth, and a willingness to do hard things. You chose to become better at what you do rather than settling for what you already knew. That kind of drive is exactly what forward-thinking employers are looking for.',
  sabbatical: 'A sabbatical is not a gap; it\'s a strategic investment in yourself. The most innovative companies in the world encourage sabbaticals because they know that people who take time to recharge and explore come back sharper and more creative. You did something many people only dream about, and you\'re better for it.',
  career_change: 'Changing careers takes courage and self-awareness. You recognized what you truly wanted and took concrete steps to make it happen. That kind of intentionality is rare and valuable. Your unique combination of experiences from different fields gives you a perspective that other candidates simply don\'t have.',
  business: 'Starting a business is one of the most challenging things a person can do. Whether it succeeded wildly or taught you tough lessons, you gained experience in leadership, decision-making, and execution that most people never get. Employers increasingly value entrepreneurial thinkers who understand how businesses actually work.',
};

function fillTemplate(template, activities, learned) {
  return template
    .replace(/\{activities\}/g, activities || 'self-directed learning and skill development')
    .replace(/\{learned\}/g, learned || 'valuable new perspectives and skills');
}

function generateContent(reason, duration, activities, learned) {
  const resumeTemplates = RESUME_TEMPLATES[reason] || RESUME_TEMPLATES.layoff;
  const interviewTemplates = INTERVIEW_TEMPLATES[reason] || INTERVIEW_TEMPLATES.layoff;
  const reframe = REFRAME_TEMPLATES[reason] || REFRAME_TEMPLATES.layoff;

  const durationNote = duration === 'short' ? '' :
    duration === 'extended' ? ' This was a significant period, but every moment contributed to who you are as a professional today.' : '';

  const resumeBullets = resumeTemplates.slice(0, 3).map(t => fillTemplate(t, activities, learned));
  const interviewPoints = interviewTemplates.slice(0, 3).map(t => fillTemplate(t, activities, learned));
  const reframeParagraph = reframe + durationNote;

  return { resumeBullets, interviewPoints, reframeParagraph };
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

export default function CareerGapExplainer() {
  const [inputs, setInputs] = useState({ duration: 'short', reason: 'layoff', activities: '', learned: '' });
  const [result, setResult] = useState(null);

  const set = (k, v) => setInputs(p => ({ ...p, [k]: v }));

  const generate = (e) => {
    e.preventDefault();
    setResult(generateContent(inputs.reason, inputs.duration, inputs.activities, inputs.learned));
  };

  const selectClass = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm';

  return (
    <ToolLayout title="Career Gap Explainer" description="Turn employment gaps into confident, compelling narratives for resumes and interviews.">
      <form onSubmit={generate} className="glass-card rounded-2xl p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Gap Duration</label>
            <select className={selectClass} value={inputs.duration} onChange={e => set('duration', e.target.value)}>
              {GAP_DURATIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Reason for Gap</label>
            <select className={selectClass} value={inputs.reason} onChange={e => set('reason', e.target.value)}>
              {GAP_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Activities During the Gap</label>
          <textarea
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm min-h-[80px]"
            placeholder="e.g. Completed online courses in data analytics, volunteered at a local nonprofit, freelanced as a consultant..."
            value={inputs.activities}
            onChange={e => set('activities', e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">What You Learned</label>
          <textarea
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm min-h-[80px]"
            placeholder="e.g. Improved my technical skills, gained a clearer sense of career direction, learned to manage ambiguity..."
            value={inputs.learned}
            onChange={e => set('learned', e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full">
          <Sparkles className="w-4 h-4 mr-2" /> Generate Explanation
        </Button>
      </form>

      {result && (
        <div className="mt-6 space-y-6">
          {/* Resume Bullet Points */}
          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold font-['Outfit'] flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" /> Resume Bullet Points
              </h3>
              <CopyButton text={result.resumeBullets.map((b, i) => `${i + 1}. ${b}`).join('\n\n')} />
            </div>
            <div className="space-y-3">
              {result.resumeBullets.map((bullet, i) => (
                <div key={i} className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10">
                  <span className="text-xs font-bold text-primary mt-0.5 shrink-0">{i + 1}.</span>
                  <p className="text-sm leading-relaxed">{bullet}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Interview Talking Points */}
          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold font-['Outfit'] flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-400" /> Interview Talking Points
              </h3>
              <CopyButton text={result.interviewPoints.map((p, i) => `${i + 1}. ${p}`).join('\n\n')} />
            </div>
            <div className="space-y-3">
              {result.interviewPoints.map((point, i) => (
                <div key={i} className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/5 border border-blue-500/10">
                  <span className="text-xs font-bold text-blue-400 mt-0.5 shrink-0">{i + 1}.</span>
                  <p className="text-sm leading-relaxed">{point}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Confidence Reframe */}
          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold font-['Outfit'] flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-yellow-500" /> Confidence Reframe
              </h3>
              <CopyButton text={result.reframeParagraph} />
            </div>
            <div className="p-4 rounded-lg bg-yellow-500/5 border border-yellow-500/10">
              <p className="text-sm leading-relaxed">{result.reframeParagraph}</p>
            </div>
          </div>
        </div>
      )}
    </ToolLayout>
  );
}
