export const TEMPLATES = {
  professional: {
    openings: [
      "I am writing to express my strong interest in the {title} position at {company}. With my background in {skills}, I am confident I can make a meaningful contribution to your team.",
      "I was excited to discover the {title} opening at {company}. My professional experience aligns closely with the requirements of this role, and I would welcome the opportunity to bring my expertise in {skills} to your organization.",
      "Please accept this letter as my application for the {title} role at {company}. Having developed strong skills in {skills}, I believe I am well-positioned to deliver immediate value in this capacity.",
    ],
    bodies: [
      "Throughout my career, I have consistently demonstrated the ability to deliver results in fast-paced environments. {highlights} These experiences have equipped me with a deep understanding of what it takes to excel in roles like this one.",
      "In my previous roles, I have honed my skills and built a track record of achievement. {highlights} I am particularly drawn to {company} because of your commitment to excellence and innovation in the industry.",
      "My professional journey has given me hands-on experience with the challenges and opportunities that come with this type of role. {highlights} I am eager to bring this experience to {company} and contribute to your continued success.",
    ],
    closings: [
      "I would welcome the opportunity to discuss how my skills and experience align with your team's goals. Thank you for considering my application, and I look forward to hearing from you.",
      "I am enthusiastic about the possibility of joining {company} and contributing to your mission. Please feel free to reach out at your convenience to schedule a conversation.",
      "Thank you for your time and consideration. I am available for an interview at your earliest convenience and would be happy to provide any additional information you may need.",
    ],
  },
  casual: {
    openings: [
      "I'm reaching out about the {title} role at {company} — it caught my eye right away. With my background in {skills}, I think I'd be a great fit for what you're looking for.",
      "Hey there! I just came across the {title} position at {company} and knew I had to apply. I've spent my career building skills in {skills}, and this feels like the perfect next step.",
      "I'm excited to throw my hat in the ring for the {title} role at {company}. My experience with {skills} has prepared me well for exactly this kind of opportunity.",
    ],
    bodies: [
      "Here's what I bring to the table: {highlights} I'm the kind of person who dives in, figures things out, and gets things done — and I think that's exactly what you need.",
      "A bit about what I've been up to: {highlights} I love what {company} is doing, and I'd be thrilled to bring my energy and skills to your team.",
      "What sets me apart: {highlights} I'm passionate about doing great work and I think {company} is the kind of place where I can really make an impact.",
    ],
    closings: [
      "I'd love to chat more about how I can contribute to {company}. Drop me a line anytime — I'm flexible and always happy to connect.",
      "Looking forward to the chance to learn more about the team and share more about what I can bring. Let's set up a time to talk!",
      "Thanks for reading this far! I'm genuinely excited about this opportunity and would love to discuss it further whenever works for you.",
    ],
  },
  enthusiastic: {
    openings: [
      "I am absolutely thrilled to apply for the {title} position at {company}! This role is a perfect match for my passion and expertise in {skills}, and I cannot wait to show you what I can do.",
      "When I saw the {title} opening at {company}, I knew immediately — this is the role I've been waiting for. My deep experience in {skills} has been leading me to exactly this kind of opportunity.",
      "I could not be more excited about the {title} position at {company}! Everything about this role speaks to my strengths in {skills} and my career aspirations.",
    ],
    bodies: [
      "I am genuinely passionate about this work, and my track record shows it. {highlights} Every day, I strive to push boundaries and deliver exceptional results, and I would bring that same drive to {company}.",
      "What truly excites me about {company} is the impact your work has. {highlights} I am eager to channel my experience and enthusiasm into helping your team achieve even greater things.",
      "My career has been defined by a relentless commitment to excellence. {highlights} I am confident that my passion, combined with {company}'s incredible mission, would create something truly special.",
    ],
    closings: [
      "I would be absolutely delighted to discuss this opportunity further. Thank you so much for considering my application — I truly believe we could do amazing things together!",
      "I am incredibly excited about the possibility of joining {company}. Please do not hesitate to reach out — I am ready and eager to take the next step!",
      "Thank you for this incredible opportunity! I would love to meet with you to share my vision for how I can contribute to {company}'s success. Let's make it happen!",
    ],
  },
};

export function generateCoverLetter({ name, title, company, skills, tone, highlights }) {
  const t = TEMPLATES[tone] || TEMPLATES.professional;
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const fill = str => str
    .replace(/\{name\}/g, name || 'Applicant')
    .replace(/\{title\}/g, title || 'the position')
    .replace(/\{company\}/g, company || 'your company')
    .replace(/\{skills\}/g, skills || 'relevant areas')
    .replace(/\{highlights\}/g, highlights || 'I have a strong track record of success in my field.');

  const opening = fill(pick(t.openings));
  const body = fill(pick(t.bodies));
  const closing = fill(pick(t.closings));

  const date = new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });

  return `${date}

Dear Hiring Manager,

${opening}

${body}

${closing}

Sincerely,
${name || '[Your Name]'}`;
}
