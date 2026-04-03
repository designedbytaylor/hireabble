export const ROLES_TO_SKILLS = {
  'Software Developer': {
    required: ['JavaScript', 'Git', 'REST APIs', 'SQL', 'Problem Solving', 'Agile', 'HTML/CSS', 'Data Structures'],
    nice: ['TypeScript', 'Docker', 'CI/CD', 'Cloud (AWS/GCP)', 'React', 'Node.js', 'System Design', 'Testing'],
  },
  'Data Analyst': {
    required: ['SQL', 'Excel', 'Python', 'Data Visualization', 'Statistics', 'Critical Thinking', 'Communication'],
    nice: ['Tableau', 'Power BI', 'R', 'Machine Learning', 'ETL', 'A/B Testing', 'Storytelling with Data'],
  },
  'Project Manager': {
    required: ['Stakeholder Management', 'Risk Management', 'Agile/Scrum', 'Budgeting', 'Communication', 'Planning', 'MS Project/Jira'],
    nice: ['PMP Certification', 'Six Sigma', 'Change Management', 'Conflict Resolution', 'Vendor Management'],
  },
  'Registered Nurse': {
    required: ['Patient Assessment', 'Medication Administration', 'Documentation', 'Infection Control', 'Critical Thinking', 'Communication', 'BLS/ACLS'],
    nice: ['IV Therapy', 'Wound Care', 'Telemetry', 'Epic/Cerner EHR', 'Patient Education', 'Triage'],
  },
  'Marketing Manager': {
    required: ['Campaign Management', 'Analytics', 'Content Strategy', 'Budget Management', 'SEO/SEM', 'Social Media', 'Communication'],
    nice: ['Marketing Automation', 'A/B Testing', 'CRM (HubSpot/Salesforce)', 'Copywriting', 'Brand Strategy', 'Video Marketing'],
  },
  'Accountant': {
    required: ['Financial Reporting', 'GAAP/IFRS', 'Excel', 'Reconciliation', 'Tax Preparation', 'Attention to Detail', 'Bookkeeping'],
    nice: ['CPA Designation', 'QuickBooks/Sage', 'ERP Systems', 'Auditing', 'Forecasting', 'Power BI'],
  },
  'Graphic Designer': {
    required: ['Adobe Creative Suite', 'Typography', 'Layout Design', 'Color Theory', 'Branding', 'Communication', 'Creativity'],
    nice: ['UI/UX Design', 'Motion Graphics', 'Figma', '3D Design', 'Print Production', 'Photography'],
  },
  'Sales Representative': {
    required: ['Prospecting', 'CRM Software', 'Negotiation', 'Communication', 'Product Knowledge', 'Pipeline Management', 'Closing'],
    nice: ['Salesforce', 'Cold Calling', 'Social Selling', 'Account Management', 'Sales Analytics', 'Contract Negotiation'],
  },
  'HR Manager': {
    required: ['Recruitment', 'Employee Relations', 'Employment Law', 'Performance Management', 'HRIS', 'Communication', 'Conflict Resolution'],
    nice: ['CHRP Designation', 'Compensation & Benefits', 'Training & Development', 'DEI Strategy', 'Change Management', 'Analytics'],
  },
  'Electrician': {
    required: ['Electrical Code', 'Blueprint Reading', 'Troubleshooting', 'Safety Protocols', 'Wiring', 'Circuit Design', 'Power Tools'],
    nice: ['PLC Programming', 'Solar Installation', 'Fire Alarm Systems', 'Industrial Controls', 'Estimating', 'Project Management'],
  },
  'Mechanical Engineer': {
    required: ['CAD (SolidWorks/AutoCAD)', 'Thermodynamics', 'Materials Science', 'FEA', 'Technical Drawing', 'Problem Solving', 'Mathematics'],
    nice: ['CFD', 'GD&T', 'Lean Manufacturing', 'Project Management', '3D Printing', 'MATLAB', 'Six Sigma'],
  },
  'Teacher': {
    required: ['Lesson Planning', 'Classroom Management', 'Assessment', 'Curriculum Development', 'Communication', 'Patience', 'Differentiation'],
    nice: ['EdTech Tools', 'Special Education', 'ESL/ELL', 'Coaching', 'Data-Driven Instruction', 'IEP Development'],
  },
  'Pharmacist': {
    required: ['Medication Dispensing', 'Drug Interactions', 'Patient Counseling', 'Prescription Verification', 'Clinical Knowledge', 'Attention to Detail'],
    nice: ['Compounding', 'Immunization', 'MTM', 'Inventory Management', 'Clinical Trials', 'Specialty Pharmacy'],
  },
  'Financial Analyst': {
    required: ['Financial Modeling', 'Excel (Advanced)', 'Valuation', 'Financial Reporting', 'Data Analysis', 'Presentation', 'Accounting Fundamentals'],
    nice: ['Bloomberg Terminal', 'SQL', 'Python', 'CFA Certification', 'M&A', 'Industry Analysis'],
  },
  'UX Designer': {
    required: ['User Research', 'Wireframing', 'Prototyping', 'Figma', 'Usability Testing', 'Information Architecture', 'Design Thinking'],
    nice: ['HTML/CSS', 'Animation', 'Accessibility (WCAG)', 'Design Systems', 'A/B Testing', 'Analytics'],
  },
  'DevOps Engineer': {
    required: ['Linux', 'CI/CD', 'Docker', 'Cloud (AWS/GCP/Azure)', 'Infrastructure as Code', 'Scripting (Bash/Python)', 'Monitoring'],
    nice: ['Kubernetes', 'Terraform', 'Ansible', 'Security', 'Networking', 'GitOps', 'Service Mesh'],
  },
  'Business Analyst': {
    required: ['Requirements Gathering', 'Process Mapping', 'Stakeholder Management', 'SQL', 'Documentation', 'Communication', 'Problem Solving'],
    nice: ['Agile/Scrum', 'Jira', 'Data Visualization', 'UML', 'CBAP Certification', 'Change Management'],
  },
  'Civil Engineer': {
    required: ['Structural Analysis', 'AutoCAD/Civil 3D', 'Project Management', 'Building Codes', 'Site Planning', 'Mathematics', 'Technical Writing'],
    nice: ['BIM (Revit)', 'Geotechnical', 'Environmental Assessment', 'P.Eng License', 'Estimating', 'GIS'],
  },
  'Dental Hygienist': {
    required: ['Dental Cleanings', 'Periodontal Assessment', 'Radiography', 'Patient Education', 'Infection Control', 'Charting', 'Local Anesthesia'],
    nice: ['Laser Therapy', 'Sealants', 'Whitening', 'Orthodontic Support', 'Practice Management Software'],
  },
  'Social Worker': {
    required: ['Case Management', 'Crisis Intervention', 'Counseling', 'Assessment', 'Documentation', 'Empathy', 'Cultural Competency'],
    nice: ['CBT/DBT', 'Trauma-Informed Care', 'Group Facilitation', 'Community Resources', 'Advocacy', 'Supervision'],
  },
  'Construction Manager': {
    required: ['Project Scheduling', 'Budget Management', 'Blueprint Reading', 'Safety Management', 'Contract Management', 'Team Leadership', 'Building Codes'],
    nice: ['BIM', 'Lean Construction', 'PMP Certification', 'Estimating Software', 'LEED', 'Conflict Resolution'],
  },
  'Plumber': {
    required: ['Pipe Fitting', 'Blueprint Reading', 'Troubleshooting', 'Safety Protocols', 'Building Codes', 'Customer Service', 'Physical Stamina'],
    nice: ['Gas Fitting', 'Backflow Prevention', 'Green Plumbing', 'Estimating', 'Apprentice Training', 'Commercial Systems'],
  },
  'Welder': {
    required: ['MIG/TIG/Stick Welding', 'Blueprint Reading', 'Metal Fabrication', 'Safety Protocols', 'Quality Inspection', 'Mathematics'],
    nice: ['CWB Certification', 'Pipe Welding', 'Underwater Welding', 'Robotic Welding', 'Plasma Cutting', 'NDT'],
  },
  'Truck Driver': {
    required: ['Class 1 License', 'Defensive Driving', 'Vehicle Inspection', 'Trip Planning', 'Load Securement', 'Log Books (ELD)', 'Safety Regulations'],
    nice: ['Dangerous Goods (TDG)', 'Air Brakes', 'Cross-Border', 'Reefer Transport', 'Flatbed Experience', 'GPS/Fleet Systems'],
  },
  'Administrative Assistant': {
    required: ['MS Office Suite', 'Scheduling', 'Communication', 'Organization', 'Data Entry', 'Filing', 'Customer Service'],
    nice: ['Bookkeeping', 'Event Planning', 'Social Media', 'CRM Software', 'Minute Taking', 'Travel Coordination'],
  },
  'Customer Service Rep': {
    required: ['Communication', 'Problem Solving', 'CRM Software', 'Typing Speed', 'Patience', 'Active Listening', 'Multitasking'],
    nice: ['Bilingual', 'Technical Support', 'Sales Skills', 'Zendesk/Freshdesk', 'Quality Assurance', 'Training'],
  },
  'Retail Manager': {
    required: ['Team Leadership', 'Inventory Management', 'Customer Service', 'Sales Strategy', 'POS Systems', 'Scheduling', 'Loss Prevention'],
    nice: ['Visual Merchandising', 'Hiring/Training', 'Budgeting', 'E-commerce', 'Vendor Relations', 'Analytics'],
  },
  'Chef': {
    required: ['Menu Development', 'Food Safety (Safe Food Handler)', 'Kitchen Management', 'Knife Skills', 'Inventory/Ordering', 'Time Management', 'Creativity'],
    nice: ['Pastry/Baking', 'Wine Pairing', 'Catering', 'Cost Control', 'Staff Training', 'Allergen Management'],
  },
  'Physiotherapist': {
    required: ['Assessment', 'Treatment Planning', 'Manual Therapy', 'Exercise Prescription', 'Documentation', 'Patient Education', 'Anatomy Knowledge'],
    nice: ['Sports Rehab', 'Acupuncture/Dry Needling', 'Vestibular Rehab', 'Pediatric PT', 'Telehealth', 'Research'],
  },
  'Paramedic': {
    required: ['Patient Assessment', 'Emergency Protocols', 'BLS/ACLS/PALS', 'Medication Administration', 'Communication', 'Driving (Emergency)', 'Documentation'],
    nice: ['Critical Care Transport', 'Community Paramedicine', 'Hazmat', 'Tactical Medicine', 'Flight Paramedicine', 'Instructor Certification'],
  },
};

export const ROLE_NAMES = Object.keys(ROLES_TO_SKILLS);
