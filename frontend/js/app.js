/**
 * JobGuard-XAI / VerityFile
 * Main Application Orchestrator, Hash Router, and Page Renderers
 */

(function () {
  'use strict';

  // Application State
  const AppState = {
    currentRoute: '',
    currentUser: null,
    currentPrediction: null,
    historySelection: new Set(),
    historyFilter: 'all',
    historySearch: ''
  };

  // ─── Utility Helpers ────────────────────────────────────────────────────────
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatPct(val) {
    return (val * 100).toFixed(2) + '%';
  }

  function getRiskBadge(verdict) {
    if (verdict === 'High Risk') {
      return `<span class="badge badge-high-risk"><i data-lucide="alert-triangle" style="width:12px;height:12px;"></i> High Risk</span>`;
    }
    if (verdict === 'Potentially Suspicious') {
      return `<span class="badge badge-suspicious"><i data-lucide="alert-circle" style="width:12px;height:12px;"></i> Suspicious</span>`;
    }
    return `<span class="badge badge-legit"><i data-lucide="shield-check" style="width:12px;height:12px;"></i> Legitimate</span>`;
  }

  function getPlaceholderNotice(text) {
    return `
      <div class="placeholder-notice">
        <i data-lucide="info" style="width:12px;height:12px;"></i>
        <span>${escapeHtml(text || 'PLACEHOLDER — connects to backend ML pipeline')}</span>
      </div>
    `;
  }

  // ─── Signature Element: SVG Risk Stamp Renderer ─────────────────────────────
  function generateRiskStampSVG(score, verdict) {
    let stampClass = 'stamp-legit';
    let labelText = 'LEGITIMATE';
    let ringColor = 'var(--safe)';

    if (score >= 70 || verdict === 'High Risk') {
      stampClass = 'stamp-high-risk';
      labelText = 'HIGH RISK';
      ringColor = 'var(--danger)';
    } else if (score >= 40 || verdict === 'Potentially Suspicious') {
      stampClass = 'stamp-suspicious';
      labelText = 'SUSPICIOUS';
      ringColor = 'var(--caution)';
    }

    return `
      <div class="risk-stamp-container">
        <div class="risk-stamp ${stampClass} stamp-animate">
          <svg viewBox="0 0 240 240" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <path id="stamp-arc-path" d="M 30,120 A 90,90 0 0,1 210,120" />
              <path id="stamp-sub-path" d="M 45,120 A 75,75 0 0,0 195,120" />
              <filter id="stamp-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            <!-- Outer Dashed Verification Seal Ring -->
            <circle cx="120" cy="120" r="108" class="stamp-ring" stroke-width="2.5" stroke-dasharray="6 4" />
            <circle cx="120" cy="120" r="100" class="stamp-ring" stroke-width="1.2" stroke-opacity="0.6" />

            <!-- Curved Upper Text: RISK ASSESSMENT -->
            <text font-family="'Sora', sans-serif" font-size="11" font-weight="700" letter-spacing="3" class="stamp-text">
              <textPath href="#stamp-arc-path" startOffset="50%" text-anchor="middle">
                FORENSIC VERITY SEAL
              </textPath>
            </text>

            <!-- Inner Concentric Ring -->
            <circle cx="120" cy="120" r="74" class="stamp-ring" stroke-width="1.5" stroke-dasharray="3 3" />

            <!-- Center Metric: Risk Score (IBM Plex Mono) -->
            <text x="120" y="125" text-anchor="middle" font-family="'IBM Plex Mono', monospace" font-size="52" font-weight="700" class="stamp-text" filter="url(#stamp-glow)">
              ${score}
            </text>
            <text x="120" y="142" text-anchor="middle" font-family="'IBM Plex Mono', monospace" font-size="11" font-weight="500" fill="var(--text-faint)">
              RISK INDEX / 100
            </text>

            <!-- Lower Verdict Pill -->
            <rect x="55" y="160" width="130" height="26" rx="13" fill="var(--bg-raised)" stroke="${ringColor}" stroke-width="1.5" />
            <text x="120" y="177" text-anchor="middle" font-family="'Sora', sans-serif" font-size="11.5" font-weight="800" letter-spacing="1" fill="${ringColor}">
              ${labelText}
            </text>
          </svg>
        </div>
      </div>
    `;
  }

  // ─── Toast System ───────────────────────────────────────────────────────────
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconName = 'info';
    if (type === 'success') iconName = 'check-circle-2';
    if (type === 'error') iconName = 'alert-triangle';

    toast.innerHTML = `
      <i data-lucide="${iconName}" style="width:18px;height:18px;flex-shrink:0;"></i>
      <span>${escapeHtml(message)}</span>
    `;

    container.appendChild(toast);
    if (window.lucide) lucide.createIcons();

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(40px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 320);
    }, 3800);
  }

  // ─── Modal System ───────────────────────────────────────────────────────────
  function openModal(contentHtml) {
    const container = document.getElementById('modal-container');
    if (!container) return;
    container.innerHTML = `<div class="modal-box">${contentHtml}</div>`;
    container.classList.add('open');
    if (window.lucide) lucide.createIcons();
  }

  function closeModal() {
    const container = document.getElementById('modal-container');
    if (!container) return;
    container.classList.remove('open');
    container.innerHTML = '';
  }

  // ─── Global Spotlight Search (Ctrl+K) ───────────────────────────────────────
  function initSpotlight() {
    const overlay = document.getElementById('spotlight-overlay');
    const input = document.getElementById('spotlight-input');
    const results = document.getElementById('spotlight-results');

    if (!overlay || !input || !results) return;

    function openSpotlight() {
      overlay.classList.add('open');
      input.value = '';
      renderSpotlightItems('');
      setTimeout(() => input.focus(), 50);
    }

    function closeSpotlight() {
      overlay.classList.remove('open');
    }

    window.openGlobalSpotlight = openSpotlight;

    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (overlay.classList.contains('open')) closeSpotlight();
        else openSpotlight();
      }
      if (e.key === 'Escape') {
        closeSpotlight();
        closeModal();
      }
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeSpotlight();
    });

    input.addEventListener('input', (e) => {
      renderSpotlightItems(e.target.value);
    });

    function renderSpotlightItems(query) {
      const q = (query || '').toLowerCase().trim();
      const pages = [
        { title: 'Dashboard', hash: '#dashboard', category: 'Navigation', icon: 'layout-dashboard' },
        { title: 'Fake Job Detection (Scan)', hash: '#analyze', category: 'Tool', icon: 'shield-check' },
        { title: 'NLP Lexical Analysis', hash: '#nlp', category: 'Tool', icon: 'brain-circuit' },
        { title: 'Job Roles & Skills Matrix', hash: '#roles', category: 'Explorer', icon: 'graduation-cap' },
        { title: 'Company & Job Market', hash: '#market', category: 'Intelligence', icon: 'bar-chart-2' },
        { title: 'Data Visualizations (EMSCAD)', hash: '#viz', category: 'Analytics', icon: 'pie-chart' },
        { title: 'Model Performance Benchmarks', hash: '#performance', category: 'Evaluation', icon: 'trophy' },
        { title: 'Explainable AI (SHAP Breakdown)', hash: '#xai', category: 'Interpretability', icon: 'sparkles' },
        { title: 'Prediction Audit History', hash: '#history', category: 'Records', icon: 'clock' },
        { title: 'About Project & Methodology', hash: '#about', category: 'Documentation', icon: 'info' }
      ];

      const roles = (window.ROLE_INDEX && window.ROLE_INDEX.roles) || [];

      const filteredPages = pages.filter((p) => p.title.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
      const filteredRoles = roles
        .filter((r) => r.name.toLowerCase().includes(q) || (r.topSkills || []).some((s) => s.name.toLowerCase().includes(q)))
        .slice(0, 6);

      let html = '';

      if (filteredPages.length > 0) {
        html += `<div style="font-size:11px; font-weight:700; color:var(--text-faint); text-transform:uppercase; letter-spacing:0.05em; padding:6px 12px;">Navigation</div>`;
        filteredPages.forEach((p) => {
          html += `
            <a href="${p.hash}" class="spotlight-item" onclick="document.getElementById('spotlight-overlay').classList.remove('open')">
              <i data-lucide="${p.icon}" style="width:16px;height:16px;color:var(--accent-cyan);"></i>
              <span style="flex:1;">${escapeHtml(p.title)}</span>
              <span class="spotlight-item-badge">${escapeHtml(p.category)}</span>
            </a>
          `;
        });
      }

      if (filteredRoles.length > 0) {
        html += `<div style="font-size:11px; font-weight:700; color:var(--text-faint); text-transform:uppercase; letter-spacing:0.05em; padding:10px 12px 6px 12px;">Job Roles (${filteredRoles.length})</div>`;
        filteredRoles.forEach((r) => {
          html += `
            <a href="#roles?id=${r.id}" class="spotlight-item" onclick="document.getElementById('spotlight-overlay').classList.remove('open')">
              <i data-lucide="briefcase" style="width:16px;height:16px;color:var(--accent-violet);"></i>
              <span style="flex:1;">${escapeHtml(r.name)}</span>
              <span class="spotlight-item-badge">${r.postingCount} postings</span>
            </a>
          `;
        });
      }

      if (filteredPages.length === 0 && filteredRoles.length === 0) {
        html = `<div style="padding:28px; text-align:center; color:var(--text-faint); font-size:13px;">No matching results found for "${escapeHtml(query)}"</div>`;
      }

      results.innerHTML = html;
      if (window.lucide) lucide.createIcons();
    }
  }

  // ─── Application Shell Structure ────────────────────────────────────────────
  function renderShell(contentHtml, pageTitle, pageSubtitle) {
    const user = window.JobGuardData.getCurrentUser();
    const currentHash = window.location.hash.split('?')[0] || '#dashboard';

    const navItems = [
      { id: 'dashboard', label: 'Dashboard', hash: '#dashboard', icon: 'layout-dashboard' },
      { id: 'analyze', label: 'Analyze Job', hash: '#analyze', icon: 'shield-check' },
      { id: 'nlp', label: 'NLP Analysis', hash: '#nlp', icon: 'brain-circuit' },
      { id: 'roles', label: 'Roles & Skills', hash: '#roles', icon: 'graduation-cap' },
      { id: 'market', label: 'Job Market', hash: '#market', icon: 'bar-chart-2' },
      { id: 'viz', label: 'Visualizations', hash: '#viz', icon: 'pie-chart' },
      { id: 'performance', label: 'Model Benchmarks', hash: '#performance', icon: 'trophy' },
      { id: 'xai', label: 'XAI Breakdown', hash: '#xai', icon: 'sparkles' },
      { id: 'history', label: 'Audit History', hash: '#history', icon: 'clock' },
      { id: 'about', label: 'About Architecture', hash: '#about', icon: 'info' }
    ];

    return `
      <!-- Fixed Sidebar -->
      <aside class="app-sidebar" id="app-sidebar">
        <div class="sidebar-header">
          <div class="brand-shield">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <path d="m9 12 2 2 4-4"/>
            </svg>
          </div>
          <div class="brand-text">
            <span class="brand-name">VerityFile</span>
            <span class="brand-sub">Job Posting Forensics</span>
          </div>
        </div>

        <nav class="sidebar-nav">
          <div class="nav-section-label">Core Forensic Tools</div>
          ${navItems.slice(0, 3).map((item) => `
            <a href="${item.hash}" class="nav-item ${currentHash === item.hash ? 'active' : ''}">
              <i data-lucide="${item.icon}"></i>
              <span>${item.label}</span>
            </a>
          `).join('')}

          <div class="nav-section-label">Market & Intelligence</div>
          ${navItems.slice(3, 6).map((item) => `
            <a href="${item.hash}" class="nav-item ${currentHash === item.hash ? 'active' : ''}">
              <i data-lucide="${item.icon}"></i>
              <span>${item.label}</span>
            </a>
          `).join('')}

          <div class="nav-section-label">Explainability & Audit</div>
          ${navItems.slice(6).map((item) => `
            <a href="${item.hash}" class="nav-item ${currentHash === item.hash ? 'active' : ''}">
              <i data-lucide="${item.icon}"></i>
              <span>${item.label}</span>
            </a>
          `).join('')}
        </nav>

        <div class="sidebar-footer">
          <div class="user-mini-card">
            <div class="user-avatar">${escapeHtml(user.name.charAt(0))}</div>
            <div class="user-meta">
              <span class="user-name" title="${escapeHtml(user.name)}">${escapeHtml(user.name)}</span>
              <span class="user-role-label">${escapeHtml(user.role || 'Forensic Lead')}</span>
            </div>
          </div>
          <button class="btn-icon" id="btn-logout" title="Sign out of console">
            <i data-lucide="log-out" style="width:16px;height:16px;"></i>
          </button>
        </div>
      </aside>

      <!-- Main Stage -->
      <main class="app-main">
        <!-- Sticky Glass Topbar -->
        <header class="app-topbar">
          <div class="topbar-left">
            <button class="btn-mobile-menu" id="btn-mobile-menu" aria-label="Toggle navigation">
              <i data-lucide="menu" style="width:20px;height:20px;"></i>
            </button>
            <div class="topbar-title-wrap">
              <h1 class="topbar-title">${escapeHtml(pageTitle)}</h1>
              <span class="topbar-sub">${escapeHtml(pageSubtitle || 'JobGuard-XAI Forensic Intelligence System')}</span>
            </div>
          </div>

          <div class="topbar-right">
            <button class="topbar-search-btn" onclick="window.openGlobalSpotlight()">
              <i data-lucide="search" style="width:15px;height:15px;"></i>
              <span>Search roles & analytics...</span>
              <span class="kbd-badge">Ctrl K</span>
            </button>
            <button class="notification-bell-btn" title="Recent scan notifications" onclick="location.hash='#history'">
              <i data-lucide="bell" style="width:17px;height:17px;"></i>
              <span class="notification-dot"></span>
            </button>
          </div>
        </header>

        <!-- Page Dynamic Viewport -->
        <div class="page-container">
          ${contentHtml}
        </div>
      </main>
    `;
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // PAGE RENDERERS
  // ═════════════════════════════════════════════════════════════════════════════

  // ─── 1. #dashboard ──────────────────────────────────────────────────────────
  function renderDashboard() {
    const stats = window.JobGuardData.DATASET_STATS;
    const tickerItems = window.JobGuardData.TRUST_PULSE_STREAM;

    const html = `
      <!-- Unique Feature: Live Trust Pulse Ticker -->
      <div class="ticker-container">
        <div class="ticker-label">
          <span class="ticker-pulse-dot"></span>
          <span>Trust Pulse</span>
        </div>
        <div class="ticker-track">
          <div class="ticker-marquee">
            ${[...tickerItems, ...tickerItems].map((t) => `
              <div class="ticker-item">
                <span class="ticker-item-title">${escapeHtml(t.title)}</span>
                ${getRiskBadge(t.verdict)}
                <span class="ticker-time">${t.time}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <!-- 4 Real Dataset Stat Cards + 2 Model Performance Cards -->
      <div class="grid-4" style="margin-bottom: 24px;">
        <div class="card stat-card">
          <div class="stat-card-top">
            <span class="stat-card-label">Total Postings Indexed</span>
            <div class="stat-card-icon"><i data-lucide="database"></i></div>
          </div>
          <div class="stat-card-val">${stats.totalJobs.toLocaleString()}</div>
          <div class="stat-card-sub"><i data-lucide="check" style="width:13px;height:13px;color:var(--safe);"></i> EMSCAD Benchmark Dataset</div>
        </div>

        <div class="card stat-card">
          <div class="stat-card-top">
            <span class="stat-card-label">Legitimate Verified</span>
            <div class="stat-card-icon" style="color:var(--safe);"><i data-lucide="shield-check"></i></div>
          </div>
          <div class="stat-card-val text-safe">${stats.legitimateCount.toLocaleString()}</div>
          <div class="stat-card-sub font-mono">95.16% of total postings</div>
        </div>

        <div class="card stat-card">
          <div class="stat-card-top">
            <span class="stat-card-label">Fraudulent Postings</span>
            <div class="stat-card-icon" style="color:var(--danger);"><i data-lucide="alert-octagon"></i></div>
          </div>
          <div class="stat-card-val text-danger">${stats.fraudulentCount.toLocaleString()}</div>
          <div class="stat-card-sub font-mono">866 confirmed fraudulent cases</div>
        </div>

        <div class="card stat-card">
          <div class="stat-card-top">
            <span class="stat-card-label">Baseline Fraud Rate</span>
            <div class="stat-card-icon" style="color:var(--caution);"><i data-lucide="trending-up"></i></div>
          </div>
          <div class="stat-card-val text-caution">4.84%</div>
          <div class="stat-card-sub font-mono">Severe class imbalance ratio 19:1</div>
        </div>
      </div>

      <!-- Model Preview Cards (with Placeholder Notice) -->
      <div class="grid-2" style="margin-bottom: 24px;">
        <div class="card stat-card" style="border-left: 3px solid var(--gold);">
          <div class="stat-card-top">
            <div style="display:flex; flex-direction:column; gap:4px;">
              <span class="stat-card-label">Recommended Model Architecture</span>
              ${getPlaceholderNotice('Target Model Architecture')}
            </div>
            <div class="stat-card-icon" style="color:var(--gold);"><i data-lucide="trophy"></i></div>
          </div>
          <div class="stat-card-val" style="font-size:20px; font-family:var(--font-heading);">
            Ensemble XGBoost + DistilBERT TF-IDF
          </div>
          <div class="stat-card-sub">
            <span>Optimized for Precision-Recall Area Under Curve</span>
          </div>
        </div>

        <div class="card stat-card" style="border-left: 3px solid var(--accent-cyan);">
          <div class="stat-card-top">
            <div style="display:flex; flex-direction:column; gap:4px;">
              <span class="stat-card-label">Target Evaluation F1 Score</span>
              ${getPlaceholderNotice('Awaiting Model Training Execution')}
            </div>
            <div class="stat-card-icon" style="color:var(--accent-cyan);"><i data-lucide="sparkles"></i></div>
          </div>
          <div class="stat-card-val text-cyan">
            0.892 <span style="font-size:14px; color:var(--text-faint); font-weight:400;">/ 1.000 (Target)</span>
          </div>
          <div class="stat-card-sub font-mono">
            Target Recall: 86.5% | Target Precision: 92.1%
          </div>
        </div>
      </div>

      <!-- Quick Action Gateway -->
      <div class="card" style="margin-bottom: 24px; padding: 20px 24px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:16px;">
        <div>
          <h3 style="font-size:16px; margin-bottom:4px;">Ready to inspect a suspicious job posting?</h3>
          <p style="font-size:13px; color:var(--text-muted);">Run complete forensic scan across 18 structural metadata factors and NLP scam lexicons.</p>
        </div>
        <div style="display:flex; gap:12px;">
          <a href="#analyze" class="btn btn-primary"><i data-lucide="scan"></i> Scan a Posting</a>
          <a href="#market" class="btn btn-secondary"><i data-lucide="globe"></i> Market Intelligence</a>
          <a href="#performance" class="btn btn-secondary"><i data-lucide="bar-chart"></i> View Models</a>
        </div>
      </div>

      <!-- Mini Preview Visualizations -->
      <div class="grid-2" style="margin-bottom: 24px;">
        <div class="card">
          <div class="card-header">
            <div class="card-title-group">
              <h2 class="card-title">Dataset Class Imbalance Distribution</h2>
              <span class="card-subtitle">Real EMSCAD dataset proportions (17,014 vs 866)</span>
            </div>
          </div>
          <div class="card-body" style="height: 280px; position:relative;">
            <canvas id="dash-class-canvas"></canvas>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title-group">
              <h2 class="card-title">The "Logo Paradox" Fraud Risk</h2>
              <span class="card-subtitle">Absence of logo increases fraud rate by 800% (15.93% vs 1.99%)</span>
            </div>
          </div>
          <div class="card-body" style="height: 280px; position:relative;">
            <canvas id="dash-logo-canvas"></canvas>
          </div>
        </div>
      </div>
    `;

    document.getElementById('app').innerHTML = renderShell(html, 'Forensic Command Center', 'Real-Time Job Posting Integrity & Dataset Telemetry');

    // Draw Mini Charts
    setTimeout(() => {
      ChartEngine.initChartDefaults();
      ChartEngine.drawClassBalanceDonut('dash-class-canvas');
      ChartEngine.drawFraudByLogoBar('dash-logo-canvas');
    }, 60);
  }

  // ─── 2. #analyze (Fake Job Detection) ───────────────────────────────────────
  function renderAnalyze() {
    const html = `
      <div class="motif-radar"></div>

      <div class="grid-2">
        <!-- Input Form Section -->
        <div class="card">
          <div class="card-header">
            <div class="card-title-group">
              <h2 class="card-title">Job Posting Forensics Analyzer</h2>
              <span class="card-subtitle">Evaluate posting legitimacy against 18 structural and lexical risk parameters</span>
            </div>
            <!-- Tabs -->
            <div class="tab-nav">
              <button class="tab-btn active" id="tab-structured">Structured Form</button>
              <button class="tab-btn" id="tab-paste">Paste Raw Text</button>
            </div>
          </div>

          <div class="card-body">
            <!-- Sample Filler Helpers -->
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:18px; padding-bottom:14px; border-bottom:1px solid var(--border-subtle);">
              <span style="font-size:12px; color:var(--text-faint);">Quick Test Samples:</span>
              <div style="display:flex; gap:8px;">
                <button class="btn btn-secondary btn-sm" id="btn-fill-legit">
                  <i data-lucide="check-circle" style="width:13px;height:13px;color:var(--safe);"></i> Sample Legit
                </button>
                <button class="btn btn-secondary btn-sm" id="btn-fill-scam">
                  <i data-lucide="alert-triangle" style="width:13px;height:13px;color:var(--danger);"></i> Sample Scam
                </button>
              </div>
            </div>

            <!-- Structured Form Panel -->
            <div id="panel-structured">
              <div class="form-group">
                <label class="form-label">Job Title *</label>
                <input type="text" id="input-title" class="form-input" placeholder="e.g. Senior Software Engineer / Data Entry Clerk">
              </div>

              <div class="grid-2" style="gap:16px;">
                <div class="form-group">
                  <label class="form-label">Location</label>
                  <input type="text" id="input-location" class="form-input" placeholder="e.g. US, CA, San Francisco">
                </div>
                <div class="form-group">
                  <label class="form-label">Salary Range</label>
                  <input type="text" id="input-salary" class="form-input" placeholder="e.g. 100000-130000 or $40/hr">
                </div>
              </div>

              <div class="grid-2" style="gap:16px;">
                <div class="form-group">
                  <label class="form-label">Employment Type</label>
                  <select id="select-employment" class="form-select">
                    <option value="Full-time">Full-time</option>
                    <option value="Contract">Contract</option>
                    <option value="Part-time">Part-time</option>
                    <option value="Temporary">Temporary</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Required Experience</label>
                  <select id="select-experience" class="form-select">
                    <option value="Mid-Senior level">Mid-Senior level</option>
                    <option value="Entry level">Entry level</option>
                    <option value="Associate">Associate</option>
                    <option value="Director">Director</option>
                    <option value="Internship">Internship</option>
                    <option value="Executive">Executive</option>
                    <option value="Not Applicable">Not Applicable</option>
                  </select>
                </div>
              </div>

              <!-- Metadata Binary Toggles -->
              <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:18px;">
                <div class="toggle-wrapper">
                  <div class="toggle-info">
                    <span class="toggle-title">Company Logo Available</span>
                    <span class="toggle-desc">Absence of logo is the single strongest structural fraud indicator</span>
                  </div>
                  <label class="switch">
                    <input type="checkbox" id="toggle-logo" checked>
                    <span class="slider"></span>
                  </label>
                </div>

                <div class="toggle-wrapper">
                  <div class="toggle-info">
                    <span class="toggle-title">Telecommuting / Remote</span>
                    <span class="toggle-desc">Remote roles carry nearly 2x the fraud rate of on-site roles (8.34% vs 4.69%)</span>
                  </div>
                  <label class="switch">
                    <input type="checkbox" id="toggle-telecommuting">
                    <span class="slider"></span>
                  </label>
                </div>

                <div class="toggle-wrapper">
                  <div class="toggle-info">
                    <span class="toggle-title">Formal Screening Questions Present</span>
                    <span class="toggle-desc">Screening questions significantly correlate with legitimate hiring workflows</span>
                  </div>
                  <label class="switch">
                    <input type="checkbox" id="toggle-questions" checked>
                    <span class="slider"></span>
                  </label>
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">Company Profile</label>
                <textarea id="input-profile" class="form-textarea" placeholder="Brief background of the hiring organization..."></textarea>
              </div>

              <div class="form-group">
                <label class="form-label">Job Description *</label>
                <textarea id="input-description" class="form-textarea" style="min-height:120px;" placeholder="Full responsibilities, day-to-day duties, team mission..."></textarea>
              </div>

              <div class="form-group">
                <label class="form-label">Requirements & Qualifications</label>
                <textarea id="input-requirements" class="form-textarea" placeholder="Required skills, years of experience, degrees, certifications..."></textarea>
              </div>
            </div>

            <!-- Paste Tab Panel -->
            <div id="panel-paste" style="display:none;">
              <div class="form-group">
                <label class="form-label">Paste Full Raw Job Posting *</label>
                <textarea id="input-raw-text" class="form-textarea" style="min-height:360px;" placeholder="Paste the complete text from LinkedIn, Indeed, or email here..."></textarea>
              </div>
            </div>

            <button class="btn btn-primary btn-lg" id="btn-run-analysis" style="width:100%; margin-top:8px;">
              <i data-lucide="scan"></i> Run Forensic Scan
            </button>
          </div>
        </div>

        <!-- Result Section (Initial Placeholder State / Dynamic Upon Analysis) -->
        <div class="card" id="analysis-result-card">
          <div class="card-header">
            <div class="card-title-group">
              <h2 class="card-title">Forensic Verdict & Risk Assessment</h2>
              <span class="card-subtitle">Real-time inference and attribution report</span>
            </div>
            <div id="result-badge-slot"></div>
          </div>

          <div class="card-body" id="analysis-result-body">
            <!-- Empty initial prompt -->
            <div style="text-align:center; padding:60px 20px; color:var(--text-faint);">
              <i data-lucide="shield-alert" style="width:48px;height:48px;margin-bottom:14px;color:var(--text-faint);"></i>
              <h3 style="font-size:16px; color:var(--text-muted); margin-bottom:6px;">Awaiting Job Posting Input</h3>
              <p style="font-size:13px; max-width:360px; margin:0 auto;">
                Fill out the form on the left or click "Sample Scam" to run an automated forensic inspection.
              </p>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('app').innerHTML = renderShell(html, 'Fake Job Detection', 'Automated Multimodal Fraud Classification & Risk Auditing');

    // Tab Switching Logic
    const tabStructured = document.getElementById('tab-structured');
    const tabPaste = document.getElementById('tab-paste');
    const panelStructured = document.getElementById('panel-structured');
    const panelPaste = document.getElementById('panel-paste');

    tabStructured.addEventListener('click', () => {
      tabStructured.classList.add('active');
      tabPaste.classList.remove('active');
      panelStructured.style.display = 'block';
      panelPaste.style.display = 'none';
    });

    tabPaste.addEventListener('click', () => {
      tabPaste.classList.add('active');
      tabStructured.classList.remove('active');
      panelPaste.style.display = 'block';
      panelStructured.style.display = 'none';
    });

    // Sample Fillers
    document.getElementById('btn-fill-legit').addEventListener('click', () => {
      tabStructured.click();
      document.getElementById('input-title').value = 'Senior Staff Platform Engineer';
      document.getElementById('input-location').value = 'US, CA, San Francisco';
      document.getElementById('input-salary').value = '$160,000 - $195,000';
      document.getElementById('toggle-logo').checked = true;
      document.getElementById('toggle-telecommuting').checked = false;
      document.getElementById('toggle-questions').checked = true;
      document.getElementById('input-profile').value = 'Enterprise cloud infrastructure provider serving Fortune 500 financial institutions with verified SOC2 compliance.';
      document.getElementById('input-description').value = 'We are seeking a seasoned Platform Engineer to architect distributed microservices in Go and Kubernetes. You will collaborate directly with our security auditing teams to maintain 99.999% uptime.';
      document.getElementById('input-requirements').value = 'Minimum 6+ years experience in distributed systems, Golang, Kubernetes, Docker, and CI/CD automation pipelines.';
      showToast('Loaded verified legitimate posting sample', 'info');
    });

    document.getElementById('btn-fill-scam').addEventListener('click', () => {
      tabStructured.click();
      document.getElementById('input-title').value = 'Data Entry & Virtual Package Processing Clerk ($5,200/Mo)';
      document.getElementById('input-location').value = 'Remote / Anywhere';
      document.getElementById('input-salary').value = '$45/hour + $1,000 weekly bonus';
      document.getElementById('toggle-logo').checked = false;
      document.getElementById('toggle-telecommuting').checked = true;
      document.getElementById('toggle-questions').checked = false;
      document.getElementById('input-profile').value = '';
      document.getElementById('input-description').value = 'URGENT HIRING! Work from the comfort of your home! No experience required! Responsibilities include receiving checks, forwarding wire transfer deposits, and re-shipping corporate packages via Western Union. Contact recruiter immediately on Telegram @CorporateHR_Support.';
      document.getElementById('input-requirements').value = 'Must possess active bank account for direct deposit advance and mobile phone for WhatsApp communications.';
      showToast('Loaded known fraudulent scam sample', 'info');
    });

    // Run Analysis Button Handler
    const runBtn = document.getElementById('btn-run-analysis');
    runBtn.addEventListener('click', async () => {
      let isPasteMode = panelPaste.style.display === 'block';
      let formData = {};

      if (isPasteMode) {
        const raw = document.getElementById('input-raw-text').value.trim();
        if (!raw) {
          showToast('Please paste job posting content first', 'error');
          return;
        }
        formData = {
          title: 'Unstructured Raw Posting',
          description: raw,
          company_profile: '',
          has_company_logo: false,
          telecommuting: raw.toLowerCase().includes('remote') || raw.toLowerCase().includes('work from home'),
          requirements: ''
        };
      } else {
        const title = document.getElementById('input-title').value.trim();
        const desc = document.getElementById('input-description').value.trim();
        if (!title && !desc) {
          showToast('Please provide at least a Job Title or Description', 'error');
          return;
        }
        formData = {
          title: title || 'Untitled Job Posting',
          location: document.getElementById('input-location').value,
          salary_range: document.getElementById('input-salary').value,
          company_profile: document.getElementById('input-profile').value,
          description: desc,
          requirements: document.getElementById('input-requirements').value,
          has_company_logo: document.getElementById('toggle-logo').checked,
          telecommuting: document.getElementById('toggle-telecommuting').checked,
          has_questions: document.getElementById('toggle-questions').checked
        };
      }

      // Set Loading UI State
      runBtn.classList.add('is-loading');
      runBtn.innerHTML = `<span class="spinner"></span> Scanning Posting Vectors...`;

      const result = await window.JobGuardData.analyzeJob(formData);
      AppState.currentPrediction = result;

      runBtn.classList.remove('is-loading');
      runBtn.innerHTML = `<i data-lucide="scan"></i> Run Forensic Scan`;

      // Render Result Panel
      renderAnalyzeResult(result);
      showToast(`Scan complete: Evaluated as ${result.verdict} (${result.risk_score}/100)`, result.risk_score >= 70 ? 'error' : 'success');
    });
  }

  function renderAnalyzeResult(result) {
    const body = document.getElementById('analysis-result-body');
    const badgeSlot = document.getElementById('result-badge-slot');
    if (!body) return;

    if (badgeSlot) {
      badgeSlot.innerHTML = getRiskBadge(result.verdict);
    }

    body.innerHTML = `
      <!-- Signature Risk Stamp -->
      ${generateRiskStampSVG(result.risk_score, result.verdict)}

      <!-- Model Chip with Notice -->
      <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px; margin: 16px 0; padding:12px; background:var(--bg-raised); border-radius:10px;">
        <div style="display:flex; align-items:center; gap:8px;">
          <i data-lucide="cpu" style="width:16px;height:16px;color:var(--accent-cyan);"></i>
          <span style="font-size:12.5px; font-weight:600; color:var(--text-primary);">${escapeHtml(result.model_used)}</span>
        </div>
        ${getPlaceholderNotice('Connects to trained backend')}
      </div>

      <!-- Plain Language Explanation -->
      <div style="margin-bottom: 20px; padding:14px; background:rgba(19, 26, 46, 0.8); border:1px solid var(--border-color); border-radius:10px;">
        <span style="font-size:11px; font-family:var(--font-heading); font-weight:700; text-transform:uppercase; color:var(--accent-cyan); display:block; margin-bottom:4px;">
          Forensic Summary
        </span>
        <p style="font-size:13px; color:var(--text-primary); line-height:1.5;">${escapeHtml(result.explanation)}</p>
      </div>

      <!-- Factor Breakdown -->
      <div style="margin-bottom: 24px;">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
          <h3 style="font-size:14px; font-weight:700;">Top Influential Factors</h3>
          ${getPlaceholderNotice('Heuristic SHAP weights')}
        </div>
        <div class="factor-list">
          ${result.factors.map((f) => `
            <div class="factor-item">
              <div class="factor-meta">
                <span class="factor-name">
                  <i data-lucide="${f.direction === 'fraud' ? 'alert-circle' : 'check-circle-2'}" style="width:14px;height:14px;color:${f.direction === 'fraud' ? 'var(--danger)' : 'var(--safe)'};"></i>
                  ${escapeHtml(f.name)}
                </span>
                <span class="factor-impact ${f.direction === 'fraud' ? 'text-danger' : 'text-safe'}">
                  ${f.impact > 0 ? '+' : ''}${f.impact}
                </span>
              </div>
              <div class="factor-bar-track">
                <div class="factor-bar-fill ${f.direction === 'fraud' ? 'fill-fraud' : 'fill-legit'}" style="width: ${Math.min(100, Math.abs(f.impact) * 180)}%;"></div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Red Flag Radar (Chart.js Radar) -->
      <div style="margin-bottom: 24px;">
        <h3 style="font-size:14px; font-weight:700; margin-bottom:8px;">Red Flag Radar (6 Dimensions)</h3>
        <div style="height: 240px; position:relative;">
          <canvas id="analyze-radar-canvas"></canvas>
        </div>
      </div>

      <!-- Actions -->
      <div style="display:flex; gap:12px; justify-content:flex-end;">
        <a href="#xai" class="btn btn-secondary">
          <i data-lucide="sparkles"></i> Full XAI Breakdown →
        </a>
      </div>
    `;

    if (window.lucide) lucide.createIcons();

    // Render Radar Chart
    setTimeout(() => {
      const radar = result.radar_dimensions;
      ChartEngine.drawRadarChart(
        'analyze-radar-canvas',
        ['Keyword Density', 'Profile Completeness', 'Urgency Phrasing', 'Credential Mismatch', 'Vague Location', 'Missing Attributes'],
        [radar.keywordDensity, radar.profileCompleteness, radar.urgencyLanguage, radar.credentialMismatch, radar.vagueLocation, radar.missingInfo],
        'Dimension Risk Index',
        result.risk_score >= 70 ? 'rgb(251, 93, 93)' : 'rgb(139, 92, 246)'
      );
    }, 50);
  }

  // ─── 3. #nlp (NLP Lexical Analysis) ─────────────────────────────────────────
  function renderNLP() {
    const html = `
      <div class="motif-token-lattice"></div>

      <div class="card" style="margin-bottom: 24px;">
        <div class="card-header">
          <div class="card-title-group">
            <h2 class="card-title">NLP Lexical & Semantic Parser</h2>
            <span class="card-subtitle">Extract vocabulary distributions, high-risk trigrams, and scam vocabulary density</span>
          </div>
          ${getPlaceholderNotice('TF-IDF / NLTK Tokenizer')}
        </div>
        <div class="card-body">
          <div class="form-group">
            <label class="form-label">Job Posting Text Corpus</label>
            <textarea id="nlp-input-text" class="form-textarea" style="min-height: 140px;" placeholder="Paste job description or requirements to inspect linguistic risk vectors..."></textarea>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
            <div style="display:flex; gap:8px;">
              <button class="btn btn-secondary btn-sm" id="btn-nlp-sample-legit">Legit Text Sample</button>
              <button class="btn btn-secondary btn-sm" id="btn-nlp-sample-scam">Scam Trap Sample</button>
            </div>
            <button class="btn btn-primary" id="btn-run-nlp">
              <i data-lucide="brain-circuit"></i> Run NLP Analysis
            </button>
          </div>
        </div>
      </div>

      <!-- Results Viewport -->
      <div id="nlp-results-container" style="display:none;">
        <!-- Real Text Statistics -->
        <div class="grid-4" style="margin-bottom: 24px;">
          <div class="card stat-card">
            <span class="stat-card-label">Character Count</span>
            <div class="stat-card-val" id="nlp-stat-chars">0</div>
            <div class="stat-card-sub">Total raw glyphs</div>
          </div>
          <div class="card-card stat-card">
            <span class="stat-card-label">Word Count</span>
            <div class="stat-card-val" id="nlp-stat-words">0</div>
            <div class="stat-card-sub">Tokens extracted</div>
          </div>
          <div class="card stat-card">
            <span class="stat-card-label">Avg Word Length</span>
            <div class="stat-card-val" id="nlp-stat-len">0.0</div>
            <div class="stat-card-sub">Characters / token</div>
          </div>
          <div class="card stat-card">
            <span class="stat-card-label">Sentence Count</span>
            <div class="stat-card-val" id="nlp-stat-sentences">0</div>
            <div class="stat-card-sub">Grammatical units</div>
          </div>
        </div>

        <div class="grid-2" style="margin-bottom: 24px;">
          <!-- Suspicious Phrases -->
          <div class="card">
            <div class="card-header">
              <div class="card-title-group">
                <h3 class="card-title">Flagged Phrasing Triggers</h3>
                <span class="card-subtitle">Scam lexical concordance matches</span>
              </div>
            </div>
            <div class="card-body">
              <div id="nlp-phrases-list" style="display:flex; flex-direction:column; gap:10px;"></div>
            </div>
          </div>

          <!-- Radar: Signal Strength -->
          <div class="card">
            <div class="card-header">
              <div class="card-title-group">
                <h3 class="card-title">Fraud Signal Strength Radar</h3>
                <span class="card-subtitle">Multi-axis lexical scoring</span>
              </div>
            </div>
            <div class="card-body" style="height: 280px; position:relative;">
              <canvas id="nlp-radar-canvas"></canvas>
            </div>
          </div>
        </div>

        <!-- Keyword Frequencies -->
        <div class="card">
          <div class="card-header">
            <div class="card-title-group">
              <h3 class="card-title">Extracted High-Frequency Keywords</h3>
              <span class="card-subtitle">Non-stopword vocabulary distribution</span>
            </div>
          </div>
          <div class="card-body" style="height: 280px; position:relative;">
            <canvas id="nlp-keywords-canvas"></canvas>
          </div>
        </div>
      </div>
    `;

    document.getElementById('app').innerHTML = renderShell(html, 'NLP Lexical Analysis', 'Natural Language Feature Extraction & Forensic Linguistic Profiling');

    const inputArea = document.getElementById('nlp-input-text');

    document.getElementById('btn-nlp-sample-legit').addEventListener('click', () => {
      inputArea.value = `We are looking for an experienced Senior Software Engineer with strong background in Python, distributed database systems, SQL query optimization, and AWS cloud architecture. The candidate will design reliable APIs, conduct rigorous code reviews, and mentor junior developers in our agile engineering organization. Qualifications include BS in Computer Science or equivalent real-world industry experience.`;
    });

    document.getElementById('btn-nlp-sample-scam').addEventListener('click', () => {
      inputArea.value = `Work from home immediate start! Lucrative position for entry-level data processing clerk. No prior experience needed, generous compensation of $4,500 monthly plus weekly bonuses. Selected applicants will receive an advance cashier check to cover equipment setup and training materials. Immediate communication required via Telegram @RecruitmentHQ or WhatsApp. Forward all questions immediately.`;
    });

    document.getElementById('btn-run-nlp').addEventListener('click', async () => {
      const text = inputArea.value.trim();
      if (!text) {
        showToast('Please enter text to analyze', 'error');
        return;
      }

      const res = await window.JobGuardData.runNLPAnalysis(text);

      document.getElementById('nlp-results-container').style.display = 'block';
      document.getElementById('nlp-stat-chars').textContent = res.charCount.toLocaleString();
      document.getElementById('nlp-stat-words').textContent = res.wordCount.toLocaleString();
      document.getElementById('nlp-stat-len').textContent = res.avgWordLength;
      document.getElementById('nlp-stat-sentences').textContent = res.sentenceCount;

      // Render Phrases
      const listEl = document.getElementById('nlp-phrases-list');
      if (res.detectedPhrases.length === 0) {
        listEl.innerHTML = `<p style="font-size:13px; color:var(--safe);">No high-risk scam trigrams or wire forwarding requests detected.</p>`;
      } else {
        listEl.innerHTML = res.detectedPhrases
          .map((p) => {
            let badgeClass = 'badge-suspicious';
            if (p.severity === 'Critical') badgeClass = 'badge-high-risk';
            return `
              <div style="display:flex; align-items:center; justify-content:space-between; padding:10px 14px; background:var(--bg-raised); border-radius:8px; border:1px solid var(--border-color);">
                <div style="display:flex; flex-direction:column;">
                  <span style="font-family:var(--font-mono); font-weight:600; color:var(--text-primary);">"${escapeHtml(p.phrase)}"</span>
                  <span style="font-size:11.5px; color:var(--text-faint);">${escapeHtml(p.desc)}</span>
                </div>
                <span class="badge ${badgeClass}">${p.severity}</span>
              </div>
            `;
          })
          .join('');
      }

      // Draw Charts
      setTimeout(() => {
        ChartEngine.drawRadarChart(
          'nlp-radar-canvas',
          ['Urgency Language', 'Vagueness Index', 'Contact Risk', 'Financial Routing', 'Grammar Integrity', 'Readability'],
          [res.fraudSignal.urgencyFactor, res.fraudSignal.vaguenessScore, res.fraudSignal.contactRisk, res.fraudSignal.financialRisk, res.fraudSignal.grammarIntegrity, res.fraudSignal.readabilityScore],
          'NLP Signal Severity',
          'rgb(34, 211, 238)'
        );

        // Keywords Horizontal Bar
        const kwLabels = res.topKeywords.slice(0, 8).map((k) => k.word);
        const kwCounts = res.topKeywords.slice(0, 8).map((k) => k.count);
        ChartEngine.drawSkillsBar('nlp-keywords-canvas', res.topKeywords.slice(0, 8).map(k => ({ name: k.word, count: k.count })));
      }, 50);

      showToast('NLP lexical parsing completed', 'success');
    });
  }

  // ─── 4. #roles (Job Role & Skills Explorer) ─────────────────────────────────
  function renderRoles() {
    const roles = (window.ROLE_INDEX && window.ROLE_INDEX.roles) || [];
    const urlParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const activeRoleId = urlParams.get('id') || 'data_scientist';
    const activeRole = roles.find((r) => r.id === activeRoleId) || roles[0];

    const quickPicks = [
      'Data Scientist',
      'Software Engineer',
      'Marketing Manager',
      'UX Designer',
      'Financial Analyst',
      'HR Manager',
      'Product Manager',
      'Sales Executive',
      'DevOps Engineer',
      'Content Writer'
    ];

    const html = `
      <div class="motif-constellation">
        <svg width="100%" height="100%" viewBox="0 0 500 400" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="250" cy="200" r="14" fill="var(--accent-cyan)" fill-opacity="0.6" filter="drop-shadow(0 0 12px var(--accent-cyan))" />
          <circle cx="120" cy="90" r="7" fill="var(--accent-violet)" />
          <circle cx="380" cy="110" r="8" fill="var(--accent-violet)" />
          <circle cx="160" cy="310" r="6" fill="var(--safe)" />
          <circle cx="360" cy="290" r="7" fill="var(--accent-cyan)" />
          <line x1="250" y1="200" x2="120" y2="90" stroke="var(--border-color)" stroke-width="1.5" stroke-dasharray="4 4" />
          <line x1="250" y1="200" x2="380" y2="110" stroke="var(--border-color)" stroke-width="1.5" stroke-dasharray="4 4" />
          <line x1="250" y1="200" x2="160" y2="310" stroke="var(--border-color)" stroke-width="1.5" stroke-dasharray="4 4" />
          <line x1="250" y1="200" x2="360" y2="290" stroke="var(--border-color)" stroke-width="1.5" stroke-dasharray="4 4" />
        </svg>
      </div>

      <!-- Hero Search Section -->
      <div class="card" style="margin-bottom: 24px; padding: 28px;">
        <h2 style="font-size:22px; margin-bottom:8px;">What role do you want to explore?</h2>
        <p style="font-size:13.5px; color:var(--text-muted); margin-bottom:16px;">
          Explore verified skill requirements, hiring geographic density, and authentic market postings across 25 career trajectories.
        </p>

        <div style="position:relative; max-width:640px;">
          <input type="text" id="roles-search-input" class="form-input" style="padding-left:42px; font-size:15px; height:46px;" placeholder="Search role title (e.g. Data Scientist, DevOps, Full Stack)..." value="${escapeHtml(activeRole ? activeRole.name : '')}">
          <i data-lucide="search" style="position:absolute; left:14px; top:14px; width:18px; height:18px; color:var(--accent-cyan);"></i>
        </div>

        <div class="chips-container">
          ${quickPicks.map((qp) => {
            const isMatch = activeRole && activeRole.name.toLowerCase() === qp.toLowerCase();
            return `
              <button class="chip ${isMatch ? 'active' : ''}" onclick="window.location.hash='#roles?id=${qp.toLowerCase().replace(/\s+/g, '_')}'">
                ${escapeHtml(qp)}
              </button>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Matched Role Dashboard -->
      ${activeRole ? `
        <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px; margin-bottom:20px;">
          <div style="display:flex; align-items:center; gap:12px;">
            <div style="width:42px; height:42px; border-radius:10px; background:linear-gradient(135deg, var(--accent-violet), var(--accent-cyan)); display:flex; align-items:center; justify-content:center; color:#FFFFFF;">
              <i data-lucide="briefcase" style="width:22px;height:22px;"></i>
            </div>
            <div>
              <h2 style="font-size:20px;">${escapeHtml(activeRole.name)}</h2>
              <span style="font-size:12px; color:var(--text-faint); font-family:var(--font-mono);">${activeRole.postingCount} authentic verified postings analyzed</span>
            </div>
          </div>
          <span class="badge badge-legit">Verified Legitimate Corpus</span>
        </div>

        <div class="grid-2" style="margin-bottom: 24px;">
          <!-- Top Required Skills -->
          <div class="card">
            <div class="card-header">
              <div class="card-title-group">
                <h3 class="card-title">Core Required Skills & Proficiencies</h3>
                <span class="card-subtitle">Frequency of technical keywords across verified postings</span>
              </div>
            </div>
            <div class="card-body" style="height: 320px; position:relative;">
              <canvas id="role-skills-canvas"></canvas>
            </div>
          </div>

          <!-- Locations & Employment Type -->
          <div class="card">
            <div class="card-header">
              <div class="card-title-group">
                <h3 class="card-title">Top Geographic Hubs</h3>
                <span class="card-subtitle">Highest posting density regions</span>
              </div>
            </div>
            <div class="card-body">
              <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:24px;">
                ${(activeRole.topLocations || []).map((loc) => `
                  <div style="display:flex; align-items:center; justify-content:space-between; padding:8px 12px; background:var(--bg-raised); border-radius:8px; border:1px solid var(--border-color);">
                    <div style="display:flex; align-items:center; gap:8px;">
                      <i data-lucide="map-pin" style="width:14px;height:14px;color:var(--accent-cyan);"></i>
                      <span style="font-size:13px; font-weight:500;">${escapeHtml(loc.location)}</span>
                    </div>
                    <span class="font-mono" style="font-size:12px; color:var(--text-muted);">${loc.count} jobs</span>
                  </div>
                `).join('')}
              </div>

              <h4 style="font-size:13px; font-weight:700; margin-bottom:8px; color:var(--text-muted);">Employment Breakdown</h4>
              <div style="display:flex; gap:8px; flex-wrap:wrap;">
                ${(activeRole.employmentTypes || []).map((et) => `
                  <span class="badge badge-neutral" style="font-size:12px;">
                    ${escapeHtml(et.type)}: <strong style="color:var(--accent-cyan); margin-left:4px;">${et.pct || et.count}%</strong>
                  </span>
                `).join('')}
              </div>
            </div>
          </div>
        </div>

        <!-- Sample Authentic Postings -->
        <div class="card">
          <div class="card-header">
            <div class="card-title-group">
              <h3 class="card-title">Sample Benchmark Postings</h3>
              <span class="card-subtitle">Real verified job specifications from the dataset</span>
            </div>
          </div>
          <div class="card-body">
            <div class="grid-2">
              ${(activeRole.samplePostings || []).map((sp) => `
                <div style="padding:18px; background:var(--bg-raised); border-radius:12px; border:1px solid var(--border-color); display:flex; flex-direction:column; justify-content:space-between; gap:10px;">
                  <div>
                    <h4 style="font-size:14.5px; color:var(--text-primary); margin-bottom:4px;">${escapeHtml(sp.title)}</h4>
                    <div style="display:flex; gap:10px; font-size:11.5px; color:var(--text-faint); margin-bottom:8px; font-family:var(--font-mono);">
                      <span><i data-lucide="map-pin" style="width:12px;height:12px;"></i> ${escapeHtml(sp.location)}</span>
                      <span><i data-lucide="clock" style="width:12px;height:12px;"></i> ${escapeHtml(sp.type)}</span>
                    </div>
                    <p style="font-size:12.5px; color:var(--text-muted); line-height:1.5;">${escapeHtml(sp.snippet)}</p>
                  </div>
                  <span class="badge badge-legit" style="width:fit-content;">Legitimate Benchmark</span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      ` : `
        <div class="card" style="padding:40px; text-align:center;">
          <p>No matching role found. Please select from the chips above.</p>
        </div>
      `}
    `;

    document.getElementById('app').innerHTML = renderShell(html, 'Job Roles & Skills Matrix', 'Career Competency Benchmarks & Skill Co-occurrence Index');

    // Draw Skills Chart
    if (activeRole && activeRole.topSkills) {
      setTimeout(() => {
        ChartEngine.drawSkillsBar('role-skills-canvas', activeRole.topSkills);
      }, 50);
    }

    // Dynamic Search Handler
    const searchInput = document.getElementById('roles-search-input');
    if (searchInput) {
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const val = searchInput.value.trim().toLowerCase();
          const match = roles.find((r) => r.name.toLowerCase().includes(val) || r.id.includes(val));
          if (match) {
            window.location.hash = `#roles?id=${match.id}`;
          } else {
            showToast(`No exact match for "${val}". Try "Data Scientist" or "Software Engineer"`, 'info');
          }
        }
      });
    }
  }

  // ─── 5. #market (Company & Job Market Intelligence) ─────────────────────────
  function renderMarket() {
    const stats = window.JobGuardData.DATASET_STATS;
    const heatmap = stats.marketHeatmap;

    const html = `
      <div class="motif-contour"></div>

      <!-- Real Dataset Disclaimer Banner -->
      <div style="display:flex; align-items:center; gap:12px; padding:14px 20px; background:rgba(34, 211, 238, 0.08); border:1px solid rgba(34, 211, 238, 0.3); border-radius:12px; margin-bottom:24px;">
        <i data-lucide="shield-alert" style="width:20px;height:20px;color:var(--accent-cyan); flex-shrink:0;"></i>
        <div style="font-size:13px; color:var(--text-primary);">
          <strong>EMSCAD Benchmark Intelligence:</strong> Market statistics below reflect 17,880 empirical corporate postings. Fraud concentration varies dramatically by industry domain and seniority level.
        </div>
      </div>

      <!-- Unique Feature: Market Heatmap Grid -->
      <div class="card" style="margin-bottom: 24px;">
        <div class="card-header">
          <div class="card-title-group">
            <h2 class="card-title">Market Risk Heatmap: Industry Domain × Experience Level</h2>
            <span class="card-subtitle">Empirical fraud occurrence rate (%) across key employment coordinates</span>
          </div>
          <div style="display:flex; align-items:center; gap:8px; font-size:11px; font-family:var(--font-mono);">
            <span>Low (0-5%)</span>
            <span style="display:inline-block;width:12px;height:12px;background:rgba(52,211,153,0.3);border-radius:2px;"></span>
            <span style="display:inline-block;width:12px;height:12px;background:rgba(251,191,36,0.3);border-radius:2px;"></span>
            <span style="display:inline-block;width:12px;height:12px;background:rgba(251,93,93,0.6);border-radius:2px;"></span>
            <span>Severe (>30%)</span>
          </div>
        </div>

        <div class="card-body">
          <div class="heatmap-table-container">
            <table class="heatmap-table">
              <thead>
                <tr>
                  <th style="text-align:left; padding-left:12px;">Industry Domain</th>
                  ${heatmap.experienceLevels.map((lvl) => `<th>${escapeHtml(lvl)}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${heatmap.industries.map((ind, rIdx) => `
                  <tr>
                    <td class="row-header">${escapeHtml(ind)}</td>
                    ${heatmap.matrix[rIdx].map((rate) => {
                      let heatClass = 'heat-level-0';
                      if (rate >= 30) heatClass = 'heat-level-5';
                      else if (rate >= 20) heatClass = 'heat-level-4';
                      else if (rate >= 12) heatClass = 'heat-level-3';
                      else if (rate >= 6) heatClass = 'heat-level-2';
                      else if (rate >= 3) heatClass = 'heat-level-1';
                      return `
                        <td>
                          <div class="heatmap-cell ${heatClass}" title="${escapeHtml(ind)} [${rate}% Fraud Risk]">
                            ${rate.toFixed(1)}%
                          </div>
                        </td>
                      `;
                    }).join('')}
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Top Industries Table with Real Fraud Rate Column -->
      <div class="card" style="margin-bottom: 24px;">
        <div class="card-header">
          <div class="card-title-group">
            <h2 class="card-title">Top 12 Industries: Volume & Vulnerability Index</h2>
            <span class="card-subtitle">Total posting volume vs documented fraudulent occurrences</span>
          </div>
        </div>
        <div class="card-body" style="padding:0;">
          <div class="table-responsive">
            <table class="table-dark">
              <thead>
                <tr>
                  <th>Industry Sector</th>
                  <th>Total Postings</th>
                  <th>Legitimate</th>
                  <th>Fraudulent</th>
                  <th>Fraud Rate (%)</th>
                  <th>Risk Tier</th>
                </tr>
              </thead>
              <tbody>
                ${stats.topIndustries.map((item) => {
                  let badge = '<span class="badge badge-legit">Low Risk</span>';
                  if (item.fraudRate >= 0.15) badge = '<span class="badge badge-high-risk">Critical Hazard</span>';
                  else if (item.fraudRate >= 0.05) badge = '<span class="badge badge-suspicious">Elevated Risk</span>';
                  return `
                    <tr>
                      <td style="font-weight:600;">${escapeHtml(item.industry)}</td>
                      <td class="font-mono">${item.total.toLocaleString()}</td>
                      <td class="font-mono text-safe">${(item.total - item.fraud).toLocaleString()}</td>
                      <td class="font-mono text-danger">${item.fraud}</td>
                      <td class="font-mono" style="font-weight:700;">${(item.fraudRate * 100).toFixed(2)}%</td>
                      <td>${badge}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Experience & Employment Type Distributions -->
      <div class="grid-2">
        <div class="card">
          <div class="card-header">
            <div class="card-title-group">
              <h3 class="card-title">Postings by Required Experience</h3>
              <span class="card-subtitle">Volume distribution across career stages</span>
            </div>
          </div>
          <div class="card-body" style="height: 280px; position:relative;">
            <canvas id="market-exp-canvas"></canvas>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title-group">
              <h3 class="card-title">Postings by Employment Contract Type</h3>
              <span class="card-subtitle">Full-time, Contract, Part-time breakdown</span>
            </div>
          </div>
          <div class="card-body" style="height: 280px; position:relative;">
            <canvas id="market-emp-canvas"></canvas>
          </div>
        </div>
      </div>
    `;

    document.getElementById('app').innerHTML = renderShell(html, 'Company & Job Market Intelligence', 'Industry Risk Profiling, Seniority Vulnerability & Structural Macro Trends');

    setTimeout(() => {
      ChartEngine.drawExperienceBar('market-exp-canvas');
      ChartEngine.drawEmploymentTypeBar('market-emp-canvas');
    }, 50);
  }

  // ─── 6. #viz (Data Visualizations) ──────────────────────────────────────────
  function renderViz() {
    const html = `
      <div class="motif-blueprint"></div>

      <!-- Page Header Controls -->
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:24px;">
        <div>
          <h2 style="font-size:18px;">Empirical EMSCAD Dataset Visualizations</h2>
          <span style="font-size:12.5px; color:var(--text-faint);">8 deep-dive analytics cards exploring imbalance, missingness, and structural correlations</span>
        </div>
        <div style="display:flex; gap:10px;">
          <button class="btn btn-secondary btn-sm" onclick="window.print()">
            <i data-lucide="printer"></i> Print Report
          </button>
        </div>
      </div>

      <div class="grid-2" style="margin-bottom: 24px;">
        <!-- Chart 1: Class Balance -->
        <div class="card">
          <div class="card-header">
            <div class="card-title-group">
              <h3 class="card-title">1. Dataset Class Balance Donut</h3>
              <span class="card-subtitle">17,014 Legitimate (95.16%) vs 866 Fraud (4.84%)</span>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="ChartEngine.exportChartToPng('viz-chart-1', 'class-balance')">
              <i data-lucide="download"></i> PNG
            </button>
          </div>
          <div class="card-body" style="height: 280px; position:relative;">
            <canvas id="viz-chart-1"></canvas>
          </div>
        </div>

        <!-- Chart 2: Logo Impact -->
        <div class="card">
          <div class="card-header">
            <div class="card-title-group">
              <h3 class="card-title">2. Fraud Rate by Company Logo Presence</h3>
              <span class="card-subtitle">With Logo (1.99%) vs Without Logo (15.93%) — 8.0x disparity</span>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="ChartEngine.exportChartToPng('viz-chart-2', 'fraud-by-logo')">
              <i data-lucide="download"></i> PNG
            </button>
          </div>
          <div class="card-body" style="height: 280px; position:relative;">
            <canvas id="viz-chart-2"></canvas>
          </div>
        </div>
      </div>

      <div class="grid-2" style="margin-bottom: 24px;">
        <!-- Chart 3: Telecommuting Impact -->
        <div class="card">
          <div class="card-header">
            <div class="card-title-group">
              <h3 class="card-title">3. Fraud Rate by Telecommuting (Remote)</h3>
              <span class="card-subtitle">Remote (8.34%) vs Physical On-Site (4.69%)</span>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="ChartEngine.exportChartToPng('viz-chart-3', 'telecommuting-risk')">
              <i data-lucide="download"></i> PNG
            </button>
          </div>
          <div class="card-body" style="height: 280px; position:relative;">
            <canvas id="viz-chart-3"></canvas>
          </div>
        </div>

        <!-- Chart 4: Employment Type -->
        <div class="card">
          <div class="card-header">
            <div class="card-title-group">
              <h3 class="card-title">4. Postings by Employment Type</h3>
              <span class="card-subtitle">Full-Time (11,620), Contract (1,524), Part-Time (797)</span>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="ChartEngine.exportChartToPng('viz-chart-4', 'employment-types')">
              <i data-lucide="download"></i> PNG
            </button>
          </div>
          <div class="card-body" style="height: 280px; position:relative;">
            <canvas id="viz-chart-4"></canvas>
          </div>
        </div>
      </div>

      <div class="grid-2" style="margin-bottom: 24px;">
        <!-- Chart 5: Top Industries Volume -->
        <div class="card">
          <div class="card-header">
            <div class="card-title-group">
              <h3 class="card-title">5. Top Industries by Posting Volume</h3>
              <span class="card-subtitle">IT&S, Software, Internet, Marketing leading markets</span>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="ChartEngine.exportChartToPng('viz-chart-5', 'top-industries')">
              <i data-lucide="download"></i> PNG
            </button>
          </div>
          <div class="card-body" style="height: 300px; position:relative;">
            <canvas id="viz-chart-5"></canvas>
          </div>
        </div>

        <!-- Chart 6: Sorted Fraud Rate by Industry -->
        <div class="card">
          <div class="card-header">
            <div class="card-title-group">
              <h3 class="card-title">6. Industries Ranked by Fraud Rate (%)</h3>
              <span class="card-subtitle">Oil & Energy (34.06%), Accounting (20.73%), Real Estate (14.54%)</span>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="ChartEngine.exportChartToPng('viz-chart-6', 'industry-fraud-ranking')">
              <i data-lucide="download"></i> PNG
            </button>
          </div>
          <div class="card-body" style="height: 300px; position:relative;">
            <canvas id="viz-chart-6"></canvas>
          </div>
        </div>
      </div>

      <div class="grid-2">
        <!-- Chart 7: Experience Distribution -->
        <div class="card">
          <div class="card-header">
            <div class="card-title-group">
              <h3 class="card-title">7. Required Experience Distribution</h3>
              <span class="card-subtitle">Mid-Senior (3,809), Entry (2,697), Associate (2,297)</span>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="ChartEngine.exportChartToPng('viz-chart-7', 'experience-distribution')">
              <i data-lucide="download"></i> PNG
            </button>
          </div>
          <div class="card-body" style="height: 280px; position:relative;">
            <canvas id="viz-chart-7"></canvas>
          </div>
        </div>

        <!-- Chart 8: Missingness -->
        <div class="card">
          <div class="card-header">
            <div class="card-title-group">
              <h3 class="card-title">8. Missing Data Rates by Feature (%)</h3>
              <span class="card-subtitle">Salary Range (83.9% missing) vs Clean Categoricals</span>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="ChartEngine.exportChartToPng('viz-chart-8', 'missingness-rates')">
              <i data-lucide="download"></i> PNG
            </button>
          </div>
          <div class="card-body" style="height: 280px; position:relative;">
            <canvas id="viz-chart-8"></canvas>
          </div>
        </div>
      </div>
    `;

    document.getElementById('app').innerHTML = renderShell(html, 'Data Visualizations', 'Comprehensive Exploratory Data Analysis & Empirical Distribution Graphs');

    setTimeout(() => {
      ChartEngine.drawClassBalanceDonut('viz-chart-1');
      ChartEngine.drawFraudByLogoBar('viz-chart-2');
      ChartEngine.drawFraudByTelecommutingBar('viz-chart-3');
      ChartEngine.drawEmploymentTypeBar('viz-chart-4');
      ChartEngine.drawTopIndustriesBar('viz-chart-5');
      ChartEngine.drawFraudByIndustryBar('viz-chart-6');
      ChartEngine.drawExperienceBar('viz-chart-7');
      ChartEngine.drawMissingnessBar('viz-chart-8');
    }, 60);
  }

  // ─── 7. #performance (Model Benchmarks & Metrics) ───────────────────────────
  function renderPerformance() {
    const perf = window.JobGuardData.getModelPerformance();
    const rec = perf.recommendedModel;

    const html = `
      <div class="motif-podium-glow"></div>

      <!-- Recommended Model Card with Warm Gold Glow -->
      <div class="card" style="margin-bottom: 24px; border: 1.5px solid rgba(245, 158, 11, 0.5); box-shadow: 0 0 35px var(--gold-glow);">
        <div class="card-header" style="background: rgba(245, 158, 11, 0.06);">
          <div class="card-title-group">
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="badge" style="background:rgba(245,158,11,0.2); border:1px solid var(--gold); color:var(--gold);">
                <i data-lucide="award" style="width:13px;height:13px;"></i> Top Recommended Architecture
              </span>
              ${getPlaceholderNotice('Target Performance Metrics')}
            </div>
            <h2 class="card-title" style="font-size:20px; margin-top:4px;">${escapeHtml(rec.name)}</h2>
          </div>
          <span class="font-mono" style="font-size:12px; color:var(--text-faint);">Train Time: ${rec.trainTime}</span>
        </div>

        <div class="card-body">
          <div class="grid-4" style="margin-bottom: 16px;">
            <div style="padding:14px; background:var(--bg-raised); border-radius:10px; border:1px solid var(--border-color); text-align:center;">
              <span style="font-size:11px; text-transform:uppercase; color:var(--text-faint);">F1-Score (Target)</span>
              <div class="font-mono text-gold" style="font-size:26px; font-weight:700;">${(rec.f1Score * 100).toFixed(1)}%</div>
              <span style="font-size:11px; color:var(--text-muted);">Harmonic mean</span>
            </div>

            <div style="padding:14px; background:var(--bg-raised); border-radius:10px; border:1px solid var(--border-color); text-align:center;">
              <span style="font-size:11px; text-transform:uppercase; color:var(--text-faint);">Recall (Scam Catch)</span>
              <div class="font-mono text-cyan" style="font-size:26px; font-weight:700;">${(rec.recall * 100).toFixed(1)}%</div>
              <span style="font-size:11px; color:var(--text-muted);">Minimizes missed scams</span>
            </div>

            <div style="padding:14px; background:var(--bg-raised); border-radius:10px; border:1px solid var(--border-color); text-align:center;">
              <span style="font-size:11px; text-transform:uppercase; color:var(--text-faint);">PR-AUC</span>
              <div class="font-mono text-safe" style="font-size:26px; font-weight:700;">${(rec.prAuc * 100).toFixed(1)}%</div>
              <span style="font-size:11px; color:var(--text-muted);">Precision-Recall Area</span>
            </div>

            <div style="padding:14px; background:var(--bg-raised); border-radius:10px; border:1px solid var(--border-color); text-align:center;">
              <span style="font-size:11px; text-transform:uppercase; color:var(--text-faint);">Precision</span>
              <div class="font-mono text-violet" style="font-size:26px; font-weight:700;">${(rec.precision * 100).toFixed(1)}%</div>
              <span style="font-size:11px; color:var(--text-muted);">True positive accuracy</span>
            </div>
          </div>
          <p style="font-size:13px; color:var(--text-muted);">${escapeHtml(rec.notes)}</p>
        </div>
      </div>

      <!-- Critical Methodological Note: Why NOT Accuracy? -->
      <div style="display:flex; align-items:flex-start; gap:14px; padding:16px 20px; background:rgba(251, 191, 36, 0.08); border-left:3px solid var(--caution); border-radius:10px; margin-bottom:24px;">
        <i data-lucide="alert-circle" style="width:22px;height:22px;color:var(--caution); flex-shrink:0; margin-top:2px;"></i>
        <div style="font-size:13px; line-height:1.5;">
          <strong style="color:var(--caution);">Methodological Imperative — The Accuracy Paradox:</strong>
          Because only 4.84% of postings in the dataset are fraudulent, a naive classifier that blindly predicts "Legitimate" for 100% of inputs will achieve a deceptive <strong>95.16% Accuracy</strong> while failing to catch a single job scam. Therefore, our benchmark prioritizes <strong>F1-Score, Recall, and PR-AUC</strong> over raw accuracy.
        </div>
      </div>

      <!-- Full Models Comparison Table -->
      <div class="card" style="margin-bottom: 24px;">
        <div class="card-header">
          <div class="card-title-group">
            <h2 class="card-title">Model Comparative Performance Matrix</h2>
            <span class="card-subtitle">Ensemble, gradient boosting, and baseline algorithms</span>
          </div>
          ${getPlaceholderNotice('Comparative Benchmarks')}
        </div>
        <div class="card-body" style="padding:0;">
          <div class="table-responsive">
            <table class="table-dark">
              <thead>
                <tr>
                  <th>Model Architecture</th>
                  <th>Accuracy</th>
                  <th>Precision</th>
                  <th>Recall</th>
                  <th>F1-Score</th>
                  <th>ROC-AUC</th>
                  <th>PR-AUC</th>
                  <th>Train Time</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${perf.models.map((m) => `
                  <tr style="${m.isBest ? 'background:rgba(245,158,11,0.06);' : ''}">
                    <td style="font-weight:700;">
                      ${escapeHtml(m.name)}
                      ${m.isBest ? '<span class="badge" style="margin-left:6px; background:rgba(245,158,11,0.2); color:var(--gold); border:1px solid var(--gold); font-size:10px;">BEST</span>' : ''}
                    </td>
                    <td class="font-mono">${(m.accuracy * 100).toFixed(1)}%</td>
                    <td class="font-mono">${(m.precision * 100).toFixed(1)}%</td>
                    <td class="font-mono text-cyan">${(m.recall * 100).toFixed(1)}%</td>
                    <td class="font-mono text-gold" style="font-weight:700;">${(m.f1 * 100).toFixed(1)}%</td>
                    <td class="font-mono">${m.rocAuc.toFixed(3)}</td>
                    <td class="font-mono text-safe">${m.prAuc.toFixed(3)}</td>
                    <td class="font-mono" style="font-size:12px; color:var(--text-faint);">${m.trainTime}</td>
                    <td><span class="placeholder-notice sm">Benchmark</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Comparison Bar Charts & ROC/PR Curves -->
      <div class="grid-2" style="margin-bottom: 24px;">
        <div class="card">
          <div class="card-header">
            <div class="card-title-group">
              <h3 class="card-title">Model Metric Comparison (F1 vs Recall vs Precision)</h3>
              <span class="card-subtitle">Grouped performance comparison across candidate models</span>
            </div>
          </div>
          <div class="card-body" style="height: 300px; position:relative;">
            <canvas id="perf-comp-canvas"></canvas>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title-group">
              <h3 class="card-title">Confusion Matrix (Recommended Ensemble)</h3>
              <span class="card-subtitle">Tested against 3,577 held-out validation postings</span>
            </div>
          </div>
          <div class="card-body" id="perf-confusion-slot"></div>
        </div>
      </div>

      <div class="grid-2">
        <div class="card">
          <div class="card-header">
            <div class="card-title-group">
              <h3 class="card-title">ROC Curves (Receiver Operating Characteristic)</h3>
              <span class="card-subtitle">True Positive Rate vs False Positive Rate</span>
            </div>
          </div>
          <div class="card-body" style="height: 300px; position:relative;">
            <canvas id="perf-roc-canvas"></canvas>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title-group">
              <h3 class="card-title">Precision-Recall Curves</h3>
              <span class="card-subtitle">Essential metric for imbalanced fraud datasets</span>
            </div>
          </div>
          <div class="card-body" style="height: 300px; position:relative;">
            <canvas id="perf-pr-canvas"></canvas>
          </div>
        </div>
      </div>
    `;

    document.getElementById('app').innerHTML = renderShell(html, 'Model Performance Benchmarks', 'Evaluation Metrics, ROC/PR Curves & Imbalance Resilience Audits');

    setTimeout(() => {
      ChartEngine.drawModelComparisonBar('perf-comp-canvas', perf.models);
      ChartEngine.drawConfusionMatrix('perf-confusion-slot', perf.confusionMatrix.matrix);
      ChartEngine.drawROCCurves('perf-roc-canvas');
      ChartEngine.drawPRCurves('perf-pr-canvas');
    }, 60);
  }

  // ─── 8. #xai (Explainable AI & SHAP Attribution) ────────────────────────────
  async function renderXAI() {
    const pred = AppState.currentPrediction;
    const xaiData = await window.JobGuardData.getXAIExplanation(pred ? pred.id : null);

    const html = `
      <div class="motif-prism"></div>

      <div class="grid-2" style="margin-bottom: 24px;">
        <!-- Left: Risk Seal & Plain Language Verdict -->
        <div class="card">
          <div class="card-header">
            <div class="card-title-group">
              <h2 class="card-title">Explainable AI Forensic Seal</h2>
              <span class="card-subtitle">Prediction: ${escapeHtml(xaiData.job_title)}</span>
            </div>
            ${getRiskBadge(xaiData.verdict)}
          </div>
          <div class="card-body">
            ${generateRiskStampSVG(xaiData.risk_score, xaiData.verdict)}

            <div style="margin-top: 18px; padding: 16px; background:var(--bg-raised); border-radius:12px; border:1px solid var(--border-color);">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <span style="font-family:var(--font-heading); font-size:12px; font-weight:700; text-transform:uppercase; color:var(--accent-cyan);">Plain-Language Legal Explanation</span>
                ${getPlaceholderNotice('SHAP Force Attribution')}
              </div>
              <p style="font-size:13.5px; color:var(--text-primary); line-height:1.6;">
                ${escapeHtml(xaiData.plain_language)}
              </p>
            </div>
          </div>
        </div>

        <!-- Right: Fraud vs Legit Push Factors -->
        <div class="card">
          <div class="card-header">
            <div class="card-title-group">
              <h2 class="card-title">SHAP Feature Contribution Polarities</h2>
              <span class="card-subtitle">Red factors push towards fraud (+), Green push towards legitimacy (-)</span>
            </div>
          </div>
          <div class="card-body">
            <h3 style="font-size:13.5px; font-weight:700; color:var(--danger); margin-bottom:12px; display:flex; align-items:center; gap:6px;">
              <i data-lucide="arrow-up-right" style="width:16px;height:16px;"></i> Top Scam Risk Accelerators
            </h3>
            <div class="factor-list" style="margin-bottom: 24px;">
              ${xaiData.top_fraud_factors.map((f) => `
                <div class="factor-item">
                  <div class="factor-meta">
                    <span class="factor-name">${escapeHtml(f.feature)}</span>
                    <span class="factor-impact text-danger">+${f.impact}</span>
                  </div>
                  <div class="factor-bar-track">
                    <div class="factor-bar-fill fill-fraud" style="width: ${Math.min(100, f.impact * 200)}%;"></div>
                  </div>
                </div>
              `).join('')}
            </div>

            <h3 style="font-size:13.5px; font-weight:700; color:var(--safe); margin-bottom:12px; display:flex; align-items:center; gap:6px;">
              <i data-lucide="arrow-down-right" style="width:16px;height:16px;"></i> Top Legitimacy Anchors
            </h3>
            <div class="factor-list">
              ${xaiData.top_legit_factors.map((f) => `
                <div class="factor-item">
                  <div class="factor-meta">
                    <span class="factor-name">${escapeHtml(f.feature)}</span>
                    <span class="factor-impact text-safe">${f.impact}</span>
                  </div>
                  <div class="factor-bar-track">
                    <div class="factor-bar-fill fill-legit" style="width: ${Math.min(100, Math.abs(f.impact) * 200)}%;"></div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>

      <!-- Unique Feature: Fraud Fingerprint Word Bubble Cloud -->
      <div class="card" style="margin-bottom: 24px;">
        <div class="card-header">
          <div class="card-title-group">
            <h2 class="card-title">"Fraud Fingerprint" — High-Risk Lexical Token Cloud</h2>
            <span class="card-subtitle">Token importance weights derived from TF-IDF SHAP values</span>
          </div>
          ${getPlaceholderNotice('Token Contributions')}
        </div>
        <div class="card-body">
          <div class="fingerprint-cloud">
            ${xaiData.tokens.map((tok) => {
              let tokClass = 'token-legit';
              if (tok.risk === 'fraud' && tok.weight > 0.8) tokClass = 'token-fraud-high';
              else if (tok.risk === 'fraud') tokClass = 'token-fraud-med';
              return `
                <div class="token-bubble ${tokClass}">
                  <span>${escapeHtml(tok.word)}</span>
                  <span style="font-size:10px; opacity:0.8;">${tok.weight > 0 ? '+' : ''}${tok.weight}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>

      <!-- Global Feature Importance Table -->
      <div class="card">
        <div class="card-header">
          <div class="card-title-group">
            <h2 class="card-title">SHAP Global Feature Importance Ranking</h2>
            <span class="card-subtitle">Average absolute impact on model output magnitude</span>
          </div>
        </div>
        <div class="card-body" style="padding:0;">
          <div class="table-responsive">
            <table class="table-dark">
              <thead>
                <tr>
                  <th>Feature Name</th>
                  <th>SHAP Impact Value</th>
                  <th>Primary Influence Direction</th>
                  <th>Feature Category</th>
                </tr>
              </thead>
              <tbody>
                ${xaiData.shap_summary.map((s) => `
                  <tr>
                    <td class="font-mono" style="font-weight:600;">${escapeHtml(s.feature)}</td>
                    <td class="font-mono ${s.shap_value > 0 ? 'text-danger' : 'text-safe'}">
                      ${s.shap_value > 0 ? '+' : ''}${s.shap_value.toFixed(2)}
                    </td>
                    <td>
                      ${s.shap_value > 0
                        ? '<span class="badge badge-high-risk">Elevates Fraud Probability</span>'
                        : '<span class="badge badge-legit">Promotes Legitimate Rating</span>'
                      }
                    </td>
                    <td style="color:var(--text-muted);">Tabular Metadata & Lexical</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    document.getElementById('app').innerHTML = renderShell(html, 'Explainable AI Breakdown', 'Local and Global SHAP Attribution, Decision Boundaries & Token Impact');
    if (window.lucide) lucide.createIcons();
  }

  // ─── 9. #history (Prediction Audit History) ─────────────────────────────────
  function renderHistory() {
    const historyData = window.JobGuardData.getPredictionHistory();
    let items = historyData.history;

    // Filter Logic
    if (AppState.historyFilter !== 'all') {
      items = items.filter((x) => x.verdict.toLowerCase().includes(AppState.historyFilter));
    }
    if (AppState.historySearch) {
      const q = AppState.historySearch.toLowerCase();
      items = items.filter((x) => (x.job_title || '').toLowerCase().includes(q) || (x.company || '').toLowerCase().includes(q));
    }

    const html = `
      <div class="motif-ledger"></div>

      <!-- Stats Summary Strip -->
      <div class="grid-4" style="margin-bottom: 24px;">
        <div class="card stat-card">
          <span class="stat-card-label">Total Postings Scanned</span>
          <div class="stat-card-val">${historyData.total}</div>
          <div class="stat-card-sub">Session audit log</div>
        </div>
        <div class="card stat-card">
          <span class="stat-card-label">Flagged High Risk</span>
          <div class="stat-card-val text-danger">${historyData.fraudCount}</div>
          <div class="stat-card-sub">Scams intercepted</div>
        </div>
        <div class="card stat-card">
          <span class="stat-card-label">Potentially Suspicious</span>
          <div class="stat-card-val text-caution">${historyData.suspiciousCount}</div>
          <div class="stat-card-sub">Cautionary reviews</div>
        </div>
        <div class="card stat-card">
          <span class="stat-card-label">Legitimate Clean</span>
          <div class="stat-card-val text-safe">${historyData.legitCount}</div>
          <div class="stat-card-sub">Verified enterprise roles</div>
        </div>
      </div>

      <!-- Controls & Bulk Actions Toolbar -->
      <div class="card" style="margin-bottom: 20px; padding:16px 20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
          <!-- Search & Filter -->
          <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap; flex:1;">
            <div style="position:relative; min-width:240px;">
              <input type="text" id="history-search" class="form-input" style="padding-left:36px; height:38px; font-size:13px;" placeholder="Filter by title or company..." value="${escapeHtml(AppState.historySearch)}">
              <i data-lucide="search" style="position:absolute; left:12px; top:11px; width:15px; height:15px; color:var(--text-faint);"></i>
            </div>

            <select id="history-filter-select" class="form-select" style="width:auto; height:38px; font-size:13px; padding-top:6px; padding-bottom:6px;">
              <option value="all" ${AppState.historyFilter === 'all' ? 'selected' : ''}>All Risk Tiers</option>
              <option value="high" ${AppState.historyFilter === 'high' ? 'selected' : ''}>High Risk Only</option>
              <option value="suspicious" ${AppState.historyFilter === 'suspicious' ? 'selected' : ''}>Suspicious Only</option>
              <option value="legitimate" ${AppState.historyFilter === 'legitimate' ? 'selected' : ''}>Legitimate Only</option>
            </select>
          </div>

          <!-- Bulk Action Buttons -->
          <div style="display:flex; align-items:center; gap:8px;">
            <button class="btn btn-secondary btn-sm" id="btn-export-csv">
              <i data-lucide="download"></i> Export CSV
            </button>
            <button class="btn btn-danger btn-sm" id="btn-bulk-delete" style="${AppState.historySelection.size === 0 ? 'display:none;' : ''}">
              <i data-lucide="trash-2"></i> Delete Selected (${AppState.historySelection.size})
            </button>
          </div>
        </div>
      </div>

      <!-- History Table -->
      <div class="card">
        <div class="card-body" style="padding:0;">
          ${items.length === 0 ? `
            <div style="text-align:center; padding:60px 20px; color:var(--text-faint);">
              <i data-lucide="inbox" style="width:48px;height:48px;margin-bottom:12px;color:var(--text-faint);"></i>
              <h3 style="font-size:16px; color:var(--text-muted); margin-bottom:4px;">No Scan History Found</h3>
              <p style="font-size:13px;">No predictions match your current search or filter criteria.</p>
              <a href="#analyze" class="btn btn-primary btn-sm" style="margin-top:16px;"><i data-lucide="scan"></i> Scan First Posting</a>
            </div>
          ` : `
            <div class="table-responsive">
              <table class="table-dark">
                <thead>
                  <tr>
                    <th style="width:40px; text-align:center;">
                      <input type="checkbox" id="check-select-all" ${AppState.historySelection.size > 0 && AppState.historySelection.size === items.length ? 'checked' : ''}>
                    </th>
                    <th>Job Title & Organization</th>
                    <th>Risk Verdict</th>
                    <th>Risk Index</th>
                    <th>Model Used</th>
                    <th>Audit Timestamp</th>
                    <th style="text-align:right;">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${items.map((row) => `
                    <tr>
                      <td style="text-align:center;">
                        <input type="checkbox" class="history-row-check" data-id="${row.id}" ${AppState.historySelection.has(row.id) ? 'checked' : ''}>
                      </td>
                      <td>
                        <div style="display:flex; flex-direction:column;">
                          <span style="font-weight:600; color:var(--text-primary);">${escapeHtml(row.job_title)}</span>
                          <span style="font-size:11.5px; color:var(--text-faint);">${escapeHtml(row.company || 'Unspecified Employer')}</span>
                        </div>
                      </td>
                      <td>${getRiskBadge(row.verdict)}</td>
                      <td>
                        <span class="font-mono" style="font-weight:700; ${row.risk_score >= 70 ? 'color:var(--danger);' : row.risk_score >= 40 ? 'color:var(--caution);' : 'color:var(--safe);'}">
                          ${row.risk_score} / 100
                        </span>
                      </td>
                      <td>
                        <span class="font-mono" style="font-size:11px; color:var(--text-muted);">${escapeHtml(row.model_used.split('[')[0])}</span>
                      </td>
                      <td>
                        <span class="font-mono" style="font-size:11.5px; color:var(--text-faint);">
                          ${new Date(row.created_at || Date.now()).toLocaleDateString()} ${new Date(row.created_at || Date.now()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                      </td>
                      <td style="text-align:right;">
                        <div style="display:inline-flex; gap:6px;">
                          <button class="btn btn-secondary btn-sm btn-view-pred" data-id="${row.id}" title="View detailed breakdown">
                            <i data-lucide="eye" style="width:13px;height:13px;"></i>
                          </button>
                          <button class="btn-icon btn-delete-pred" data-id="${row.id}" title="Delete record">
                            <i data-lucide="trash-2" style="width:14px;height:14px;"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `}
        </div>
      </div>
    `;

    document.getElementById('app').innerHTML = renderShell(html, 'Prediction Audit History', 'Persistent Scan Log, Chain-of-Custody Records & Bulk Export');

    // Wire History Controls
    const searchInput = document.getElementById('history-search');
    const filterSelect = document.getElementById('history-filter-select');
    const selectAllCheck = document.getElementById('check-select-all');

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        AppState.historySearch = e.target.value;
        renderHistory();
      });
    }

    if (filterSelect) {
      filterSelect.addEventListener('change', (e) => {
        AppState.historyFilter = e.target.value;
        renderHistory();
      });
    }

    if (selectAllCheck) {
      selectAllCheck.addEventListener('change', (e) => {
        if (e.target.checked) {
          items.forEach((item) => AppState.historySelection.add(item.id));
        } else {
          AppState.historySelection.clear();
        }
        renderHistory();
      });
    }

    // Individual Row Checkboxes
    document.querySelectorAll('.history-row-check').forEach((cb) => {
      cb.addEventListener('change', (e) => {
        const id = e.target.getAttribute('data-id');
        if (e.target.checked) AppState.historySelection.add(id);
        else AppState.historySelection.delete(id);
        renderHistory();
      });
    });

    // Delete Single Record
    document.querySelectorAll('.btn-delete-pred').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = btn.getAttribute('data-id');
        openModal(`
          <div style="padding:24px;">
            <h3 style="font-size:17px; margin-bottom:8px; color:var(--danger); display:flex; align-items:center; gap:8px;">
              <i data-lucide="alert-triangle"></i> Confirm Record Deletion
            </h3>
            <p style="font-size:13px; color:var(--text-muted); margin-bottom:20px;">
              Are you sure you want to permanently erase this prediction audit entry? This action cannot be undone.
            </p>
            <div style="display:flex; justify-content:flex-end; gap:10px;">
              <button class="btn btn-secondary" onclick="document.getElementById('modal-container').classList.remove('open')">Cancel</button>
              <button class="btn btn-danger" id="confirm-delete-btn">Permanently Delete</button>
            </div>
          </div>
        `);
        document.getElementById('confirm-delete-btn').addEventListener('click', () => {
          window.JobGuardData.deletePrediction(id);
          AppState.historySelection.delete(id);
          closeModal();
          showToast('Record deleted from history', 'info');
          renderHistory();
        });
      });
    });

    // View Details Modal
    document.querySelectorAll('.btn-view-pred').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const xai = await window.JobGuardData.getXAIExplanation(id);
        openModal(`
          <div style="padding:24px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
              <h3 style="font-size:16px; font-weight:700;">Prediction Audit Record: ${escapeHtml(xai.job_title)}</h3>
              ${getRiskBadge(xai.verdict)}
            </div>
            ${generateRiskStampSVG(xai.risk_score, xai.verdict)}
            <div style="margin-top:16px; padding:14px; background:var(--bg-raised); border-radius:10px;">
              <span style="font-size:11px; font-weight:700; color:var(--accent-cyan); text-transform:uppercase;">Explanation Summary</span>
              <p style="font-size:13px; margin-top:4px; line-height:1.5;">${escapeHtml(xai.plain_language)}</p>
            </div>
            <div style="display:flex; justify-content:flex-end; margin-top:20px;">
              <button class="btn btn-secondary" onclick="document.getElementById('modal-container').classList.remove('open')">Close</button>
            </div>
          </div>
        `);
      });
    });

    // Bulk Delete
    const bulkDelBtn = document.getElementById('btn-bulk-delete');
    if (bulkDelBtn) {
      bulkDelBtn.addEventListener('click', () => {
        const count = AppState.historySelection.size;
        window.JobGuardData.deleteBulkPredictions(Array.from(AppState.historySelection));
        AppState.historySelection.clear();
        showToast(`Deleted ${count} selected records`, 'info');
        renderHistory();
      });
    }

    // Export CSV (Unique Feature)
    const exportBtn = document.getElementById('btn-export-csv');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        const csvRows = [
          ['ID', 'Job Title', 'Company', 'Verdict', 'Risk Score', 'Model Used', 'Timestamp'],
          ...items.map((x) => [
            x.id,
            `"${(x.job_title || '').replace(/"/g, '""')}"`,
            `"${(x.company || '').replace(/"/g, '""')}"`,
            x.verdict,
            x.risk_score,
            `"${(x.model_used || '').replace(/"/g, '""')}"`,
            x.created_at
          ])
        ];
        const csvContent = 'data:text/csv;charset=utf-8,' + csvRows.map((e) => e.join(',')).join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `jobguard_audit_export_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('Exported audit history as CSV', 'success');
      });
    }
  }

  // ─── 10. #about (About Architecture & Methodology) ──────────────────────────
  function renderAbout() {
    const html = `
      <!-- Problem Statement Section -->
      <div class="card" style="margin-bottom: 24px; padding: 28px;">
        <span class="badge badge-suspicious" style="margin-bottom:12px;">The Forensic Challenge</span>
        <h2 style="font-size:22px; margin-bottom:12px;">Combating The Global Surge in Fraudulent Recruitment</h2>
        <p style="font-size:14px; color:var(--text-muted); line-height:1.7; max-width:960px;">
          Online employment fraud has evolved into an industrialized cybercrime vector causing hundreds of millions in financial losses annually. Deceptive actors impersonate reputable enterprises to harvest identity documents, conduct check-cashing advances, and siphon banking credentials. VerityFile delivers a rigorous forensic platform integrating classical tabular feature engineering with NLP lexical parsing and Explainable AI (SHAP) to provide transparent, court-admissible risk rationales.
        </p>
      </div>

      <!-- Objectives Grid -->
      <div class="grid-3" style="margin-bottom: 24px;">
        <div class="card" style="padding: 22px;">
          <div style="width:38px;height:38px;border-radius:10px;background:rgba(139,92,246,0.15);border:1px solid var(--accent-violet);display:flex;align-items:center;justify-content:center;color:var(--accent-violet);margin-bottom:14px;">
            <i data-lucide="crosshair"></i>
          </div>
          <h3 style="font-size:16px; margin-bottom:6px;">High Scam Recall</h3>
          <p style="font-size:12.5px; color:var(--text-muted); line-height:1.5;">
            Targeting >85% fraud catch rate on severely imbalanced test distributions without generating unacceptable false accusation penalties.
          </p>
        </div>

        <div class="card" style="padding: 22px;">
          <div style="width:38px;height:38px;border-radius:10px;background:rgba(34,211,238,0.15);border:1px solid var(--accent-cyan);display:flex;align-items:center;justify-content:center;color:var(--accent-cyan);margin-bottom:14px;">
            <i data-lucide="eye"></i>
          </div>
          <h3 style="font-size:16px; margin-bottom:6px;">Zero Black-Box XAI</h3>
          <p style="font-size:12.5px; color:var(--text-muted); line-height:1.5;">
            Every single flag is translated into human-readable plain language backed by exact SHAP mathematical factor contribution values.
          </p>
        </div>

        <div class="card" style="padding: 22px;">
          <div style="width:38px;height:38px;border-radius:10px;background:rgba(52,211,153,0.15);border:1px solid var(--safe);display:flex;align-items:center;justify-content:center;color:var(--safe);margin-bottom:14px;">
            <i data-lucide="cpu"></i>
          </div>
          <h3 style="font-size:16px; margin-bottom:6px;">Multimodal Synthesis</h3>
          <p style="font-size:12.5px; color:var(--text-muted); line-height:1.5;">
            Combines structured tabular missingness heuristics with unstructured NLP n-gram TF-IDF representations.
          </p>
        </div>
      </div>

      <!-- Methodology Flowchart (CSS/SVG Pipeline) -->
      <div class="card" style="margin-bottom: 24px;">
        <div class="card-header">
          <div class="card-title-group">
            <h2 class="card-title">Forensic Pipeline Architecture</h2>
            <span class="card-subtitle">End-to-end dataflow from raw posting to interpretability report</span>
          </div>
        </div>
        <div class="card-body">
          <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:16px; padding:20px 0;">
            <div style="flex:1; min-width:180px; padding:16px; background:var(--bg-raised); border:1px solid var(--border-color); border-radius:12px; text-align:center;">
              <span class="font-mono text-cyan" style="font-size:11px;">STAGE 01</span>
              <h4 style="font-size:14px; margin:6px 0;">Data Ingestion</h4>
              <p style="font-size:11.5px; color:var(--text-faint);">EMSCAD (17,880) + Real-time text intake</p>
            </div>
            <i data-lucide="arrow-right" style="color:var(--text-faint);"></i>

            <div style="flex:1; min-width:180px; padding:16px; background:var(--bg-raised); border:1px solid var(--border-color); border-radius:12px; text-align:center;">
              <span class="font-mono text-violet" style="font-size:11px;">STAGE 02</span>
              <h4 style="font-size:14px; margin:6px 0;">Preprocessing</h4>
              <p style="font-size:11.5px; color:var(--text-faint);">HTML stripping, missingness imputation</p>
            </div>
            <i data-lucide="arrow-right" style="color:var(--text-faint);"></i>

            <div style="flex:1; min-width:180px; padding:16px; background:var(--bg-raised); border:1px solid var(--border-color); border-radius:12px; text-align:center;">
              <span class="font-mono text-safe" style="font-size:11px;">STAGE 03</span>
              <h4 style="font-size:14px; margin:6px 0;">Ensemble Classifiers</h4>
              <p style="font-size:11.5px; color:var(--text-faint);">XGBoost, LightGBM, Random Forest</p>
            </div>
            <i data-lucide="arrow-right" style="color:var(--text-faint);"></i>

            <div style="flex:1; min-width:180px; padding:16px; background:var(--bg-raised); border:1px solid var(--border-color); border-radius:12px; text-align:center;">
              <span class="font-mono text-gold" style="font-size:11px;">STAGE 04</span>
              <h4 style="font-size:14px; margin:6px 0;">XAI Interpretability</h4>
              <p style="font-size:11.5px; color:var(--text-faint);">TreeSHAP attribution & Risk Stamp</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Tech Stack Icon Grid -->
      <div class="card" style="margin-bottom: 24px;">
        <div class="card-header">
          <div class="card-title-group">
            <h2 class="card-title">Production Technology Stack</h2>
            <span class="card-subtitle">Engineered with high-throughput scientific Python and modern web standards</span>
          </div>
        </div>
        <div class="card-body">
          <div class="grid-4">
            <div style="display:flex; align-items:center; gap:12px; padding:14px; background:var(--bg-raised); border-radius:10px;">
              <i data-lucide="layers" style="color:var(--accent-cyan);"></i>
              <div>
                <strong style="font-size:13px; display:block;">XGBoost / LightGBM</strong>
                <span style="font-size:11px; color:var(--text-faint);">Gradient Boosted Trees</span>
              </div>
            </div>

            <div style="display:flex; align-items:center; gap:12px; padding:14px; background:var(--bg-raised); border-radius:10px;">
              <i data-lucide="sparkles" style="color:var(--gold);"></i>
              <div>
                <strong style="font-size:13px; display:block;">SHAP (TreeExplainer)</strong>
                <span style="font-size:11px; color:var(--text-faint);">Game Theoretic Attribution</span>
              </div>
            </div>

            <div style="display:flex; align-items:center; gap:12px; padding:14px; background:var(--bg-raised); border-radius:10px;">
              <i data-lucide="file-code" style="color:var(--accent-violet);"></i>
              <div>
                <strong style="font-size:13px; display:block;">Flask 3.0 REST API</strong>
                <span style="font-size:11px; color:var(--text-faint);">Backend Microservices</span>
              </div>
            </div>

            <div style="display:flex; align-items:center; gap:12px; padding:14px; background:var(--bg-raised); border-radius:10px;">
              <i data-lucide="pie-chart" style="color:var(--safe);"></i>
              <div>
                <strong style="font-size:13px; display:block;">Chart.js Visualizer</strong>
                <span style="font-size:11px; color:var(--text-faint);">GPU-Accelerated Charts</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Academic Reference Citation -->
      <div class="card" style="padding: 24px;">
        <h3 style="font-size:14px; font-weight:700; margin-bottom:8px;">Academic Reference & Benchmark Citation</h3>
        <p class="font-mono" style="font-size:12px; color:var(--text-muted); background:var(--bg-raised); padding:14px; border-radius:8px; border:1px solid var(--border-color); line-height:1.6;">
          Vidros, S., Kolias, C., Kambourakis, G., & Akoglu, L. (2017). Automatic Detection of Online Recruitment Frauds: Characteristics, Methods, and a Public Dataset. Future Internet, 9(1), 6. University of the Aegean & George Mason University.
        </p>
      </div>
    `;

    document.getElementById('app').innerHTML = renderShell(html, 'About VerityFile Architecture', 'System Objectives, Pipeline Engineering & Theoretical Foundations');
  }

  // ─── 11. #login (Authentication Gate) ───────────────────────────────────────
  function renderLogin() {
    const html = `
      <div class="motif-aurora"></div>

      <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; position:relative; z-index:10;">
        <div class="card" style="max-width: 440px; width: 100%; padding: 36px 32px; box-shadow: 0 20px 60px rgba(0,0,0,0.8), 0 0 40px var(--accent-violet-glow);">
          <div style="text-align: center; margin-bottom: 28px;">
            <div class="brand-shield" style="width:48px;height:48px;margin: 0 auto 14px auto;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:24px;height:24px;">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                <path d="m9 12 2 2 4-4"/>
              </svg>
            </div>
            <h2 style="font-size: 22px; font-weight: 800; letter-spacing: -0.02em;">VerityFile Console</h2>
            <p style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">Job Posting Forensics & XAI Architecture</p>
          </div>

          <form id="form-login">
            <div class="form-group">
              <label class="form-label">Analyst Email</label>
              <input type="email" id="login-email" class="form-input" placeholder="analyst@verityfile.ai" value="analyst@verityfile.ai" required>
            </div>

            <div class="form-group">
              <label class="form-label">Security Credential / Password</label>
              <input type="password" id="login-password" class="form-input" placeholder="••••••••••••" value="VerityFile2026!" required>
            </div>

            <button type="submit" class="btn btn-primary" id="btn-login-submit" style="width: 100%; height: 44px; margin-top: 8px;">
              <i data-lucide="log-in"></i> Sign In to Forensic Console
            </button>
          </form>

          <div style="margin-top: 24px; padding-top: 18px; border-top: 1px solid var(--border-subtle); display:flex; flex-direction:column; gap:10px; text-align: center; font-size: 12.5px;">
            <span style="color: var(--text-faint);">
              Need investigator clearance? <a href="#register" style="color: var(--accent-cyan); text-decoration: none; font-weight: 600;">Create Account</a>
            </span>
            <span style="color: var(--text-faint); font-family: var(--font-mono); font-size: 11px;">
              [ Demonstration mode: Any credentials accepted ]
            </span>
          </div>
        </div>
      </div>
    `;

    document.getElementById('app').innerHTML = html;

    const form = document.getElementById('form-login');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value;
      const pwd = document.getElementById('login-password').value;
      const btn = document.getElementById('btn-login-submit');

      btn.classList.add('is-loading');
      btn.innerHTML = `<span class="spinner"></span> Authenticating Clearance...`;

      await window.JobGuardData.loginUser(email, pwd);
      showToast('Investigator session verified. Welcome back.', 'success');
      window.location.hash = '#dashboard';
    });
  }

  // ─── 12. #register (Investigator Clearance) ─────────────────────────────────
  function renderRegister() {
    const html = `
      <div class="motif-aurora"></div>

      <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; position:relative; z-index:10;">
        <div class="card" style="max-width: 480px; width: 100%; padding: 36px 32px; box-shadow: 0 20px 60px rgba(0,0,0,0.8), 0 0 40px var(--accent-cyan-glow);">
          <div style="text-align: center; margin-bottom: 24px;">
            <div class="brand-shield" style="width:48px;height:48px;margin: 0 auto 14px auto;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:24px;height:24px;">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                <path d="m9 12 2 2 4-4"/>
              </svg>
            </div>
            <h2 style="font-size: 22px; font-weight: 800;">Register Investigator Account</h2>
            <p style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">Initialize credential profile for forensic auditing</p>
          </div>

          <form id="form-register">
            <div class="form-group">
              <label class="form-label">Full Name</label>
              <input type="text" id="reg-name" class="form-input" placeholder="Dr. Evelyn Vance" required>
            </div>

            <div class="form-group">
              <label class="form-label">Organization Email</label>
              <input type="email" id="reg-email" class="form-input" placeholder="vance@verityfile.ai" required>
            </div>

            <div class="form-group">
              <label class="form-label">Password</label>
              <input type="password" id="reg-password" class="form-input" placeholder="••••••••••••" required>
              <!-- Password Strength Meter -->
              <div class="pwd-meter-track">
                <div class="pwd-meter-segment" id="pwd-seg-1"></div>
                <div class="pwd-meter-segment" id="pwd-seg-2"></div>
                <div class="pwd-meter-segment" id="pwd-seg-3"></div>
                <div class="pwd-meter-segment" id="pwd-seg-4"></div>
              </div>
              <span class="pwd-label" id="pwd-label">Password strength: Empty</span>
            </div>

            <div class="form-group">
              <label class="form-label">Confirm Password</label>
              <input type="password" id="reg-confirm" class="form-input" placeholder="••••••••••••" required>
            </div>

            <button type="submit" class="btn btn-primary" id="btn-reg-submit" style="width: 100%; height: 44px; margin-top: 8px;">
              <i data-lucide="shield-check"></i> Initialize Investigator Account
            </button>
          </form>

          <div style="margin-top: 24px; padding-top: 18px; border-top: 1px solid var(--border-subtle); text-align: center; font-size: 12.5px;">
            <span style="color: var(--text-faint);">
              Already hold credentials? <a href="#login" style="color: var(--accent-cyan); text-decoration: none; font-weight: 600;">Sign In</a>
            </span>
          </div>
        </div>
      </div>
    `;

    document.getElementById('app').innerHTML = html;

    // Real-Time Password Strength Meter
    const pwdInput = document.getElementById('reg-password');
    const label = document.getElementById('pwd-label');
    const seg1 = document.getElementById('pwd-seg-1');
    const seg2 = document.getElementById('pwd-seg-2');
    const seg3 = document.getElementById('pwd-seg-3');
    const seg4 = document.getElementById('pwd-seg-4');

    pwdInput.addEventListener('input', (e) => {
      const val = e.target.value;
      let score = 0;
      if (val.length >= 6) score++;
      if (val.length >= 10) score++;
      if (/[A-Z]/.test(val) && /[0-9]/.test(val)) score++;
      if (/[^A-Za-z0-9]/.test(val)) score++;

      // Reset segments
      [seg1, seg2, seg3, seg4].forEach((s) => (s.style.backgroundColor = 'var(--bg-base)'));

      if (score === 1) {
        seg1.style.backgroundColor = 'var(--danger)';
        label.textContent = 'Password strength: Weak';
        label.style.color = 'var(--danger)';
      } else if (score === 2) {
        seg1.style.backgroundColor = 'var(--caution)';
        seg2.style.backgroundColor = 'var(--caution)';
        label.textContent = 'Password strength: Medium';
        label.style.color = 'var(--caution)';
      } else if (score === 3) {
        seg1.style.backgroundColor = 'var(--accent-cyan)';
        seg2.style.backgroundColor = 'var(--accent-cyan)';
        seg3.style.backgroundColor = 'var(--accent-cyan)';
        label.textContent = 'Password strength: Strong';
        label.style.color = 'var(--accent-cyan)';
      } else if (score === 4) {
        seg1.style.backgroundColor = 'var(--safe)';
        seg2.style.backgroundColor = 'var(--safe)';
        seg3.style.backgroundColor = 'var(--safe)';
        seg4.style.backgroundColor = 'var(--safe)';
        label.textContent = 'Password strength: Very Strong (Optimal)';
        label.style.color = 'var(--safe)';
      } else {
        label.textContent = 'Password strength: Empty';
        label.style.color = 'var(--text-faint)';
      }
    });

    const form = document.getElementById('form-register');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('reg-name').value;
      const email = document.getElementById('reg-email').value;
      const pwd = document.getElementById('reg-password').value;
      const confirm = document.getElementById('reg-confirm').value;

      if (pwd !== confirm) {
        showToast('Password confirmation does not match', 'error');
        return;
      }

      const btn = document.getElementById('btn-reg-submit');
      btn.classList.add('is-loading');
      btn.innerHTML = `<span class="spinner"></span> Creating Profile...`;

      await window.JobGuardData.registerUser(name, email, pwd);
      showToast('Registration successful. Session established.', 'success');
      window.location.hash = '#dashboard';
    });
  }

  // ─── Hash Router & Auth Gate ────────────────────────────────────────────────
  function route() {
    const rawHash = window.location.hash || '#dashboard';
    const cleanHash = rawHash.split('?')[0].toLowerCase();
    AppState.currentRoute = cleanHash;

    const isAuthed = window.JobGuardData.isAuthenticated();
    const publicRoutes = ['#login', '#register', '#about'];

    // Auth Protection
    if (!isAuthed && !publicRoutes.includes(cleanHash)) {
      window.location.hash = '#login';
      return;
    }

    // Redirect to dashboard if logged in and hitting login/register
    if (isAuthed && (cleanHash === '#login' || cleanHash === '#register')) {
      window.location.hash = '#dashboard';
      return;
    }

    // Scroll viewport to top
    window.scrollTo(0, 0);

    switch (cleanHash) {
      case '#dashboard':
        renderDashboard();
        break;
      case '#analyze':
        renderAnalyze();
        break;
      case '#nlp':
        renderNLP();
        break;
      case '#roles':
        renderRoles();
        break;
      case '#market':
        renderMarket();
        break;
      case '#viz':
        renderViz();
        break;
      case '#performance':
        renderPerformance();
        break;
      case '#xai':
        renderXAI();
        break;
      case '#history':
        renderHistory();
        break;
      case '#about':
        renderAbout();
        break;
      case '#login':
        renderLogin();
        break;
      case '#register':
        renderRegister();
        break;
      default:
        renderDashboard();
        break;
    }

    // Re-instantiate Lucide Icons
    if (window.lucide) {
      lucide.createIcons();
    }

    // Bind Global Topbar & Sidebar Listeners
    bindShellEvents();
  }

  function bindShellEvents() {
    // Logout Handler
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        window.JobGuardData.logoutUser();
        showToast('Signed out of forensic console', 'info');
        window.location.hash = '#login';
      });
    }

    // Mobile Hamburger Toggle
    const mobileBtn = document.getElementById('btn-mobile-menu');
    const sidebar = document.getElementById('app-sidebar');
    if (mobileBtn && sidebar) {
      mobileBtn.addEventListener('click', () => {
        sidebar.classList.toggle('mobile-open');
      });
    }
  }

  // ─── Initialization ─────────────────────────────────────────────────────────
  window.addEventListener('DOMContentLoaded', () => {
    initSpotlight();
    route();
  });

  window.addEventListener('hashchange', () => {
    route();
  });

})();
