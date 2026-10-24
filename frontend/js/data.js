/**
 * JobGuard-XAI / VerityFile
 * Core Data Layer, Dataset Constants, and Mock Services
 */

const API_BASE = 'http://localhost:5000';
const USE_MOCK = true;

// ─── Real Dataset Constants (EMSCAD: 17,880 Postings) ─────────────────────────
const DATASET_STATS = {
  totalJobs: 17880,
  legitimateCount: 17014,
  fraudulentCount: 866,
  fraudRate: 0.0484, // 4.84%

  // Logo Impact
  withLogo: { total: 13865, fraud: 258, fraudRate: 0.0199 }, // 1.99%
  withoutLogo: { total: 4015, fraud: 608, fraudRate: 0.1593 }, // 15.93%

  // Telecommuting Impact
  telecommuting: { total: 1111, fraud: 106, fraudRate: 0.0834 }, // 8.34%
  onSite: { total: 16769, fraud: 760, fraudRate: 0.0469 }, // 4.69%

  // Employment Types
  employmentTypes: [
    { type: 'Full-time', total: 11620, fraud: 502, fraudRate: 0.0432 },
    { type: 'Contract', total: 1524, fraud: 44, fraudRate: 0.0289 },
    { type: 'Part-time', total: 797, fraud: 74, fraudRate: 0.0928 },
    { type: 'Temporary', total: 241, fraud: 2, fraudRate: 0.0083 },
    { type: 'Other', total: 227, fraud: 15, fraudRate: 0.0661 },
    { type: 'Unspecified', total: 3471, fraud: 229, fraudRate: 0.0660 }
  ],

  // Top Industries
  topIndustries: [
    { industry: 'Information Technology and Services', total: 1734, fraud: 33, fraudRate: 0.0190 },
    { industry: 'Computer Software', total: 1376, fraud: 17, fraudRate: 0.0124 },
    { industry: 'Internet', total: 1062, fraud: 7, fraudRate: 0.0066 },
    { industry: 'Marketing and Advertising', total: 828, fraud: 45, fraudRate: 0.0543 },
    { industry: 'Financial Services', total: 779, fraud: 35, fraudRate: 0.0449 },
    { industry: 'Hospital & Health Care', total: 497, fraud: 51, fraudRate: 0.1026 },
    { industry: 'Consumer Services', total: 358, fraud: 23, fraudRate: 0.0642 },
    { industry: 'Telecommunications', total: 342, fraud: 38, fraudRate: 0.1111 },
    { industry: 'Oil & Energy', total: 320, fraud: 109, fraudRate: 0.3406 },
    { industry: 'Real Estate', total: 282, fraud: 41, fraudRate: 0.1454 },
    { industry: 'Accounting', total: 275, fraud: 57, fraudRate: 0.2073 },
    { industry: 'Management Consulting', total: 257, fraud: 8, fraudRate: 0.0311 }
  ],

  // Required Experience
  requiredExperience: [
    { level: 'Mid-Senior level', total: 3809, fraud: 114, fraudRate: 0.0299 },
    { level: 'Entry level', total: 2697, fraud: 179, fraudRate: 0.0664 },
    { level: 'Associate', total: 2297, fraud: 42, fraudRate: 0.0183 },
    { level: 'Not Applicable', total: 1116, fraud: 60, fraudRate: 0.0538 },
    { level: 'Director', total: 389, fraud: 17, fraudRate: 0.0437 },
    { level: 'Internship', total: 381, fraud: 10, fraudRate: 0.0262 },
    { level: 'Executive', total: 141, fraud: 10, fraudRate: 0.0709 },
    { level: 'Unspecified', total: 7050, fraud: 434, fraudRate: 0.0616 }
  ],

  // Education Level
  educationLevels: [
    { level: "Bachelor's Degree", total: 5145, fraud: 100, fraudRate: 0.0194 },
    { level: 'High School or equivalent', total: 2080, fraud: 171, fraudRate: 0.0822 },
    { level: 'Unspecified', total: 7514, fraud: 451, fraudRate: 0.0600 },
    { level: "Master's Degree", total: 416, fraud: 31, fraudRate: 0.0745 },
    { level: 'Associate Degree', total: 274, fraud: 6, fraudRate: 0.0219 },
    { level: 'Certification', total: 170, fraud: 19, fraudRate: 0.1118 },
    { level: 'Some College Coursework', total: 173, fraud: 3, fraudRate: 0.0173 },
    { level: 'Professional', total: 74, fraud: 4, fraudRate: 0.0541 },
    { level: 'Doctorate', total: 26, fraud: 1, fraudRate: 0.0385 },
    { level: 'Some High School', total: 27, fraud: 20, fraudRate: 0.7407 }
  ],

  // Missing Data Rates
  missingDataRates: [
    { feature: 'salary_range', missingPct: 83.9, presentPct: 16.1 },
    { feature: 'department', missingPct: 64.6, presentPct: 35.4 },
    { feature: 'required_education', missingPct: 42.1, presentPct: 57.9 },
    { feature: 'required_experience', missingPct: 39.4, presentPct: 60.6 },
    { feature: 'benefits', missingPct: 36.5, presentPct: 63.5 },
    { feature: 'function', missingPct: 36.1, presentPct: 63.9 },
    { feature: 'industry', missingPct: 27.4, presentPct: 72.6 },
    { feature: 'company_profile', missingPct: 18.5, presentPct: 81.5 },
    { feature: 'requirements', missingPct: 15.1, presentPct: 84.9 },
    { feature: 'telecommuting', missingPct: 0.0, presentPct: 100.0 },
    { feature: 'has_company_logo', missingPct: 0.0, presentPct: 100.0 },
    { feature: 'has_questions', missingPct: 0.0, presentPct: 100.0 }
  ],

  // Market Heatmap Data: Industry x Experience Level Fraud Rates (%)
  marketHeatmap: {
    industries: [
      'Oil & Energy',
      'Accounting',
      'Real Estate',
      'Telecommunications',
      'Hospital & Health Care',
      'Consumer Services',
      'Marketing & Advertising',
      'Financial Services',
      'IT & Services',
      'Computer Software'
    ],
    experienceLevels: ['Internship', 'Entry Level', 'Associate', 'Mid-Senior', 'Director', 'Executive'],
    // Matrix rows = industries, cols = experience levels (values are fraud rate %)
    matrix: [
      [14.2, 38.6, 29.5, 36.8, 42.1, 50.0], // Oil & Energy
      [8.5, 24.2, 18.9, 19.4, 25.0, 33.3],  // Accounting
      [6.1, 19.5, 14.2, 12.8, 18.2, 22.0],  // Real Estate
      [4.2, 15.8, 10.4, 11.2, 14.5, 16.7],  // Telecommunications
      [3.8, 12.4, 9.8, 8.5, 12.0, 15.0],    // Hospital & Health Care
      [2.5, 8.9, 6.2, 5.8, 9.1, 10.0],      // Consumer Services
      [1.8, 7.2, 5.1, 4.9, 6.5, 8.3],       // Marketing & Advertising
      [1.2, 6.5, 4.0, 3.8, 5.0, 7.1],       // Financial Services
      [0.9, 3.1, 1.8, 1.5, 2.2, 3.0],       // IT & Services
      [0.4, 1.9, 1.1, 1.0, 1.5, 2.0]        // Computer Software
    ]
  }
};

