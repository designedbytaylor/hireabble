const RESPONSIBILITIES = {
  technology: {
    junior: [
      "Write clean, maintainable code following team standards and best practices",
      "Participate in code reviews and contribute to team knowledge sharing",
      "Debug and resolve software defects reported by QA or end users",
      "Collaborate with senior developers on feature implementation",
      "Write unit tests and maintain test coverage for assigned modules",
      "Document code changes and update technical documentation",
      "Participate in daily stand-ups and sprint planning meetings",
      "Learn and adopt new technologies as required by the project",
    ],
    mid: [
      "Design and implement new features from requirements to deployment",
      "Lead code reviews and mentor junior team members",
      "Collaborate with product managers to define technical requirements",
      "Optimize application performance and resolve bottlenecks",
      "Contribute to architectural decisions and system design",
      "Maintain CI/CD pipelines and deployment processes",
      "Investigate and resolve production incidents",
      "Drive improvements in code quality and development processes",
    ],
    senior: [
      "Lead the design and architecture of complex software systems",
      "Define technical strategy and roadmap for the engineering team",
      "Mentor and coach developers across the organization",
      "Collaborate with leadership to align technical decisions with business goals",
      "Drive cross-team initiatives and resolve complex technical challenges",
      "Establish and evolve engineering best practices and standards",
      "Lead incident response and conduct post-mortems",
      "Evaluate and recommend new technologies and tools",
    ],
  },
  default: {
    junior: [
      "Support day-to-day operations and contribute to team projects",
      "Assist senior team members with research and analysis",
      "Maintain accurate records and documentation",
      "Participate in team meetings and contribute ideas for improvement",
      "Handle incoming requests and resolve routine issues",
      "Learn company processes and industry best practices",
      "Prepare reports and presentations as assigned",
      "Collaborate with cross-functional teams on shared objectives",
    ],
    mid: [
      "Manage projects from planning through execution and delivery",
      "Develop and implement strategies to achieve departmental goals",
      "Analyze data and provide recommendations to leadership",
      "Build and maintain relationships with key stakeholders",
      "Identify process improvements and lead implementation",
      "Train and support junior team members",
      "Prepare and present progress reports to management",
      "Coordinate with other departments to ensure alignment",
    ],
    senior: [
      "Set strategic direction and priorities for the department",
      "Lead and develop a high-performing team",
      "Drive organizational change and continuous improvement",
      "Build executive-level relationships with key partners",
      "Manage departmental budget and resource allocation",
      "Represent the organization in industry forums and events",
      "Define KPIs and ensure accountability for results",
      "Mentor emerging leaders and plan for succession",
    ],
  },
};

const QUALIFICATIONS = {
  technology: {
    junior: [
      "Bachelor's degree in Computer Science, Engineering, or related field (or equivalent experience)",
      "0-2 years of professional software development experience",
      "Proficiency in at least one programming language",
      "Understanding of software development fundamentals",
      "Strong problem-solving and analytical skills",
      "Ability to work collaboratively in a team environment",
      "Eagerness to learn and grow in a fast-paced environment",
    ],
    mid: [
      "Bachelor's degree in Computer Science, Engineering, or related field",
      "3-5 years of professional software development experience",
      "Strong proficiency in relevant programming languages and frameworks",
      "Experience with databases, APIs, and cloud services",
      "Demonstrated ability to ship production-quality software",
      "Excellent communication and collaboration skills",
      "Experience with agile development methodologies",
    ],
    senior: [
      "Bachelor's or Master's degree in Computer Science, Engineering, or related field",
      "7+ years of professional software development experience",
      "Deep expertise in system design and architecture",
      "Track record of leading complex technical projects",
      "Experience mentoring and developing engineering talent",
      "Excellent communication skills with technical and non-technical audiences",
      "Experience with distributed systems and scalability challenges",
    ],
  },
  default: {
    junior: [
      "Bachelor's degree in a relevant field or equivalent experience",
      "0-2 years of relevant professional experience",
      "Strong written and verbal communication skills",
      "Proficiency with Microsoft Office Suite or Google Workspace",
      "Detail-oriented with strong organizational skills",
      "Ability to work both independently and as part of a team",
      "Eagerness to learn and take on new challenges",
    ],
    mid: [
      "Bachelor's degree in a relevant field",
      "3-5 years of progressive experience in the role",
      "Demonstrated leadership and project management skills",
      "Strong analytical and problem-solving abilities",
      "Excellent interpersonal and stakeholder management skills",
      "Experience with industry-standard tools and methodologies",
      "Ability to manage competing priorities effectively",
    ],
    senior: [
      "Bachelor's or Master's degree in a relevant field",
      "7+ years of progressive experience with demonstrated leadership",
      "Proven track record of strategic thinking and execution",
      "Exceptional communication and presentation skills",
      "Experience managing budgets and cross-functional teams",
      "Strong industry knowledge and professional network",
      "Ability to drive organizational change and innovation",
    ],
  },
};

const BENEFITS = [
  "Competitive salary and performance bonuses",
  "Comprehensive health, dental, and vision insurance",
  "Generous paid time off and vacation policy",
  "RRSP matching program",
  "Professional development budget and learning opportunities",
  "Flexible work arrangements (remote/hybrid options available)",
  "Employee wellness program",
  "Team social events and company culture activities",
  "Paid parental leave",
  "Employee assistance program (EAP)",
];

const EMPLOYMENT_TYPES = {
  'full-time': 'Full-Time',
  'part-time': 'Part-Time',
  'contract': 'Contract',
  'internship': 'Internship',
};

const REMOTE_POLICIES = {
  onsite: 'This is an on-site position.',
  hybrid: 'This is a hybrid position with flexible in-office days.',
  remote: 'This is a fully remote position open to candidates across Canada.',
};

function pickRandom(arr, count) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export function generateJobDescription({ title, seniority, industry, location, employmentType, companyName, remotePolicy }) {
  const indKey = industry === 'technology' ? 'technology' : 'default';
  const level = seniority || 'mid';

  const responsibilities = pickRandom(RESPONSIBILITIES[indKey][level] || RESPONSIBILITIES.default.mid, 6);
  const qualifications = pickRandom(QUALIFICATIONS[indKey][level] || QUALIFICATIONS.default.mid, 6);
  const benefits = pickRandom(BENEFITS, 6);

  const typeLabel = EMPLOYMENT_TYPES[employmentType] || 'Full-Time';
  const remoteNote = REMOTE_POLICIES[remotePolicy] || '';

  const about = `${companyName || '[Company Name]'} is looking for a talented ${title || '[Job Title]'} to join our team${location ? ` in ${location}` : ''}. This is a ${typeLabel.toLowerCase()} opportunity for someone passionate about making an impact. ${remoteNote}`;

  return { about, responsibilities, qualifications, benefits, title: title || '[Job Title]', company: companyName || '[Company Name]', location: location || '[Location]', type: typeLabel };
}
