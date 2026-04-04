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
  { value: 'jobs_in_city', label: 'Jobs in City' },
  { value: 'salary_guide', label: 'Salary Guide' },
  { value: 'career_guide', label: 'Career Guide' },
  { value: 'interview_prep', label: 'Interview Prep' },
];

export const PAGE_TYPE_MAP = Object.fromEntries(PAGE_TYPES.map(p => [p.value, p.label]));

export const TABS = [
  { key: 'dashboard', label: 'Dashboard', icon: 'BarChart3' },
  { key: 'generate', label: 'Generate', icon: 'Play' },
  { key: 'posts', label: 'Posts', icon: 'FileText' },
];