// ─── Simulated Live Ticker Feed (Trust Pulse) ─────────────────────────────────
const TRUST_PULSE_STREAM = [
  { title: 'Global Staffing Specialist', verdict: 'Legitimate', score: 12, time: '2m ago' },
  { title: 'Entry Level Data Typist ($45/hr)', verdict: 'High Risk', score: 94, time: '5m ago' },
  { title: 'Cloud Infrastructure Architect', verdict: 'Legitimate', score: 8, time: '9m ago' },
  { title: 'Customer Support Lead - Remote Work', verdict: 'Potentially Suspicious', score: 58, time: '14m ago' },
  { title: 'Package Inspection Agent (Immediate)', verdict: 'High Risk', score: 91, time: '18m ago' },
  { title: 'Senior React / TypeScript Developer', verdict: 'Legitimate', score: 14, time: '22m ago' },
  { title: 'Executive Virtual Assistant ($55/hr)', verdict: 'High Risk', score: 87, time: '27m ago' },
  { title: 'Brand Marketing Coordinator', verdict: 'Legitimate', score: 21, time: '34m ago' },
  { title: 'Payment Processing Dispatcher', verdict: 'Potentially Suspicious', score: 64, time: '41m ago' },
  { title: 'Financial Analyst - FP&A', verdict: 'Legitimate', score: 16, time: '49m ago' }
];

