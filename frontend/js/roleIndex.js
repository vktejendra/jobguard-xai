/**
 * JobGuard-XAI / VerityFile
 * Role Index Data (Stub - will be updated by ml/nlp/build_role_index.py)
 */

const ROLE_INDEX = {
  roles: [
    {
      id: 'data_scientist',
      name: 'Data Scientist',
      postingCount: 247,
      topSkills: [
        { name: 'Python', count: 215, pct: 87 },
        { name: 'Machine Learning', count: 189, pct: 76 },
        { name: 'SQL', count: 172, pct: 70 },
        { name: 'Data Analysis', count: 154, pct: 62 },
        { name: 'R', count: 120, pct: 49 },
        { name: 'Pandas / NumPy', count: 112, pct: 45 },
        { name: 'TensorFlow / PyTorch', count: 98, pct: 40 },
        { name: 'Statistics', count: 92, pct: 37 }
      ],
      topLocations: [
        { location: 'US, CA, San Francisco', count: 48 },
        { location: 'US, NY, New York', count: 39 },
        { location: 'US, WA, Seattle', count: 25 },
        { location: 'GB, LND, London', count: 21 },
        { location: 'Remote / Telecommuting', count: 32 }
      ],
      employmentTypes: [
        { type: 'Full-time', count: 205, pct: 83 },
        { type: 'Contract', count: 31, pct: 13 },
        { type: 'Part-time', count: 7, pct: 3 },
        { type: 'Other', count: 4, pct: 1 }
      ],
      samplePostings: [
        {
          title: 'Senior Data Scientist - Predictive Analytics',
          location: 'San Francisco, CA',
          type: 'Full-time',
          industry: 'Information Technology and Services',
          snippet: 'Looking for a Senior Data Scientist to architect predictive models, build end-to-end ML pipelines, and collaborate with product teams on production NLP and churn models.'
        },
        {
          title: 'Lead Machine Learning & Data Scientist',
          location: 'New York, NY',
          type: 'Full-time',
          industry: 'Financial Services',
          snippet: 'Develop statistical algorithms, fraud scoring systems, and scalable analytical pipelines using Python, SQL, and modern cloud infrastructure.'
        }
      ]
    },
    {
      id: 'software_engineer',
      name: 'Software Engineer',
      postingCount: 842,
      topSkills: [
        { name: 'JavaScript / TypeScript', count: 580, pct: 69 },
        { name: 'Python', count: 512, pct: 61 },
        { name: 'Java', count: 420, pct: 50 },
        { name: 'Git & CI/CD', count: 395, pct: 47 },
        { name: 'REST APIs', count: 370, pct: 44 },
        { name: 'Docker / Cloud', count: 340, pct: 40 },
        { name: 'SQL / Databases', count: 310, pct: 37 },
        { name: 'Agile / Scrum', count: 290, pct: 34 }
      ],
      topLocations: [
        { location: 'US, CA, San Jose', count: 120 },
        { location: 'US, NY, New York', count: 95 },
        { location: 'US, TX, Austin', count: 82 },
        { location: 'GB, LND, London', count: 68 },
        { location: 'Remote / Telecommuting', count: 145 }
      ],
      employmentTypes: [
        { type: 'Full-time', count: 710, pct: 84 },
        { type: 'Contract', count: 95, pct: 11 },
        { type: 'Part-time', count: 22, pct: 3 },
        { type: 'Other', count: 15, pct: 2 }
      ],
      samplePostings: [
        {
          title: 'Full Stack Software Engineer',
          location: 'Austin, TX',
          type: 'Full-time',
          industry: 'Computer Software',
          snippet: 'Architect web services and client-side interfaces. Strong proficiency with TypeScript, Node.js, and modern distributed systems.'
        }
      ]
    },
    {
      id: 'web_developer',
      name: 'Web Developer',
      postingCount: 412,
      topSkills: [
        { name: 'HTML5 / CSS3', count: 380, pct: 92 },
        { name: 'JavaScript', count: 350, pct: 85 },
        { name: 'React / Vue', count: 260, pct: 63 },
        { name: 'Responsive Design', count: 220, pct: 53 },
        { name: 'PHP / WordPress', count: 180, pct: 44 },
        { name: 'Git', count: 170, pct: 41 }
      ],
      topLocations: [
        { location: 'US, NY, New York', count: 65 },
        { location: 'US, IL, Chicago', count: 42 },
        { location: 'Remote', count: 95 }
      ],
      employmentTypes: [
        { type: 'Full-time', count: 290, pct: 70 },
        { type: 'Contract', count: 85, pct: 21 },
        { type: 'Part-time', count: 37, pct: 9 }
      ],
      samplePostings: [
        {
          title: 'Frontend Web Developer',
          location: 'Chicago, IL',
          type: 'Full-time',
          industry: 'Internet',
          snippet: 'Create intuitive UI components, optimize web performance, and maintain modern front-end design systems.'
        }
      ]
    },
    {
      id: 'data_analyst',
      name: 'Data Analyst',
      postingCount: 389,
      topSkills: [
        { name: 'SQL', count: 340, pct: 87 },
        { name: 'Excel / Sheets', count: 310, pct: 80 },
        { name: 'Tableau / PowerBI', count: 260, pct: 67 },
        { name: 'Python', count: 195, pct: 50 },
        { name: 'Data Visualization', count: 180, pct: 46 }
      ],
      topLocations: [
        { location: 'US, NY, New York', count: 58 },
        { location: 'US, CA, Los Angeles', count: 40 },
        { location: 'Remote', count: 62 }
      ],
      employmentTypes: [
        { type: 'Full-time', count: 320, pct: 82 },
        { type: 'Contract', count: 50, pct: 13 }
      ],
      samplePostings: [
        {
          title: 'Business & Operations Data Analyst',
          location: 'New York, NY',
          type: 'Full-time',
          industry: 'Management Consulting',
          snippet: 'Extract data trends, build executive dashboards, and translate raw telemetry into actionable business strategies.'
        }
      ]
    },
    {
      id: 'ml_engineer',
      name: 'Machine Learning Engineer',
      postingCount: 165,
      topSkills: [
        { name: 'Python', count: 155, pct: 94 },
        { name: 'PyTorch / TensorFlow', count: 140, pct: 85 },
        { name: 'MLOps / Docker', count: 120, pct: 73 },
        { name: 'Model Optimization', count: 105, pct: 64 },
        { name: 'Cloud (AWS/GCP)', count: 95, pct: 58 }
      ],
      topLocations: [
        { location: 'US, CA, San Francisco', count: 45 },
        { location: 'US, WA, Seattle', count: 30 },
        { location: 'Remote', count: 35 }
      ],
      employmentTypes: [
        { type: 'Full-time', count: 150, pct: 91 },
        { type: 'Contract', count: 15, pct: 9 }
      ],
      samplePostings: [
        {
          title: 'Senior MLOps / Machine Learning Engineer',
          location: 'Seattle, WA',
          type: 'Full-time',
          industry: 'Computer Software',
          snippet: 'Deploy large language models, inference microservices, and monitoring systems for enterprise predictive AI.'
        }
      ]
    },
    {
      id: 'devops_engineer',
      name: 'DevOps Engineer',
      postingCount: 298,
      topSkills: [
        { name: 'Kubernetes / Docker', count: 270, pct: 91 },
        { name: 'AWS / Azure / GCP', count: 250, pct: 84 },
        { name: 'CI/CD Pipelines', count: 235, pct: 79 },
        { name: 'Terraform / IaC', count: 210, pct: 70 },
        { name: 'Linux / Bash', count: 195, pct: 65 }
      ],
      topLocations: [
        { location: 'US, TX, Austin', count: 40 },
        { location: 'US, CA, San Francisco', count: 38 },
        { location: 'Remote', count: 65 }
      ],
      employmentTypes: [
        { type: 'Full-time', count: 260, pct: 87 },
        { type: 'Contract', count: 38, pct: 13 }
      ],
      samplePostings: [
        {
          title: 'Site Reliability / DevOps Engineer',
          location: 'Austin, TX',
          type: 'Full-time',
          industry: 'Information Technology and Services',
          snippet: 'Oversee zero-downtime infrastructure, Kubernetes clusters, and automated continuous delivery.'
        }
      ]
    },
    {
      id: 'product_manager',
      name: 'Product Manager',
      postingCount: 312,
      topSkills: [
        { name: 'Product Roadmapping', count: 275, pct: 88 },
        { name: 'Agile / Scrum', count: 250, pct: 80 },
        { name: 'User Research', count: 210, pct: 67 },
        { name: 'Data Analysis', count: 190, pct: 61 },
        { name: 'Cross-functional Leadership', count: 180, pct: 58 }
      ],
      topLocations: [
        { location: 'US, NY, New York', count: 52 },
        { location: 'US, CA, San Francisco', count: 48 },
        { location: 'Remote', count: 50 }
      ],
      employmentTypes: [
        { type: 'Full-time', count: 295, pct: 95 },
        { type: 'Contract', count: 17, pct: 5 }
      ],
      samplePostings: [
        {
          title: 'Technical Product Manager',
          location: 'New York, NY',
          type: 'Full-time',
          industry: 'Internet',
          snippet: 'Drive product vision, prioritize roadmap initiatives, and partner with engineering to deliver exceptional features.'
        }
      ]
    },
    {
      id: 'project_manager',
      name: 'Project Manager',
      postingCount: 460,
      topSkills: [
        { name: 'PMP / Agile / Scrum', count: 390, pct: 85 },
        { name: 'Stakeholder Management', count: 350, pct: 76 },
        { name: 'Budgeting & Scope', count: 310, pct: 67 },
        { name: 'Jira / Confluence', count: 290, pct: 63 }
      ],
      topLocations: [
        { location: 'US, IL, Chicago', count: 55 },
        { location: 'US, GA, Atlanta', count: 48 },
        { location: 'Remote', count: 70 }
      ],
      employmentTypes: [
        { type: 'Full-time', count: 390, pct: 85 },
        { type: 'Contract', count: 70, pct: 15 }
      ],
      samplePostings: [
        {
          title: 'IT Project Manager',
          location: 'Atlanta, GA',
          type: 'Full-time',
          industry: 'Information Technology and Services',
          snippet: 'Coordinate enterprise migrations, sprint planning, and executive deliverables.'
        }
      ]
    },
    {
      id: 'ux_designer',
      name: 'UX Designer',
      postingCount: 220,
      topSkills: [
        { name: 'Figma / Sketch', count: 205, pct: 93 },
        { name: 'User Research & Wireframing', count: 190, pct: 86 },
        { name: 'Prototyping', count: 170, pct: 77 },
        { name: 'Design Systems', count: 155, pct: 70 }
      ],
      topLocations: [
        { location: 'US, CA, San Francisco', count: 38 },
        { location: 'US, NY, New York', count: 34 },
        { location: 'Remote', count: 45 }
      ],
      employmentTypes: [
        { type: 'Full-time', count: 180, pct: 82 },
        { type: 'Contract', count: 40, pct: 18 }
      ],
      samplePostings: [
        {
          title: 'Senior Product UX/UI Designer',
          location: 'San Francisco, CA',
          type: 'Full-time',
          industry: 'Computer Software',
          snippet: 'Craft user-centric experiences, conduct usability tests, and evolve modern web app design systems.'
        }
      ]
    },
    {
      id: 'graphic_designer',
      name: 'Graphic Designer',
      postingCount: 190,
      topSkills: [
        { name: 'Adobe Photoshop & Illustrator', count: 180, pct: 95 },
        { name: 'Brand Identity', count: 150, pct: 79 },
        { name: 'Typography', count: 130, pct: 68 },
        { name: 'InDesign', count: 110, pct: 58 }
      ],
      topLocations: [
        { location: 'US, CA, Los Angeles', count: 32 },
        { location: 'US, NY, New York', count: 28 },
        { location: 'Remote', count: 35 }
      ],
      employmentTypes: [
        { type: 'Full-time', count: 140, pct: 74 },
        { type: 'Contract', count: 50, pct: 26 }
      ],
      samplePostings: [
        {
          title: 'Creative Brand & Graphic Designer',
          location: 'Los Angeles, CA',
          type: 'Full-time',
          industry: 'Marketing and Advertising',
          snippet: 'Design brand campaigns, visual collateral, and digital media assets.'
        }
      ]
    },
    {
      id: 'marketing_manager',
      name: 'Marketing Manager',
      postingCount: 380,
      topSkills: [
        { name: 'Campaign Strategy', count: 340, pct: 89 },
        { name: 'SEO & SEM', count: 290, pct: 76 },
        { name: 'Content Marketing', count: 260, pct: 68 },
        { name: 'Google Analytics', count: 240, pct: 63 }
      ],
      topLocations: [
        { location: 'US, NY, New York', count: 60 },
        { location: 'US, IL, Chicago', count: 44 },
        { location: 'Remote', count: 55 }
      ],
      employmentTypes: [
        { type: 'Full-time', count: 330, pct: 87 },
        { type: 'Contract', count: 50, pct: 13 }
      ],
      samplePostings: [
        {
          title: 'Growth Marketing Manager',
          location: 'New York, NY',
          type: 'Full-time',
          industry: 'Marketing and Advertising',
          snippet: 'Drive customer acquisition funnels, digital ad campaigns, and brand partnerships.'
        }
      ]
    },
    {
      id: 'sales_executive',
      name: 'Sales Executive',
      postingCount: 520,
      topSkills: [
        { name: 'B2B Sales', count: 480, pct: 92 },
        { name: 'Salesforce / CRM', count: 410, pct: 79 },
        { name: 'Lead Generation & Cold Outreach', count: 370, pct: 71 },
        { name: 'Negotiation & Closing', count: 350, pct: 67 }
      ],
      topLocations: [
        { location: 'US, TX, Dallas', count: 62 },
        { location: 'US, IL, Chicago', count: 58 },
        { location: 'US, NY, New York', count: 54 }
      ],
      employmentTypes: [
        { type: 'Full-time', count: 485, pct: 93 },
        { type: 'Contract', count: 35, pct: 7 }
      ],
      samplePostings: [
        {
          title: 'Enterprise Account Executive',
          location: 'Dallas, TX',
          type: 'Full-time',
          industry: 'Information Technology and Services',
          snippet: 'Close mid-market and enterprise SaaS software subscriptions and expand revenue pipelines.'
        }
      ]
    },
    {
      id: 'hr_manager',
      name: 'HR Manager',
      postingCount: 275,
      topSkills: [
        { name: 'Employee Relations', count: 250, pct: 91 },
        { name: 'Talent Acquisition', count: 220, pct: 80 },
        { name: 'HRIS / Workday', count: 190, pct: 69 },
        { name: 'Compliance & Labor Law', count: 175, pct: 64 }
      ],
      topLocations: [
        { location: 'US, NY, New York', count: 42 },
        { location: 'US, TX, Houston', count: 35 },
        { location: 'US, CA, Los Angeles', count: 30 }
      ],
      employmentTypes: [
        { type: 'Full-time', count: 255, pct: 93 },
        { type: 'Contract', count: 20, pct: 7 }
      ],
      samplePostings: [
        {
          title: 'People Operations / HR Manager',
          location: 'Houston, TX',
          type: 'Full-time',
          industry: 'Human Resources',
          snippet: 'Direct employee engagement, onboarding programs, performance reviews, and compliance.'
        }
      ]
    },
    {
      id: 'financial_analyst',
      name: 'Financial Analyst',
      postingCount: 260,
      topSkills: [
        { name: 'Financial Modeling', count: 245, pct: 94 },
        { name: 'Advanced Excel', count: 230, pct: 88 },
        { name: 'Forecasting & Budgeting', count: 195, pct: 75 },
        { name: 'Variance Analysis', count: 170, pct: 65 }
      ],
      topLocations: [
        { location: 'US, NY, New York', count: 68 },
        { location: 'US, NC, Charlotte', count: 32 },
        { location: 'US, IL, Chicago', count: 28 }
      ],
      employmentTypes: [
        { type: 'Full-time', count: 240, pct: 92 },
        { type: 'Contract', count: 20, pct: 8 }
      ],
      samplePostings: [
        {
          title: 'Corporate Financial Analyst',
          location: 'New York, NY',
          type: 'Full-time',
          industry: 'Financial Services',
          snippet: 'Build quarterly projections, analyze financial statements, and support strategic investor reports.'
        }
      ]
    },
    {
      id: 'business_analyst',
      name: 'Business Analyst',
      postingCount: 345,
      topSkills: [
        { name: 'Requirements Gathering', count: 310, pct: 90 },
        { name: 'SQL & Data Mapping', count: 260, pct: 75 },
        { name: 'Process Flow (BPMN)', count: 230, pct: 67 },
        { name: 'Agile User Stories', count: 215, pct: 62 }
      ],
      topLocations: [
        { location: 'US, NY, New York', count: 48 },
        { location: 'US, GA, Atlanta', count: 38 },
        { location: 'Remote', count: 50 }
      ],
      employmentTypes: [
        { type: 'Full-time', count: 300, pct: 87 },
        { type: 'Contract', count: 45, pct: 13 }
      ],
      samplePostings: [
        {
          title: 'Senior Business Systems Analyst',
          location: 'Atlanta, GA',
          type: 'Full-time',
          industry: 'Banking',
          snippet: 'Liaise between executive leadership and engineering teams to document business requirements.'
        }
      ]
    },
    {
      id: 'content_writer',
      name: 'Content Writer',
      postingCount: 170,
      topSkills: [
        { name: 'Copywriting & Editing', count: 160, pct: 94 },
        { name: 'SEO Optimization', count: 140, pct: 82 },
        { name: 'Content Strategy', count: 110, pct: 65 },
        { name: 'CMS (WordPress)', count: 95, pct: 56 }
      ],
      topLocations: [
        { location: 'US, NY, New York', count: 28 },
        { location: 'Remote', count: 68 }
      ],
      employmentTypes: [
        { type: 'Full-time', count: 110, pct: 65 },
        { type: 'Contract', count: 48, pct: 28 },
        { type: 'Part-time', count: 12, pct: 7 }
      ],
      samplePostings: [
        {
          title: 'Technical Content & Blog Writer',
          location: 'Remote',
          type: 'Contract',
          industry: 'Publishing',
          snippet: 'Write engaging technical articles, product case studies, and thought leadership articles.'
        }
      ]
    },
    {
      id: 'customer_service',
      name: 'Customer Service Representative',
      postingCount: 710,
      topSkills: [
        { name: 'Customer Support / Zendesk', count: 640, pct: 90 },
        { name: 'Verbal & Written Communication', count: 610, pct: 86 },
        { name: 'Problem Resolution', count: 520, pct: 73 },
        { name: 'Call Center Metrics', count: 410, pct: 58 }
      ],
      topLocations: [
        { location: 'US, FL, Orlando', count: 75 },
        { location: 'US, TX, San Antonio', count: 68 },
        { location: 'US, OH, Columbus', count: 52 },
        { location: 'Remote', count: 110 }
      ],
      employmentTypes: [
        { type: 'Full-time', count: 590, pct: 83 },
        { type: 'Part-time', count: 85, pct: 12 },
        { type: 'Temporary', count: 35, pct: 5 }
      ],
      samplePostings: [
        {
          title: 'Remote Inbound Customer Support Specialist',
          location: 'Remote',
          type: 'Full-time',
          industry: 'Consumer Services',
          snippet: 'Provide first-call resolution to tier-1 inbound questions via phone, ticket, and chat.'
        }
      ]
    },
    {
      id: 'operations_manager',
      name: 'Operations Manager',
      postingCount: 235,
      topSkills: [
        { name: 'Operations Planning', count: 215, pct: 91 },
        { name: 'Process Optimization', count: 190, pct: 81 },
        { name: 'Team Leadership', count: 180, pct: 77 },
        { name: 'KPI Tracking', count: 160, pct: 68 }
      ],
      topLocations: [
        { location: 'US, CA, Los Angeles', count: 35 },
        { location: 'US, TX, Dallas', count: 30 }
      ],
      employmentTypes: [
        { type: 'Full-time', count: 220, pct: 94 },
        { type: 'Contract', count: 15, pct: 6 }
      ],
      samplePostings: [
        {
          title: 'Supply Chain & Operations Manager',
          location: 'Dallas, TX',
          type: 'Full-time',
          industry: 'Logistics and Supply Chain',
          snippet: 'Drive fulfillment efficiency, inventory accuracy, and regional carrier relationships.'
        }
      ]
    },
    {
      id: 'accountant',
      name: 'Accountant',
      postingCount: 295,
      topSkills: [
        { name: 'General Ledger & GAAP', count: 280, pct: 95 },
        { name: 'QuickBooks / NetSuite', count: 240, pct: 81 },
        { name: 'Account Reconciliation', count: 225, pct: 76 },
        { name: 'Tax Preparation', count: 170, pct: 58 }
      ],
      topLocations: [
        { location: 'US, NY, New York', count: 45 },
        { location: 'US, CA, Los Angeles', count: 35 },
        { location: 'US, FL, Miami', count: 28 }
      ],
      employmentTypes: [
        { type: 'Full-time', count: 265, pct: 90 },
        { type: 'Contract', count: 30, pct: 10 }
      ],
      samplePostings: [
        {
          title: 'Senior Staff Accountant',
          location: 'Miami, FL',
          type: 'Full-time',
          industry: 'Accounting',
          snippet: 'Prepare journal entries, conduct monthly closing, and coordinate internal audit reviews.'
        }
      ]
    },
    {
      id: 'recruiter',
      name: 'Recruiter',
      postingCount: 220,
      topSkills: [
        { name: 'Talent Sourcing', count: 205, pct: 93 },
        { name: 'LinkedIn Recruiter', count: 190, pct: 86 },
        { name: 'Interviewing & Screening', count: 175, pct: 80 },
        { name: 'ATS Systems (Greenhouse/Lever)', count: 155, pct: 70 }
      ],
      topLocations: [
        { location: 'US, NY, New York', count: 38 },
        { location: 'US, CA, San Francisco', count: 32 },
        { location: 'Remote', count: 48 }
      ],
      employmentTypes: [
        { type: 'Full-time', count: 185, pct: 84 },
        { type: 'Contract', count: 35, pct: 16 }
      ],
      samplePostings: [
        {
          title: 'Technical Talent Recruiter',
          location: 'Remote',
          type: 'Full-time',
          industry: 'Staffing and Recruiting',
          snippet: 'Manage full-cycle hiring pipelines for high-growth software engineering positions.'
        }
      ]
    },
    {
      id: 'network_engineer',
      name: 'Network Engineer',
      postingCount: 160,
      topSkills: [
        { name: 'Cisco Routing & Switching', count: 150, pct: 94 },
        { name: 'Firewalls & VPNs', count: 135, pct: 84 },
        { name: 'TCP/IP & DNS', count: 125, pct: 78 },
        { name: 'Network Monitoring', count: 105, pct: 66 }
      ],
      topLocations: [
        { location: 'US, VA, Ashburn', count: 30 },
        { location: 'US, TX, Dallas', count: 24 }
      ],
      employmentTypes: [
        { type: 'Full-time', count: 145, pct: 91 },
        { type: 'Contract', count: 15, pct: 9 }
      ],
      samplePostings: [
        {
          title: 'Infrastructure Network Engineer',
          location: 'Ashburn, VA',
          type: 'Full-time',
          industry: 'Telecommunications',
          snippet: 'Maintain data center switches, routing protocols, and perimeter firewall security.'
        }
      ]
    },
    {
      id: 'database_admin',
      name: 'Database Administrator',
      postingCount: 145,
      topSkills: [
        { name: 'PostgreSQL / MySQL / Oracle', count: 140, pct: 97 },
        { name: 'Query Optimization & Indexing', count: 125, pct: 86 },
        { name: 'Backup & Disaster Recovery', count: 115, pct: 79 },
        { name: 'High Availability Replication', count: 95, pct: 66 }
      ],
      topLocations: [
        { location: 'US, NY, New York', count: 26 },
        { location: 'US, NC, Raleigh', count: 20 }
      ],
      employmentTypes: [
        { type: 'Full-time', count: 135, pct: 93 },
        { type: 'Contract', count: 10, pct: 7 }
      ],
      samplePostings: [
        {
          title: 'Senior Database Administrator (DBA)',
          location: 'Raleigh, NC',
          type: 'Full-time',
          industry: 'Information Technology and Services',
          snippet: 'Manage multi-terabyte transactional database clusters and automated backup protocols.'
        }
      ]
    },
    {
      id: 'qa_engineer',
      name: 'QA Engineer',
      postingCount: 230,
      topSkills: [
        { name: 'Test Automation (Selenium/Cypress)', count: 205, pct: 89 },
        { name: 'Manual Testing & Test Plans', count: 195, pct: 85 },
        { name: 'Jira & Defect Tracking', count: 175, pct: 76 },
        { name: 'API Testing (Postman)', count: 160, pct: 70 }
      ],
      topLocations: [
        { location: 'US, CA, San Jose', count: 35 },
        { location: 'US, TX, Austin', count: 28 },
        { location: 'Remote', count: 42 }
      ],
      employmentTypes: [
        { type: 'Full-time', count: 205, pct: 89 },
        { type: 'Contract', count: 25, pct: 11 }
      ],
      samplePostings: [
        {
          title: 'Software Quality Assurance Automation Engineer',
          location: 'Austin, TX',
          type: 'Full-time',
          industry: 'Computer Software',
          snippet: 'Author automated end-to-end regression suites and collaborate with continuous deployment pipelines.'
        }
      ]
    },
    {
      id: 'mobile_developer',
      name: 'Mobile Developer',
      postingCount: 185,
      topSkills: [
        { name: 'React Native / Flutter', count: 165, pct: 89 },
        { name: 'iOS (Swift) / Android (Kotlin)', count: 150, pct: 81 },
        { name: 'Mobile UI/UX Standards', count: 130, pct: 70 },
        { name: 'App Store / Play Store Deployment', count: 115, pct: 62 }
      ],
      topLocations: [
        { location: 'US, CA, Los Angeles', count: 30 },
        { location: 'US, NY, New York', count: 28 },
        { location: 'Remote', count: 38 }
      ],
      employmentTypes: [
        { type: 'Full-time', count: 160, pct: 86 },
        { type: 'Contract', count: 25, pct: 14 }
      ],
      samplePostings: [
        {
          title: 'Mobile Application Developer (iOS/Android)',
          location: 'Los Angeles, CA',
          type: 'Full-time',
          industry: 'Computer Software',
          snippet: 'Engineer high-performance cross-platform mobile apps with seamless real-time syncing.'
        }
      ]
    },
    {
      id: 'full_stack_developer',
      name: 'Full Stack Developer',
      postingCount: 490,
      topSkills: [
        { name: 'JavaScript / Node.js / React', count: 460, pct: 94 },
        { name: 'SQL & NoSQL Databases', count: 410, pct: 84 },
        { name: 'REST & GraphQL APIs', count: 375, pct: 77 },
        { name: 'Cloud & Docker', count: 320, pct: 65 }
      ],
      topLocations: [
        { location: 'US, NY, New York', count: 70 },
        { location: 'US, CA, San Francisco', count: 65 },
        { location: 'Remote', count: 90 }
      ],
      employmentTypes: [
        { type: 'Full-time', count: 425, pct: 87 },
        { type: 'Contract', count: 65, pct: 13 }
      ],
      samplePostings: [
        {
          title: 'Lead Full Stack Web Developer',
          location: 'New York, NY',
          type: 'Full-time',
          industry: 'Internet',
          snippet: 'Design resilient microservices, reactive frontend web interfaces, and automated CI pipelines.'
        }
      ]
    }
  ],
  lastUpdated: '2026-10-21T00:00:00Z',
  totalPostings: 7425,
  legitimateOnly: true,
  isStub: true
};

if (typeof window !== 'undefined') {
  window.ROLE_INDEX = ROLE_INDEX;
}
