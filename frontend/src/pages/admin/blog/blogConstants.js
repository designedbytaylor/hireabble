export const CANADA_CITIES = [
  'Toronto', 'Vancouver', 'Montreal', 'Calgary', 'Ottawa', 'Edmonton',
  'Winnipeg', 'Quebec City', 'Hamilton', 'Kitchener', 'London', 'Halifax',
  'Victoria', 'Saskatoon', 'Regina', "St. John's", 'Kelowna', 'Barrie',
  'Windsor', 'Mississauga',
];

export const US_CITIES = [
  'New York', 'San Francisco', 'Los Angeles', 'Chicago', 'Seattle', 'Austin',
  'Boston', 'Denver', 'Miami', 'Dallas', 'Atlanta', 'Phoenix', 'Minneapolis',
  'Portland', 'San Diego', 'Washington DC', 'Philadelphia', 'Nashville',
  'Raleigh', 'Charlotte',
];

export const ALL_CITIES = [...CANADA_CITIES, ...US_CITIES];

export const ROLES = [
  'Software Developer', 'Data Analyst', 'Project Manager', 'Registered Nurse',
  'Marketing Manager', 'Accountant', 'Graphic Designer', 'Sales Representative',
  'HR Manager', 'Electrician', 'Mechanical Engineer', 'Teacher', 'Pharmacist',
  'Financial Analyst', 'UX Designer', 'DevOps Engineer', 'Business Analyst',
  'Civil Engineer', 'Dental Hygienist', 'Social Worker', 'Construction Manager',
  'Plumber', 'Welder', 'Truck Driver', 'Administrative Assistant',
  'Customer Service Rep', 'Retail Manager', 'Chef', 'Physiotherapist', 'Paramedic',
];

export const PAGE_TYPES = [
  // Tier 1 — city × role
  { value: 'jobs_in_city', label: 'Jobs in City', tier: 1 },
  { value: 'salary_guide', label: 'Salary Guide', tier: 1 },
  { value: 'career_guide', label: 'Career Guide', tier: 1 },
  { value: 'interview_prep', label: 'Interview Prep', tier: 1 },
  { value: 'resume_tips', label: 'Resume Tips', tier: 1 },
  { value: 'cover_letter_guide', label: 'Cover Letter Guide', tier: 1 },
  { value: 'cost_of_living', label: 'Cost of Living', tier: 1 },
  { value: 'skills_guide', label: 'Skills Guide', tier: 1 },
  { value: 'day_in_life', label: 'Day in the Life', tier: 1 },
  { value: 'salary_negotiation', label: 'Salary Negotiation', tier: 1 },
  // Tier 2 — city × role + some multi-dim
  { value: 'remote_work_guide', label: 'Remote Work Guide', tier: 2 },
  { value: 'entry_level_guide', label: 'Entry-Level Guide', tier: 2 },
  { value: 'freelance_guide', label: 'Freelance Guide', tier: 2 },
  { value: 'certification_guide', label: 'Certification Guide', tier: 2 },
  { value: 'company_size_guide', label: 'Startup vs Corporate', tier: 2 },
  { value: 'role_comparison', label: 'Role vs Role', tier: 2, dim: 'role2' },
  { value: 'industry_guide', label: 'Industry Guide', tier: 2, dim: 'industry' },
  // Tier 3 — advanced + multi-dim
  { value: 'neighborhood_guide', label: 'Neighborhood Guide', tier: 3 },
  { value: 'company_hiring', label: 'Companies Hiring', tier: 3 },
  { value: 'visa_immigration', label: 'Immigration Guide', tier: 3 },
  { value: 'career_transition', label: 'Career Transition', tier: 3, dim: 'role2' },
  { value: 'technology_stack', label: 'Technology Jobs', tier: 3, dim: 'technology' },
  { value: 'city_comparison', label: 'City vs City', tier: 3, dim: 'city2' },
  { value: 'annual_job_market', label: 'Job Market Report', tier: 3, dim: 'city_only' },
];

export const INDUSTRIES = [
  'Technology', 'Healthcare', 'Finance', 'Retail', 'Manufacturing',
  'Education', 'Government', 'Construction', 'Energy', 'Hospitality',
];

export const TECHNOLOGIES = [
  'Python', 'JavaScript', 'React', 'Node.js', 'TypeScript', 'Java',
  'AWS', 'Docker', 'Kubernetes', 'SQL', 'PostgreSQL', 'MongoDB',
  'Go', 'Rust', 'C#', '.NET', 'Ruby', 'PHP', 'Swift', 'Kotlin',
  'Terraform', 'GraphQL', 'Redis', 'Tableau', 'Salesforce',
  'SAP', 'Power BI', 'Figma', 'AutoCAD', 'MATLAB',
];

export const PAGE_TYPE_MAP = Object.fromEntries(PAGE_TYPES.map(p => [p.value, p.label]));

export const TABS = [
  { key: 'dashboard', label: 'Dashboard', icon: 'BarChart3' },
  { key: 'generate', label: 'Generate', icon: 'Play' },
  { key: 'posts', label: 'Posts', icon: 'FileText' },
];