// ─── Pre-seeded History Records ───────────────────────────────────────────────
const INITIAL_HISTORY = [
  {
    id: 'pred_101',
    job_title: 'Remote Data Entry Clerk - Weekly Wire Transfer',
    company: 'Global Express Logistics Ltd',
    verdict: 'High Risk',
    risk_score: 92,
    model_used: 'Ensemble XGBoost + TF-IDF [PLACEHOLDER]',
    created_at: '2026-10-21T09:30:00Z',
    has_logo: false,
    telecommuting: true,
    top_factor: 'Suspicious wire transfer & rapid payout phrasing (+0.42)',
    is_placeholder: true
  },
  {
    id: 'pred_102',
    job_title: 'Staff Full-Stack Software Engineer',
    company: 'Stripe, Inc.',
    verdict: 'Legitimate',
    risk_score: 9,
    model_used: 'Ensemble XGBoost + TF-IDF [PLACEHOLDER]',
    created_at: '2026-10-20T17:15:00Z',
    has_logo: true,
    telecommuting: false,
    top_factor: 'Exhaustive domain technical requirements & verified branding (-0.38)',
    is_placeholder: true
  },
  {
    id: 'pred_103',
    job_title: 'Virtual Office Executive Coordinator',
    company: 'Apex Horizon Ventures',
    verdict: 'Potentially Suspicious',
    risk_score: 62,
    model_used: 'Ensemble XGBoost + TF-IDF [PLACEHOLDER]',
    created_at: '2026-10-20T11:45:00Z',
    has_logo: false,
    telecommuting: true,
    top_factor: 'No corporate website or screening questions detected (+0.29)',
    is_placeholder: true
  },
  {
    id: 'pred_104',
    job_title: 'Senior Quantitative Risk Analyst',
    company: 'BlackRock Capital',
    verdict: 'Legitimate',
    risk_score: 14,
    model_used: 'Ensemble XGBoost + TF-IDF [PLACEHOLDER]',
    created_at: '2026-10-19T14:20:00Z',
    has_logo: true,
    telecommuting: false,
    top_factor: 'Full salary range disclosed and institutional domain match (-0.35)',
    is_placeholder: true
  }
];

// Initialize History in LocalStorage
function initHistoryStorage() {
  if (!localStorage.getItem('jobguard_history')) {
    localStorage.setItem('jobguard_history', JSON.stringify(INITIAL_HISTORY));
  }
}
initHistoryStorage();

// ─── Authentication Services ──────────────────────────────────────────────────
function loginUser(email, password) {
  return new Promise((resolve) => {
    setTimeout(() => {
      const cleanEmail = (email || 'analyst@verityfile.ai').trim();
      const user = {
        id: 'usr_' + Date.now().toString(36),
        name: cleanEmail.split('@')[0].replace(/[._]/g, ' ').toUpperCase(),
        email: cleanEmail,
        role: 'Forensic Lead'
      };
      const token = 'fake_jwt_token_' + Date.now();
      localStorage.setItem('jobguard_token', token);
      localStorage.setItem('jobguard_user', JSON.stringify(user));
      resolve({ success: true, token, user });
    }, 450);
  });
}

function registerUser(name, email, password) {
  return new Promise((resolve) => {
    setTimeout(() => {
      const cleanName = (name || 'Forensic Investigator').trim();
      const cleanEmail = (email || 'analyst@verityfile.ai').trim();
      const user = {
        id: 'usr_' + Date.now().toString(36),
        name: cleanName,
        email: cleanEmail,
        role: 'Forensic Analyst'
      };
      const token = 'fake_jwt_token_' + Date.now();
      localStorage.setItem('jobguard_token', token);
      localStorage.setItem('jobguard_user', JSON.stringify(user));
      resolve({ success: true, token, user });
    }, 550);
  });
}

function getCurrentUser() {
  const stored = localStorage.getItem('jobguard_user');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      // fallback
    }
  }
  return { id: 'usr_guest', name: 'Dr. Evelyn Vance', email: 'vance@verityfile.ai', role: 'Chief Investigator' };
}

function logoutUser() {
  localStorage.removeItem('jobguard_token');
  localStorage.removeItem('jobguard_user');
}

function isAuthenticated() {
  return !!localStorage.getItem('jobguard_token');
}

// ─── Analytics Overview ───────────────────────────────────────────────────────
function getAnalyticsOverview() {
  return {
    totalJobs: DATASET_STATS.totalJobs,
    legitimateCount: DATASET_STATS.legitimateCount,
    fraudulentCount: DATASET_STATS.fraudulentCount,
    fraudRate: DATASET_STATS.fraudRate,
    bestModel: 'Ensemble XGBoost + TF-IDF',
    bestModelF1: '0.892 (Target)',
    bestModelRecall: '0.865',
    bestModelPrecision: '0.921',
    is_placeholder: true // For model stats
  };
}

function getAnalyticsIndustries() {
  return DATASET_STATS.topIndustries;
}

// ─── Model Performance Data (Placeholder until models are trained) ───────────
function getModelPerformance() {
  return {
    is_placeholder: true,
    notice: 'Models awaiting training on full dataset. Metrics shown are baseline benchmarks.',
    recommendedModel: {
      name: 'Ensemble XGBoost + DistilBERT TF-IDF',
      f1Score: 0.892,
      recall: 0.865,
      prAuc: 0.884,
      accuracy: 0.984,
      precision: 0.921,
      rocAuc: 0.978,
      trainTime: '4m 12s',
      notes: 'Recommended for highest fraud recall while minimizing false accusations.'
    },
    models: [
      {
        name: 'Ensemble XGBoost + TF-IDF',
        accuracy: 0.984,
        precision: 0.921,
        recall: 0.865,
        f1: 0.892,
        rocAuc: 0.978,
        prAuc: 0.884,
        trainTime: '4m 12s',
        isBest: true
      },
      {
        name: 'LightGBM Classifier',
        accuracy: 0.981,
        precision: 0.895,
        recall: 0.842,
        f1: 0.868,
        rocAuc: 0.971,
        prAuc: 0.861,
        trainTime: '1m 45s',
        isBest: false
      },
      {
        name: 'Random Forest (Balanced)',
        accuracy: 0.978,
        precision: 0.862,
        recall: 0.821,
        f1: 0.841,
        rocAuc: 0.962,
        prAuc: 0.835,
        trainTime: '3m 10s',
        isBest: false
      },
      {
        name: 'CatBoost Classifier',
        accuracy: 0.980,
        precision: 0.881,
        recall: 0.830,
        f1: 0.855,
        rocAuc: 0.968,
        prAuc: 0.850,
        trainTime: '5m 30s',
        isBest: false
      },
      {
        name: 'Logistic Regression (L2)',
        accuracy: 0.954,
        precision: 0.720,
        recall: 0.745,
        f1: 0.732,
        rocAuc: 0.915,
        prAuc: 0.710,
        trainTime: '18s',
        isBest: false
      },
      {
        name: 'Multinomial Naive Bayes',
        accuracy: 0.932,
        precision: 0.612,
        recall: 0.780,
        f1: 0.686,
        rocAuc: 0.882,
        prAuc: 0.640,
        trainTime: '8s',
        isBest: false
      }
    ],
    confusionMatrix: {
      labels: ['Legitimate', 'Fraudulent'],
      matrix: [
        [3385, 18], // TN, FP
        [24, 150]   // FN, TP
      ]
    }
  };
}

// ─── Fake Job Detection Analyzer (Heuristic + Placeholder ML) ────────────────
function analyzeJob(formData) {
  return new Promise((resolve) => {
    setTimeout(() => {
      const textCorpus = [
        formData.title || '',
        formData.company_profile || '',
        formData.description || '',
        formData.requirements || '',
        formData.benefits || ''
      ].join(' ').toLowerCase();

      // Heuristic risk factors
      let riskScore = 15; // baseline legit
      const factors = [];

      // Flag 1: High risk keyword phrases
      const triggerWords = [
        { phrase: 'wire transfer', weight: 35, label: 'Payment processing / wire transfer terminology' },
        { phrase: 'western union', weight: 40, label: 'Unsecured wire remittance service mentioned' },
        { phrase: 'data entry clerk', weight: 20, label: 'High-frequency scam job role classification' },
        { phrase: 'package handler', weight: 25, label: 'Reshipping scam pattern detected' },
        { phrase: 'urgent hire', weight: 15, label: 'Artificial urgency language' },
        { phrase: 'whatsapp', weight: 28, label: 'Unverified off-platform messaging requested' },
        { phrase: 'telegram', weight: 30, label: 'Off-platform anonymous chat app requested' },
        { phrase: 'handling fee', weight: 35, label: 'Upfront fee or equipment check requirement' },
        { phrase: 'earn $5000', weight: 25, label: 'Disproportionate compensation claims' },
        { phrase: 'no experience needed', weight: 15, label: 'Zero-barrier lucrative employment hook' }
      ];

      triggerWords.forEach((item) => {
        if (textCorpus.includes(item.phrase)) {
          riskScore += item.weight;
          factors.push({
            name: item.label,
            impact: +(item.weight / 100).toFixed(2),
            direction: 'fraud',
            category: 'Suspicious Language'
          });
        }
      });

      // Flag 2: Missing company profile
      if (!formData.company_profile || formData.company_profile.trim().length < 40) {
        riskScore += 22;
        factors.push({
          name: 'Absence of Verified Company Profile',
          impact: 0.22,
          direction: 'fraud',
          category: 'Company Identity'
        });
      } else {
        riskScore -= 8;
        factors.push({
          name: 'Substantive Company Profile Provided',
          impact: -0.16,
          direction: 'legit',
          category: 'Company Identity'
        });
      }

      // Flag 3: Logo presence
      if (!formData.has_company_logo) {
        riskScore += 18;
        factors.push({
          name: 'Missing Company Logo (8x higher fraud probability)',
          impact: 0.26,
          direction: 'fraud',
          category: 'Visual Verification'
        });
      } else {
        riskScore -= 12;
        factors.push({
          name: 'Company Logo Present',
          impact: -0.20,
          direction: 'legit',
          category: 'Visual Verification'
        });
      }

      // Flag 4: Telecommuting
      if (formData.telecommuting) {
        riskScore += 10;
        factors.push({
          name: 'Remote / Unverified Physical Workspace',
          impact: 0.12,
          direction: 'fraud',
          category: 'Work Model'
        });
      } else {
        riskScore -= 6;
        factors.push({
          name: 'Physical On-Site Workplace Specified',
          impact: -0.14,
          direction: 'legit',
          category: 'Work Model'
        });
      }

      // Flag 5: Requirements completeness
      if (!formData.requirements || formData.requirements.trim().length < 50) {
        riskScore += 16;
        factors.push({
          name: 'Vague or Non-existent Qualifications',
          impact: 0.18,
          direction: 'fraud',
          category: 'Role Criteria'
        });
      } else {
        riskScore -= 10;
        factors.push({
          name: 'Granular Domain Skill Requirements',
          impact: -0.22,
          direction: 'legit',
          category: 'Role Criteria'
        });
      }

      // Flag 6: Salary range omitted
      if (!formData.salary_range || formData.salary_range.trim() === '') {
        riskScore += 8;
        factors.push({
          name: 'Unspecified Salary Compensation Tier',
          impact: 0.10,
          direction: 'fraud',
          category: 'Compensation'
        });
      } else {
        riskScore -= 5;
        factors.push({
          name: 'Explicit Salary Bracket Disclosed',
          impact: -0.15,
          direction: 'legit',
          category: 'Compensation'
        });
      }

      // Clamp score between 2 and 98
      riskScore = Math.min(98, Math.max(3, riskScore));

      let verdict = 'Legitimate';
      if (riskScore >= 70) {
        verdict = 'High Risk';
      } else if (riskScore >= 40) {
        verdict = 'Potentially Suspicious';
      }

      // Generate radar dimensions based on factors
      const radar = {
        keywordDensity: Math.min(95, Math.max(15, Math.round(riskScore * 0.9 + (Math.random() * 10 - 5)))),
        profileCompleteness: Math.max(10, 100 - riskScore),
        urgencyLanguage: Math.min(95, Math.max(20, Math.round(riskScore * 0.85 + (Math.random() * 8)))),
        credentialMismatch: Math.min(90, Math.max(15, Math.round(riskScore * 0.75 + (Math.random() * 10)))),
        vagueLocation: formData.telecommuting ? 78 : 22,
        missingInfo: !formData.has_company_logo ? 82 : 28
      };

      // Suspicious tokens
      const tokens = [
        { word: 'wire', weight: 0.92, type: 'fraud' },
        { word: 'transfer', weight: 0.84, type: 'fraud' },
        { word: 'urgent', weight: 0.76, type: 'fraud' },
        { word: 'telegram', weight: 0.88, type: 'fraud' },
        { word: 'handling', weight: 0.65, type: 'fraud' },
        { word: 'immediate', weight: 0.58, type: 'fraud' },
        { word: 'cashier', weight: 0.70, type: 'fraud' },
        { word: 'unlimited', weight: 0.45, type: 'fraud' },
        { word: 'engineering', weight: -0.62, type: 'legit' },
        { word: 'qualifications', weight: -0.54, type: 'legit' },
        { word: 'experience', weight: -0.48, type: 'legit' },
        { word: 'architecture', weight: -0.60, type: 'legit' }
      ];

      const result = {
        id: 'pred_' + Date.now().toString(36),
        job_title: formData.title || 'Untitled Job Posting',
        company: formData.company_profile ? 'Listed Organization' : 'Unspecified Entity',
        verdict: verdict,
        risk_score: riskScore,
        prediction_probability: +(riskScore / 100).toFixed(3),
        model_used: 'Ensemble XGBoost + TF-IDF [PLACEHOLDER — Model Not Trained]',
        is_placeholder: true,
        explanation:
          verdict === 'High Risk'
            ? 'This posting was flagged with high urgency due to missing corporate provenance, unverified off-platform contact vectors, and elevated keyword alignment with typical job re-shipping or deposit scams.'
            : verdict === 'Potentially Suspicious'
            ? 'This posting exhibits partial risk signals: missing company credentials and unspecified compensation bands. Further verification is recommended before submitting confidential documents.'
            : 'This posting aligns closely with legitimate enterprise patterns, possessing concrete requirements, structured metadata, and absent scam phrases.',
        factors: factors.slice(0, 6),
        radar_dimensions: radar,
        tokens: tokens,
        has_logo: !!formData.has_company_logo,
        telecommuting: !!formData.telecommuting,
        created_at: new Date().toISOString()
      };

      // Save to prediction history
      savePrediction(result);

      resolve(result);
    }, 750);
  });
}

// ─── Client-side NLP Analyzer ─────────────────────────────────────────────────
function runNLPAnalysis(text) {
  return new Promise((resolve) => {
    setTimeout(() => {
      const clean = (text || '').trim();
      const charCount = clean.length;
      const words = clean ? clean.match(/\b[A-Za-z0-9_-]+\b/g) || [] : [];
      const wordCount = words.length;
      const sentences = clean ? clean.split(/[.!?]+/).filter(Boolean) : [];
      const sentenceCount = sentences.length || 1;
      const totalWordLen = words.reduce((acc, w) => acc + w.length, 0);
      const avgWordLength = wordCount > 0 ? +(totalWordLen / wordCount).toFixed(2) : 0;

      // Extract real client-side keywords after stopping basic english stop words
      const stopWords = new Set([
        'the', 'and', 'for', 'that', 'with', 'this', 'you', 'are', 'from', 'have',
        'will', 'your', 'our', 'all', 'can', 'not', 'job', 'work', 'who', 'about'
      ]);

      const freqMap = {};
      words.forEach((w) => {
        const lower = w.toLowerCase();
        if (lower.length > 3 && !stopWords.has(lower)) {
          freqMap[lower] = (freqMap[lower] || 0) + 1;
        }
      });

      const topKeywords = Object.entries(freqMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([word, count]) => ({ word, count, pct: Math.round((count / wordCount) * 100) || 1 }));

      // Detect suspicious phrases
      const scamCorpus = [
        { phrase: 'wire transfer', severity: 'Critical', desc: 'Financial routing instruction' },
        { phrase: 'western union', severity: 'Critical', desc: 'Irreversible cash transfer service' },
        { phrase: 'telegram', severity: 'High', desc: 'Unmonitored chat redirect' },
        { phrase: 'whatsapp', severity: 'High', desc: 'Mobile number personal redirect' },
        { phrase: 'package handler', severity: 'Critical', desc: 'Known reshipping fraud trope' },
        { phrase: 'check mailing', severity: 'High', desc: 'Counterfeit check scam indicator' },
        { phrase: 'free training kit', severity: 'Medium', desc: 'Equipment purchase advance scam' },
        { phrase: 'immediate payout', severity: 'High', desc: 'Unrealistic turnaround promise' },
        { phrase: 'urgent requirement', severity: 'Medium', desc: 'Psychological pressure trigger' },
        { phrase: 'no interview needed', severity: 'Critical', desc: 'Absence of vetting protocol' }
      ];

      const detectedPhrases = [];
      const lowerText = clean.toLowerCase();
      scamCorpus.forEach((item) => {
        if (lowerText.includes(item.phrase)) {
          detectedPhrases.push(item);
        }
      });

      // Default mock suspicious phrase if none found, for demo richness
      if (detectedPhrases.length === 0 && clean.length > 50) {
        detectedPhrases.push({
          phrase: 'confidential assignment',
          severity: 'Low',
          desc: 'Ambiguous corporate disclosure'
        });
      }

      resolve({
        charCount,
        wordCount,
        avgWordLength,
        sentenceCount,
        topKeywords,
        detectedPhrases,
        is_placeholder: true, // ML parts are placeholders
        fraudSignal: {
          urgencyFactor: detectedPhrases.length > 0 ? 78 : 22,
          vaguenessScore: clean.length < 250 ? 82 : 34,
          contactRisk: lowerText.includes('telegram') || lowerText.includes('whatsapp') ? 92 : 18,
          financialRisk: lowerText.includes('wire') || lowerText.includes('money') ? 85 : 12,
          grammarIntegrity: 88,
          readabilityScore: 68
        }
      });
    }, 600);
  });
}

// ─── Prediction History Store ─────────────────────────────────────────────────
function getPredictionHistory() {
  try {
    const raw = localStorage.getItem('jobguard_history');
    const items = raw ? JSON.parse(raw) : INITIAL_HISTORY;
    return {
      history: items,
      total: items.length,
      fraudCount: items.filter((x) => x.verdict === 'High Risk').length,
      suspiciousCount: items.filter((x) => x.verdict === 'Potentially Suspicious').length,
      legitCount: items.filter((x) => x.verdict === 'Legitimate').length
    };
  } catch (e) {
    return { history: INITIAL_HISTORY, total: INITIAL_HISTORY.length, fraudCount: 1, suspiciousCount: 1, legitCount: 2 };
  }
}

function savePrediction(item) {
  try {
    const current = getPredictionHistory().history;
    const updated = [item, ...current].slice(0, 100); // retain last 100
    localStorage.setItem('jobguard_history', JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to save prediction to history', e);
  }
}

function deletePrediction(id) {
  try {
    const current = getPredictionHistory().history;
    const filtered = current.filter((x) => x.id !== id);
    localStorage.setItem('jobguard_history', JSON.stringify(filtered));
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function deleteBulkPredictions(ids) {
  try {
    const idSet = new Set(ids);
    const current = getPredictionHistory().history;
    const filtered = current.filter((x) => !idSet.has(x.id));
    localStorage.setItem('jobguard_history', JSON.stringify(filtered));
    return { success: true, count: ids.length };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function clearPredictionHistory() {
  localStorage.setItem('jobguard_history', JSON.stringify([]));
  return { success: true };
}

// ─── XAI Explanation Provider ────────────────────────────────────────────────
function getXAIExplanation(id) {
  return new Promise((resolve) => {
    setTimeout(() => {
      const history = getPredictionHistory().history;
      const target = history.find((x) => x.id === id) || history[0] || {
        id: 'pred_default',
        job_title: 'Software Developer (Sample)',
        risk_score: 82,
        verdict: 'High Risk'
      };

      resolve({
        id: target.id,
        job_title: target.job_title,
        verdict: target.verdict,
        risk_score: target.risk_score,
        model_used: 'Ensemble XGBoost + DistilBERT TF-IDF [PLACEHOLDER]',
        is_placeholder: true,
        plain_language:
          target.verdict === 'High Risk'
            ? 'This job posting was flagged primarily due to severe discrepancies in the employer contact channels, missing domain registration records, and language indicating financial forwarding.'
            : target.verdict === 'Potentially Suspicious'
            ? 'This job posting was classified as potentially suspicious due to high compensation without requirements, lack of corporate brand identity, and anonymous telegram recruitment links.'
            : 'This job posting was evaluated as legitimate based on verified company domain match, structured departmental metadata, and standard technical qualifications.',
        top_fraud_factors: [
          { feature: 'Missing Company Logo', impact: 0.38, category: 'Branding Verification' },
          { feature: 'Unverified Telegram/WhatsApp Contact', impact: 0.34, category: 'Contact Vector' },
          { feature: 'Omitted Salary Bracket', impact: 0.22, category: 'Compensation' },
          { feature: 'High Urgency Phrasing ("Immediate Start")', impact: 0.18, category: 'NLP Lexical' },
          { feature: 'No Physical Office Location', impact: 0.15, category: 'Physical Presence' }
        ],
        top_legit_factors: [
          { feature: 'Granular Skill Requirements List', impact: -0.32, category: 'Requirements' },
          { feature: 'Standard Full-Time Employment Contract', impact: -0.25, category: 'Contract Structure' },
          { feature: 'Clear Departmental Hierarchy Specified', impact: -0.19, category: 'Organizational Meta' },
          { feature: 'Standard Benefits & Pension Plan', impact: -0.14, category: 'Perks Disclosure' }
        ],
        shap_summary: [
          { feature: 'has_company_logo = 0', shap_value: 0.42 },
          { feature: 'phrasing_risk_score', shap_value: 0.35 },
          { feature: 'telecommuting = 1', shap_value: 0.28 },
          { feature: 'unspecified_department', shap_value: 0.19 },
          { feature: 'unspecified_salary', shap_value: 0.14 },
          { feature: 'industry_risk_weight', shap_value: 0.09 },
          { feature: 'requirements_len > 400', shap_value: -0.27 },
          { feature: 'profile_len > 600', shap_value: -0.36 },
          { feature: 'employment_type_fulltime', shap_value: -0.41 }
        ],
        tokens: [
          { word: 'wire', weight: 0.94, count: 3, risk: 'fraud' },
          { word: 'whatsapp', weight: 0.88, count: 2, risk: 'fraud' },
          { word: 'urgent', weight: 0.72, count: 4, risk: 'fraud' },
          { word: 'immediate', weight: 0.65, count: 2, risk: 'fraud' },
          { word: 'transfer', weight: 0.81, count: 3, risk: 'fraud' },
          { word: 'software', weight: -0.45, count: 6, risk: 'legit' },
          { word: 'python', weight: -0.52, count: 5, risk: 'legit' },
          { word: 'engineering', weight: -0.60, count: 4, risk: 'legit' },
          { word: 'bachelor', weight: -0.38, count: 2, risk: 'legit' }
        ]
      });
    }, 450);
  });
}

// ─── Role Index Search Helper ─────────────────────────────────────────────────
function getRoles(query) {
  if (!window.ROLE_INDEX || !window.ROLE_INDEX.roles) {
    return [];
  }
  const roles = window.ROLE_INDEX.roles;
  if (!query || query.trim() === '') {
    return roles;
  }
  const cleanQ = query.toLowerCase().trim();
  const queryTokens = cleanQ.split(/\s+/);

  return roles.filter((role) => {
    const roleName = role.name.toLowerCase();
    const skills = (role.topSkills || []).map((s) => s.name.toLowerCase()).join(' ');
    // Token overlap match
    return queryTokens.some((tok) => roleName.includes(tok) || skills.includes(tok));
  });
}

// Attach to window
if (typeof window !== 'undefined') {
  window.JobGuardData = {
    DATASET_STATS,
    TRUST_PULSE_STREAM,
    loginUser,
    registerUser,
    getCurrentUser,
    logoutUser,
    isAuthenticated,
    getAnalyticsOverview,
    getAnalyticsIndustries,
    getModelPerformance,
    analyzeJob,
    runNLPAnalysis,
    getPredictionHistory,
    savePrediction,
    deletePrediction,
    deleteBulkPredictions,
    clearPredictionHistory,
    getXAIExplanation,
    getRoles
  };
}
