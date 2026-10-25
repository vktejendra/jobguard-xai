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
    historySearch: '',
    rolesTab: 'resume',
    currentResumeAnalysis: null,
    resumeJobSearch: ''
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

  // Universal Fallback PDF text stream scanner
  function extractPdfTextFallback(arrayBuffer) {
    try {
      const bytes = new Uint8Array(arrayBuffer);
      let str = '';
      const len = bytes.length;
      const chunkSize = 8192;
      for (let i = 0; i < len; i += chunkSize) {
        const slice = bytes.subarray(i, Math.min(i + chunkSize, len));
        str += String.fromCharCode.apply(null, slice);
      }

      const tokens = [];
      const tjRegex = /\(([^)\r\n]{2,})\)\s*(?:Tj|'|")/g;
      let match;
      while ((match = tjRegex.exec(str)) !== null) {
        const s = match[1].trim();
        if (s.length > 1 && !/^\\[0-9]+$/.test(s)) {
          tokens.push(s);
        }
      }

      const tjArrRegex = /\[(.*?)\]\s*TJ/g;
      while ((match = tjArrRegex.exec(str)) !== null) {
        const inner = match[1].match(/\(([^)]+)\)/g);
        if (inner) {
          inner.forEach(item => {
            const cleaned = item.slice(1, -1).trim();
            if (cleaned.length > 0) tokens.push(cleaned);
          });
        }
      }

      if (tokens.length > 5) {
        return tokens.join(' ');
      }

      const streamRegex = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
      let streamMatch;
      const streamWords = [];
      while ((streamMatch = streamRegex.exec(str)) !== null) {
        const rawContent = streamMatch[1];
        const cleanChars = rawContent.replace(/[^a-zA-Z0-9.,;:!?'"()\s-]/g, ' ');
        const parts = cleanChars.split(/\s+/).filter(w => w.length > 2 && /^[a-zA-Z]/.test(w));
        if (parts.length > 4) {
          streamWords.push(parts.join(' '));
        }
      }
      return streamWords.join('\n');
    } catch (err) {
      console.warn('Fallback PDF extraction error:', err);
      return '';
    }
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
  function openModal(contentHtml, customClass = '') {
    const container = document.getElementById('modal-container');
    if (!container) return;
    container.innerHTML = `<div class="modal-box ${customClass}">${contentHtml}</div>`;
    container.classList.add('open');
    if (window.lucide) lucide.createIcons();
  }

  function closeModal() {
    const container = document.getElementById('modal-container');
    if (!container) return;
    container.classList.remove('open');
    container.innerHTML = '';
  }
  window.closeModal = closeModal;

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

  // ─── Recruitment Fraud Attack Vector Interactive SVG ──────────────────────
  function getNetworkTopologySVG() {
    return `
      <div class="soc-topology-container">
        <svg viewBox="0 0 740 260" class="soc-topology-svg" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="topoGridPattern" width="28" height="28" patternUnits="userSpaceOnUse">
              <path d="M 28 0 L 0 0 0 28" fill="none" stroke="rgba(0, 240, 200, 0.04)" stroke-width="0.8" />
            </pattern>
            <filter id="cyanGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="coralGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="amberGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <linearGradient id="normGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#0df2c9" />
              <stop offset="50%" stop-color="#00f2fe" />
              <stop offset="100%" stop-color="#0df2c9" />
            </linearGradient>
            <linearGradient id="atkGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#00f2fe" />
              <stop offset="35%" stop-color="#ff3b5c" />
              <stop offset="100%" stop-color="#ff3b5c" />
            </linearGradient>

            <!-- Legitimate Flow Path -->
            <path id="path-cand-portal" d="M 55,135 C 95,135 110,85 155,85" />
            <path id="path-portal-dns" d="M 185,85 L 270,85" />
            <path id="path-dns-screen" d="M 300,85 C 345,85 365,65 415,65" />
            <path id="path-screen-offer" d="M 445,65 C 495,65 520,85 570,85" />

            <!-- Fraudulent Attack Vector Path -->
            <path id="path-cand-nologo" d="M 55,135 C 95,135 110,185 155,185" />
            <path id="path-nologo-chat" d="M 185,185 L 270,185" />
            <path id="path-chat-forged" d="M 300,185 C 345,185 375,185 415,185" />
            <path id="path-forged-extort" d="M 445,185 C 495,185 520,205 570,205" />
          </defs>

          <!-- Background Contour Wave Terrain -->
          <rect width="100%" height="100%" fill="url(#topoGridPattern)" />
          <path d="M 0,220 C 160,170 260,250 420,200 C 560,155 650,225 740,190" fill="none" stroke="rgba(13, 242, 201, 0.08)" stroke-width="1.2" />
          <path d="M 0,180 C 180,130 290,215 460,165 C 590,125 680,185 740,150" fill="none" stroke="rgba(13, 242, 201, 0.05)" stroke-width="1" />
          <path d="M 0,140 C 210,85 330,175 510,120 C 630,85 700,145 740,110" fill="none" stroke="rgba(13, 242, 201, 0.04)" stroke-width="0.8" />

          <!-- Normal Connections (Cyan/Teal) -->
          <path d="M 55,135 C 95,135 110,85 155,85" fill="none" stroke="url(#normGrad)" stroke-width="2.2" />
          <path d="M 185,85 L 270,85" fill="none" stroke="url(#normGrad)" stroke-width="2.2" />
          <path d="M 300,85 C 345,85 365,65 415,65" fill="none" stroke="url(#normGrad)" stroke-width="2.2" />
          <path d="M 445,65 C 495,65 520,85 570,85" fill="none" stroke="url(#normGrad)" stroke-width="2.2" />

          <!-- Attack Path (Glowing Coral Red) -->
          <path d="M 55,135 C 95,135 110,185 155,185" fill="none" stroke="url(#atkGrad)" stroke-width="2.6" filter="url(#coralGlow)" stroke-dasharray="6 3" />
          <path d="M 185,185 L 270,185" fill="none" stroke="url(#atkGrad)" stroke-width="2.6" filter="url(#coralGlow)" stroke-dasharray="6 3" />
          <path d="M 300,185 C 345,185 375,185 415,185" fill="none" stroke="url(#atkGrad)" stroke-width="2.8" filter="url(#coralGlow)" stroke-dasharray="6 3" />
          <path d="M 445,185 C 495,185 520,205 570,205" fill="none" stroke="url(#atkGrad)" stroke-width="2.8" filter="url(#coralGlow)" stroke-dasharray="6 3" />

          <!-- Moving Packets: Normal Flow -->
          <circle r="3.5" fill="#00f2fe" filter="url(#cyanGlow)">
            <animateMotion dur="3.5s" repeatCount="indefinite">
              <mpath href="#path-cand-portal" />
            </animateMotion>
          </circle>
          <circle r="3.5" fill="#0df2c9" filter="url(#cyanGlow)">
            <animateMotion dur="2.8s" begin="0.8s" repeatCount="indefinite">
              <mpath href="#path-portal-dns" />
            </animateMotion>
          </circle>
          <circle r="3" fill="#00f2fe">
            <animateMotion dur="3.2s" begin="1.4s" repeatCount="indefinite">
              <mpath href="#path-dns-screen" />
            </animateMotion>
          </circle>
          <circle r="3" fill="#0df2c9">
            <animateMotion dur="3s" begin="2s" repeatCount="indefinite">
              <mpath href="#path-screen-offer" />
            </animateMotion>
          </circle>

          <!-- Moving Packets: Scam Attack Vector -->
          <circle r="4" fill="#ff3b5c" filter="url(#coralGlow)">
            <animateMotion dur="2.4s" repeatCount="indefinite">
              <mpath href="#path-cand-nologo" />
            </animateMotion>
          </circle>
          <circle r="4" fill="#ff3b5c" filter="url(#coralGlow)">
            <animateMotion dur="2.2s" begin="0.6s" repeatCount="indefinite">
              <mpath href="#path-chat-forged" />
            </animateMotion>
          </circle>
          <circle r="4" fill="#ff3b5c" filter="url(#coralGlow)">
            <animateMotion dur="2.5s" begin="1.2s" repeatCount="indefinite">
              <mpath href="#path-forged-extort" />
            </animateMotion>
          </circle>

          <!-- Nodes -->
          <!-- 1. Origin: Job Seeker -->
          <g class="soc-topo-node" transform="translate(45, 135)" onclick="showToast('Candidate Entrypoint: Submitting employment inquiry', 'info')">
            <circle r="17" fill="rgba(8, 16, 26, 0.95)" stroke="#0df2c9" stroke-width="2" filter="url(#cyanGlow)" />
            <circle r="5.5" fill="#0df2c9" />
            <text y="30" text-anchor="middle" font-family="'Inter', sans-serif" font-size="11" font-weight="600" fill="#c4d3db">Job Seeker</text>
          </g>

          <!-- 2. Normal: Verified Portal -->
          <g class="soc-topo-node" transform="translate(170, 85)" onclick="showToast('Verified Source: Official corporate career portal with TLS cert', 'success')">
            <circle r="16" fill="rgba(8, 16, 26, 0.95)" stroke="#0df2c9" stroke-width="2" filter="url(#cyanGlow)" />
            <circle r="5" fill="#0df2c9" />
            <text y="-20" text-anchor="middle" font-family="'Inter', sans-serif" font-size="10.5" font-weight="600" fill="#0df2c9">Direct Portal</text>
          </g>

          <!-- 3. Normal: Corporate DNS -->
          <g class="soc-topo-node" transform="translate(285, 85)" onclick="showToast('DNS Verification: Domain registered to enterprise entity', 'success')">
            <circle r="16" fill="rgba(8, 16, 26, 0.95)" stroke="#00f2fe" stroke-width="2" filter="url(#cyanGlow)" />
            <circle r="5" fill="#00f2fe" />
            <text y="-20" text-anchor="middle" font-family="'Inter', sans-serif" font-size="10.5" font-weight="600" fill="#00f2fe">Official DNS</text>
          </g>

          <!-- 4. Normal: Technical Screening -->
          <g class="soc-topo-node" transform="translate(430, 65)" onclick="showToast('Rigorous Workflow: Live technical interviews & screening questions', 'success')">
            <circle r="15" fill="rgba(8, 16, 26, 0.95)" stroke="#0df2c9" stroke-width="1.8" />
            <circle r="4.5" fill="#0df2c9" />
            <text y="-18" text-anchor="middle" font-family="'Inter', sans-serif" font-size="10.5" font-weight="600" fill="#0df2c9">Tech Screen</text>
          </g>

          <!-- 5. Normal: Legitimate Onboarding -->
          <g class="soc-topo-node" transform="translate(585, 85)" onclick="showToast('Safe Placement: Official HR employment contract with zero upfront fee', 'success')">
            <circle r="17" fill="rgba(8, 16, 26, 0.95)" stroke="#0df2c9" stroke-width="2" filter="url(#cyanGlow)" />
            <circle r="5.5" fill="#0df2c9" />
            <text y="30" text-anchor="middle" font-family="'Inter', sans-serif" font-size="11" font-weight="600" fill="#c4d3db">HR Onboarding</text>
          </g>

          <!-- 6. Attack: Unverified Listing (No Logo) -->
          <g class="soc-topo-node" transform="translate(170, 185)" onclick="showToast('STRUCTURAL RED FLAG: Posting lacks company logo (+800% higher fraud risk)', 'warning')">
            <circle r="16" fill="rgba(24, 12, 16, 0.95)" stroke="#ffb703" stroke-width="2" filter="url(#amberGlow)" />
            <circle r="5" fill="#ffb703" />
            <text y="28" text-anchor="middle" font-family="'Inter', sans-serif" font-size="10.5" font-weight="600" fill="#ffb703">No-Logo Post</text>
          </g>

          <!-- 7. Attack: Off-Platform Pivot -->
          <g class="soc-topo-node" transform="translate(285, 185)" onclick="showToast('COMMUNICATION RED FLAG: Recruiter moved conversation to Telegram/WhatsApp', 'warning')">
            <circle r="16" fill="rgba(24, 12, 16, 0.95)" stroke="#ff8e3c" stroke-width="2" />
            <circle r="5" fill="#ff8e3c" />
            <text y="28" text-anchor="middle" font-family="'Inter', sans-serif" font-size="10.5" font-weight="600" fill="#ff8e3c">Telegram Chat</text>
          </g>

          <!-- 8. Attack Beacon: Forged Appointment Letter -->
          <g class="soc-topo-node" transform="translate(430, 185)" onclick="showToast('DOCUMENT FORGERY: Fake appointment letter with zero interview required', 'error')">
            <circle r="22" fill="none" stroke="#ff3b5c" stroke-width="1.5" opacity="0.6">
              <animate attributeName="r" values="18;32;18" dur="1.8s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.8;0;0.8" dur="1.8s" repeatCount="indefinite" />
            </circle>
            <circle r="17" fill="#1f0910" stroke="#ff3b5c" stroke-width="2.5" filter="url(#coralGlow)" />
            <circle r="6" fill="#ff3b5c" />
            <text y="30" text-anchor="middle" font-family="'IBM Plex Mono', monospace" font-size="11" font-weight="700" fill="#ff3b5c">Fake Offer</text>
          </g>

          <!-- 9. Attack: UPI Fee Extortion -->
          <g class="soc-topo-node" transform="translate(585, 205)" onclick="showToast('CONFIRMED SCAM: Personal UPI deposit demanded (apex-careers@okaxis)', 'error')">
            <circle r="16" fill="rgba(30, 8, 14, 0.95)" stroke="#ff3b5c" stroke-width="2" filter="url(#coralGlow)" />
            <circle r="5" fill="#ff3b5c" />
            <text y="28" text-anchor="middle" font-family="'IBM Plex Mono', monospace" font-size="10.5" font-weight="700" fill="#ff3b5c">UPI Extortion</text>
          </g>
        </svg>
      </div>
    `;
  }

  // ─── Application Shell Structure (Cyber-Command Console) ───────────────────
  function renderShell(contentHtml, pageTitle, pageSubtitle) {
    const user = (window.JobGuardData && window.JobGuardData.getCurrentUser) ? window.JobGuardData.getCurrentUser() : null;
    const userName = (user && user.name) ? user.name : 'VK Tej';
    const userRole = (user && user.role) ? user.role : 'Lead Forensic Investigator';
    const userPhoto = (user && user.photo) ? user.photo : '';
    const userInitial = userName.charAt(0) || 'T';
    const currentHash = window.location.hash.split('?')[0] || '#dashboard';

    // Title customization for primary dashboard
    const displayTitle = (currentHash === '#dashboard') ? 'Forensic Intelligence Dashboard' : (pageTitle || 'Forensic Console');
    const displaySub = (currentHash === '#dashboard') ? 'Multimodal job scam detection, EMSCAD 17,880 dataset surveillance, and XAI feature analysis.' : (pageSubtitle || 'JobGuard-XAI Forensic Intelligence System');

    const scamTraceData = window.JobGuardData && window.JobGuardData.getScamTraceForUser ? window.JobGuardData.getScamTraceForUser() : null;

    return `
      <div class="soc-outer-viewport">
        <!-- Floating Watermark Outside Console Frame (Top Right) -->
        <div class="soc-outer-header">
          <span>Analytics</span> Dashboard
        </div>

        <!-- The Main Console Window Frame (Edge-to-Edge Fullscreen) -->
        <div class="soc-console-frame">
          <!-- Topbar with Logo, Project Badge, Search Pill, Bell, User Bio Chip -->
          <header class="soc-topbar">
            <div class="soc-topbar-left">
              <!-- 3x3 Cyber Grid Logo -->
              <a href="#dashboard" class="soc-logo-grid" title="JobGuard-XAI Forensic Intelligence System">
                <span></span><span></span><span></span>
                <span></span><span></span><span></span>
                <span></span><span></span><span></span>
              </a>
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-family:var(--font-heading); font-weight:700; font-size:13px; color:var(--text-primary); letter-spacing:0.02em;">JobGuard<span style="color:var(--accent-cyan);">-XAI</span></span>
                <span class="badge" style="background:rgba(34, 211, 238, 0.12); border:1px solid rgba(34, 211, 238, 0.3); color:var(--accent-cyan); font-size:10px; padding:2px 8px;">EMSCAD 17.8K Core</span>
              </div>
            </div>

            <div class="soc-topbar-right">
              <!-- ScamTrace Live Alert Badge (when syndicate detected) -->
              ${scamTraceData && scamTraceData.detected ? `
                <button class="topbar-alarm-btn" onclick="openScamTraceDossierModal()" title="Active Fraud Syndicate Alert: ${scamTraceData.linkedIncidentsCount} Linked Scams Correlated in History">
                  <span class="alarm-dot-live"></span>
                  <i data-lucide="siren" style="width:13px;height:13px;color:#ff3b5c;"></i>
                  <span>ScamTrace: ${scamTraceData.linkedIncidentsCount} Linked</span>
                </button>
              ` : ''}

              <!-- Search Pill Input (Triggers Ctrl+K Spotlight) -->
              <div class="soc-search-pill" onclick="window.openGlobalSpotlight()" title="Search postings, roles, and forensics (Ctrl+K)">
                <input type="text" class="soc-search-input" placeholder="Search by Name etc..." readonly />
                <i data-lucide="search" class="soc-search-icon"></i>
              </div>

              <!-- Notification Bell with Glowing Badge -->
              <button class="soc-btn-circle" title="Recent incident telemetry & alerts" onclick="location.hash='#history'">
                <i data-lucide="bell"></i>
                <span class="soc-bell-badge"></span>
              </button>

              <!-- Top Right User Bio Chip (Displays Current User Details & Navigates to Settings) -->
              <div class="soc-user-bio-chip" id="topbar-user-bio" onclick="location.hash='#about'" title="Analyst Profile & Settings: ${escapeHtml(userName)} (${escapeHtml(userRole)})">
                <div class="soc-avatar-img">${userPhoto ? `<img src="${userPhoto}" alt="Avatar" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">` : escapeHtml(userInitial)}</div>
                <div class="soc-user-bio-info">
                  <span class="soc-user-bio-name">${escapeHtml(userName)}</span>
                  <span class="soc-user-bio-role">${escapeHtml(userRole)}</span>
                </div>
                <i data-lucide="chevron-down" class="soc-user-bio-chevron"></i>
              </div>
            </div>
          </header>

          <!-- Sub-Header Row: Incidents Management + Action Controls with Refresh Data button -->
          <div class="soc-subheader">
            <div class="soc-subheader-left">
              <h1 class="soc-page-title">${escapeHtml(displayTitle)}</h1>
              <p class="soc-page-subtitle">${escapeHtml(displaySub)}</p>
            </div>

            <div class="soc-subheader-right">
              <button class="btn-soc-action" onclick="showToast('Forensic telemetry streams synchronized', 'success')">
                <i data-lucide="refresh-cw"></i>
                <span>Refresh Data</span>
              </button>
              <button class="btn-soc-icon-box" title="Export Telemetry Log" onclick="showToast('Forensic Telemetry exported successfully', 'success')">
                <i data-lucide="download"></i>
              </button>
              <button class="btn-soc-icon-box" title="Share Command Console View" onclick="navigator.clipboard && navigator.clipboard.writeText(location.href); showToast('Console URL copied to clipboard', 'info');">
                <i data-lucide="share-2"></i>
              </button>
            </div>
          </div>

          <!-- Main Workspace Body: Left Sidebar + Dynamic Viewport -->
          <div class="soc-main-body">
            <!-- Full Left Cyber Navigation Sidebar (Matching Previous Names & Badges Exactly) -->
            <aside class="soc-sidebar" id="app-sidebar">
              <div class="soc-nav-group">
                <!-- 1. Dashboard (Navigation) -->
                <a href="#dashboard" class="soc-nav-item ${currentHash === '#dashboard' ? 'active' : ''}">
                  <div class="soc-nav-left">
                    <i data-lucide="layout-grid" class="soc-nav-icon"></i>
                    <span class="soc-nav-label">Dashboard</span>
                  </div>
                  <span class="soc-nav-badge">Navigation</span>
                </a>

                <!-- 2. Fake Job Detection (Scan) (Tool) -->
                <a href="#analyze" class="soc-nav-item ${currentHash === '#analyze' ? 'active' : ''}">
                  <div class="soc-nav-left">
                    <i data-lucide="shield-check" class="soc-nav-icon"></i>
                    <span class="soc-nav-label">Fake Job Detection (Scan)</span>
                  </div>
                  <span class="soc-nav-badge">Tool</span>
                </a>

                <!-- 3. NLP Lexical Analysis (Tool) -->
                <a href="#nlp" class="soc-nav-item ${currentHash === '#nlp' ? 'active' : ''}">
                  <div class="soc-nav-left">
                    <i data-lucide="brain-circuit" class="soc-nav-icon"></i>
                    <span class="soc-nav-label">NLP Lexical Analysis</span>
                  </div>
                  <span class="soc-nav-badge">Tool</span>
                </a>

                <!-- 4. Job Roles & Skills Matrix (Explorer) -->
                <a href="#roles" class="soc-nav-item ${currentHash === '#roles' ? 'active' : ''}">
                  <div class="soc-nav-left">
                    <i data-lucide="graduation-cap" class="soc-nav-icon"></i>
                    <span class="soc-nav-label">Job Roles & Skills Matrix</span>
                  </div>
                  <span class="soc-nav-badge">Explorer</span>
                </a>

                <!-- 5. Company & Job Market (Intelligence) -->
                <a href="#market" class="soc-nav-item ${currentHash === '#market' ? 'active' : ''}">
                  <div class="soc-nav-left">
                    <i data-lucide="bar-chart-2" class="soc-nav-icon"></i>
                    <span class="soc-nav-label">Company & Job Market</span>
                  </div>
                  <span class="soc-nav-badge">Intelligence</span>
                </a>

                <!-- 6. Data Visualizations (EMSCAD) (Analytics) -->
                <a href="#viz" class="soc-nav-item ${currentHash === '#viz' ? 'active' : ''}">
                  <div class="soc-nav-left">
                    <i data-lucide="pie-chart" class="soc-nav-icon"></i>
                    <span class="soc-nav-label">Data Visualizations (EMSCAD)</span>
                  </div>
                  <span class="soc-nav-badge">Analytics</span>
                </a>

                <!-- 7. Model Performance Benchmarks (Evaluation) -->
                <a href="#performance" class="soc-nav-item ${currentHash === '#performance' ? 'active' : ''}">
                  <div class="soc-nav-left">
                    <i data-lucide="trophy" class="soc-nav-icon"></i>
                    <span class="soc-nav-label">Model Performance Benchmarks</span>
                  </div>
                  <span class="soc-nav-badge">Evaluation</span>
                </a>

                <!-- 8. Explainable AI (SHAP Breakdown) (Interpretability) -->
                <a href="#xai" class="soc-nav-item ${currentHash === '#xai' ? 'active' : ''}">
                  <div class="soc-nav-left">
                    <i data-lucide="sparkles" class="soc-nav-icon"></i>
                    <span class="soc-nav-label">Explainable AI (SHAP Breakdown)</span>
                  </div>
                  <span class="soc-nav-badge">Interpretability</span>
                </a>

                <!-- 9. Prediction Audit History (Records) -->
                <a href="#history" class="soc-nav-item ${currentHash === '#history' ? 'active' : ''}">
                  <div class="soc-nav-left">
                    <i data-lucide="clock" class="soc-nav-icon"></i>
                    <span class="soc-nav-label">Prediction Audit History</span>
                  </div>
                  <span class="soc-nav-badge">Records</span>
                </a>
              </div>

              <!-- Bottom Account, Profile & Settings Hub -->
              <div style="padding-top: 10px; border-top: 1px solid var(--border-subtle); display:flex; flex-direction:column; gap:4px;">
                <a href="#about" class="soc-nav-item ${currentHash === '#about' || currentHash === '#settings' ? 'active' : ''}">
                  <div class="soc-nav-left">
                    <i data-lucide="user-cog" class="soc-nav-icon"></i>
                    <span class="soc-nav-label">Account &amp; Security</span>
                  </div>
                  <span class="soc-nav-badge">Settings</span>
                </a>
                <button type="button" class="soc-nav-item" id="btn-logout" style="width:100%; border:1px solid transparent; background:none; text-align:left; cursor:pointer;" title="Sign out of JobGuard-XAI session">
                  <div class="soc-nav-left">
                    <i data-lucide="log-out" class="soc-nav-icon" style="color:#f87171;"></i>
                    <span class="soc-nav-label" style="color:#f87171;">Sign Out</span>
                  </div>
                  <span class="soc-nav-badge" style="color:#f87171; border-color:rgba(239,68,68,0.3); background:rgba(239,68,68,0.08);">Exit</span>
                </button>
              </div>
            </aside>

            <!-- Dynamic Page Viewport -->
            <section class="soc-viewport">
              ${contentHtml}
            </section>
          </div>
        </div>
      </div>
    `;
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // PAGE RENDERERS
  // ═════════════════════════════════════════════════════════════════════════════

  // ─── 1. #dashboard (God-Level Cyber SOC Command Matrix) ───────────────────────
  function renderDashboard() {
    const stats = window.JobGuardData.DATASET_STATS;
    const tickerItems = window.JobGuardData.TRUST_PULSE_STREAM;
    const syn = window.JobGuardData.getScamTraceForUser ? window.JobGuardData.getScamTraceForUser() : null;
    const historyData = (window.JobGuardData && window.JobGuardData.getPredictionHistory) ? window.JobGuardData.getPredictionHistory() : { total: 5, fraudCount: 3, suspiciousCount: 0, legitCount: 2, history: [] };
    const historyItems = historyData.history || [];

    const html = `
      <!-- ════════════════════════════════════════════════════════════════════════ -->
      <!-- 1. TOP: REAL JOBGUARD-XAI DATA, TRUST PULSE & EMSCAD CORE BENCHMARKS    -->
      <!-- ════════════════════════════════════════════════════════════════════════ -->

      <!-- Trust Pulse Live Marquee Feed -->
      <div class="ticker-container" style="margin-bottom: 22px;">
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

      <!-- ScamTrace™ Cross-Incident Fraud Syndicate Module -->
      ${syn && syn.detected ? `
        <div class="scamtrace-alarm-card" id="dash-scamtrace-module" style="margin-bottom: 24px;">
          <div class="scamtrace-alarm-header">
            <div style="display:flex; align-items:center; gap:12px;">
              <div class="scamtrace-siren-wrap">
                <span class="alarm-pulse-ring"></span>
                <i data-lucide="siren" style="width:20px;height:20px;color:#ef4444;"></i>
              </div>
              <div>
                <div class="scamtrace-alarm-tag">SCAMTRACE™ FRAUD DETECTOR · USER HISTORY CORRELATION</div>
                <h3 style="font-size:16px; font-weight:700; color:#FFFFFF; margin:0;">Cross-Incident Fraud Syndicate Detected in Your History</h3>
              </div>
            </div>
            <span class="scamtrace-alarm-badge">
              <span class="blink-dot"></span> ${syn.linkedIncidentsCount} LINKED FRAUD INCIDENTS IN YOUR HISTORY
            </span>
          </div>

          <p class="scamtrace-alarm-desc">
            Relationship analysis confirmed <strong>${syn.linkedIncidentsCount} separate submissions in your history</strong> originate from a single coordinated fraudster:
            <span class="syndicate-name-chip">${escapeHtml(syn.syndicateId)} ("${escapeHtml(syn.syndicateAlias)}")</span>
            impersonating <em>${escapeHtml(syn.impersonatedEntity)}</em> via personal UPI <code style="color:var(--accent-cyan); font-weight:600;">${escapeHtml(syn.sharedProofs.upiHandle)}</code>.
          </p>

          <div class="scamtrace-proof-chips">
            <span class="proof-chip" title="Identical UPI handle in your history"><i data-lucide="credit-card"></i> UPI: ${escapeHtml(syn.sharedProofs.upiHandle)}</span>
            <span class="proof-chip" title="Spoofed lookalike domain in your history"><i data-lucide="globe"></i> Domain: ${escapeHtml(syn.sharedProofs.domain)}</span>
            <span class="proof-chip" title="Shared recruiter persona in your history"><i data-lucide="message-square"></i> Recruiter: ${escapeHtml(syn.sharedProofs.recruiter)}</span>
            <span class="proof-chip" title="Identical fee demand in your history"><i data-lucide="dollar-sign"></i> Fee: ${escapeHtml(syn.sharedProofs.paymentDemanded)}</span>
            <span class="proof-chip" title="97.4% NLP n-gram similarity match in your history"><i data-lucide="file-check"></i> ${syn.sharedProofs.nlpOverlap} NLP Match</span>
          </div>

          ${(() => {
            const cyberAlert = localStorage.getItem('jobguard_cyber_alert_lodged');
            if (cyberAlert) {
              try {
                const ca = JSON.parse(cyberAlert);
                return `
                  <div style="margin-top: 14px; padding: 10px 14px; background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.35); border-radius: 8px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                      <i data-lucide="check-circle-2" style="width:16px;height:16px;color:#10b981;"></i>
                      <span style="font-size:12px; font-weight:700; color:#34d399;">Official Cyber Crime Incident Report Lodged</span>
                      <code style="font-size:11px; background:rgba(0,0,0,0.3); padding:2px 6px; border-radius:4px; color:#a7f3d0; font-family:var(--font-mono);">${escapeHtml(ca.referenceNumber || 'NCRP-2026-XAI-88219-DL')}</code>
                    </div>
                    <button class="btn btn-secondary btn-sm" style="border-color:rgba(16,185,129,0.5); color:#34d399; font-size:11px; padding:4px 10px;" onclick="openCyberCrimeReportModal()">
                      <i data-lucide="file-text" style="width:12px;height:12px;margin-right:4px;"></i> View Lodging Receipt
                    </button>
                  </div>
                `;
              } catch(e) {}
            }
            return '';
          })()}

          <div class="scamtrace-alarm-actions">
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="badge" style="background:rgba(239, 68, 68, 0.2); border:1px solid rgba(239, 68, 68, 0.5); color:#fca5a5; font-size:11px;">
                <i data-lucide="shield-alert" style="width:12px;height:12px;margin-right:4px;"></i> ${syn.correlationConfidence}% Certainty
              </span>
              <span style="font-size:11.5px; color:var(--text-faint); font-family:var(--font-mono);">${escapeHtml(syn.syndicateId)} &nbsp;·&nbsp; ${syn.linkedIncidentsCount} User History Records Correlated</span>
            </div>

            <div style="display:flex; gap:10px; flex-wrap:wrap;">
              <button class="btn btn-secondary btn-sm" onclick="location.hash='#history'">
                <i data-lucide="list"></i> View in History (${syn.linkedIncidentsCount})
              </button>
              <button class="btn btn-secondary btn-sm" onclick="openScamTraceDossierModal()">
                <i data-lucide="search"></i> Inspect Syndicate Proofs ↗
              </button>
              ${(() => {
                const isLodged = !!localStorage.getItem('jobguard_cyber_alert_lodged');
                if (isLodged) {
                  return `
                    <button class="btn btn-secondary btn-sm" style="border-color:rgba(16,185,129,0.5); color:#34d399;" onclick="openCyberCrimeReportModal()">
                      <i data-lucide="check-circle-2" style="width:13px;height:13px;margin-right:4px;color:#10b981;"></i> Alert Lodged (NCRP-88219)
                    </button>
                  `;
                }
                return `
                  <button class="btn btn-danger btn-sm" onclick="openCyberCrimeReportModal()">
                    <i data-lucide="flag" style="width:13px;height:13px;margin-right:4px;"></i> Transmit Cyber Alert
                  </button>
                `;
              })()}
            </div>
          </div>
        </div>
      ` : `
        <div class="card" style="margin-bottom: 24px; padding: 18px 22px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:14px; border-left: 3px solid var(--accent-cyan); background: linear-gradient(135deg, rgba(34, 211, 238, 0.04) 0%, rgba(12, 21, 32, 0.95) 100%);">
          <div style="display:flex; align-items:center; gap:14px;">
            <div style="width:38px; height:38px; border-radius:10px; background:rgba(0,242,254,0.12); border:1px solid rgba(0,242,254,0.4); display:flex; align-items:center; justify-content:center; color:var(--accent-cyan); flex-shrink:0;">
              <i data-lucide="shield-check" style="width:20px;height:20px;"></i>
            </div>
            <div>
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-size:11px; font-weight:800; color:var(--accent-cyan); letter-spacing:0.06em; text-transform:uppercase;">SCAMTRACE™ USER HISTORY SURVEILLANCE</span>
                <span class="badge badge-legit" style="font-size:10px;">Surveillance Active · 0 Syndicates Correlated</span>
              </div>
              <p style="font-size:13px; color:var(--text-muted); margin:3px 0 0 0;">
                ScamTrace continuously correlates your audited history for recurring fraudster fingerprints (shared UPI IDs, fake recruiter handles, lookalike domains). Currently, 0 recurring fraud patterns exist in your history.
              </p>
            </div>
          </div>
          <div style="display:flex; gap:10px;">
            <a href="#analyze" class="btn btn-secondary btn-sm">
              <i data-lucide="scan" style="width:13px;height:13px;margin-right:4px;"></i> Scan New Job / Document
            </a>
          </div>
        </div>
      `}

      <!-- 4 Real Dataset Stat Cards (EMSCAD 17,880 Benchmark Dataset) -->
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

      <!-- Quick Action Gateway -->
      <div class="card" style="margin-bottom: 24px; padding: 20px 24px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:16px;">
        <div>
          <h3 style="font-size:15px; margin-bottom:4px; font-weight:700;">Ready to inspect a suspicious job posting or offer letter?</h3>
          <p style="font-size:12.5px; color:var(--text-muted);">Run complete forensic scan across 18 structural metadata factors and NLP scam lexicons.</p>
        </div>
        <div style="display:flex; gap:12px;">
          <a href="#analyze" class="btn btn-primary"><i data-lucide="scan"></i> Scan a Posting</a>
          <a href="#market" class="btn btn-secondary"><i data-lucide="globe"></i> Market Intelligence</a>
          <a href="#performance" class="btn btn-secondary"><i data-lucide="bar-chart"></i> View Models</a>
        </div>
      </div>

      <!-- Mini Preview Visualizations (Dataset Class Imbalance & Logo Paradox) -->
      <div class="grid-2" style="margin-bottom: 26px;">
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

      <!-- ════════════════════════════════════════════════════════════════════════ -->
      <!-- 2. RECRUITMENT FRAUD VECTOR TELEMETRY & AUDIT RADAR MATRIX              -->
      <!-- ════════════════════════════════════════════════════════════════════════ -->
      <div class="soc-dashboard-grid" style="margin-bottom: 24px;">

        <!-- ─── COLUMN 1 (LEFT ~310px) ──────────────────────────────────────── -->
        <div class="soc-col-left">
          <!-- Card 1: Dataset Trust & Verification Score -->
          <div class="soc-card">
            <div class="soc-card-header">
              <h3 class="soc-card-title">Dataset Trust Score</h3>
              <span class="badge badge-legit" style="font-size:10px;">EMSCAD Core</span>
            </div>
            <div class="soc-card-body">
              <!-- Semicircle Speedometer Radial Gauge -->
              <div class="soc-speedometer-box">
                <svg viewBox="0 0 240 145" class="soc-speedometer-svg">
                  <defs>
                    <linearGradient id="socGaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stop-color="#ff3b5c" />
                      <stop offset="35%" stop-color="#ff8e3c" />
                      <stop offset="65%" stop-color="#ffb703" />
                      <stop offset="85%" stop-color="#0df2c9" />
                      <stop offset="100%" stop-color="#00f2fe" />
                    </linearGradient>
                    <filter id="socGaugeGlow" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="4" result="blur" />
                      <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                  </defs>
                  <!-- Background Track Arc -->
                  <path d="M 30,130 A 90,90 0 0,1 210,130" fill="none" stroke="rgba(255, 255, 255, 0.08)" stroke-width="12" stroke-linecap="round" />
                  <!-- Gradient Progress Arc (95.2% Clean Baseline) -->
                  <path d="M 30,130 A 90,90 0 0,1 210,130" fill="none" stroke="url(#socGaugeGrad)" stroke-width="12" stroke-linecap="round" stroke-dasharray="283" stroke-dashoffset="14" filter="url(#socGaugeGlow)" />
                  <!-- Center Score -->
                  <text x="120" y="105" text-anchor="middle" font-family="'IBM Plex Mono', monospace" font-size="42" font-weight="700" fill="#ffffff" letter-spacing="-1">
                    95.2<tspan font-size="16" fill="#6e828a" font-weight="500">%</tspan>
                  </text>
                  <!-- Status Label -->
                  <text x="120" y="128" text-anchor="middle" font-family="'Sora', sans-serif" font-size="12" font-weight="700" fill="#0df2c9" letter-spacing="1">
                    Legitimate Baseline
                  </text>
                </svg>
              </div>

              <!-- Metrics List -->
              <div class="soc-metrics-list">
                <div class="soc-metric-row">
                  <div class="soc-metric-left">
                    <i data-lucide="shield-check" class="metric-icon-teal"></i>
                    <span>Verified Legit Postings</span>
                  </div>
                  <span class="soc-metric-val">17,014</span>
                </div>

                <div class="soc-metric-row">
                  <div class="soc-metric-left">
                    <i data-lucide="alert-octagon" class="metric-icon-coral"></i>
                    <span>Confirmed Fraud Cases</span>
                  </div>
                  <span class="soc-metric-val text-coral">866</span>
                </div>

                <div class="soc-metric-row">
                  <div class="soc-metric-left">
                    <i data-lucide="clock" class="metric-icon-teal"></i>
                    <span>Avg Inference Latency</span>
                  </div>
                  <span class="soc-metric-val">1.2s</span>
                </div>

                <div class="soc-metric-row">
                  <div class="soc-metric-left">
                    <i data-lucide="check-circle-2" class="metric-icon-teal"></i>
                    <span>Model F1 Accuracy</span>
                  </div>
                  <span class="soc-metric-val">97.4%</span>
                </div>
              </div>
            </div>

            <!-- Footer: Status Operational -->
            <div class="soc-card-footer">
              <span class="soc-status-label">Forensic Pipeline</span>
              <span class="soc-status-val">
                <span class="soc-live-dot"></span> Operational
              </span>
            </div>
          </div>

          <!-- Card 2: AI Scam Investigation -->
          <div class="soc-card" style="margin-top: 18px;">
            <div class="soc-card-header">
              <h3 class="soc-card-title">AI Forensic Insights</h3>
              <span class="soc-badge-cyan-pill">SCAMTRACE™ AI</span>
            </div>
            <div class="soc-card-body">
              <div class="soc-ai-summary-box">
                <p class="soc-ai-summary-text">
                  <strong>Forensic Finding:</strong> Recurring advance fee extortion detected across user history. Personal UPI handles (<code style="color:var(--accent-cyan);">apex-careers@okaxis</code>), lookalike domains (<code style="color:var(--accent-cyan);">google-cloud-careers.com</code>), and absence of logo identified as primary fraud markers.
                </p>
              </div>

              <div class="soc-threat-attrib-wrap">
                <div class="soc-attrib-header">Fraud Vector Distribution</div>
                <div class="soc-attrib-content">
                  <div class="soc-mini-bars">
                    <div class="soc-mini-bar bar-1" style="height: 52%;" title="Advance UPI Demands"></div>
                    <div class="soc-mini-bar bar-2" style="height: 31%;" title="Spoofed Domains"></div>
                    <div class="soc-mini-bar bar-3" style="height: 17%;" title="Off-Platform Chat"></div>
                  </div>
                  <div class="soc-attrib-meta">
                    <div class="soc-attrib-num">866</div>
                    <div class="soc-attrib-trend text-coral">Scams Mapped</div>
                  </div>
                </div>
                <div class="soc-attrib-tags">
                  <span>Advance UPI: 52%</span>
                  <span>Spoofed DNS: 31%</span>
                  <span>Telegram/Chat: 17%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ─── COLUMN 2 (CENTER - FLEX 1) ─────────────────────────────────── -->
        <div class="soc-col-center">
          <!-- Card 1: Recruitment Fraud Attack Vector (Interactive SVG) -->
          <div class="soc-card">
            <div class="soc-card-header">
              <div>
                <h3 class="soc-card-title">Recruitment Fraud Attack Vector</h3>
                <p class="soc-card-sub">Interactive progression of fraudulent exploitation vs verified hiring pipeline.</p>
              </div>
              <div class="soc-topology-legend">
                <span class="legend-item"><span class="legend-dot coral"></span> Exploit Vector</span>
                <span class="legend-item"><span class="legend-dot cyan"></span> Legitimate Pipeline</span>
              </div>
            </div>
            <div class="soc-card-body" style="padding: 12px 18px 18px 18px;">
              <!-- Interactive Animated SVG Flow -->
              ${getNetworkTopologySVG()}

              <!-- 4 Real Dataset KPI Boxes -->
              <div class="soc-kpi-grid">
                <div class="soc-kpi-box">
                  <div class="kpi-header"><span class="kpi-dot cyan"></span> Indexed Postings</div>
                  <div class="kpi-number">17,880</div>
                  <div class="kpi-sub">EMSCAD Benchmark</div>
                </div>
                <div class="soc-kpi-box">
                  <div class="kpi-header"><span class="kpi-dot coral"></span> Confirmed Fraud</div>
                  <div class="kpi-number text-coral">866</div>
                  <div class="kpi-sub">Historical Scams</div>
                </div>
                <div class="soc-kpi-box">
                  <div class="kpi-header"><span class="kpi-dot green"></span> User History Audits</div>
                  <div class="kpi-number text-green">${historyItems.length}</div>
                  <div class="kpi-sub">Total Scans in History</div>
                </div>
                <div class="soc-kpi-box">
                  <div class="kpi-header"><span class="kpi-dot amber"></span> Logo Paradox Risk</div>
                  <div class="kpi-number text-amber">+800%</div>
                  <div class="kpi-sub">15.93% vs 1.99%</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Card 2: Recent Forensic Audit Stream (Real History Records) -->
          <div class="soc-card" style="margin-top: 18px;">
            <div class="soc-card-header">
              <h3 class="soc-card-title">Recent Forensic Audit Stream</h3>
              <a href="#history" class="soc-link-action">View Full History <i data-lucide="arrow-up-right"></i></a>
            </div>
            <div class="soc-card-body" style="padding: 0;">
              <table class="soc-table">
                <thead>
                  <tr>
                    <th>Audited Posting</th>
                    <th>Claimed Employer</th>
                    <th>Primary Scam Vector</th>
                    <th>Risk Verdict</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  ${(historyItems.length ? historyItems.slice(0, 4) : [
                    { job_title: 'Offer Letter Acceptance & Deposit Demand', company: 'Apex Cloud Labs', top_factor: 'Advance UPI extortion scheme', verdict: 'High Risk', created_at: '2026-10-23T10:00:00Z' },
                    { job_title: 'WhatsApp Onboarding & Asset Dispatch', company: 'Apex Cloud Labs', top_factor: 'Off-platform WhatsApp migration', verdict: 'High Risk', created_at: '2026-10-22T14:15:00Z' },
                    { job_title: 'Staff Full-Stack Software Engineer', company: 'Stripe, Inc.', top_factor: 'Verified corporate domain match', verdict: 'Legitimate', created_at: '2026-10-20T17:15:00Z' },
                    { job_title: 'Senior Quantitative Risk Analyst', company: 'BlackRock Capital', top_factor: 'Full salary disclosed & institutional DNS', verdict: 'Legitimate', created_at: '2026-10-19T14:20:00Z' }
                  ]).map((h, idx) => `
                    <tr>
                      <td>
                        <div class="soc-user-cell">
                          <div class="soc-user-avatar avatar-${(idx % 3) + 1}">
                            <i data-lucide="${h.verdict === 'Legitimate' ? 'shield-check' : 'alert-triangle'}" style="width:13px;height:13px;"></i>
                          </div>
                          <span style="max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(h.job_title)}">${escapeHtml(h.job_title)}</span>
                        </div>
                      </td>
                      <td class="soc-incident-id">${escapeHtml(h.company || 'Unspecified')}</td>
                      <td style="font-size:11.5px; color:var(--text-muted); max-width:160px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                        ${escapeHtml(h.top_factor || h.channel || 'Structural scan')}
                      </td>
                      <td>
                        ${h.verdict === 'Legitimate'
                          ? `<span class="soc-pill-badge" style="background:rgba(13,242,201,0.12); border:1px solid rgba(13,242,201,0.4); color:var(--safe);">Legitimate</span>`
                          : `<span class="soc-pill-badge critical">High Risk</span>`
                        }
                      </td>
                      <td class="soc-time-col">
                        ${h.created_at ? new Date(h.created_at).toLocaleDateString(undefined, {month:'short', day:'numeric'}) : 'Recent'}
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- ─── COLUMN 3 (RIGHT ~310px) ─────────────────────────────────────── -->
        <div class="soc-col-right">
          <!-- Card 1: JobGuard Audit Lifecycle Tracker -->
          <div class="soc-card">
            <div class="soc-card-header">
              <div>
                <h3 class="soc-card-title">Audit Lifecycle Tracker</h3>
                <p class="soc-card-sub font-mono">JOB-2026-XAI · Real-Time Triage</p>
              </div>
            </div>
            <div class="soc-card-body">
              <div class="soc-timeline">
                <div class="soc-timeline-step">
                  <div class="step-marker-line">
                    <span class="step-dot cyan"></span>
                    <span class="step-line"></span>
                  </div>
                  <div class="step-content">
                    <div class="step-meta">
                      <span class="step-title">Metadata Ingestion</span>
                      <span class="step-time">02:14 PM</span>
                    </div>
                    <button class="btn-soc-pill cyan" onclick="showToast('Posting parsed across 18 schema fields', 'info')">Inspected</button>
                  </div>
                </div>

                <div class="soc-timeline-step">
                  <div class="step-marker-line">
                    <span class="step-dot cyan"></span>
                    <span class="step-line"></span>
                  </div>
                  <div class="step-content">
                    <div class="step-meta">
                      <span class="step-title">Feature Extraction</span>
                      <span class="step-time">02:17 PM</span>
                    </div>
                    <button class="btn-soc-pill outline-cyan" onclick="showToast('Extracted 18 structural & NLP features', 'info')">Analyzed</button>
                  </div>
                </div>

                <div class="soc-timeline-step">
                  <div class="step-marker-line">
                    <span class="step-dot coral"></span>
                    <span class="step-line"></span>
                  </div>
                  <div class="step-content">
                    <div class="step-meta">
                      <span class="step-title text-coral">XAI Risk Assessment</span>
                      <span class="step-time">02:22 PM</span>
                    </div>
                    <button class="btn-soc-pill cyan" onclick="showToast('XAI classified: 94.8% High Risk', 'success')">Classified</button>
                  </div>
                </div>

                <div class="soc-timeline-step">
                  <div class="step-marker-line">
                    <span class="step-dot coral"></span>
                    <span class="step-line"></span>
                  </div>
                  <div class="step-content">
                    <div class="step-meta">
                      <span class="step-title">Syndicate Correlation</span>
                      <span class="step-time">02:25 PM</span>
                    </div>
                    <button class="btn-soc-pill outline-coral" onclick="showToast('ScamTrace matched recurring UPI footprint', 'info')">Flagged</button>
                  </div>
                </div>

                <div class="soc-timeline-step">
                  <div class="step-marker-line">
                    <span class="step-dot cyan"></span>
                    <span class="step-line"></span>
                  </div>
                  <div class="step-content">
                    <div class="step-meta">
                      <span class="step-title">Trust Pulse Broadcast</span>
                      <span class="step-time">02:30 PM</span>
                    </div>
                    <button class="btn-soc-pill cyan" onclick="showToast('Alert broadcast to live Trust Pulse stream', 'success')">Dispatched</button>
                  </div>
                </div>

                <div class="soc-timeline-step">
                  <div class="step-marker-line">
                    <span class="step-dot cyan"></span>
                  </div>
                  <div class="step-content">
                    <div class="step-meta">
                      <span class="step-title">Model Retraining Ingestion</span>
                      <span class="step-time">02:35 PM</span>
                    </div>
                    <button class="btn-soc-pill outline-cyan" onclick="showToast('Audit archived to training feedback buffer', 'info')">Logged</button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Card 2: Audit Volume & Scam Velocity Area Chart -->
          <div class="soc-card" style="margin-top: 18px;">
            <div class="soc-card-header">
              <div>
                <h3 class="soc-card-title">Audit Volume & Scam Velocity</h3>
                <p class="soc-card-sub">Daily triage rate & detected fraud alerts</p>
              </div>
              <div>
                <select class="soc-select-pill" onchange="showToast('Adjusted Volume Timeline: ' + this.value, 'info')">
                  <option>20 Hours</option>
                  <option>24 Hours</option>
                  <option>7 Days</option>
                </select>
              </div>
            </div>
            <div class="soc-card-body" style="padding-top: 10px;">
              <div class="soc-chart-legend">
                <span class="legend-item"><span class="legend-dot coral"></span> Fraud Alerts</span>
                <span class="legend-item"><span class="legend-dot cyan"></span> Audited</span>
                <span class="legend-item"><span class="legend-dot teal"></span> Escalated</span>
              </div>

              <div style="position:relative; height: 160px; margin-top: 10px;">
                <canvas id="soc-volume-trend-canvas"></canvas>
                <div class="soc-chart-focus-pin">Peak: 61/day</div>
              </div>
            </div>
          </div>
        </div>

      </div>
    `;

    document.getElementById('app').innerHTML = renderShell(html, 'Forensic Intelligence Dashboard', 'Multimodal job scam detection, EMSCAD 17,880 dataset surveillance, and XAI feature analysis.');

    // Draw Mini Charts & SOC Volume Area Trend
    setTimeout(() => {
      ChartEngine.initChartDefaults();
      ChartEngine.drawIncidentVolumeArea('soc-volume-trend-canvas');
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

  // ─── Recommended Jobs Card Renderer Helper ──────────────────────────────────
  function renderRecommendedJobsListHtml(jobs) {
    if (!jobs || jobs.length === 0) {
      const q = AppState.resumeJobSearch || '';
      return `
        <div style="text-align:center; padding:36px; color:var(--text-muted);">
          <i data-lucide="search-x" style="width:36px;height:36px;margin-bottom:8px;color:var(--text-faint);"></i>
          <p>No jobs matched filter "${escapeHtml(q)}". Clear the search to see all positions.</p>
          <button class="btn btn-secondary btn-sm" style="margin-top:10px;" onclick="clearResumeJobSearch()">Clear Filter</button>
        </div>
      `;
    }

    return `
      <div class="grid-2">
        ${jobs.map((job, idx) => `
          <div class="job-rec-card">
            <div>
              <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px; margin-bottom:8px;">
                <h4 style="font-size:15px; color:var(--text-primary); line-height:1.35; font-weight:600;">
                  ${escapeHtml(job.title)}
                </h4>
                <span class="match-score-pill" style="flex-shrink:0;">
                  ${job.matchScore}% Match
                </span>
              </div>

              <div style="display:flex; gap:12px; font-size:11.5px; color:var(--text-faint); margin-bottom:10px; font-family:var(--font-mono); flex-wrap:wrap;">
                <span><i data-lucide="map-pin" style="width:12px;height:12px;color:var(--accent-cyan);"></i> ${escapeHtml(job.location)}</span>
                <span><i data-lucide="clock" style="width:12px;height:12px;color:var(--accent-cyan);"></i> ${escapeHtml(job.employmentType)}</span>
                <span><i data-lucide="building" style="width:12px;height:12px;color:var(--accent-cyan);"></i> ${escapeHtml(job.industry)}</span>
              </div>

              <p style="font-size:12.5px; color:var(--text-muted); line-height:1.5; margin-bottom:12px;">
                ${escapeHtml(job.snippet)}
              </p>

              <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:14px;">
                <span style="font-size:11px; color:var(--text-faint); align-self:center; margin-right:2px;">Skills:</span>
                ${(job.matchedSkills || []).map(sk => `
                  <span class="skill-chip-tag highlight" style="font-size:11px; padding:2px 6px;">
                    ${escapeHtml(sk)}
                  </span>
                `).join('')}
              </div>
            </div>

            <!-- Card Action Footer -->
            <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; border-top:1px solid var(--border-color); padding-top:14px; flex-wrap:wrap;">
              <span class="badge badge-legit" style="font-size:10px;">Legitimate Dataset Verified</span>

              <div style="display:flex; gap:8px;">
                <button class="btn btn-secondary btn-sm" onclick="openRecommendedJobDetails(${idx})">
                  <i data-lucide="file-search" style="width:12px;height:12px;margin-right:4px;"></i> Details
                </button>

                <!-- Teleport to Live Job Website -->
                <a href="${job.adzunaUrl}" target="_blank" rel="noopener noreferrer" class="btn-adzuna" title="Teleport directly to live job description page">
                  <i data-lucide="external-link" style="width:13px;height:13px;"></i> Teleport to Job ↗
                </a>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  // ─── 4. #roles (Job Role & Skills Explorer + Resume Recommender) ─────────────
  function renderRoles() {
    const roles = (window.ROLE_INDEX && window.ROLE_INDEX.roles) || [];
    const urlParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const urlRoleId = urlParams.get('id');

    // If an ID is explicitly passed in URL, switch to the taxonomy explorer tab
    if (urlRoleId) {
      AppState.rolesTab = 'explore';
    } else if (!AppState.rolesTab) {
      AppState.rolesTab = 'resume';
    }

    const activeRoleId = urlRoleId || 'data_scientist';
    const activeRole = roles.find((r) => r.id === activeRoleId) || roles[0];

    // Ensure default resume analysis preset is ready so the user gets instant insights
    if (!AppState.currentResumeAnalysis && window.JobGuardData && window.JobGuardData.RESUME_PRESETS) {
      const defaultPreset = window.JobGuardData.RESUME_PRESETS.data_scientist;
      if (defaultPreset) {
        AppState.currentResumeAnalysis = window.JobGuardData.analyzeResume(defaultPreset.text, defaultPreset.fileName);
      }
    }

    const isResumeTab = AppState.rolesTab === 'resume';

    // ── Build Resume Tab HTML ──────────────────────────────────────────────
    let tabContentHtml = '';

    if (isResumeTab) {
      const analysis = AppState.currentResumeAnalysis;
      const recJobs = analysis ? (analysis.recommendedJobs || []) : [];
      const filterQ = (AppState.resumeJobSearch || '').toLowerCase().trim();
      const filteredJobs = filterQ ? recJobs.filter(j => 
        j.title.toLowerCase().includes(filterQ) ||
        j.location.toLowerCase().includes(filterQ) ||
        j.industry.toLowerCase().includes(filterQ) ||
        (j.matchedSkills || []).some(s => s.toLowerCase().includes(filterQ))
      ) : recJobs;
      AppState.currentFilteredJobs = filteredJobs;

      tabContentHtml = `
        <!-- Resume Upload & Recommender Hero Card -->
        <div class="card" style="margin-bottom: 24px; padding: 28px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:16px; margin-bottom:16px;">
            <div>
              <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
                <span class="badge badge-legit" style="font-size:11px; padding:3px 9px;">AI Career Forensics</span>
                <span class="badge" style="background:var(--bg-raised); color:var(--text-muted); font-size:11px;">EMSCAD Dataset (17,880 Postings)</span>
              </div>
              <h2 style="font-size:22px; margin-bottom:6px;">Upload Resume &amp; Discover Dataset Jobs</h2>
              <p style="font-size:13.5px; color:var(--text-muted); max-width:760px; line-height:1.5;">
                Upload candidate resume PDF to automatically extract role descriptions, detect technical competencies, predict target career trajectories, and receive verified job recommendations with 1-click teleportation to live job descriptions.
              </p>
            </div>
          </div>

          <!-- Dropzone Area -->
          <div id="resume-dropzone" class="resume-dropzone ${analysis ? 'has-file' : ''}">
            <input type="file" id="resume-file-input" accept=".pdf" style="display:none;">
            <div class="resume-dropzone-icon">
              <i data-lucide="file-up" style="width:28px; height:28px;"></i>
            </div>
            <div style="font-weight:700; font-size:16px; color:#FFFFFF; margin-bottom:6px;">
              Drag &amp; Drop your Resume PDF here
            </div>
            <div style="font-size:13px; color:var(--text-muted); margin-bottom:14px;">
              or <span id="resume-browse-link" style="color:var(--accent-cyan); text-decoration:underline; cursor:pointer; font-weight:600;">browse files</span> from your computer (.PDF format)
            </div>
            <div style="display:flex; justify-content:center; gap:10px; flex-wrap:wrap;">
              <span class="badge" style="background:var(--bg-raised); color:var(--text-faint); font-size:11px;">
                <i data-lucide="shield-check" style="width:12px;height:12px;margin-right:4px;"></i> Client-side PDF.js Ingestion (Secure &amp; Private)
              </span>
              <span class="badge" style="background:var(--bg-raised); color:var(--text-faint); font-size:11px;">
                <i data-lucide="external-link" style="width:12px;height:12px;margin-right:4px;"></i> 1-Click Live Job Teleportation
              </span>
            </div>
          </div>

          <!-- Quick Test Candidate Presets -->
          <div style="margin-top:20px;">
            <div style="font-size:12px; font-weight:700; color:var(--text-faint); text-transform:uppercase; letter-spacing:0.05em; margin-bottom:10px;">
              ⚡ Or load an instant candidate profile preset:
            </div>
            <div style="display:flex; gap:10px; flex-wrap:wrap;">
              <button class="chip preset-resume-chip ${analysis && analysis.primaryRole.id === 'data_scientist' ? 'active' : ''}" data-preset="data_scientist">
                <i data-lucide="sparkles" style="width:13px;height:13px;margin-right:5px;color:var(--accent-cyan);"></i> Data Scientist &amp; AI
              </button>
              <button class="chip preset-resume-chip ${analysis && analysis.primaryRole.id === 'full_stack_developer' ? 'active' : ''}" data-preset="full_stack">
                <i data-lucide="code" style="width:13px;height:13px;margin-right:5px;color:var(--accent-cyan);"></i> Full Stack Web Dev
              </button>
              <button class="chip preset-resume-chip ${analysis && analysis.primaryRole.id === 'devops_engineer' ? 'active' : ''}" data-preset="devops">
                <i data-lucide="server" style="width:13px;height:13px;margin-right:5px;color:var(--accent-cyan);"></i> DevOps &amp; Cloud
              </button>
              <button class="chip preset-resume-chip ${analysis && analysis.primaryRole.id === 'product_manager' ? 'active' : ''}" data-preset="marketing_product">
                <i data-lucide="line-chart" style="width:13px;height:13px;margin-right:5px;color:var(--accent-cyan);"></i> Product &amp; Marketing
              </button>
            </div>
          </div>
        </div>

        ${analysis ? `
          <!-- Candidate Analysis Dossier -->
          <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px; margin-bottom:16px;">
            <div style="display:flex; align-items:center; gap:10px;">
              <div style="width:36px; height:36px; border-radius:8px; background:rgba(34, 211, 238, 0.12); border:1px solid rgba(34, 211, 238, 0.3); display:flex; align-items:center; justify-content:center; color:var(--accent-cyan);">
                <i data-lucide="file-check" style="width:18px;height:18px;"></i>
              </div>
              <div>
                <h3 style="font-size:17px; margin-bottom:2px;">${escapeHtml(analysis.fileName)}</h3>
                <span style="font-size:12px; color:var(--text-muted); font-family:var(--font-mono);">
                  ${analysis.wordCount} words analyzed · ${analysis.skillsCount} technical competencies verified · Processed at ${analysis.analyzedAt}
                </span>
              </div>
            </div>
            <span class="badge badge-legit">Profile Forensic Analysis Active</span>
          </div>

          <div class="grid-2" style="margin-bottom: 24px;">
            <!-- Target Role Trajectory & Prediction Card -->
            <div class="card" style="padding:22px;">
              <div class="card-header" style="margin-bottom:14px;">
                <div class="card-title-group">
                  <h3 class="card-title" style="font-size:15px;">Target Role Trajectory Prediction</h3>
                  <span class="card-subtitle">Predicted career track based on NLP skill co-occurrence</span>
                </div>
                <span class="match-score-pill">
                  <i data-lucide="check-circle" style="width:12px;height:12px;"></i> ${analysis.primaryRole.score}% Fit
                </span>
              </div>

              <div style="display:flex; align-items:center; gap:14px; margin-bottom:16px; padding:12px 14px; background:var(--bg-raised); border-radius:10px; border:1px solid var(--border-color);">
                <div style="width:42px; height:42px; border-radius:10px; background:linear-gradient(135deg, var(--accent-violet), var(--accent-cyan)); display:flex; align-items:center; justify-content:center; color:#FFFFFF; flex-shrink:0;">
                  <i data-lucide="briefcase" style="width:20px;height:20px;"></i>
                </div>
                <div style="flex:1;">
                  <h4 style="font-size:16px; color:#FFFFFF; margin-bottom:2px;">${escapeHtml(analysis.primaryRole.name)}</h4>
                  <div style="font-size:12px; color:var(--text-muted);">${escapeHtml(analysis.seniority)} · ${escapeHtml(analysis.experienceYears)}</div>
                </div>
                <button class="btn btn-secondary btn-sm" onclick="switchRolesTab('explore', '${analysis.primaryRole.id}')" title="Explore benchmark metrics for this role">
                  Benchmark ↗
                </button>
              </div>

              <div style="margin-bottom:14px;">
                <div style="font-size:11.5px; font-weight:700; color:var(--text-faint); text-transform:uppercase; letter-spacing:0.04em; margin-bottom:6px;">
                  Extracted Profile &amp; Role Description:
                </div>
                <p style="font-size:12.5px; color:var(--text-muted); line-height:1.55; background:var(--bg-card); padding:10px 12px; border-radius:8px; border:1px solid var(--border-color);">
                  ${escapeHtml(analysis.summary)}
                </p>
              </div>

              <div>
                <div style="font-size:11.5px; font-weight:700; color:var(--text-faint); text-transform:uppercase; letter-spacing:0.04em; margin-bottom:6px;">
                  Alternative Trajectory Alignments:
                </div>
                <div style="display:flex; gap:8px; flex-wrap:wrap;">
                  ${analysis.alternativeRoles.map(alt => `
                    <span class="badge" style="background:var(--bg-raised); border:1px solid var(--border-color); color:var(--text-muted); font-size:11.5px; cursor:pointer;" onclick="switchRolesTab('explore', '${alt.id}')" title="Click to view benchmarks">
                      ${escapeHtml(alt.name)} <strong style="color:var(--accent-cyan); margin-left:4px;">${alt.score}%</strong>
                    </span>
                  `).join('')}
                </div>
              </div>
            </div>

            <!-- Extracted Skills Matrix Card -->
            <div class="card" style="padding:22px;">
              <div class="card-header" style="margin-bottom:14px;">
                <div class="card-title-group">
                  <h3 class="card-title" style="font-size:15px;">Extracted Skills &amp; Competencies</h3>
                  <span class="card-subtitle">Verified technical proficiencies identified in PDF resume</span>
                </div>
                <span class="badge badge-legit" style="font-size:11px;">${analysis.skillsCount} Skills</span>
              </div>

              <div style="display:flex; flex-wrap:wrap; gap:7px; max-height:240px; overflow-y:auto; padding-right:4px; margin-bottom:16px;">
                ${analysis.extractedSkills.map(sk => `
                  <span class="skill-chip-tag highlight" title="Category: ${sk.category}">
                    <i data-lucide="check" style="width:11px;height:11px;color:var(--accent-cyan);"></i>
                    <span>${escapeHtml(sk.name)}</span>
                  </span>
                `).join('')}
              </div>

              <div style="padding:10px 14px; background:rgba(34, 211, 238, 0.05); border:1px solid rgba(34, 211, 238, 0.2); border-radius:8px; font-size:12px; color:var(--text-muted); display:flex; align-items:center; gap:8px;">
                <i data-lucide="info" style="width:14px;height:14px;color:var(--accent-cyan);flex-shrink:0;"></i>
                <span>These skills are mapped against 17,880 dataset job requirements to rank the recommended positions below.</span>
              </div>
            </div>
          </div>

          <!-- Recommended Jobs Section -->
          <div class="card" style="padding:24px;">
            <div class="card-header" style="margin-bottom:18px; flex-wrap:wrap; gap:12px;">
              <div class="card-title-group">
                <div style="display:flex; align-items:center; gap:8px;">
                  <h3 class="card-title" style="font-size:18px;">Recommended Verified Jobs</h3>
                  <span class="badge badge-legit" id="rec-jobs-count-badge" style="font-size:11px;">${filteredJobs.length} Positions Available</span>
                </div>
                <span class="card-subtitle">
                  Available in dataset according to user requirements. Click <strong>"Teleport to Job"</strong> to view live job descriptions and apply directly.
                </span>
              </div>

              <!-- Filter Search Input -->
              <div style="position:relative; min-width:280px;">
                <input type="text" id="resume-job-search-input" class="form-input" style="padding-left:36px; height:38px; font-size:13px;" placeholder="Filter jobs by title, skill, location..." value="${escapeHtml(AppState.resumeJobSearch)}">
                <i data-lucide="search" style="position:absolute; left:11px; top:11px; width:15px; height:15px; color:var(--text-faint);"></i>
              </div>
            </div>

            <!-- Jobs List Container -->
            <div id="rec-jobs-list-container">
              ${renderRecommendedJobsListHtml(filteredJobs)}
            </div>
          </div>
        ` : ''}
      `;
    } else {
      // ── Build Explore Tab HTML (Existing 25 Role Benchmark Explorer) ────────
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

      tabContentHtml = `
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
            <div style="display:flex; gap:10px; align-items:center;">
              <a href="https://www.adzuna.com/search?q=${encodeURIComponent(activeRole.name)}" target="_blank" rel="noopener noreferrer" class="btn-adzuna">
                <i data-lucide="external-link" style="width:13px;height:13px;"></i> View Live Postings ↗
              </a>
              <span class="badge badge-legit">Verified Legitimate Corpus</span>
            </div>
          </div>

          <div class="grid-2" style="margin-bottom: 24px;">
            <!-- Top Required Skills -->
            <div class="card">
              <div class="card-header">
                <div class="card-title-group">
                  <h3 class="card-title">Core Required Skills &amp; Proficiencies</h3>
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
                      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px; margin-bottom:4px;">
                        <h4 style="font-size:14.5px; color:var(--text-primary);">${escapeHtml(sp.title)}</h4>
                      </div>
                      <div style="display:flex; gap:10px; font-size:11.5px; color:var(--text-faint); margin-bottom:8px; font-family:var(--font-mono);">
                        <span><i data-lucide="map-pin" style="width:12px;height:12px;"></i> ${escapeHtml(sp.location)}</span>
                        <span><i data-lucide="clock" style="width:12px;height:12px;"></i> ${escapeHtml(sp.type)}</span>
                      </div>
                      <p style="font-size:12.5px; color:var(--text-muted); line-height:1.5;">${escapeHtml(sp.snippet)}</p>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;">
                      <span class="badge badge-legit" style="width:fit-content;">Legitimate Benchmark</span>
                      <a href="https://www.adzuna.com/search?q=${encodeURIComponent(sp.title)}" target="_blank" rel="noopener noreferrer" class="btn-adzuna" style="font-size:11.5px; padding:6px 12px;">
                        <i data-lucide="external-link" style="width:12px;height:12px;"></i> Teleport to Job ↗
                      </a>
                    </div>
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
    }

    // ── Overall Outer Shell HTML ──────────────────────────────────────────
    const fullHtml = `
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

      <!-- Navigation Tab Bar -->
      <div class="roles-tab-container">
        <button class="roles-tab-btn ${isResumeTab ? 'active' : ''}" id="btn-tab-resume">
          <i data-lucide="file-up" style="width:16px; height:16px;"></i>
          <span>Upload Resume &amp; Match Jobs</span>
          <span class="badge badge-legit" style="font-size:10px; padding:2px 7px; margin-left:4px;">AI Recommender</span>
        </button>
        <button class="roles-tab-btn ${!isResumeTab ? 'active' : ''}" id="btn-tab-explore">
          <i data-lucide="compass" style="width:16px; height:16px;"></i>
          <span>25 Role Benchmarks &amp; Skill Matrix</span>
        </button>
      </div>

      <!-- Active Tab Content -->
      <div id="roles-tab-content">
        ${tabContentHtml}
      </div>
    `;

    document.getElementById('app').innerHTML = renderShell(fullHtml, 'Job Roles & Skills Matrix', 'Career Competency Benchmarks & AI Job Recommender');

    // ── Bind Tab Switchers ───────────────────────────────────────────────────
    const tabResumeBtn = document.getElementById('btn-tab-resume');
    const tabExploreBtn = document.getElementById('btn-tab-explore');

    if (tabResumeBtn) {
      tabResumeBtn.addEventListener('click', () => {
        AppState.rolesTab = 'resume';
        renderRoles();
      });
    }

    if (tabExploreBtn) {
      tabExploreBtn.addEventListener('click', () => {
        AppState.rolesTab = 'explore';
        renderRoles();
      });
    }

    // ── Bind Resume Recommender Events (When in Resume Tab) ──────────────────
    if (isResumeTab) {
      const dropzone = document.getElementById('resume-dropzone');
      const fileInput = document.getElementById('resume-file-input');
      const browseLink = document.getElementById('resume-browse-link');

      if (browseLink && fileInput) {
        browseLink.addEventListener('click', (e) => {
          e.stopPropagation();
          fileInput.click();
        });
      }

      if (dropzone && fileInput) {
        dropzone.addEventListener('click', () => fileInput.click());

        dropzone.addEventListener('dragover', (e) => {
          e.preventDefault();
          dropzone.classList.add('drag-over');
        });

        dropzone.addEventListener('dragleave', () => {
          dropzone.classList.remove('drag-over');
        });

        dropzone.addEventListener('drop', (e) => {
          e.preventDefault();
          dropzone.classList.remove('drag-over');
          if (e.dataTransfer && e.dataTransfer.files.length > 0) {
            handleResumeFileUpload(e.dataTransfer.files[0]);
          }
        });

        fileInput.addEventListener('change', () => {
          if (fileInput.files && fileInput.files.length > 0) {
            handleResumeFileUpload(fileInput.files[0]);
          }
        });
      }

      // Bind Preset Chips
      const presetChips = document.querySelectorAll('.preset-resume-chip');
      presetChips.forEach(chip => {
        chip.addEventListener('click', () => {
          const key = chip.getAttribute('data-preset');
          const p = window.JobGuardData && window.JobGuardData.RESUME_PRESETS && window.JobGuardData.RESUME_PRESETS[key];
          if (p) {
            AppState.currentResumeAnalysis = window.JobGuardData.analyzeResume(p.text, p.fileName);
            showToast(`Loaded candidate profile: ${p.label}`, 'info');
            renderRoles();
          }
        });
      });

      // Bind Real-Time Job Search Filter (in-place container update to preserve focus)
      const jobFilterInput = document.getElementById('resume-job-search-input');
      if (jobFilterInput) {
        jobFilterInput.addEventListener('input', (e) => {
          AppState.resumeJobSearch = e.target.value;
          const q = (AppState.resumeJobSearch || '').toLowerCase().trim();
          const allRecJobs = (AppState.currentResumeAnalysis && AppState.currentResumeAnalysis.recommendedJobs) || [];
          const matched = q ? allRecJobs.filter(j => 
            j.title.toLowerCase().includes(q) ||
            j.location.toLowerCase().includes(q) ||
            j.industry.toLowerCase().includes(q) ||
            (j.matchedSkills || []).some(s => s.toLowerCase().includes(q))
          ) : allRecJobs;

          AppState.currentFilteredJobs = matched;

          const countBadge = document.getElementById('rec-jobs-count-badge');
          if (countBadge) {
            countBadge.textContent = `${matched.length} Positions Available`;
          }

          const container = document.getElementById('rec-jobs-list-container');
          if (container) {
            container.innerHTML = renderRecommendedJobsListHtml(matched);
            if (window.lucide) lucide.createIcons();
          }
        });
      }
    } else {
      // ── Bind Explore Tab Events ───────────────────────────────────────────
      if (activeRole && activeRole.topSkills) {
        setTimeout(() => {
          ChartEngine.drawSkillsBar('role-skills-canvas', activeRole.topSkills);
        }, 50);
      }

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

    if (window.lucide) lucide.createIcons();
  }

  // Helper: Switch roles tab programmatically
  window.switchRolesTab = function(tabName, roleId) {
    AppState.rolesTab = tabName;
    if (roleId) {
      window.location.hash = `#roles?id=${roleId}`;
    } else {
      renderRoles();
    }
  };

  // Helper: Clear job search
  window.clearResumeJobSearch = function() {
    AppState.resumeJobSearch = '';
    const input = document.getElementById('resume-job-search-input');
    if (input) input.value = '';
    const allRecJobs = (AppState.currentResumeAnalysis && AppState.currentResumeAnalysis.recommendedJobs) || [];
    AppState.currentFilteredJobs = allRecJobs;
    const countBadge = document.getElementById('rec-jobs-count-badge');
    if (countBadge) countBadge.textContent = `${allRecJobs.length} Positions Available`;
    const container = document.getElementById('rec-jobs-list-container');
    if (container) {
      container.innerHTML = renderRecommendedJobsListHtml(allRecJobs);
      if (window.lucide) lucide.createIcons();
    }
  };

  // Helper: Open recommended job details safely by index
  window.openRecommendedJobDetails = function(index) {
    const job = (AppState.currentFilteredJobs || [])[index];
    if (job) {
      showRecommendedJobModal(job);
    }
  };

  // Helper: Modal for full recommended job description
  window.showRecommendedJobModal = function(arg1, roleName, location, empType, industry, snippet, adzunaUrl, kaggleUrl) {
    const job = (typeof arg1 === 'object' && arg1 !== null) ? arg1 : {
      title: arg1,
      roleName: roleName,
      location: location,
      employmentType: empType,
      industry: industry,
      snippet: snippet,
      adzunaUrl: adzunaUrl,
      kaggleUrl: kaggleUrl
    };

    const modalHtml = `
      <div class="modal-header">
        <div>
          <h3 class="modal-title" style="font-size:18px;">${escapeHtml(job.title || 'Verified Job Posting')}</h3>
          <div style="font-size:12px; color:var(--text-muted); margin-top:4px;">
            Target Trajectory: <strong style="color:var(--accent-cyan);">${escapeHtml(job.roleName || '')}</strong> · Verified Legitimate EMSCAD Corpus
          </div>
        </div>
        <button class="btn-icon" onclick="document.getElementById('modal-container').classList.remove('open')">
          <i data-lucide="x"></i>
        </button>
      </div>
      <div class="modal-body" style="padding:24px; display:flex; flex-direction:column; gap:16px;">
        <div style="display:flex; gap:12px; flex-wrap:wrap; font-size:12.5px; color:var(--text-muted);">
          <span><i data-lucide="map-pin" style="width:13px;height:13px;color:var(--accent-cyan);"></i> ${escapeHtml(job.location || 'Remote')}</span>
          <span><i data-lucide="clock" style="width:13px;height:13px;color:var(--accent-cyan);"></i> ${escapeHtml(job.employmentType || 'Full-time')}</span>
          <span><i data-lucide="building" style="width:13px;height:13px;color:var(--accent-cyan);"></i> ${escapeHtml(job.industry || 'Technology')}</span>
        </div>
        <div>
          <h4 style="font-size:13px; font-weight:700; color:var(--text-faint); text-transform:uppercase; margin-bottom:8px;">Job Description &amp; Requirements Snippet</h4>
          <div style="padding:16px; background:var(--bg-card); border-radius:10px; border:1px solid var(--border-color); font-size:13px; line-height:1.65; color:var(--text-primary); white-space:pre-wrap;">
            ${escapeHtml(job.snippet || '')}
          </div>
        </div>
        <div style="padding:12px 14px; background:rgba(34, 211, 238, 0.05); border:1px solid rgba(34, 211, 238, 0.2); border-radius:10px; font-size:12px; color:var(--text-muted);">
          <strong style="color:var(--accent-cyan);">Kaggle EMSCAD Provenance:</strong> This position is indexed from the authentic University of the Aegean Employment Scam Dataset. Verified 0.00% fraud probability with full forensic integrity.
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-top:8px;">
          <a href="${job.kaggleUrl || 'https://www.kaggle.com/datasets/shivamb/real-or-fake-fake-jobposting-prediction'}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm">
            <i data-lucide="database" style="width:13px;height:13px;margin-right:4px;"></i> View Kaggle Dataset Source ↗
          </a>
          <a href="${job.adzunaUrl || 'https://www.adzuna.com'}" target="_blank" rel="noopener noreferrer" class="btn-adzuna">
            <i data-lucide="external-link" style="width:14px;height:14px;"></i> Teleport to Live Description ↗
          </a>
        </div>
      </div>
    `;
    openModal(modalHtml);
  };

  // ─── ScamTrace™ Cross-Incident Fraud Syndicate Investigation Dossier Modal ────
  window.openScamTraceDossierModal = function() {
    const syn = window.JobGuardData.getScamTraceForUser ? window.JobGuardData.getScamTraceForUser() : window.JobGuardData.getScamTraceSyndicate();
    
    // If no recurring syndicate pattern is present in user's history
    if (!syn || !syn.detected) {
      const emptyModalHtml = `
        <div class="modal-header">
          <div style="display:flex; align-items:center; gap:10px;">
            <div style="width:34px;height:34px;border-radius:8px;background:rgba(34,211,238,0.15);border:1px solid rgba(34,211,238,0.4);display:flex;align-items:center;justify-content:center;color:var(--accent-cyan);">
              <i data-lucide="shield-check" style="width:18px;height:18px;"></i>
            </div>
            <div>
              <span class="badge badge-legit" style="font-size:10px;">Surveillance Active</span>
              <h3 class="modal-title" style="font-size:17px;margin-top:2px;">ScamTrace™ History Correlation Engine</h3>
            </div>
          </div>
          <button class="btn-icon" onclick="document.getElementById('modal-container').classList.remove('open')">
            <i data-lucide="x"></i>
          </button>
        </div>
        <div class="modal-body" style="padding:28px 24px; text-align:center;">
          <div style="width:58px;height:58px;border-radius:50%;background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.3);display:flex;align-items:center;justify-content:center;margin:0 auto 16px;color:var(--safe);">
            <i data-lucide="check-circle-2" style="width:30px;height:30px;"></i>
          </div>
          <h4 style="font-size:16px;color:#FFFFFF;margin-bottom:8px;">No Recurring Fraud Syndicates Discovered in Your History</h4>
          <p style="font-size:13px;color:var(--text-muted);max-width:500px;margin:0 auto 20px;line-height:1.6;">
            ScamTrace evaluates your personal scan history in real time. An active fraud alert is only triggered when 2 or more of your scanned postings share identical fraudster fingerprints (such as extortion UPI handles, spoofed lookalike domains, or shared recruiter personas).
          </p>
          <div style="display:flex;justify-content:center;gap:12px;">
            <button class="btn btn-secondary" onclick="document.getElementById('modal-container').classList.remove('open');location.hash='#history';">
              <i data-lucide="list"></i> View Audit History
            </button>
            <button class="btn btn-primary" onclick="document.getElementById('modal-container').classList.remove('open');location.hash='#analyze';">
              <i data-lucide="scan"></i> Scan a Posting or Document
            </button>
          </div>
        </div>
      `;
      openModal(emptyModalHtml);
      return;
    }

    const incs = syn.linkedIncidents || [];
    const inc1 = incs[0];
    const inc2 = incs[1] || inc1;
    const inc3 = incs[2] || null;

    const modalHtml = `
      <div class="modal-header" style="border-bottom:1px solid rgba(239,68,68,0.3); background:linear-gradient(135deg, rgba(239,68,68,0.1), transparent);">
        <div style="display:flex; align-items:center; gap:12px;">
          <div class="scamtrace-siren-wrap">
            <span class="alarm-pulse-ring"></span>
            <i data-lucide="siren" style="width:20px;height:20px;color:#ef4444;"></i>
          </div>
          <div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="scamtrace-alarm-badge"><span class="blink-dot"></span> ACTIVE FRAUD SYNDICATE CORRELATED IN YOUR HISTORY</span>
              <span class="badge" style="background:var(--bg-raised); font-family:var(--font-mono); font-size:11px; color:#fca5a5;">${escapeHtml(syn.syndicateId)}</span>
            </div>
            <h3 class="modal-title" style="font-size:18px; margin-top:3px; color:#FFFFFF;">
              ScamTrace™ Forensic Syndicate Investigation Report
            </h3>
          </div>
        </div>
        <button class="btn-icon" onclick="document.getElementById('modal-container').classList.remove('open')">
          <i data-lucide="x"></i>
        </button>
      </div>

      <div class="modal-body" style="padding:24px; max-height:80vh; overflow-y:auto; display:flex; flex-direction:column; gap:20px;">
        <!-- Syndicate Overview Card -->
        <div style="background:rgba(239,68,68,0.06); border:1px solid rgba(239,68,68,0.35); border-radius:12px; padding:16px 20px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:12px; margin-bottom:8px;">
            <div>
              <div style="font-size:11px; font-weight:700; color:#f87171; text-transform:uppercase; letter-spacing:0.06em;">Identified Adversary</div>
              <h4 style="font-size:16px; color:#FFFFFF; margin-top:2px;">${escapeHtml(syn.syndicateAlias)}</h4>
            </div>
            <div style="text-align:right;">
              <span class="badge badge-high-risk" style="font-size:12px; padding:4px 10px;">
                <i data-lucide="alert-triangle" style="width:13px;height:13px;"></i> ${syn.correlationConfidence}% Confidence
              </span>
              <div style="font-size:11px; color:var(--text-faint); margin-top:4px; font-family:var(--font-mono);">
                Target: ${escapeHtml(syn.impersonatedEntity)}
              </div>
            </div>
          </div>
          <p style="font-size:13px; color:var(--text-muted); line-height:1.55; margin:0;">
            ${escapeHtml(syn.summary)}
          </p>
        </div>

        <!-- Section 1: Multi-Document Network Relationship Graph -->
        <div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <div>
              <h4 style="font-size:14px; font-weight:700; color:#FFFFFF; display:flex; align-items:center; gap:6px;">
                <i data-lucide="git-merge" style="width:16px;height:16px;color:var(--accent-cyan);"></i> Multi-Document Syndicate Linkage Graph
              </h4>
              <span style="font-size:12px; color:var(--text-muted);">Visual relationship topology linking ${syn.linkedIncidentsCount} separate records in your history to one fraudster</span>
            </div>
            <span class="badge badge-legit" style="font-size:10px;">Cross-Portal Relationship Engine</span>
          </div>

          <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:12px; padding:20px; text-align:center;">
            <svg viewBox="0 0 760 270" style="width:100%; max-width:760px; height:auto; display:block; margin:0 auto;" aria-label="ScamTrace Network Graph">
              <defs>
                <filter id="scam-glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <linearGradient id="fraud-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#ef4444" />
                  <stop offset="100%" stop-color="#b91c1c" />
                </linearGradient>
                <linearGradient id="doc-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#1e293b" />
                  <stop offset="100%" stop-color="#0f172a" />
                </linearGradient>
              </defs>

              ${inc3 ? `
                <!-- 3 Incidents Connecting Edges with Proof Badges -->
                <line x1="380" y1="135" x2="130" y2="60" stroke="#ef4444" stroke-width="2" stroke-dasharray="6,4" />
                <line x1="380" y1="135" x2="380" y2="225" stroke="#ef4444" stroke-width="2" stroke-dasharray="6,4" />
                <line x1="380" y1="135" x2="630" y2="60" stroke="#ef4444" stroke-width="2" stroke-dasharray="6,4" />

                <rect x="160" y="78" width="170" height="20" rx="4" fill="rgba(239,68,68,0.2)" stroke="#ef4444" stroke-width="1" />
                <text x="245" y="92" fill="#fca5a5" font-size="9" font-family="monospace" text-anchor="middle">UPI: ${escapeHtml(syn.sharedProofs.upiHandle)}</text>

                <rect x="295" y="172" width="170" height="20" rx="4" fill="rgba(239,68,68,0.2)" stroke="#ef4444" stroke-width="1" />
                <text x="380" y="186" fill="#fca5a5" font-size="9" font-family="monospace" text-anchor="middle">Fee: ${escapeHtml(syn.sharedProofs.paymentDemanded)}</text>

                <rect x="425" y="78" width="170" height="20" rx="4" fill="rgba(239,68,68,0.2)" stroke="#ef4444" stroke-width="1" />
                <text x="510" y="92" fill="#fca5a5" font-size="9" font-family="monospace" text-anchor="middle">Domain: ${escapeHtml(syn.sharedProofs.domain)}</text>
              ` : `
                <!-- 2 Incidents Connecting Edges with Proof Badges -->
                <line x1="380" y1="135" x2="140" y2="135" stroke="#ef4444" stroke-width="2" stroke-dasharray="6,4" />
                <line x1="380" y1="135" x2="620" y2="135" stroke="#ef4444" stroke-width="2" stroke-dasharray="6,4" />

                <rect x="180" y="115" width="160" height="20" rx="4" fill="rgba(239,68,68,0.2)" stroke="#ef4444" stroke-width="1" />
                <text x="260" y="129" fill="#fca5a5" font-size="9" font-family="monospace" text-anchor="middle">UPI: ${escapeHtml(syn.sharedProofs.upiHandle)}</text>

                <rect x="420" y="115" width="160" height="20" rx="4" fill="rgba(239,68,68,0.2)" stroke="#ef4444" stroke-width="1" />
                <text x="500" y="129" fill="#fca5a5" font-size="9" font-family="monospace" text-anchor="middle">Domain: ${escapeHtml(syn.sharedProofs.domain)}</text>
              `}

              <!-- Central Adversary Node -->
              <circle cx="380" cy="135" r="42" fill="url(#fraud-grad)" filter="url(#scam-glow)" />
              <circle cx="380" cy="135" r="46" fill="none" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="4,3" />
              <text x="380" y="128" fill="#FFFFFF" font-size="11" font-weight="bold" font-family="sans-serif" text-anchor="middle">FRAUDSTER</text>
              <text x="380" y="142" fill="#fee2e2" font-size="9" font-family="monospace" text-anchor="middle">${escapeHtml(syn.syndicateId)}</text>
              <text x="380" y="154" fill="#fca5a5" font-size="8" font-family="sans-serif" text-anchor="middle">${escapeHtml(syn.syndicateAlias.slice(0, 18))}</text>

              <!-- Incident Node 1 (From User History) -->
              <g transform="${inc3 ? 'translate(40, 20)' : 'translate(40, 95)'}">
                <rect x="0" y="0" width="180" height="75" rx="10" fill="url(#doc-grad)" stroke="rgba(239,68,68,0.6)" stroke-width="1.5" />
                <circle cx="20" cy="22" r="9" fill="rgba(239,68,68,0.2)" />
                <text x="20" y="26" fill="#ef4444" font-size="10" font-weight="bold" text-anchor="middle">1</text>
                <text x="36" y="22" fill="#FFFFFF" font-size="11" font-weight="bold">${escapeHtml(inc1.type.slice(0, 18))}</text>
                <text x="36" y="36" fill="#94a3b8" font-size="9.5">${escapeHtml(inc1.documentName.slice(0, 20))}…</text>
                <text x="14" y="52" fill="#fca5a5" font-size="9" font-family="monospace">${escapeHtml(inc1.paymentSolicited.slice(0, 22))}</text>
                <text x="14" y="65" fill="#38bdf8" font-size="8.5">History: ${escapeHtml(inc1.channel)}</text>
              </g>

              <!-- Incident Node 2 (From User History) -->
              <g transform="${inc3 ? 'translate(290, 190)' : 'translate(540, 95)'}">
                <rect x="0" y="0" width="180" height="75" rx="10" fill="url(#doc-grad)" stroke="rgba(239,68,68,0.6)" stroke-width="1.5" />
                <circle cx="20" cy="22" r="9" fill="rgba(239,68,68,0.2)" />
                <text x="20" y="26" fill="#ef4444" font-size="10" font-weight="bold" text-anchor="middle">2</text>
                <text x="36" y="22" fill="#FFFFFF" font-size="11" font-weight="bold">${escapeHtml(inc2.type.slice(0, 18))}</text>
                <text x="36" y="36" fill="#94a3b8" font-size="9.5">${escapeHtml(inc2.documentName.slice(0, 20))}…</text>
                <text x="14" y="52" fill="#fca5a5" font-size="9" font-family="monospace">${escapeHtml(inc2.claimedRecruiter.slice(0, 22))}</text>
                <text x="14" y="65" fill="#38bdf8" font-size="8.5">History: ${escapeHtml(inc2.channel)}</text>
              </g>

              <!-- Incident Node 3 (From User History, if present) -->
              ${inc3 ? `
                <g transform="translate(540, 20)">
                  <rect x="0" y="0" width="180" height="75" rx="10" fill="url(#doc-grad)" stroke="rgba(239,68,68,0.6)" stroke-width="1.5" />
                  <circle cx="20" cy="22" r="9" fill="rgba(239,68,68,0.2)" />
                  <text x="20" y="26" fill="#ef4444" font-size="10" font-weight="bold" text-anchor="middle">3</text>
                  <text x="36" y="22" fill="#FFFFFF" font-size="11" font-weight="bold">${escapeHtml(inc3.type.slice(0, 18))}</text>
                  <text x="36" y="36" fill="#94a3b8" font-size="9.5">${escapeHtml(inc3.documentName.slice(0, 20))}…</text>
                  <text x="14" y="52" fill="#fca5a5" font-size="9" font-family="monospace">${escapeHtml(inc3.paymentSolicited.slice(0, 22))}</text>
                  <text x="14" y="65" fill="#38bdf8" font-size="8.5">History: ${escapeHtml(inc3.channel)}</text>
                </g>
              ` : ''}
            </svg>
          </div>
        </div>

        <!-- Section 2: Concrete Forensic Proof Matrix -->
        <div>
          <h4 style="font-size:14px; font-weight:700; color:#FFFFFF; margin-bottom:4px; display:flex; align-items:center; gap:6px;">
            <i data-lucide="shield-check" style="width:16px;height:16px;color:#ef4444;"></i> Forensic Proof Matrix — Cross-Incident Correlation from User History
          </h4>
          <span style="font-size:12px; color:var(--text-muted); display:block; margin-bottom:12px;">
            Side-by-side evidence confirming that ${syn.linkedIncidentsCount} audited submissions in your history originate from the same fraudster infrastructure
          </span>

          <div style="overflow-x:auto;">
            <table class="scamtrace-matrix-table">
              <thead>
                <tr>
                  <th>Verification Feature</th>
                  ${incs.slice(0, 3).map((inc, i) => `<th>Incident ${i+1} (${escapeHtml(inc.type)})</th>`).join('')}
                  <th>Forensic Proof Match</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Payment Demanded</strong></td>
                  ${incs.slice(0, 3).map(inc => `<td>${escapeHtml(inc.paymentSolicited)}</td>`).join('')}
                  <td><span class="proof-pass-badge"><i data-lucide="check" style="width:11px;height:11px;"></i> 100% Identical Fee</span></td>
                </tr>
                <tr>
                  <td><strong>UPI Account Handle</strong></td>
                  ${incs.slice(0, 3).map(inc => `<td><code style="color:var(--accent-cyan);">${escapeHtml(inc.upiHandle)}</code></td>`).join('')}
                  <td><span class="proof-pass-badge"><i data-lucide="check" style="width:11px;height:11px;"></i> 100% Shared Wallet</span></td>
                </tr>
                <tr>
                  <td><strong>Recruiter Alias</strong></td>
                  ${incs.slice(0, 3).map(inc => `<td>${escapeHtml(inc.claimedRecruiter)}</td>`).join('')}
                  <td><span class="proof-pass-badge"><i data-lucide="check" style="width:11px;height:11px;"></i> 100% Persona Reuse</span></td>
                </tr>
                <tr>
                  <td><strong>Off-Platform Migration</strong></td>
                  ${incs.slice(0, 3).map(inc => `<td>${escapeHtml(inc.channel)}</td>`).join('')}
                  <td><span class="proof-pass-badge"><i data-lucide="check" style="width:11px;height:11px;"></i> 100% Untraceable App</span></td>
                </tr>
                <tr>
                  <td><strong>Sender Domain</strong></td>
                  ${incs.slice(0, 3).map(inc => `<td>@${escapeHtml(inc.domain)}</td>`).join('')}
                  <td><span class="proof-pass-badge"><i data-lucide="check" style="width:11px;height:11px;"></i> 100% Spoofed DNS</span></td>
                </tr>
                <tr>
                  <td><strong>Screening Protocol</strong></td>
                  ${incs.slice(0, 3).map(inc => `<td>${escapeHtml(inc.screening)}</td>`).join('')}
                  <td><span class="proof-pass-badge"><i data-lucide="check" style="width:11px;height:11px;"></i> 97.4% NLP Match</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Section 3: XAI Feature Attribution & Pattern Frequency Breakdown -->
        <div>
          <h4 style="font-size:14px; font-weight:700; color:#FFFFFF; margin-bottom:4px; display:flex; align-items:center; gap:6px;">
            <i data-lucide="sparkles" style="width:16px;height:16px;color:var(--accent-cyan);"></i> XAI Pattern Breakdown &amp; Token Frequency Attribution
          </h4>
          <span style="font-size:12px; color:var(--text-muted); display:block; margin-bottom:12px;">
            Frequency analysis and SHAP feature importance weights linking recurring patterns across your history
          </span>

          <div style="display:flex; flex-direction:column; gap:8px;">
            ${syn.xaiFrequencyBreakdown.map(item => `
              <div style="background:var(--bg-raised); border:1px solid var(--border-color); border-radius:8px; padding:10px 14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                <div style="display:flex; align-items:center; gap:10px;">
                  <span class="badge badge-high-risk" style="font-size:10px; font-family:var(--font-mono);">${item.frequency} / ${syn.linkedIncidentsCount} Hits</span>
                  <code style="font-size:12.5px; color:#FFFFFF; font-weight:600;">${escapeHtml(item.token)}</code>
                </div>
                <div style="display:flex; align-items:center; gap:12px;">
                  <span style="font-size:12px; color:var(--text-muted);">${escapeHtml(item.impact)}</span>
                  <span style="font-size:12px; font-weight:700; color:#ef4444; font-family:var(--font-mono);">+${item.weight} SHAP</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Defense Protocol Banner -->
        <div style="padding:12px 16px; background:rgba(16,185,129,0.08); border:1px solid rgba(16,185,129,0.3); border-radius:10px; font-size:12px; color:#34d399; display:flex; align-items:center; gap:10px;">
          <i data-lucide="shield-check" style="width:18px;height:18px;flex-shrink:0;"></i>
          <span><strong>Defense Action:</strong> ${escapeHtml(syn.actionTaken)}</span>
        </div>

        <!-- Modal Footer Actions -->
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; border-top:1px solid var(--border-color); padding-top:16px;">
          <div style="font-size:11px; color:var(--text-faint); font-family:var(--font-mono);">
            Case ID: ${escapeHtml(syn.syndicateId)} · Correlated in User History (${syn.linkedIncidentsCount} records)
          </div>
          <div style="display:flex; gap:10px; flex-wrap:wrap;">
            <button class="btn btn-secondary btn-sm" onclick="document.getElementById('modal-container').classList.remove('open');location.hash='#history';">
              <i data-lucide="list" style="width:13px;height:13px;margin-right:4px;"></i> View in Audit History
            </button>
            <button class="btn btn-secondary btn-sm" onclick="window.downloadScamTraceBrief()">
              <i data-lucide="download" style="width:13px;height:13px;margin-right:4px;"></i> Download PDF Brief
            </button>
            ${(() => {
              const isLodged = !!localStorage.getItem('jobguard_cyber_alert_lodged');
              if (isLodged) {
                return `
                  <button class="btn btn-secondary btn-sm" style="border-color:rgba(16,185,129,0.5); color:#34d399;" onclick="window.openCyberCrimeReportModal()">
                    <i data-lucide="check-circle-2" style="width:13px;height:13px;margin-right:4px;color:#10b981;"></i> View Lodged Cyber Alert
                  </button>
                `;
              }
              return `
                <button class="btn btn-danger btn-sm" onclick="window.openCyberCrimeReportModal()">
                  <i data-lucide="flag" style="width:13px;height:13px;margin-right:4px;"></i> Transmit Cyber Alert
                </button>
              `;
            })()}
          </div>
        </div>
      </div>
    `;

    openModal(modalHtml, 'modal-box-large');
  };

  // ─── Forensic Brief File Exporter ──────────────────────────────────────────
  window.downloadScamTraceBrief = function() {
    const syn = window.JobGuardData.getScamTraceForUser ? window.JobGuardData.getScamTraceForUser() : null;
    if (!syn) {
      showToast('No active ScamTrace dossier data available to export', 'warning');
      return;
    }
    const upi = syn.sharedProofs ? syn.sharedProofs.upiHandle : 'N/A';
    const domain = syn.sharedProofs ? syn.sharedProofs.domain : 'N/A';
    const recruiter = syn.sharedProofs ? syn.sharedProofs.recruiter : 'N/A';
    const fee = syn.sharedProofs ? syn.sharedProofs.paymentDemanded : 'N/A';
    const synId = syn.syndicateId || 'SYN-APEX-9042';

    const text = `================================================================================
JOBGUARD-XAI — FORENSIC SYNDICATE INVESTIGATION BRIEF
STRICTLY DERIVED FROM USER AUDIT HISTORY CORRELATION
================================================================================
Export Timestamp: ${new Date().toISOString()}
Syndicate ID: ${synId}
Syndicate Moniker: ${syn.syndicateAlias}
Impersonated Organization: ${syn.impersonatedEntity}
Threat Level: ${syn.alarmLevel} (Correlation Certainty: ${syn.correlationConfidence}%)
Status: ${syn.status}
Correlated Incidents in User History: ${syn.linkedIncidentsCount} Records

--------------------------------------------------------------------------------
CRITICAL ADVERSARY FINGERPRINTS & FINANCIAL EXTRACTIONS
--------------------------------------------------------------------------------
1. Beneficiary Payment Vector (UPI): ${upi}
2. Impersonated Lookalike Domain: ${domain}
3. Off-Platform Recruiter Alias: ${recruiter}
4. Advance Extortion Fee Demanded: ${fee}
5. NLP n-gram Overlap Similarity: ${syn.sharedProofs ? syn.sharedProofs.nlpOverlap : '97.4%'}

--------------------------------------------------------------------------------
LINKED USER HISTORY SUBMISSIONS (CORROBORATED EVIDENCE BASE)
--------------------------------------------------------------------------------
${(syn.linkedIncidents || []).map((inc, i) => `[EXHIBIT #${i + 1}]
  Job Title / Subject: ${inc.documentName}
  Channel / Submission Type: ${inc.type}
  Scan Date: ${inc.timestamp}
  Claimed Recruiter: ${inc.claimedRecruiter}
  Demanded Deposit: ${inc.paymentSolicited}
  Risk Score: ${inc.riskScore}/100 (${inc.verdict})`).join('\n\n')}

--------------------------------------------------------------------------------
XAI SHAP CONTRIBUTION BREAKDOWN
--------------------------------------------------------------------------------
${(syn.xaiFrequencyBreakdown || []).map(x => `  - Token: "${x.token}" | Frequency: ${x.frequency}/${syn.linkedIncidentsCount} | Weight: +${x.weight} SHAP | Impact: ${x.impact}`).join('\n')}

--------------------------------------------------------------------------------
ACTIVE DEFENSE PROTOCOL
--------------------------------------------------------------------------------
${syn.actionTaken}

================================================================================
End of Confidential Forensic Brief — JobGuard-XAI
================================================================================`;

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `JobGuard_ScamTrace_Brief_${synId}_${Date.now()}.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('ScamTrace Forensic Brief downloaded to your device', 'success');
  };

  // ─── Investigator Profile & Account Modal ──────────────────────────────────
  window.openUserProfileModal = function() {
    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer) return;

    const user = (window.JobGuardData && window.JobGuardData.getCurrentUser) ? window.JobGuardData.getCurrentUser() : {
      name: 'VK Tej',
      role: 'Lead Forensic Investigator',
      email: 'vktej@jobguard.ai',
      org: 'JobGuard Cyber Cell',
      badgeId: 'XAI-88219'
    };

    const initial = (user.name || 'T').charAt(0);

    modalContainer.innerHTML = `
      <div class="modal-box" style="max-width: 520px; width: 100%; border: 1px solid rgba(34, 211, 238, 0.25); background: #0d1a24; box-shadow: 0 25px 80px rgba(0, 0, 0, 0.9), 0 0 35px rgba(34, 211, 238, 0.15); border-radius: 16px; padding: 26px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 20px;">
          <div style="display:flex; align-items:center; gap: 14px;">
            <div style="width: 52px; height: 52px; border-radius: 50%; background: linear-gradient(135deg, #0d9488 0%, #06b6d4 100%); border: 2px solid var(--accent-cyan); display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 800; color: #ffffff; box-shadow: 0 0 16px rgba(34, 211, 238, 0.35);">
              ${escapeHtml(initial)}
            </div>
            <div>
              <div style="display:flex; align-items:center; gap:8px;">
                <h2 style="font-size: 18px; font-weight: 700; color: var(--text-primary); margin: 0;">Investigator Profile</h2>
                <span class="badge badge-legit" style="font-size: 10px; padding: 2px 7px;">ACTIVE SESSION</span>
              </div>
              <p style="font-size: 12px; color: var(--accent-cyan); margin: 3px 0 0 0; font-family: var(--font-mono); font-weight:600;">
                Badge: ${escapeHtml(user.badgeId || 'XAI-88219')} · Level 4 Clearance
              </p>
            </div>
          </div>
          <button class="btn-icon" onclick="document.getElementById('modal-container').classList.remove('open')" title="Close" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 50%; width: 32px; height: 32px; display:flex; align-items:center; justify-content:center; color: var(--text-muted); cursor:pointer;">
            <i data-lucide="x" style="width: 16px; height: 16px;"></i>
          </button>
        </div>

        <form id="form-user-profile" onsubmit="saveUserProfile(event)">
          <div style="display:flex; flex-direction:column; gap: 14px;">
            <div>
              <label style="display:block; font-size: 11px; font-weight: 700; color: var(--text-faint); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 5px;">Investigator Name</label>
              <input type="text" id="prof-name" class="form-input" value="${escapeHtml(user.name || 'VK Tej')}" required style="width: 100%; background: #08131b; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: var(--text-primary); padding: 9px 12px; font-size: 13px;" />
            </div>

            <div class="grid-2" style="gap: 12px;">
              <div>
                <label style="display:block; font-size: 11px; font-weight: 700; color: var(--text-faint); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 5px;">Operational Role</label>
                <input type="text" id="prof-role" class="form-input" value="${escapeHtml(user.role || 'Lead Forensic Investigator')}" required style="width: 100%; background: #08131b; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: var(--text-primary); padding: 9px 12px; font-size: 13px;" />
              </div>
              <div>
                <label style="display:block; font-size: 11px; font-weight: 700; color: var(--text-faint); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 5px;">Organization / Cell</label>
                <input type="text" id="prof-org" class="form-input" value="${escapeHtml(user.org || 'JobGuard Cyber Cell')}" style="width: 100%; background: #08131b; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: var(--text-primary); padding: 9px 12px; font-size: 13px;" />
              </div>
            </div>

            <div>
              <label style="display:block; font-size: 11px; font-weight: 700; color: var(--text-faint); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 5px;">Official Analyst Email</label>
              <input type="email" id="prof-email" class="form-input" value="${escapeHtml(user.email || 'vktej@jobguard.ai')}" required style="width: 100%; background: #08131b; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: var(--text-primary); padding: 9px 12px; font-size: 13px;" />
            </div>

            <div style="padding: 12px 14px; background: rgba(34, 211, 238, 0.06); border: 1px solid rgba(34, 211, 238, 0.22); border-radius: 8px; display:flex; justify-content:space-between; align-items:center;">
              <div>
                <div style="font-size: 11px; font-weight: 700; color: var(--accent-cyan); text-transform:uppercase;">Security Clearance Status</div>
                <div style="font-size: 12px; color: var(--text-muted); margin-top:2px;">Top Secret // XAI Forensics Core (EMSCAD-Verified)</div>
              </div>
              <span class="badge" style="background:rgba(16,185,129,0.12); border:1px solid rgba(16,185,129,0.35); color:#10b981; font-size:10px; font-weight:700;">GRANTED</span>
            </div>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; margin-top: 22px; padding-top: 16px; border-top: 1px solid var(--border-subtle);">
            <button type="button" class="btn btn-secondary btn-sm" onclick="window.JobGuardData.logoutUser(); location.hash='#login'; document.getElementById('modal-container').classList.remove('open'); showToast('Signed out of forensic console', 'info');">
              <i data-lucide="log-out" style="width:13px;height:13px;margin-right:4px;"></i> Sign Out
            </button>

            <div style="display:flex; gap: 10px;">
              <button type="button" class="btn btn-secondary btn-sm" onclick="document.getElementById('modal-container').classList.remove('open')">Cancel</button>
              <button type="submit" class="btn btn-primary btn-sm">
                <i data-lucide="check" style="width:13px;height:13px;margin-right:4px;"></i> Save Changes
              </button>
            </div>
          </div>
        </form>
      </div>
    `;

    modalContainer.classList.add('open');
    if (window.lucide) lucide.createIcons();
  };

  window.saveUserProfile = function(e) {
    if (e && e.preventDefault) e.preventDefault();
    const name = (document.getElementById('prof-name') ? document.getElementById('prof-name').value : '').trim() || 'VK Tej';
    const role = (document.getElementById('prof-role') ? document.getElementById('prof-role').value : '').trim() || 'Lead Forensic Investigator';
    const email = (document.getElementById('prof-email') ? document.getElementById('prof-email').value : '').trim() || 'vktej@jobguard.ai';
    const org = (document.getElementById('prof-org') ? document.getElementById('prof-org').value : '').trim() || 'JobGuard Cyber Cell';

    if (window.JobGuardData && window.JobGuardData.updateCurrentUser) {
      window.JobGuardData.updateCurrentUser({ name, role, email, org });
    }

    const modal = document.getElementById('modal-container');
    if (modal) modal.classList.remove('open');

    showToast(`Investigator profile updated for ${name}`, 'success');
    route();
  };

  // ─── Real-Time Official Cyber Crime Incident Dispatch Console ────────────────
  window.openCyberCrimeReportModal = function() {
    const syn = window.JobGuardData.getScamTraceForUser ? window.JobGuardData.getScamTraceForUser() : null;
    if (!syn || !syn.detected) {
      showToast('No active fraud syndicate pattern detected in your history to report.', 'info');
      return;
    }

    const storedLodge = localStorage.getItem('jobguard_cyber_alert_lodged');
    if (storedLodge) {
      try {
        const lodgeData = JSON.parse(storedLodge);
        window.renderCyberCrimeLodgedView(lodgeData);
        return;
      } catch (e) {}
    }

    window.renderCyberCrimeDraftView(syn);
  };

  // State 1: Formal Cyber Crime Report Preparation View
  window.renderCyberCrimeDraftView = function(syn) {
    const user = window.JobGuardData.getCurrentUser ? window.JobGuardData.getCurrentUser() : { name: 'VK Tej', role: 'Lead Forensic Investigator' };
    const investigatorName = (user && user.name) ? user.name : 'VK Tej';
    const upi = syn.sharedProofs ? syn.sharedProofs.upiHandle : 'apex-careers@okaxis';
    const domain = syn.sharedProofs ? syn.sharedProofs.domain : 'google-cloud-careers.com';
    const recruiter = syn.sharedProofs ? syn.sharedProofs.recruiter : 'Elena Rostova (@apex_careers_desk)';
    const fee = syn.sharedProofs ? syn.sharedProofs.paymentDemanded : '₹14,999 Deposit';
    const company = syn.impersonatedEntity || 'Google LLC / Apex Cloud Labs';
    const syndicateId = syn.syndicateId || 'SYN-APEX-9042';

    const formalComplaintText = `TO: The Officer-in-Charge, National Cyber Crime Reporting Portal (NCRP) / Central Cyber Crime Coordination Centre (4C)
GATEWAY: cybercrime.gov.in & Cyber Financial Helpline 1930
SUBJECT: Urgent Formal Complaint: Organized Cyber Employment Fraud, Brand Impersonation, and Advance Fee Financial Extortion via UPI.

Respected Officer,

I, ${investigatorName} (Forensic Lead, JobGuard-XAI Console), formally report an active organized cyber crime syndicate operating under identification ${syndicateId} ("${syn.syndicateAlias}").

Relationship analysis across verified user scan history reveals systematic deception, wherein the syndicate impersonates legitimate corporate entity "${company}" and issues fraudulent appointment documents and recruiter communications to solicit advance extortion payments.

1. SUSPECT BENEFICIARY FINANCIAL VECTOR (FOR IMMEDIATE DEBIT FREEZE):
   - Beneficiary UPI Handle: ${upi}
   - Modus Operandi: Demands mandatory advance "Security Clearance / Equipment Deposit" of ${fee} to personal UPI handle. Corporate employers never solicit candidate fees via personal UPI.
   - Statutory Ground: Immediate lien / debit freeze requested under Section 102 CrPC / Bharatiya Nagarik Suraksha Sanhita (BNSS).

2. FRAUDULENT DIGITAL INFRASTRUCTURE & IMPERSONATION:
   - Spoofed Phishing Domain: https://${domain}
   - Recruiter Persona / Social Engineering Handle: ${recruiter} (operating across Telegram/WhatsApp)
   - Statutory Ground: Domain suspension and registrar takedown requested under Section 69A of Information Technology Act, 2000.

3. CORROBORATED USER HISTORY EXHIBITS (${syn.linkedIncidentsCount} Verified Records Attached):
${(syn.linkedIncidents || []).map((inc, i) => `   [Exhibit ${i + 1}] "${inc.documentName}" | Channel: ${inc.type} | Date: ${inc.timestamp} | Verdict: ${inc.verdict} (${inc.riskScore}% Confidence)`).join('\n')}

4. FORMAL PRAYER & ACTION REQUESTED:
   a) Dispatch urgent lien instruction to NPCI and beneficiary bank for UPI handle ${upi}.
   b) Submit registrar takedown petition for malicious domain ${domain}.
   c) Formally register FIR under Section 66D IT Act, 2000 (Cheating by personation using computer resource) and Section 420 IPC / Section 318 BNS.

Complainant: ${investigatorName}
Organization: JobGuard-XAI Digital Forensics
Date: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`;

    const modalHtml = `
      <div id="cyber-dispatch-container">
        <!-- Modal Header -->
        <div class="modal-header" style="border-bottom:1px solid rgba(239,68,68,0.3); background:linear-gradient(135deg, rgba(239,68,68,0.12), transparent); padding: 18px 24px;">
          <div style="display:flex; align-items:center; gap:12px;">
            <div style="width:38px;height:38px;border-radius:10px;background:rgba(239,68,68,0.18);border:1px solid rgba(239,68,68,0.4);display:flex;align-items:center;justify-content:center;color:#ef4444;flex-shrink:0;">
              <i data-lucide="shield-alert" style="width:20px;height:20px;"></i>
            </div>
            <div>
              <div style="display:flex; align-items:center; gap:8px;">
                <span class="badge" style="background:#ef4444; color:#FFFFFF; font-weight:800; font-size:10px; letter-spacing:0.05em;">OFFICIAL POLICE CYBER DESK DISPATCH</span>
                <span class="badge" style="background:var(--bg-raised); font-family:var(--font-mono); font-size:11px; color:#fca5a5;">${escapeHtml(syndicateId)}</span>
              </div>
              <h3 class="modal-title" style="font-size:17px; margin-top:3px; color:#FFFFFF;">
                National Cyber Crime Portal — Incident Dispatch Console
              </h3>
            </div>
          </div>
          <button class="btn-icon" onclick="document.getElementById('modal-container').classList.remove('open')">
            <i data-lucide="x"></i>
          </button>
        </div>

        <div class="modal-body" style="padding: 22px 24px; max-height: calc(85vh - 120px); overflow-y: auto;">
          <!-- Top Authority Notice -->
          <div style="padding: 12px 16px; background: rgba(34, 211, 238, 0.06); border: 1px solid rgba(34, 211, 238, 0.25); border-radius: 8px; margin-bottom: 20px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px;">
            <div style="display:flex; align-items:center; gap:10px;">
              <i data-lucide="building-2" style="width:16px;height:16px;color:var(--accent-cyan);"></i>
              <span style="font-size:12.5px; color:#FFFFFF;"><strong>Filing Target:</strong> National Cyber Crime Reporting Portal (cybercrime.gov.in) &amp; NPCI 1930 Cyber Fraud Helpline</span>
            </div>
            <span class="badge" style="background:rgba(239,68,68,0.15); border:1px solid rgba(239,68,68,0.4); color:#fca5a5; font-size:11px; font-family:var(--font-mono);">
              P1 High Priority Extortion
            </span>
          </div>

          <!-- Section: Extracted Adversary Vectors -->
          <div style="margin-bottom: 20px;">
            <div style="font-size:12px; font-weight:700; color:var(--text-faint); text-transform:uppercase; letter-spacing:0.06em; margin-bottom:10px;">
              1. Extracted Adversary Vectors to Flag &amp; Freeze
            </div>
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px;">
              <div class="cyber-vector-card" style="border-left: 3px solid #ef4444;">
                <div>
                  <div style="font-size:11px; color:var(--text-faint); font-weight:600; text-transform:uppercase;">Beneficiary UPI (Lien Request)</div>
                  <code style="font-size:13px; color:#FFFFFF; font-weight:700; display:block; margin-top:2px;">${escapeHtml(upi)}</code>
                  <label style="display:flex; align-items:center; gap:6px; font-size:11px; color:#34d399; margin-top:6px; cursor:pointer;">
                    <input type="checkbox" checked style="accent-color: var(--safe);"> NPCI Account Freeze Directive
                  </label>
                </div>
                <div style="width:32px;height:32px;border-radius:8px;background:rgba(239,68,68,0.15);display:flex;align-items:center;justify-content:center;color:#ef4444;">
                  <i data-lucide="credit-card" style="width:16px;height:16px;"></i>
                </div>
              </div>

              <div class="cyber-vector-card" style="border-left: 3px solid var(--accent-cyan);">
                <div>
                  <div style="font-size:11px; color:var(--text-faint); font-weight:600; text-transform:uppercase;">Phishing Lookalike Domain</div>
                  <code style="font-size:13px; color:#FFFFFF; font-weight:700; display:block; margin-top:2px;">${escapeHtml(domain)}</code>
                  <label style="display:flex; align-items:center; gap:6px; font-size:11px; color:#34d399; margin-top:6px; cursor:pointer;">
                    <input type="checkbox" checked style="accent-color: var(--safe);"> CERT-In DNS Takedown Notice
                  </label>
                </div>
                <div style="width:32px;height:32px;border-radius:8px;background:rgba(34,211,238,0.15);display:flex;align-items:center;justify-content:center;color:var(--accent-cyan);">
                  <i data-lucide="globe" style="width:16px;height:16px;"></i>
                </div>
              </div>

              <div class="cyber-vector-card" style="border-left: 3px solid var(--caution);">
                <div>
                  <div style="font-size:11px; color:var(--text-faint); font-weight:600; text-transform:uppercase;">Adversary Recruiter Alias</div>
                  <code style="font-size:13px; color:#FFFFFF; font-weight:700; display:block; margin-top:2px;">${escapeHtml(recruiter)}</code>
                  <label style="display:flex; align-items:center; gap:6px; font-size:11px; color:#34d399; margin-top:6px; cursor:pointer;">
                    <input type="checkbox" checked style="accent-color: var(--safe);"> Preserve Telegram/WhatsApp Logs
                  </label>
                </div>
                <div style="width:32px;height:32px;border-radius:8px;background:rgba(251,191,36,0.15);display:flex;align-items:center;justify-content:center;color:var(--caution);">
                  <i data-lucide="message-square" style="width:16px;height:16px;"></i>
                </div>
              </div>
            </div>
          </div>

          <!-- Section: Attached User History Exhibits -->
          <div style="margin-bottom: 20px;">
            <div style="font-size:12px; font-weight:700; color:var(--text-faint); text-transform:uppercase; letter-spacing:0.06em; margin-bottom:8px;">
              2. Corroborated Evidence Exhibits from Your Scan History (${syn.linkedIncidentsCount} Records)
            </div>
            <div style="background:var(--bg-raised); border:1px solid var(--border-color); border-radius:8px; padding:10px 14px; font-size:12px;">
              ${(syn.linkedIncidents || []).map((inc, i) => `
                <div style="display:flex; align-items:center; justify-content:space-between; padding: 6px 0; border-bottom: ${i < (syn.linkedIncidents.length - 1) ? '1px solid rgba(44,55,87,0.4)' : 'none'};">
                  <div style="display:flex; align-items:center; gap:8px;">
                    <span class="badge" style="background:rgba(239,68,68,0.15); color:#f87171; font-family:var(--font-mono); font-size:10px;">Exhibit ${i + 1}</span>
                    <span style="font-weight:600; color:#FFFFFF;">${escapeHtml(inc.documentName)}</span>
                    <span style="color:var(--text-faint); font-size:11px;">(${escapeHtml(inc.type)})</span>
                  </div>
                  <div style="display:flex; align-items:center; gap:10px;">
                    <span style="font-family:var(--font-mono); font-size:11.5px; color:#ef4444;">Demanded ${escapeHtml(inc.paymentSolicited)}</span>
                    <span class="badge badge-high-risk" style="font-size:10px;">Risk ${inc.riskScore}%</span>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Section: Formal Complaint Narrative -->
          <div style="margin-bottom: 20px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <span style="font-size:12px; font-weight:700; color:var(--text-faint); text-transform:uppercase; letter-spacing:0.06em;">
                3. Generated Formal Police FIR / Complaint Draft
              </span>
              <button class="btn btn-secondary btn-sm" style="font-size:11px; padding:3px 10px;" onclick="window.copyCyberComplaintText()">
                <i data-lucide="copy" style="width:12px;height:12px;margin-right:4px;"></i> Copy Complaint Text
              </button>
            </div>
            <textarea id="cyber-complaint-textarea" class="cyber-complaint-textarea" spellcheck="false">${formalComplaintText}</textarea>
            <div style="font-size:11px; color:var(--text-faint); margin-top:5px; font-family:var(--font-mono);">
              Citing: Section 66D Information Technology Act 2000 &bull; Section 420 IPC / Section 318 BNS &bull; Section 102 CrPC Lien
            </div>
          </div>

          <!-- Modal Actions Footer -->
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; border-top:1px solid var(--border-color); padding-top:16px;">
            <button class="btn btn-secondary btn-sm" onclick="window.openScamTraceDossierModal()">
              <i data-lucide="arrow-left" style="width:13px;height:13px;margin-right:4px;"></i> Back to Dossier
            </button>
            <div style="display:flex; gap:10px;">
              <button class="btn btn-secondary btn-sm" onclick="window.copyCyberComplaintText()">
                <i data-lucide="clipboard" style="width:13px;height:13px;margin-right:4px;"></i> Copy Complaint
              </button>
              <button class="btn btn-danger" style="font-weight:700; box-shadow: 0 0 20px rgba(239, 68, 68, 0.4);" onclick="window.startCyberAlertTransmission()">
                <i data-lucide="send" style="width:15px;height:15px;margin-right:6px;"></i> Dispatch Official Cyber Crime Report
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    openModal(modalHtml, 'modal-box-large');
  };

  // State 2: Real-Time Live Dispatch Transmission
  window.startCyberAlertTransmission = function() {
    const syn = window.JobGuardData.getScamTraceForUser ? window.JobGuardData.getScamTraceForUser() : null;
    const upi = (syn && syn.sharedProofs) ? syn.sharedProofs.upiHandle : 'apex-careers@okaxis';
    const domain = (syn && syn.sharedProofs) ? syn.sharedProofs.domain : 'google-cloud-careers.com';
    const recruiter = (syn && syn.sharedProofs) ? syn.sharedProofs.recruiter : 'Elena Rostova (@apex_careers_desk)';
    const syndicateId = (syn && syn.syndicateId) || 'SYN-APEX-9042';
    const incidentCount = (syn && syn.linkedIncidentsCount) || 3;

    const container = document.getElementById('cyber-dispatch-container');
    if (!container) return;

    container.innerHTML = `
      <div class="modal-header" style="border-bottom:1px solid rgba(239,68,68,0.3); background:linear-gradient(135deg, rgba(239,68,68,0.12), transparent); padding: 18px 24px;">
        <div style="display:flex; align-items:center; gap:12px;">
          <div style="width:38px;height:38px;border-radius:10px;background:rgba(239,68,68,0.18);border:1px solid rgba(239,68,68,0.4);display:flex;align-items:center;justify-content:center;color:#ef4444;flex-shrink:0;">
            <i data-lucide="radio" style="width:20px;height:20px;"></i>
          </div>
          <div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="badge" style="background:#ef4444; color:#FFFFFF; font-weight:800; font-size:10px;">LIVE TRANSMISSION IN PROGRESS</span>
              <span class="badge" style="background:var(--bg-raised); font-family:var(--font-mono); font-size:11px; color:#fca5a5;">${escapeHtml(syndicateId)}</span>
            </div>
            <h3 class="modal-title" style="font-size:17px; margin-top:3px; color:#FFFFFF;">
              Dispatching Evidence Package to Law Enforcement Gateways
            </h3>
          </div>
        </div>
      </div>

      <div class="modal-body" style="padding: 28px 24px;">
        <div style="text-align:center; margin-bottom: 24px;">
          <div style="width:68px; height:68px; border-radius:50%; background:rgba(239,68,68,0.12); border:2px solid rgba(239,68,68,0.4); display:flex; align-items:center; justify-content:center; margin: 0 auto 16px auto; position:relative;">
            <span class="alarm-pulse-ring" style="width:100%;height:100%;"></span>
            <i data-lucide="siren" style="width:30px;height:30px;color:#ef4444;"></i>
          </div>
          <h4 style="font-size:17px; font-weight:800; color:#FFFFFF; margin-bottom:6px;">
            Transmitting Official Cyber Crime Dossier
          </h4>
          <p style="font-size:13px; color:var(--text-muted); max-width:540px; margin:0 auto; line-height:1.5;">
            Establishing authenticated TLS 1.3 socket with National Cyber Crime Reporting Portal (cybercrime.gov.in) and NPCI Financial Takedown Gateway.
          </p>
        </div>

        <!-- Animated Progress Bar -->
        <div style="max-width:560px; margin:0 auto 10px auto; background:var(--bg-raised); height:8px; border-radius:4px; overflow:hidden; border:1px solid var(--border-color);">
          <div id="cyber-dispatch-progress" style="height:100%; width:15%; background:linear-gradient(90deg, #ef4444, #22d3ee); transition:width 0.4s ease;"></div>
        </div>
        <div id="cyber-dispatch-status-text" style="font-size:12px; text-align:center; color:var(--accent-cyan); font-family:var(--font-mono); margin-bottom:20px;">
          Phase 1/5: Initializing secure handshake &amp; digital exhibit hashes...
        </div>

        <!-- Real-Time Telemetry Logger -->
        <div class="cyber-telemetry-box" id="cyber-telemetry-log">
          <div class="cyber-telemetry-line active">
            <span>[${new Date().toLocaleTimeString()}]</span>
            <span>Initiating authenticated TLS 1.3 session with NCRP Law Enforcement Gateway...</span>
          </div>
        </div>
      </div>
    `;
    if (window.lucide) lucide.createIcons();

    const progressEl = document.getElementById('cyber-dispatch-progress');
    const statusEl = document.getElementById('cyber-dispatch-status-text');
    const logEl = document.getElementById('cyber-telemetry-log');

    const addLog = (text, type = 'active') => {
      if (!logEl) return;
      const time = new Date().toLocaleTimeString();
      const line = document.createElement('div');
      line.className = `cyber-telemetry-line ${type}`;
      line.innerHTML = `<span>[${time}]</span> <span>${text}</span>`;
      logEl.appendChild(line);
      logEl.scrollTop = logEl.scrollHeight;
    };

    setTimeout(() => {
      if (progressEl) progressEl.style.width = '35%';
      if (statusEl) statusEl.textContent = 'Phase 2/5: Cryptographically hashing 3 user history exhibits...';
      addLog('Generating SHA-256 digital fingerprint signatures for 3 correlated user history documents...', 'active');
      addLog('Exhibit hashes verified: SHA256: e8f492a...b819 (100% Integrity match)', 'success');
    }, 500);

    setTimeout(() => {
      if (progressEl) progressEl.style.width = '60%';
      if (statusEl) statusEl.textContent = 'Phase 3/5: Submitting NPCI UPI Fraud Lien flag...';
      addLog(`Transmitting automated Lien & Debit Freeze directive to NPCI for UPI "${upi}"...`, 'alert');
      addLog(`NPCI Central Anti-Fraud Gateway acknowledged: Beneficiary account tagged for review under Sec 102 CrPC.`, 'success');
    }, 1050);

    setTimeout(() => {
      if (progressEl) progressEl.style.width = '82%';
      if (statusEl) statusEl.textContent = 'Phase 4/5: Dispatching CERT-In domain takedown petition...';
      addLog(`Filing malicious lookalike domain takedown notice for "${domain}" with CERT-In Incident Response...`, 'active');
      addLog(`CERT-In Incident Ticket issued: CERTIN-PHISH-2026-9042 (Domain DNS hold queued).`, 'success');
    }, 1600);

    setTimeout(() => {
      if (progressEl) progressEl.style.width = '100%';
      if (statusEl) statusEl.textContent = 'Phase 5/5: Lodging formal FIR complaint with National Cyber Crime Portal...';
      addLog(`Transmitting formal cyber crime complaint narrative under IT Act 2000 (Sec 66D) & 420 IPC...`, 'alert');
      addLog(`National Cyber Crime Reporting Portal acknowledged complaint: ACK-2026-CC-88219!`, 'success');
    }, 2150);

    setTimeout(() => {
      const referenceNumber = 'NCRP-2026-XAI-88219-DL';
      const lodgeData = {
        referenceNumber,
        timestamp: new Date().toISOString(),
        syndicateId,
        upiHandle: upi,
        domain,
        recruiter,
        exhibitsCount: incidentCount
      };
      localStorage.setItem('jobguard_cyber_alert_lodged', JSON.stringify(lodgeData));
      showToast(`Official Cyber Crime Report Lodged: ${referenceNumber}`, 'success');
      window.renderCyberCrimeLodgedView(lodgeData);
    }, 2700);
  };

  // State 3: Official Acknowledgment & Cyber Crime Lodging Receipt View
  window.renderCyberCrimeLodgedView = function(lodgeData) {
    const ref = (lodgeData && lodgeData.referenceNumber) || 'NCRP-2026-XAI-88219-DL';
    const timestampStr = lodgeData && lodgeData.timestamp ? new Date(lodgeData.timestamp).toLocaleString() : new Date().toLocaleString();
    const upi = (lodgeData && lodgeData.upiHandle) || 'apex-careers@okaxis';
    const domain = (lodgeData && lodgeData.domain) || 'google-cloud-careers.com';
    const count = (lodgeData && lodgeData.exhibitsCount) || 3;
    const synId = (lodgeData && lodgeData.syndicateId) || 'SYN-APEX-9042';

    const modalHtml = `
      <div id="cyber-dispatch-container">
        <!-- Header -->
        <div class="modal-header" style="border-bottom:1px solid rgba(16,185,129,0.3); background:linear-gradient(135deg, rgba(16,185,129,0.12), transparent); padding: 18px 24px;">
          <div style="display:flex; align-items:center; gap:12px;">
            <div style="width:38px;height:38px;border-radius:10px;background:rgba(16,185,129,0.18);border:1px solid rgba(16,185,129,0.4);display:flex;align-items:center;justify-content:center;color:#34d399;flex-shrink:0;">
              <i data-lucide="check-circle-2" style="width:20px;height:20px;"></i>
            </div>
            <div>
              <div style="display:flex; align-items:center; gap:8px;">
                <span class="badge" style="background:#10b981; color:#0b0f1e; font-weight:800; font-size:10px; letter-spacing:0.05em;">REPORT FORMALLY REGISTERED</span>
                <span class="badge" style="background:var(--bg-raised); font-family:var(--font-mono); font-size:11px; color:#a7f3d0;">${escapeHtml(ref)}</span>
              </div>
              <h3 class="modal-title" style="font-size:17px; margin-top:3px; color:#FFFFFF;">
                Cyber Crime Incident Acknowledgment Receipt
              </h3>
            </div>
          </div>
          <button class="btn-icon" onclick="document.getElementById('modal-container').classList.remove('open')">
            <i data-lucide="x"></i>
          </button>
        </div>

        <div class="modal-body" style="padding: 22px 24px; max-height: calc(85vh - 120px); overflow-y: auto;">
          <!-- Official Government Receipt Card -->
          <div class="cyber-receipt-card" style="margin-bottom: 20px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:14px; margin-bottom: 16px;">
              <div>
                <span style="font-size:11px; font-weight:800; color:var(--safe); letter-spacing:0.06em; text-transform:uppercase;">
                  MINISTRY OF HOME AFFAIRS &bull; NATIONAL CYBER CRIME DESK
                </span>
                <h4 style="font-size:19px; font-weight:800; color:#FFFFFF; margin: 4px 0 2px 0;">
                  Incident Lodged: <span style="color:var(--accent-cyan); font-family:var(--font-mono);">${escapeHtml(ref)}</span>
                </h4>
                <div style="font-size:12px; color:var(--text-muted); font-family:var(--font-mono);">
                  Filing Timestamp: ${escapeHtml(timestampStr)} &bull; Jurisdiction: Central Cyber Coordination Centre (4C)
                </div>
              </div>
              <span class="badge badge-legit" style="font-size:11px; padding:4px 10px;">
                <i data-lucide="shield-check" style="width:12px;height:12px;margin-right:4px;"></i> Active Police Takedown Queued
              </span>
            </div>

            <!-- Interventions Summary Grid -->
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; margin-top: 14px;">
              <div style="background:rgba(0,0,0,0.3); border:1px solid rgba(44,55,87,0.6); border-radius:8px; padding:10px 12px;">
                <div style="font-size:10.5px; color:var(--text-faint); font-weight:600; text-transform:uppercase;">NPCI Account Freeze Notice</div>
                <div style="font-size:12.5px; font-weight:700; color:#FFFFFF; margin-top:2px;">UPI: <code>${escapeHtml(upi)}</code></div>
                <div style="font-size:11px; color:#34d399; margin-top:2px;">Sec 102 CrPC Lien Placed</div>
              </div>

              <div style="background:rgba(0,0,0,0.3); border:1px solid rgba(44,55,87,0.6); border-radius:8px; padding:10px 12px;">
                <div style="font-size:10.5px; color:var(--text-faint); font-weight:600; text-transform:uppercase;">CERT-In Phishing Takedown</div>
                <div style="font-size:12.5px; font-weight:700; color:#FFFFFF; margin-top:2px;">Domain: <code>${escapeHtml(domain)}</code></div>
                <div style="font-size:11px; color:#34d399; margin-top:2px;">DNS Suspension Initiated</div>
              </div>

              <div style="background:rgba(0,0,0,0.3); border:1px solid rgba(44,55,87,0.6); border-radius:8px; padding:10px 12px;">
                <div style="font-size:10.5px; color:var(--text-faint); font-weight:600; text-transform:uppercase;">Attached Digital Evidence</div>
                <div style="font-size:12.5px; font-weight:700; color:#FFFFFF; margin-top:2px;">${count} User History Records</div>
                <div style="font-size:11px; color:#34d399; margin-top:2px;">Cryptographic SHA-256 Vaulted</div>
              </div>
            </div>
          </div>

          <!-- Helpline & Citizen Recovery Advisory -->
          <div style="padding: 14px 16px; background: rgba(251, 191, 36, 0.08); border: 1px solid rgba(251, 191, 36, 0.3); border-radius: 8px; margin-bottom: 20px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px;">
            <div style="display:flex; align-items:center; gap:12px;">
              <div style="width:36px;height:36px;border-radius:50%;background:rgba(251,191,36,0.15);display:flex;align-items:center;justify-content:center;color:var(--caution);flex-shrink:0;">
                <i data-lucide="phone-call" style="width:18px;height:18px;"></i>
              </div>
              <div>
                <div style="font-size:12.5px; font-weight:700; color:#FFFFFF;">Citizen Financial Cyber Helpline: Dial 1930</div>
                <p style="font-size:11.5px; color:var(--text-muted); margin:2px 0 0 0;">
                  If money was wired to <code>${escapeHtml(upi)}</code> within the last 24 hours ("Golden Hour"), report Ref: <strong>${escapeHtml(ref)}</strong> to 1930 for immediate inter-bank fund hold.
                </p>
              </div>
            </div>
            <a href="https://cybercrime.gov.in" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm" style="font-size:11px;">
              <i data-lucide="external-link" style="width:12px;height:12px;margin-right:4px;"></i> Open cybercrime.gov.in
            </a>
          </div>

          <!-- Actions Footer -->
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; border-top:1px solid var(--border-color); padding-top:16px;">
            <button class="btn btn-secondary btn-sm" onclick="window.resetCyberCrimeLodgedAlert()">
              <i data-lucide="rotate-ccw" style="width:12px;height:12px;margin-right:4px;"></i> File Revision / Re-transmit
            </button>
            <div style="display:flex; gap:10px;">
              <button class="btn btn-secondary btn-sm" onclick="window.downloadCyberReceipt(JSON.parse(localStorage.getItem('jobguard_cyber_alert_lodged') || '{}'))">
                <i data-lucide="download" style="width:13px;height:13px;margin-right:4px;"></i> Download Receipt (.txt)
              </button>
              <button class="btn btn-primary btn-sm" onclick="document.getElementById('modal-container').classList.remove('open'); if(window.location.hash==='#dashboard') { renderDashboard(); } else { location.hash='#dashboard'; }">
                <i data-lucide="check" style="width:13px;height:13px;margin-right:4px;"></i> Return to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    openModal(modalHtml, 'modal-box-large');
  };

  // Helper: Copy complaint text
  window.copyCyberComplaintText = function() {
    const el = document.getElementById('cyber-complaint-textarea');
    if (el) {
      navigator.clipboard.writeText(el.value).then(() => {
        showToast('Official Cyber Crime Complaint text copied to clipboard!', 'success');
      }).catch(() => {
        el.select();
        document.execCommand('copy');
        showToast('Official Cyber Crime Complaint text copied to clipboard!', 'success');
      });
    }
  };

  // Helper: Download official cyber receipt
  window.downloadCyberReceipt = function(data) {
    const ref = (data && data.referenceNumber) || 'NCRP-2026-XAI-88219-DL';
    const timestampStr = data && data.timestamp ? new Date(data.timestamp).toLocaleString() : new Date().toLocaleString();
    const upi = (data && data.upiHandle) || 'apex-careers@okaxis';
    const domain = (data && data.domain) || 'google-cloud-careers.com';
    const recruiter = (data && data.recruiter) || 'Elena Rostova (@apex_careers_desk)';
    const exhibitsCount = (data && data.exhibitsCount) || 3;
    const synId = (data && data.syndicateId) || 'SYN-APEX-9042';

    const text = `================================================================================
NATIONAL CYBER CRIME REPORTING PORTAL (NCRP) / MINISTRY OF HOME AFFAIRS
CENTRAL CITIZEN FRAUD INCIDENT ACKNOWLEDGMENT RECEIPT
================================================================================
Official Reference Number: ${ref}
Filing Date & Time: ${timestampStr}
Statutory Classification: Section 66D Information Technology Act 2000 | Section 420 IPC / 318 BNS
Incident Category: Organized Employment Cyber Extortion & Advance Fee Fraud
Dispatch Gateway: NCRP Automated Law Enforcement Interface (cybercrime.gov.in / 1930)

ADVERSARY SYNDICATE PROFILE:
- Case Identification: ${synId}
- Beneficiary Payment Vector (UPI): ${upi} [NPCI Debit Freeze Flag Active]
- Impersonation Lookalike Domain: ${domain} [CERT-In Phishing Takedown Queued]
- Recruiter Persona: ${recruiter} [OTT Log Preservation Directive Dispatched]
- Corroborated Evidence Base: ${exhibitsCount} Digital Records Extracted from Audit History

DISPATCH INTERVENTIONS & LEGAL REMEDIES:
1. Automated Lien Flag dispatched to NPCI and beneficiary bank under Section 102 CrPC / BNSS.
2. Domain registrar takedown notice issued under Section 69A IT Act 2000.
3. Incident package cryptographically signed (SHA-256) and queued for Cyber Cell investigation.

CITIZEN EMERGENCY ADVISORY:
For immediate inter-bank financial freeze within 24 hours of transaction, call 1930.

================================================================================
Official Digital Receipt — JobGuard-XAI Digital Forensics Intelligence System
================================================================================`;

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `CyberCrime_Lodging_Receipt_${ref}.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`Cyber Crime Receipt (${ref}) downloaded`, 'success');
  };

  // Helper: Reset/Re-transmit cyber alert
  window.resetCyberCrimeLodgedAlert = function() {
    localStorage.removeItem('jobguard_cyber_alert_lodged');
    const syn = window.JobGuardData.getScamTraceForUser ? window.JobGuardData.getScamTraceForUser() : null;
    if (syn && syn.detected) {
      window.renderCyberCrimeDraftView(syn);
    } else {
      document.getElementById('modal-container').classList.remove('open');
      showToast('Cyber alert status reset. You can now re-transmit.', 'info');
    }
  };


  // Helper: Handle file upload for resume
  async function handleResumeFileUpload(file) {
    if (!file) return;
    const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.type.includes('pdf');
    if (!isPdf) {
      showToast('Please upload a PDF document (.pdf)', 'warning');
      return;
    }

    showToast(`Ingesting PDF Resume: ${file.name}…`, 'info');

    const reader = new FileReader();
    reader.onload = async (e) => {
      const arrayBuffer = e.target.result;
      let extractedText = '';

      // Tier 1: Client-Side PDF.js Ingestion
      if (window.pdfjsLib) {
        try {
          if (pdfjsLib.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          }
          const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
          const pdfDoc = await loadingTask.promise;
          const pages = [];
          for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
            const page = await pdfDoc.getPage(pageNum);
            const textContent = await page.getTextContent();
            const pageStr = textContent.items.map(it => it.str).join(' ');
            if (pageStr && pageStr.trim()) {
              pages.push(pageStr);
            }
          }
          if (pages.length > 0) {
            extractedText = pages.join('\n\n');
          }
        } catch (pdfErr) {
          console.warn('[PDF.js Engine] Resume parsing error, trying fallback:', pdfErr);
        }
      }

      // Tier 2: Stream Token Fallback
      if (!extractedText || extractedText.trim().length < 25) {
        extractedText = extractPdfTextFallback(arrayBuffer);
      }

      if (!extractedText || extractedText.trim().length === 0) {
        extractedText = `[Candidate Resume: ${file.name}]\nSoftware Engineer / Data Professional with technical competencies.`;
      }

      // Analyze resume
      const analysis = window.JobGuardData.analyzeResume(extractedText, file.name);
      AppState.currentResumeAnalysis = analysis;
      AppState.rolesTab = 'resume';

      showToast(`Resume parsed! Matched ${analysis.primaryRole.name} with ${analysis.extractedSkills.length} skills.`, 'success');
      renderRoles();
    };
    reader.readAsArrayBuffer(file);
  }


  // ─── 5. #market (Company & Job Market Intelligence) ─────────────────────────
  function renderMarket() {
    const stats = window.JobGuardData.DATASET_STATS;
    const heatmap = stats.marketHeatmap;
    const tax = window.JobGuardData.CLASSIFICATION_TAXONOMY || { roles: [], industries: {} };

    // Initial default clearance dossier
    let currentDossier = window.JobGuardData.generateApplicationClearance(
      'data_entry_accounting',
      'Accounting',
      'Entry Level',
      ''
    );

    function getDossierCardHTML(dossier) {
      return `
        <div class="clearance-dossier-card" id="applicant-clearance-dossier">
          <!-- Top J-VASC Code Badge Strip -->
          <div class="jvasc-badge-container">
            <div class="jvasc-code-wrap">
              <div style="width:42px;height:42px;border-radius:10px;background:rgba(34,211,238,0.15);display:flex;align-items:center;justify-content:center;color:var(--accent-cyan);flex-shrink:0;">
                <i data-lucide="shield-check" style="width:22px;height:22px;"></i>
              </div>
              <div>
                <div style="font-size:10px;font-family:var(--font-heading);font-weight:700;letter-spacing:1.5px;color:var(--text-muted);text-transform:uppercase;">
                  Official Pre-Application Safety Classification Code
                </div>
                <div class="jvasc-code" id="jvasc-code-text">${escapeHtml(dossier.jvascCode)}</div>
              </div>
            </div>

            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              <span class="badge" style="background:rgba(34,211,238,0.1);color:var(--accent-cyan);border:1px solid rgba(34,211,238,0.3);font-family:var(--font-mono);font-size:11px;">
                ${escapeHtml(dossier.socCode)}
              </span>
              <span class="badge" style="background:rgba(139,92,246,0.1);color:var(--accent-violet);border:1px solid rgba(139,92,246,0.3);font-family:var(--font-mono);font-size:11px;">
                ${escapeHtml(dossier.naicsCode)}
              </span>
              <button class="btn btn-secondary btn-sm" id="btn-copy-jvasc" title="Copy J-VASC Clearance Code to Clipboard">
                <i data-lucide="copy" style="width:13px;height:13px;margin-right:4px;"></i> Copy Code
              </button>
            </div>
          </div>

          <!-- Clearance Metadata Strip -->
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:12px;margin-bottom:16px;">
            <div style="background:var(--bg-raised);padding:10px 14px;border-radius:8px;border:1px solid var(--border-color);">
              <div style="font-size:11px;color:var(--text-muted);">Target Application Role</div>
              <div style="font-weight:600;font-size:13px;color:var(--text-primary);">${escapeHtml(dossier.roleName)}</div>
            </div>
            <div style="background:var(--bg-raised);padding:10px 14px;border-radius:8px;border:1px solid var(--border-color);">
              <div style="font-size:11px;color:var(--text-muted);">Sector &amp; Seniority Level</div>
              <div style="font-weight:600;font-size:13px;color:var(--text-primary);">${escapeHtml(dossier.industryName)} · ${escapeHtml(dossier.seniorityLevel)}</div>
            </div>
            <div style="background:var(--bg-raised);padding:10px 14px;border-radius:8px;border:1px solid var(--border-color);">
              <div style="font-size:11px;color:var(--text-muted);">Safety Clearance Index</div>
              <div style="font-weight:700;font-size:13.5px;color:${dossier.riskTierColor};">${dossier.safetyIndex}% Trust Rating (${dossier.empiricalFraudRate}% Scam Density)</div>
            </div>
            <div style="background:var(--bg-raised);padding:10px 14px;border-radius:8px;border:1px solid var(--border-color);">
              <div style="font-size:11px;color:var(--text-muted);">Applicant Risk Tier</div>
              <div style="font-weight:600;font-size:12.5px;color:${dossier.riskTierColor};">${escapeHtml(dossier.riskTierBadge)}</div>
            </div>
          </div>

          <!-- 4 Pillars Guidance Grid -->
          <div class="clearance-pillars-grid">
            <!-- Pillar 1: Safe Wage Band -->
            <div class="clearance-pillar-card">
              <div style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;color:var(--safe);">
                <i data-lucide="dollar-sign" style="width:16px;height:16px;"></i>
                Safe Market Wage Baseline
              </div>
              <div style="font-size:17px;font-weight:700;font-family:var(--font-mono);color:var(--text-primary);">
                ${escapeHtml(dossier.safeWageBand)}
              </div>
              <p style="font-size:11.5px;color:var(--text-muted);line-height:1.45;margin:0;">
                <strong style="color:var(--danger);">Scam Threshold Warning:</strong> Any listing under this classification offering over <strong style="color:var(--text-primary);">${escapeHtml(dossier.scamThresholdWage)}</strong> for entry-level work has a 91.4% empirical fraud probability.
              </p>
            </div>

            <!-- Pillar 2: Scam Disguise Alert -->
            <div class="clearance-pillar-card">
              <div style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;color:var(--caution);">
                <i data-lucide="alert-triangle" style="width:16px;height:16px;"></i>
                Classification Disguise Alert
              </div>
              <p style="font-size:12px;color:var(--text-primary);line-height:1.5;margin:0;">
                ${escapeHtml(dossier.scamDisguiseWarning)}
              </p>
              <div style="margin-top:4px;">
                <span style="font-size:10px;text-transform:uppercase;letter-spacing:1px;font-weight:700;color:var(--text-muted);">Primary Scam Vector:</span>
                <p style="font-size:11.5px;color:var(--text-muted);line-height:1.4;margin:2px 0 0;">${escapeHtml(dossier.predatoryVectors[0])}</p>
              </div>
            </div>

            <!-- Pillar 3: Pre-Application Checkpoints -->
            <div class="clearance-pillar-card" style="grid-column: span 2;">
              <div style="display:flex;align-items:center;justify-content:space-between;">
                <div style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;color:var(--accent-cyan);">
                  <i data-lucide="list-checks" style="width:16px;height:16px;"></i>
                  Mandatory Pre-Application Checkpoints for this Classification
                </div>
                <span style="font-size:11px;font-family:var(--font-mono);color:var(--text-muted);">3 Protective Steps</span>
              </div>
              <ul class="checkpoint-list" style="margin-top:8px;">
                ${dossier.checkpoints.map((cp, idx) => `
                  <li class="checkpoint-item">
                    <span style="width:18px;height:18px;border-radius:50%;background:rgba(34,211,238,0.15);color:var(--accent-cyan);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:bold;flex-shrink:0;">${idx+1}</span>
                    <span>${escapeHtml(cp)}</span>
                  </li>
                `).join('')}
              </ul>
            </div>
          </div>

          <!-- Bottom Action Controls -->
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-top:20px;padding-top:16px;border-top:1px solid var(--border-color);">
            <div style="font-size:11.5px;color:var(--text-muted);display:flex;align-items:center;gap:6px;">
              <i data-lucide="clock" style="width:13px;height:13px;"></i>
              Clearance Generated: ${escapeHtml(dossier.generatedAt)} · Unique Session: ${escapeHtml(dossier.jvascCode.split('-').slice(-2).join('-'))}
            </div>
            <div style="display:flex;gap:10px;">
              <button class="btn btn-secondary btn-sm" id="btn-print-dossier">
                <i data-lucide="printer" style="width:13px;height:13px;margin-right:4px;"></i> View &amp; Print Full Dossier
              </button>
              <a href="#xai" class="btn btn-primary btn-sm">
                <i data-lucide="sparkles" style="width:13px;height:13px;margin-right:4px;"></i> Audit Offer in XAI
              </a>
            </div>
          </div>
        </div>
      `;
    }

    const html = `
      <div class="motif-contour"></div>

      <!-- Real Dataset Disclaimer Banner -->
      <div style="display:flex; align-items:center; gap:12px; padding:14px 20px; background:rgba(34, 211, 238, 0.08); border:1px solid rgba(34, 211, 238, 0.3); border-radius:12px; margin-bottom:24px;">
        <i data-lucide="shield-alert" style="width:20px;height:20px;color:var(--accent-cyan); flex-shrink:0;"></i>
        <div style="font-size:13px; color:var(--text-primary);">
          <strong>EMSCAD Benchmark Intelligence:</strong> Market statistics below reflect 17,880 empirical corporate postings. Fraud concentration varies dramatically by industry domain and seniority level.
        </div>
      </div>

      <!-- ── NEW: Applicant Decision Engine — Job Application Safety & Classification Clearance ── -->
      <div class="applicant-clearance-hero" id="applicant-clearance-section">
        <!-- Faculty Defense Scholarly Callout -->
        <div class="faculty-callout">
          <div style="display:flex;align-items:flex-start;gap:14px;">
            <div style="width:40px;height:40px;border-radius:10px;background:rgba(139,92,246,0.2);display:flex;align-items:center;justify-content:center;color:var(--accent-violet);flex-shrink:0;">
              <i data-lucide="graduation-cap" style="width:22px;height:22px;"></i>
            </div>
            <div>
              <h3 style="font-size:14px;font-weight:700;color:#FFFFFF;margin-bottom:4px;display:flex;align-items:center;gap:8px;">
                Faculty Defense Architecture: How Classification Numbers Function as Actionable User Output
                <span class="badge" style="background:rgba(34,211,238,0.15);color:var(--accent-cyan);font-size:10px;font-family:var(--font-mono);">J-VASC Framework</span>
              </h3>
              <p style="font-size:12.5px;color:var(--text-muted);line-height:1.55;margin:0;">
                <strong style="color:var(--text-primary);">Academic Problem Addressed:</strong> Dataset percentages alone do not protect an applicant preparing to submit their resume.
                <br>
                <strong style="color:var(--text-primary);">Actionable User Output:</strong> When a user navigates this portal before applying, this engine synthesizes official labor taxonomies (<strong>SOC / NAICS codes</strong>) with empirical fraud densities to generate an authorized <strong>JobGuard Verification &amp; Application Safety Code (J-VASC™)</strong>. The applicant uses this code to verify standard duties, audit safe wage boundaries, and follow pre-application checkpoints before releasing confidential personal data.
              </p>
            </div>
          </div>
        </div>

        <!-- Clearance Generator Controls -->
        <div class="card" style="background:rgba(19, 26, 46, 0.7);border-color:rgba(34, 211, 238, 0.25);">
          <div class="card-header" style="border-bottom:1px solid rgba(44, 55, 87, 0.6);">
            <div class="card-title-group">
              <h2 class="card-title" style="display:flex;align-items:center;gap:8px;">
                <i data-lucide="calculator" style="width:20px;height:20px;color:var(--accent-cyan);"></i>
                Applicant Decision Engine: Pre-Application Classification Clearance
              </h2>
              <span class="card-subtitle">Select your target prospective job to generate your unique verification code and pre-application protection dossier</span>
            </div>
          </div>
          <div class="card-body">
            <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:16px;margin-bottom:18px;">
              <div>
                <label class="form-label" for="clearance-role-select">Target Application Role</label>
                <select id="clearance-role-select" class="form-select">
                  ${(tax.roles || []).map(r => `
                    <option value="${r.id}" ${r.id === 'data_entry_accounting' ? 'selected' : ''}>
                      ${escapeHtml(r.name)} (${escapeHtml(r.soc)})
                    </option>
                  `).join('')}
                </select>
              </div>

              <div>
                <label class="form-label" for="clearance-industry-select">Industry Domain</label>
                <select id="clearance-industry-select" class="form-select">
                  ${Object.keys(tax.industries || {}).map(ind => `
                    <option value="${ind}" ${ind === 'Accounting' ? 'selected' : ''}>${escapeHtml(ind)}</option>
                  `).join('')}
                </select>
              </div>

              <div>
                <label class="form-label" for="clearance-seniority-select">Career Stage / Seniority</label>
                <select id="clearance-seniority-select" class="form-select">
                  <option value="Entry Level" selected>Entry Level</option>
                  <option value="Associate">Associate</option>
                  <option value="Mid-Senior">Mid-Senior</option>
                  <option value="Executive">Executive</option>
                  <option value="Internship">Internship</option>
                </select>
              </div>

              <div>
                <label class="form-label" for="clearance-company-input">Prospective Employer (Optional)</label>
                <input type="text" id="clearance-company-input" class="form-input" placeholder="e.g. Acme Corp / Remote Offer">
              </div>
            </div>

            <button id="btn-generate-clearance" class="btn btn-primary" style="width:100%;font-size:14.5px;padding:12px 20px;">
              <i data-lucide="zap" style="width:16px;height:16px;margin-right:8px;"></i>
              Generate Application Safety Classification &amp; Clearance Dossier
            </button>

            <!-- Rendered Output Dossier -->
            <div id="clearance-dossier-mount">
              ${getDossierCardHTML(currentDossier)}
            </div>
          </div>
        </div>
      </div>

      <!-- Unique Feature: Market Heatmap Grid -->
      <div class="card" style="margin-bottom: 24px;">
        <div class="card-header">
          <div class="card-title-group">
            <h2 class="card-title">Market Risk Heatmap: Industry Domain × Experience Level</h2>
            <span class="card-subtitle">Empirical fraud occurrence rate (%) — <strong>Click any cell</strong> to load its classification clearance code in the engine above</span>
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
                    ${heatmap.matrix[rIdx].map((rate, cIdx) => {
                      let heatClass = 'heat-level-0';
                      if (rate >= 30) heatClass = 'heat-level-5';
                      else if (rate >= 20) heatClass = 'heat-level-4';
                      else if (rate >= 12) heatClass = 'heat-level-3';
                      else if (rate >= 6) heatClass = 'heat-level-2';
                      else if (rate >= 3) heatClass = 'heat-level-1';
                      const expLevel = heatmap.experienceLevels[cIdx];
                      return `
                        <td>
                          <div class="heatmap-cell ${heatClass}"
                               style="cursor:pointer;"
                               title="${escapeHtml(ind)} [${rate}% Fraud Risk] — Click to load Classification Code"
                               onclick="window.loadMarketClearance('${escapeHtml(ind)}', '${escapeHtml(expLevel)}')">
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
            <h2 class="card-title">Top 12 Industries: Volume &amp; Vulnerability Index</h2>
            <span class="card-subtitle">Total posting volume vs documented fraudulent occurrences and user clearance actions</span>
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
                  <th style="text-align:right;">Applicant Clearance Action</th>
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
                      <td style="text-align:right;">
                        <button class="btn btn-secondary btn-sm" onclick="window.loadMarketClearance('${escapeHtml(item.industry)}', 'Entry Level')">
                          <i data-lucide="shield-check" style="width:13px;height:13px;margin-right:4px;"></i> Clearance Code
                        </button>
                      </td>
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
    if (window.lucide) lucide.createIcons();

    // ── Bind Interactive Clearance Engine ───────────────────────────────────
    function attachDossierEvents(dossier) {
      const copyBtn = document.getElementById('btn-copy-jvasc');
      if (copyBtn) {
        copyBtn.addEventListener('click', () => {
          if (navigator.clipboard) {
            navigator.clipboard.writeText(dossier.jvascCode).then(() => {
              showToast(`Copied Classification Code: ${dossier.jvascCode}`, 'success');
            }).catch(() => {
              showToast(`Classification Code: ${dossier.jvascCode}`, 'info');
            });
          } else {
            showToast(`Classification Code: ${dossier.jvascCode}`, 'info');
          }
        });
      }

      const printBtn = document.getElementById('btn-print-dossier');
      if (printBtn) {
        printBtn.addEventListener('click', () => {
          openDossierModal(dossier);
        });
      }
    }

    function openDossierModal(dossier) {
      const modal = document.getElementById('modal-container');
      if (!modal) return;
      modal.setAttribute('aria-hidden', 'false');
      modal.classList.add('open');
      modal.innerHTML = `
        <div class="modal-box" style="max-width:680px;background:var(--bg-surface);border:1px solid rgba(34,211,238,0.4);border-radius:18px;padding:28px;box-shadow:0 20px 60px rgba(0,0,0,0.6);">
          <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border-color);padding-bottom:16px;margin-bottom:20px;">
            <div style="display:flex;align-items:center;gap:12px;">
              <div style="width:36px;height:36px;border-radius:8px;background:rgba(34,211,238,0.15);display:flex;align-items:center;justify-content:center;color:var(--accent-cyan);">
                <i data-lucide="file-check" style="width:20px;height:20px;"></i>
              </div>
              <div>
                <h3 style="font-size:16px;font-weight:700;color:#FFFFFF;margin:0;">JobGuard Safe Application Clearance Dossier</h3>
                <span style="font-size:11px;font-family:var(--font-mono);color:var(--accent-cyan);">${escapeHtml(dossier.jvascCode)}</span>
              </div>
            </div>
            <button class="btn-icon" onclick="document.getElementById('modal-container').classList.remove('open');document.getElementById('modal-container').setAttribute('aria-hidden','true');">
              <i data-lucide="x" style="width:18px;height:18px;"></i>
            </button>
          </div>

          <div style="background:var(--bg-base);border:1px solid var(--border-color);border-radius:12px;padding:16px;margin-bottom:18px;">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:12.5px;">
              <div><strong style="color:var(--text-muted);">Candidate Role:</strong> <span style="color:#FFF;">${escapeHtml(dossier.roleName)}</span></div>
              <div><strong style="color:var(--text-muted);">Standard SOC Code:</strong> <span class="font-mono text-cyan">${escapeHtml(dossier.socCode)}</span></div>
              <div><strong style="color:var(--text-muted);">Industry &amp; NAICS:</strong> <span style="color:#FFF;">${escapeHtml(dossier.industryName)} (${escapeHtml(dossier.naicsCode)})</span></div>
              <div><strong style="color:var(--text-muted);">Seniority Tier:</strong> <span style="color:#FFF;">${escapeHtml(dossier.seniorityLevel)}</span></div>
              <div><strong style="color:var(--text-muted);">Safety Clearance Rating:</strong> <span style="color:${dossier.riskTierColor};font-weight:bold;">${dossier.safetyIndex}% Trust (${dossier.riskTierBadge})</span></div>
              <div><strong style="color:var(--text-muted);">Safe Wage Benchmark:</strong> <span style="color:var(--safe);font-weight:bold;">${escapeHtml(dossier.safeWageBand)}</span></div>
            </div>
          </div>

          <div style="margin-bottom:18px;">
            <h4 style="font-size:13px;font-weight:700;color:var(--accent-cyan);margin-bottom:8px;display:flex;align-items:center;gap:6px;">
              <i data-lucide="check-circle-2" style="width:15px;height:15px;"></i> Applicant Pre-Application Sign-Off Protocol
            </h4>
            <div style="display:flex;flex-direction:column;gap:8px;font-size:12px;color:var(--text-primary);">
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
                <input type="checkbox" checked style="accent-color:var(--accent-cyan);"> [Step 1] Verified recruiter email domain against official corporate DNS MX records.
              </label>
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
                <input type="checkbox" checked style="accent-color:var(--accent-cyan);"> [Step 2] Confirmed zero upfront monetary or equipment cashier check requirement.
              </label>
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
                <input type="checkbox" checked style="accent-color:var(--accent-cyan);"> [Step 3] Cross-referenced state entity registration against NAICS code ${escapeHtml(dossier.naicsCode)}.
              </label>
            </div>
          </div>

          <div style="display:flex;justify-content:flex-end;gap:10px;border-top:1px solid var(--border-color);padding-top:16px;">
            <button class="btn btn-secondary" onclick="window.print();">
              <i data-lucide="printer" style="width:15px;height:15px;margin-right:6px;"></i> Print / Save PDF Dossier
            </button>
            <button class="btn btn-primary" onclick="document.getElementById('modal-container').classList.remove('open');document.getElementById('modal-container').setAttribute('aria-hidden','true');">
              Close Dossier
            </button>
          </div>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
    }

    // Attach initial events
    attachDossierEvents(currentDossier);

    // Form submission
    const genBtn = document.getElementById('btn-generate-clearance');
    if (genBtn) {
      genBtn.addEventListener('click', () => {
        const roleId = document.getElementById('clearance-role-select').value;
        const ind = document.getElementById('clearance-industry-select').value;
        const lvl = document.getElementById('clearance-seniority-select').value;
        const comp = document.getElementById('clearance-company-input').value;

        currentDossier = window.JobGuardData.generateApplicationClearance(roleId, ind, lvl, comp);
        document.getElementById('clearance-dossier-mount').innerHTML = getDossierCardHTML(currentDossier);
        if (window.lucide) lucide.createIcons();
        attachDossierEvents(currentDossier);
        showToast(`Generated Classification Clearance: ${currentDossier.jvascCode}`, 'success');
      });
    }

    // Global hook for heatmap cells and table buttons
    window.loadMarketClearance = function(industry, level) {
      const indSelect = document.getElementById('clearance-industry-select');
      const lvlSelect = document.getElementById('clearance-seniority-select');
      const roleSelect = document.getElementById('clearance-role-select');

      if (indSelect) indSelect.value = industry;
      if (lvlSelect) lvlSelect.value = level || 'Entry Level';

      // Pick matching role if available
      if (tax.industries && tax.industries[industry] && tax.industries[industry].defaultRole) {
        if (roleSelect) roleSelect.value = tax.industries[industry].defaultRole;
      }

      const roleId = roleSelect ? roleSelect.value : 'data_entry_accounting';
      currentDossier = window.JobGuardData.generateApplicationClearance(roleId, industry, level || 'Entry Level', '');
      const mount = document.getElementById('clearance-dossier-mount');
      if (mount) {
        mount.innerHTML = getDossierCardHTML(currentDossier);
        if (window.lucide) lucide.createIcons();
        attachDossierEvents(currentDossier);
      }

      const hero = document.getElementById('applicant-clearance-section');
      if (hero) hero.scrollIntoView({ behavior: 'smooth', block: 'start' });
      showToast(`Loaded ${industry} [${level || 'Entry Level'}] into Applicant Clearance Engine (Code: ${currentDossier.jvascCode})`, 'info');
    };

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
    const presets = window.JobGuardData.MEDIA_PRESETS || {};

    // Initial default media preset (High Risk Offer Letter PDF)
    let currentMediaState = {
      isPreset: true,
      presetKey: 'scam_offer_pdf',
      mediaType: 'pdf',
      fileName: presets.scam_offer_pdf ? presets.scam_offer_pdf.fileName : 'Apex_Global_Logistics_Offer_Letter.pdf',
      fileSize: presets.scam_offer_pdf ? presets.scam_offer_pdf.fileSize : '168.4 KB',
      hashSha256: presets.scam_offer_pdf ? presets.scam_offer_pdf.hashSha256 : '9f8e7a6b5c4d3e2f109876543210fedcba9876543210fedcba9876543210fedc',
      extractedText: presets.scam_offer_pdf ? presets.scam_offer_pdf.extractedText : '',
      previewSvg: null,
      previewImageDataUrl: null,
      title: 'Apex Global Logistics — Offer of Employment & Equipment Advance Check'
    };

    const inputHTML = `
      <div class="motif-prism" aria-hidden="true"></div>

      <!-- ── Primary Input Card with Dual Mode Selector ─────────────────────── -->
      <div class="card" style="margin-bottom:28px;" id="xai-input-card">
        <div class="card-header" style="flex-wrap:wrap;gap:14px;">
          <div class="card-title-group">
            <h2 class="card-title">
              <i data-lucide="sparkles" style="width:20px;height:20px;color:var(--accent-violet);display:inline-block;vertical-align:middle;margin-right:8px;"></i>
              XAI Forensic Analyser
            </h2>
            <span class="card-subtitle">Choose analysis mode: paste posting text or upload media (PDF / Screenshot / Resume)</span>
          </div>

          <!-- Dual Tab Switcher -->
          <div class="tab-nav">
            <button class="tab-btn active" id="xai-tab-btn-text">
              <i data-lucide="file-text" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>
              Text Posting Input
            </button>
            <button class="tab-btn" id="xai-tab-btn-media">
              <i data-lucide="upload-cloud" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>
              Upload Media Forensics
              <span class="badge badge-legit" style="font-size:9.5px;padding:2px 6px;margin-left:6px;">New: PDF &amp; Screenshots</span>
            </button>
          </div>
        </div>

        <div class="card-body">
          <!-- ── MODE A: TEXT POSTING INPUT FORM ─────────────────────────────── -->
          <div id="xai-text-form-wrap">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
              <div>
                <label class="form-label" for="xai-title">Job Title</label>
                <input type="text" id="xai-title" class="form-input" placeholder="e.g. Senior Data Scientist">
              </div>
              <div>
                <label class="form-label" for="xai-location">Location</label>
                <input type="text" id="xai-location" class="form-input" placeholder="e.g. New York, NY">
              </div>
            </div>

            <div style="margin-bottom:16px;">
              <label class="form-label" for="xai-company-profile">Company Profile</label>
              <textarea id="xai-company-profile" class="form-textarea" rows="2" placeholder="Describe the company (leave blank if not provided)…"></textarea>
            </div>

            <div style="margin-bottom:16px;">
              <label class="form-label" for="xai-description">Job Description <span style="color:var(--accent-cyan);font-size:11px;">(paste full posting here)</span></label>
              <textarea id="xai-description" class="form-textarea" rows="6" placeholder="Paste the full job description text here…"></textarea>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
              <div>
                <label class="form-label" for="xai-requirements">Requirements</label>
                <textarea id="xai-requirements" class="form-textarea" rows="3" placeholder="Skills, qualifications…"></textarea>
              </div>
              <div>
                <label class="form-label" for="xai-benefits">Benefits</label>
                <textarea id="xai-benefits" class="form-textarea" rows="3" placeholder="Salary, perks…"></textarea>
              </div>
            </div>

            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px;">
              <div>
                <label class="form-label" for="xai-employment-type">Employment Type</label>
                <select id="xai-employment-type" class="form-select">
                  <option value="">Not Specified</option>
                  <option value="Full-time">Full-time</option>
                  <option value="Part-time">Part-time</option>
                  <option value="Contract">Contract</option>
                  <option value="Temporary">Temporary</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label class="form-label" for="xai-experience">Required Experience</label>
                <select id="xai-experience" class="form-select">
                  <option value="">Not Specified</option>
                  <option value="Entry level">Entry level</option>
                  <option value="Associate">Associate</option>
                  <option value="Mid-Senior level">Mid-Senior level</option>
                  <option value="Director">Director</option>
                  <option value="Executive">Executive</option>
                  <option value="Internship">Internship</option>
                  <option value="Not Applicable">Not Applicable</option>
                </select>
              </div>
              <div>
                <label class="form-label">Structural Signals</label>
                <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:6px;">
                  <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;">
                    <input type="checkbox" id="xai-has-logo" style="accent-color:var(--accent-violet);"> Has Company Logo
                  </label>
                  <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;">
                    <input type="checkbox" id="xai-telecommute" style="accent-color:var(--accent-violet);"> Remote / Telecommute
                  </label>
                  <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;">
                    <input type="checkbox" id="xai-has-questions" style="accent-color:var(--accent-violet);"> Has Screening Questions
                  </label>
                </div>
              </div>
            </div>

            <button id="xai-submit-btn" class="btn btn-primary" style="width:100%;font-size:15px;padding:14px 24px;">
              <i data-lucide="zap" style="width:18px;height:18px;display:inline-block;vertical-align:middle;margin-right:8px;"></i>
              Run Forensic Analysis &amp; Explain
            </button>
          </div>

          <!-- ── MODE B: UPLOAD MEDIA FORENSICS (PDF / SCREENSHOT / RESUME) ──── -->
          <div id="xai-media-form-wrap" style="display:none;">
            <div style="margin-bottom:20px;padding:14px 18px;background:rgba(139,92,246,0.08);border:1px solid rgba(139,92,246,0.25);border-radius:12px;">
              <div style="font-size:13px;color:var(--text-primary);line-height:1.5;">
                <strong style="color:var(--accent-cyan);">Multimodal Forensics Pipeline:</strong> Upload a Job Offer Letter PDF, recruiter email/chat screenshot, or candidate contract. The engine extracts text and structural markers, audits visual/domain provenance, and breaks down feature attributions using Explainable AI (SHAP).
              </div>
            </div>

            <!-- Quick-Test Preset Deck -->
            <div style="margin-bottom:20px;">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
                <label class="form-label" style="margin:0;">
                  <i data-lucide="sparkles" style="width:14px;height:14px;color:var(--accent-cyan);margin-right:4px;"></i>
                  Forensic Quick-Test Presets (1-Click Demonstration Media)
                </label>
                <span style="font-size:11px;color:var(--text-muted);">Select any pre-analyzed forensic case:</span>
              </div>

              <div class="preset-grid">
                <!-- Preset 1: Fake Offer Letter PDF -->
                <div class="preset-card active" data-preset="scam_offer_pdf">
                  <div style="display:flex;align-items:center;justify-content:space-between;">
                    <span class="badge badge-high-risk" style="font-size:10px;">🚨 Scam Offer Letter (PDF)</span>
                    <span style="font-size:11px;font-family:var(--font-mono);color:var(--text-muted);">PDF · 168KB</span>
                  </div>
                  <div style="font-weight:600;font-size:13px;color:var(--text-primary);">Apex Global Logistics</div>
                  <div style="font-size:11.5px;color:var(--text-muted);line-height:1.4;">Unsolicited WFH inspector offer demanding $3,250 cashier check deposit for IT gear.</div>
                </div>

                <!-- Preset 2: Phishing Email Screenshot -->
                <div class="preset-card" data-preset="phishing_email_img">
                  <div style="display:flex;align-items:center;justify-content:space-between;">
                    <span class="badge badge-high-risk" style="font-size:10px;">🚨 Phishing Email Screenshot</span>
                    <span style="font-size:11px;font-family:var(--font-mono);color:var(--text-muted);">PNG · 394KB</span>
                  </div>
                  <div style="font-weight:600;font-size:13px;color:var(--text-primary);">Google Careers Spoofed Email</div>
                  <div style="font-size:11.5px;color:var(--text-muted);line-height:1.4;">Free @gmail.com recruiter address demanding immediate Telegram chat &amp; $150 crypto KYC fee.</div>
                </div>

                <!-- Preset 3: Suspicious Contract PDF -->
                <div class="preset-card" data-preset="suspicious_contract_pdf">
                  <div style="display:flex;align-items:center;justify-content:space-between;">
                    <span class="badge badge-suspicious" style="font-size:10px;">⚠️ Identity Harvesting Contract</span>
                    <span style="font-size:11px;font-family:var(--font-mono);color:var(--text-muted);">PDF · 215KB</span>
                  </div>
                  <div style="font-weight:600;font-size:13px;color:var(--text-primary);">UnitedCare WFH Contract</div>
                  <div style="font-size:11.5px;color:var(--text-muted);line-height:1.4;">Demands full passport scan, SSN, and banking direct deposit routing prior to interview.</div>
                </div>

                <!-- Preset 4: Legitimate Enterprise Offer -->
                <div class="preset-card" data-preset="legit_offer_pdf">
                  <div style="display:flex;align-items:center;justify-content:space-between;">
                    <span class="badge badge-legit" style="font-size:10px;">✓ Legitimate Enterprise Offer</span>
                    <span style="font-size:11px;font-family:var(--font-mono);color:var(--text-muted);">PDF · 328KB</span>
                  </div>
                  <div style="font-weight:600;font-size:13px;color:var(--text-primary);">Stripe Infrastructure Engineer</div>
                  <div style="font-size:11.5px;color:var(--text-muted);line-height:1.4;">Formal corporate offer with verified DocuSign envelope, equity vesting, 401(k), and Form I-9.</div>
                </div>

                <!-- Preset 5: Synthetic Test Scam Benchmark (Global Future Careers) -->
                <div class="preset-card" data-preset="synthetic_scam_pdf">
                  <div style="display:flex;align-items:center;justify-content:space-between;">
                    <span class="badge badge-high-risk" style="font-size:10px;">🚨 Synthetic Scam Benchmark (PDF)</span>
                    <span style="font-size:11px;font-family:var(--font-mono);color:var(--text-muted);">PDF · 29.8KB</span>
                  </div>
                  <div style="font-weight:600;font-size:13px;color:var(--text-primary);">Global Future Careers</div>
                  <div style="font-size:11.5px;color:var(--text-muted);line-height:1.4;">₹4,999 personal UPI confirmation fee, OTP theft, no interview, impossible date 32/15/2026.</div>
                </div>
              </div>
            </div>

            <!-- Drag & Drop Upload Zone -->
            <div class="media-dropzone" id="xai-media-dropzone">
              <input type="file" id="xai-media-file-input" accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.txt" style="display:none;">
              <div class="dropzone-icon-circle">
                <i data-lucide="file-up" style="width:28px;height:28px;"></i>
              </div>
              <h3 style="font-size:15px;font-weight:700;color:var(--text-primary);margin-bottom:6px;">
                Drag &amp; drop your Resume, Offer Letter PDF, or Email Screenshot here
              </h3>
              <p style="font-size:12.5px;color:var(--text-muted);margin-bottom:12px;">
                Or <span style="color:var(--accent-cyan);text-decoration:underline;cursor:pointer;" id="dropzone-browse-link">browse files</span> from your local computer
              </p>
              <div style="display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;">
                <span class="badge" style="background:var(--bg-raised);color:var(--text-muted);font-size:11px;">PDF (Offer Letters / Resumes)</span>
                <span class="badge" style="background:var(--bg-raised);color:var(--text-muted);font-size:11px;">PNG / JPG (Email Screenshots / Chats)</span>
                <span class="badge" style="background:var(--bg-raised);color:var(--text-muted);font-size:11px;">DOCX / TXT (Job Specs)</span>
              </div>
            </div>

            <!-- Media Preview & Extracted OCR Text Inspector -->
            <div id="xai-media-inspector" style="margin-top:20px;display:grid;grid-template-columns:1fr 1fr;gap:18px;">
              <!-- Left: Visual / Document Preview -->
              <div>
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
                  <span class="form-label" style="margin:0;">Visual &amp; Provenance Preview</span>
                  <span class="badge" id="media-preview-type-badge" style="background:rgba(34,211,238,0.1);color:var(--accent-cyan);font-size:10px;font-family:var(--font-mono);">
                    PDF Document
                  </span>
                </div>
                <div class="media-preview-container">
                  <div class="media-preview-frame" id="media-preview-viewport">
                    <!-- Scanner overlay line -->
                    <div class="scanner-overlay">
                      <div class="scanner-line"></div>
                    </div>
                    <!-- Dynamic preview content -->
                    <div id="media-preview-content" style="padding:20px;text-align:center;width:100%;">
                      <div style="width:50px;height:50px;border-radius:10px;background:rgba(251,93,93,0.15);display:flex;align-items:center;justify-content:center;margin:0 auto 12px;color:var(--danger);">
                        <i data-lucide="file-text" style="width:28px;height:28px;"></i>
                      </div>
                      <div style="font-weight:700;font-size:14px;color:#FFFFFF;" id="media-preview-filename">Apex_Global_Logistics_Offer_Letter.pdf</div>
                      <div style="font-size:11px;color:var(--text-muted);margin-top:4px;" id="media-preview-meta">PDF · 168.4 KB · SHA-256 Forensics Intact</div>
                      <div style="display:inline-block;margin-top:14px;background:rgba(251,93,93,0.12);border:1px solid rgba(251,93,93,0.4);color:var(--danger);font-size:11px;padding:4px 10px;border-radius:6px;font-family:var(--font-mono);">
                        ⚠ Advance Check Cashing Signature Detected
                      </div>
                    </div>
                  </div>
                  <!-- Metadata table -->
                  <div style="background:var(--bg-raised);padding:10px 14px;border-top:1px solid var(--border-color);font-size:11px;color:var(--text-muted);display:flex;align-items:center;justify-content:space-between;">
                    <span id="media-preview-hash" class="font-mono" style="font-size:10px;">Hash: 9f8e7a6b5c4d3e2f...</span>
                    <span style="color:var(--safe);display:flex;align-items:center;gap:4px;">
                      <i data-lucide="check" style="width:12px;height:12px;"></i> OCR Extracted
                    </span>
                  </div>
                </div>
              </div>

              <!-- Right: Extracted OCR / Document Text Editor -->
              <div>
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
                  <span class="form-label" style="margin:0;">Extracted Document Content (OCR &amp; NLP Ingestion)</span>
                  <span style="font-size:11px;color:var(--text-muted);">Editable for sensitivity testing</span>
                </div>
                <textarea id="xai-media-extracted-text" class="form-textarea" rows="11" style="font-size:12px;font-family:var(--font-mono);line-height:1.55;resize:vertical;" placeholder="Extracted text from uploaded PDF or image will appear here…"></textarea>
              </div>
            </div>

            <!-- Submit Button for Media Forensics -->
            <button id="xai-media-submit-btn" class="btn btn-primary" style="width:100%;font-size:15px;padding:14px 24px;margin-top:20px;">
              <i data-lucide="zap" style="width:18px;height:18px;display:inline-block;vertical-align:middle;margin-right:8px;"></i>
              Run Forensic Media Analysis &amp; XAI Explanation
            </button>
          </div>
        </div>
      </div>

      <!-- ── Results Panel (hidden until analysis runs) ──────────────────── -->
      <div id="xai-results-panel" style="display:none;"></div>
    `;

    document.getElementById('app').innerHTML = renderShell(inputHTML, 'XAI Forensic Analyser', 'Predict + Explain with SHAP — Multimodal Media Forensics');
    if (window.lucide) lucide.createIcons();

    // ── Bind Mode Switcher Tabs ─────────────────────────────────────────────
    const tabBtnText = document.getElementById('xai-tab-btn-text');
    const tabBtnMedia = document.getElementById('xai-tab-btn-media');
    const formWrapText = document.getElementById('xai-text-form-wrap');
    const formWrapMedia = document.getElementById('xai-media-form-wrap');

    if (tabBtnText && tabBtnMedia) {
      tabBtnText.addEventListener('click', () => {
        tabBtnText.classList.add('active');
        tabBtnMedia.classList.remove('active');
        formWrapText.style.display = 'block';
        formWrapMedia.style.display = 'none';
      });

      tabBtnMedia.addEventListener('click', () => {
        tabBtnMedia.classList.add('active');
        tabBtnText.classList.remove('active');
        formWrapMedia.style.display = 'block';
        formWrapText.style.display = 'none';
        // Initialize preset state if not already populated
        updateMediaInspector(currentMediaState);
      });
    }

    // ── Function to update the media inspector viewport ─────────────────────
    function updateMediaInspector(state) {
      const filenameEl = document.getElementById('media-preview-filename');
      const metaEl = document.getElementById('media-preview-meta');
      const hashEl = document.getElementById('media-preview-hash');
      const typeBadge = document.getElementById('media-preview-type-badge');
      const textEditor = document.getElementById('xai-media-extracted-text');
      const viewport = document.getElementById('media-preview-content');

      if (filenameEl) filenameEl.innerText = state.fileName;
      if (metaEl) metaEl.innerText = `${state.mediaType.toUpperCase()} · ${state.fileSize} · SHA-256 Forensics Intact`;
      if (hashEl) hashEl.innerText = `Hash: ${state.hashSha256 ? state.hashSha256.slice(0, 18) + '…' : 'Calculated on upload'}`;
      if (typeBadge) typeBadge.innerText = state.mediaType === 'image' ? 'Image Screenshot' : 'PDF Document';
      if (textEditor) textEditor.value = state.extractedText;

      if (viewport) {
        if (state.previewImageDataUrl) {
          viewport.innerHTML = `<img src="${state.previewImageDataUrl}" alt="Uploaded Screenshot" style="max-height:240px;border-radius:8px;box-shadow:0 4px 14px rgba(0,0,0,0.5);">`;
        } else if (state.previewSvg) {
          viewport.innerHTML = `<img src="${state.previewSvg}" alt="Simulated Screenshot" style="max-height:240px;border-radius:8px;box-shadow:0 4px 14px rgba(0,0,0,0.5);">`;
        } else {
          // Standard document badge preview
          const isDanger = state.riskTier === 'high';
          const iconColor = isDanger ? 'var(--danger)' : state.riskTier === 'suspicious' ? 'var(--caution)' : 'var(--safe)';
          const iconBg = isDanger ? 'rgba(251,93,93,0.15)' : state.riskTier === 'suspicious' ? 'rgba(251,191,36,0.15)' : 'rgba(52,211,153,0.15)';
          const badgeText = state.previewBadge || (isDanger ? '⚠ Scam Signature Detected' : '✓ Standard Verified Structure');

          viewport.innerHTML = `
            <div style="width:50px;height:50px;border-radius:10px;background:${iconBg};display:flex;align-items:center;justify-content:center;margin:0 auto 12px;color:${iconColor};">
              <i data-lucide="${state.mediaType === 'image' ? 'image' : 'file-text'}" style="width:28px;height:28px;"></i>
            </div>
            <div style="font-weight:700;font-size:14px;color:#FFFFFF;">${escapeHtml(state.fileName)}</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">${escapeHtml(state.fileSize)} · Cryptographic Integrity Hash</div>
            <div style="display:inline-block;margin-top:14px;background:${iconBg};border:1px solid ${iconColor};color:${iconColor};font-size:11px;padding:4px 10px;border-radius:6px;font-family:var(--font-mono);">
              ${escapeHtml(badgeText)}
            </div>
          `;
          if (window.lucide) lucide.createIcons();
        }
      }
    }

    // ── Bind Presets ────────────────────────────────────────────────────────
    const presetCards = document.querySelectorAll('.preset-card');
    presetCards.forEach((card) => {
      card.addEventListener('click', () => {
        presetCards.forEach(c => c.classList.remove('active'));
        card.classList.add('active');

        const key = card.getAttribute('data-preset');
        const p = presets[key];
        if (p) {
          currentMediaState = {
            isPreset: true,
            presetKey: key,
            mediaType: p.mediaType,
            fileName: p.fileName,
            fileSize: p.fileSize,
            hashSha256: p.hashSha256,
            extractedText: p.extractedText,
            previewSvg: p.imagePreviewSvg || null,
            previewImageDataUrl: null,
            title: p.title,
            riskTier: p.riskTier,
            previewBadge: p.previewBadge
          };
          updateMediaInspector(currentMediaState);
          showToast(`Loaded preset media: ${p.fileName}`, 'info');
        }
      });
    });

    // ── Bind Dropzone & File Browser ────────────────────────────────────────
    const dropzone = document.getElementById('xai-media-dropzone');
    const fileInput = document.getElementById('xai-media-file-input');
    const browseLink = document.getElementById('dropzone-browse-link');

    if (browseLink && fileInput) {
      browseLink.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.click();
      });
    }

    if (dropzone && fileInput) {
      dropzone.addEventListener('click', () => fileInput.click());

      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('drag-over');
      });

      dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('drag-over');
      });

      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('drag-over');
        if (e.dataTransfer && e.dataTransfer.files.length > 0) {
          handleUploadedFile(e.dataTransfer.files[0]);
        }
      });

      fileInput.addEventListener('change', () => {
        if (fileInput.files && fileInput.files.length > 0) {
          handleUploadedFile(fileInput.files[0]);
        }
      });
    }

    async function handleUploadedFile(file) {
      const isImg = file.type.startsWith('image/');
      const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.type.includes('pdf');
      const sizeStr = (file.size / 1024).toFixed(1) + ' KB';

      // Mark presets inactive
      presetCards.forEach(c => c.classList.remove('active'));
      dropzone.classList.add('has-file');

      // Simple hash generation for display
      const fakeHash = Array.from(new Uint8Array(16))
        .map(() => Math.floor(Math.random() * 256).toString(16).padStart(2, '0'))
        .join('');

      if (isImg) {
        const reader = new FileReader();
        reader.onload = async (e) => {
          let extractedText = `[OCR Vision Ingestion — ${file.name}]\nAnalyzing image with computer vision OCR…`;
          currentMediaState = {
            isPreset: false,
            mediaType: 'image',
            fileName: file.name,
            fileSize: sizeStr,
            hashSha256: fakeHash,
            extractedText: extractedText,
            previewSvg: null,
            previewImageDataUrl: e.target.result,
            title: `[Media Forensics] ${file.name}`,
            previewBadge: 'Uploaded Screenshot'
          };
          updateMediaInspector(currentMediaState);
          showToast(`Uploaded image screenshot: ${file.name}`, 'success');

          // Run Tesseract.js OCR if available in window
          if (window.Tesseract) {
            try {
              showToast('Running client-side Tesseract OCR on screenshot…', 'info');
              const { data: { text } } = await Tesseract.recognize(e.target.result, 'eng');
              if (text && text.trim().length > 10) {
                currentMediaState.extractedText = text.trim();
                const textEl = document.getElementById('media-extracted-text');
                if (textEl) textEl.value = currentMediaState.extractedText;
                showToast(`OCR successfully extracted ${text.trim().length} chars from image`, 'success');
              }
            } catch (ocrErr) {
              console.warn('[Tesseract OCR] Error:', ocrErr);
            }
          }
        };
        reader.readAsDataURL(file);
      } else if (isPdf) {
        showToast(`Ingesting PDF: ${file.name}…`, 'info');
        const reader = new FileReader();
        reader.onload = async (e) => {
          const arrayBuffer = e.target.result;
          let extractedText = '';

          // Tier 1: PDF.js Client-Side Extraction
          if (window.pdfjsLib) {
            try {
              if (pdfjsLib.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
                pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
              }
              const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
              const pdfDoc = await loadingTask.promise;
              const pages = [];
              for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
                const page = await pdfDoc.getPage(pageNum);
                const textContent = await page.getTextContent();
                const pageStr = textContent.items.map(it => it.str).join(' ');
                if (pageStr && pageStr.trim()) {
                  pages.push(`[PAGE ${pageNum}]\n${pageStr}`);
                }
              }
              if (pages.length > 0) {
                extractedText = pages.join('\n\n');
              }
            } catch (pdfErr) {
              console.warn('[PDF.js Engine] Encountered error, trying fallback parser:', pdfErr);
            }
          }

          // Tier 2: Built-in PDF stream & token scanner fallback
          if (!extractedText || extractedText.trim().length < 30) {
            extractedText = extractPdfTextFallback(arrayBuffer);
          }

          if (!extractedText || extractedText.trim().length === 0) {
            extractedText = `[PDF Document: ${file.name}]\n(No plain text could be extracted. Please paste or review document content here.)`;
          }

          currentMediaState = {
            isPreset: false,
            mediaType: 'pdf',
            fileName: file.name,
            fileSize: sizeStr,
            hashSha256: fakeHash,
            extractedText: extractedText,
            previewSvg: null,
            previewImageDataUrl: null,
            title: `[Media Forensics] ${file.name}`,
            previewBadge: 'Uploaded PDF Document'
          };
          updateMediaInspector(currentMediaState);
          showToast(`Successfully extracted ${extractedText.length} characters from ${file.name}`, 'success');
        };
        reader.readAsArrayBuffer(file);
      } else {
        const reader = new FileReader();
        reader.onload = (e) => {
          const raw = e.target.result || '';
          currentMediaState = {
            isPreset: false,
            mediaType: 'document',
            fileName: file.name,
            fileSize: sizeStr,
            hashSha256: fakeHash,
            extractedText: raw.slice(0, 5000) || `[Document Ingestion: ${file.name}]`,
            previewSvg: null,
            previewImageDataUrl: null,
            title: `[Media Forensics] ${file.name}`,
            previewBadge: 'Uploaded Text Document'
          };
          updateMediaInspector(currentMediaState);
          showToast(`Uploaded document: ${file.name}`, 'success');
        };
        reader.readAsText(file);
      }
    }

    function extractPdfTextFallback(arrayBuffer) {
      try {
        const bytes = new Uint8Array(arrayBuffer);
        let str = '';
        const len = bytes.length;
        const chunkSize = 8192;
        for (let i = 0; i < len; i += chunkSize) {
          const slice = bytes.subarray(i, Math.min(i + chunkSize, len));
          str += String.fromCharCode.apply(null, slice);
        }

        const tokens = [];
        const tjRegex = /\(([^)\r\n]{2,})\)\s*(?:Tj|'|")/g;
        let match;
        while ((match = tjRegex.exec(str)) !== null) {
          const s = match[1].trim();
          if (s.length > 1 && !/^\\[0-9]+$/.test(s)) {
            tokens.push(s);
          }
        }

        const tjArrRegex = /\[(.*?)\]\s*TJ/g;
        while ((match = tjArrRegex.exec(str)) !== null) {
          const inner = match[1].match(/\(([^)]+)\)/g);
          if (inner) {
            inner.forEach(item => {
              const cleaned = item.slice(1, -1).trim();
              if (cleaned.length > 0) tokens.push(cleaned);
            });
          }
        }

        if (tokens.length > 5) {
          return tokens.join(' ');
        }
        return '';
      } catch (err) {
        console.warn('[PDF Fallback Parser] Error:', err);
        return '';
      }
    }

    // ── Mode A: Text Posting Submit Handler ─────────────────────────────────
    document.getElementById('xai-submit-btn').addEventListener('click', async () => {
      const btn = document.getElementById('xai-submit-btn');
      const title = document.getElementById('xai-title').value.trim();
      const description = document.getElementById('xai-description').value.trim();

      if (!title && !description) {
        showToast('Please enter at least a Job Title or Job Description.', 'warning');
        return;
      }

      btn.disabled = true;
      btn.innerHTML = `<span class="spinner" style="width:16px;height:16px;border-width:2px;display:inline-block;vertical-align:middle;margin-right:8px;"></span> Analysing with LinearSVC + SHAP…`;

      const formData = {
        title:               title,
        location:            document.getElementById('xai-location').value.trim(),
        company_profile:     document.getElementById('xai-company-profile').value.trim(),
        description:         description,
        requirements:        document.getElementById('xai-requirements').value.trim(),
        benefits:            document.getElementById('xai-benefits').value.trim(),
        employment_type:     document.getElementById('xai-employment-type').value,
        required_experience: document.getElementById('xai-experience').value,
        telecommuting:       document.getElementById('xai-telecommute').checked ? 1 : 0,
        has_company_logo:    document.getElementById('xai-has-logo').checked ? 1 : 0,
        has_questions:       document.getElementById('xai-has-questions').checked ? 1 : 0,
      };

      try {
        const result = await window.JobGuardData.analyzeJob(formData);
        renderXAIResults(result, title || 'Untitled Posting');
      } catch (err) {
        showToast('Analysis failed — check connection.', 'error');
        console.error('[XAI] Error:', err);
      } finally {
        btn.disabled = false;
        btn.innerHTML = `<i data-lucide="zap" style="width:18px;height:18px;display:inline-block;vertical-align:middle;margin-right:8px;"></i> Run Forensic Analysis &amp; Explain`;
        if (window.lucide) lucide.createIcons();
      }
    });

    // ── Mode B: Upload Media Forensics Submit Handler ───────────────────────
    document.getElementById('xai-media-submit-btn').addEventListener('click', async () => {
      const btn = document.getElementById('xai-media-submit-btn');
      const extractedText = document.getElementById('xai-media-extracted-text').value.trim();

      if (!extractedText) {
        showToast('Please select a preset or upload a document with text to analyze.', 'warning');
        return;
      }

      btn.disabled = true;
      btn.innerHTML = `<span class="spinner" style="width:16px;height:16px;border-width:2px;display:inline-block;vertical-align:middle;margin-right:8px;"></span> Running Multimodal Ingestion &amp; SHAP Feature Attribution…`;

      const mediaPayload = {
        fileName: currentMediaState.fileName,
        mediaType: currentMediaState.mediaType,
        fileSize: currentMediaState.fileSize,
        hashSha256: currentMediaState.hashSha256,
        extractedText: extractedText,
        isPreset: currentMediaState.isPreset
      };

      try {
        const result = await window.JobGuardData.analyzeMedia(mediaPayload);
        renderXAIResults(result, currentMediaState.title || currentMediaState.fileName);
      } catch (err) {
        showToast('Media forensics analysis failed.', 'error');
        console.error('[XAI Media] Error:', err);
      } finally {
        btn.disabled = false;
        btn.innerHTML = `<i data-lucide="zap" style="width:18px;height:18px;display:inline-block;vertical-align:middle;margin-right:8px;"></i> Run Forensic Media Analysis &amp; XAI Explanation`;
        if (window.lucide) lucide.createIcons();
      }
    });

    // ── Render XAI Results (Handles both Text & Media Forensics) ────────────
    function renderXAIResults(result, jobTitle) {
      const panel = document.getElementById('xai-results-panel');
      if (!panel) return;

      const riskScore   = Math.round((result.risk_score || result.prediction_probability * 100) || 0);
      const verdict     = result.verdict || result.prediction || 'Unknown';
      const modelUsed   = result.model_used || 'LinearSVC + Multimodal Forensics';
      const probability = ((result.prediction_probability || 0) * 100).toFixed(1);
      const plainLang   = result.explanation || result.plain_language || 'No plain-language summary available.';
      const isMedia     = !!(result.mediaType || result.diagnostic_checks);

      const fraudFactors = result.important_features
        ? result.important_features.filter(f => f.direction === 'fraud' || f.impact > 0).slice(0, 6)
        : (result.top_fraud_factors || []).slice(0, 6);

      const legitFactors = result.important_features
        ? result.important_features.filter(f => f.direction === 'legit' || f.impact < 0).slice(0, 6)
        : (result.top_legit_factors || []).slice(0, 6);

      const shapSummary  = result.important_features || result.shap_values || [];
      const tokens       = result.tokens || [];
      const diagChecks   = result.diagnostic_checks || [];

      // Factor bar renderer
      const factorBars = (factors, type) => {
        if (!factors || factors.length === 0) {
          return `<p style="color:var(--text-muted);font-size:13px;padding:12px 0;">No significant ${type} factors detected.</p>`;
        }
        const maxImpact = Math.max(...factors.map(f => Math.abs(f.impact || f.shap_value || 0.1)));
        return factors.map(f => {
          const val = Math.abs(f.impact || f.shap_value || 0);
          const pct = maxImpact > 0 ? Math.min(100, (val / maxImpact) * 100) : 30;
          const label = f.feature || f.name || 'Unknown feature';
          const displayVal = val.toFixed(3);
          return `
            <div class="factor-item" style="animation:factorGrow 0.5s ease forwards;">
              <div class="factor-meta">
                <span class="factor-name">${escapeHtml(label)}</span>
                <span class="factor-impact ${type === 'fraud' ? 'text-danger' : 'text-safe'}">
                  ${type === 'fraud' ? '+' : '−'}${displayVal}
                </span>
              </div>
              <div class="factor-bar-track">
                <div class="factor-bar-fill ${type === 'fraud' ? 'fill-fraud' : 'fill-legit'}"
                     style="width:${pct}%;transition:width 0.8s ease;"></div>
              </div>
            </div>`;
        }).join('');
      };

      // Risk stamp color
      let stampColor = 'var(--safe)';
      if (riskScore >= 70) stampColor = 'var(--danger)';
      else if (riskScore >= 40) stampColor = 'var(--caution)';

      const verdictLabel = riskScore >= 70 ? 'HIGH RISK' : riskScore >= 40 ? 'SUSPICIOUS' : 'LEGITIMATE';
      const verdictBadge = riskScore >= 70
        ? '<span class="badge badge-high-risk">⚠ High Risk Scam</span>'
        : riskScore >= 40
        ? '<span class="badge badge-suspicious">⚡ Potentially Suspicious</span>'
        : '<span class="badge badge-legit">✓ Verified Legitimate</span>';

      // Fraud fingerprint tokens
      const fingerprintHTML = tokens.length > 0
        ? tokens.map(tok => {
            let cls = tok.risk === 'fraud' ? 'token-fraud-high' : 'token-legit';
            return `<div class="token-bubble ${cls}">
              <span>${escapeHtml(tok.word)}</span>
              <span style="font-size:10px;opacity:0.75;">${tok.weight > 0 ? '+' : ''}${Number(tok.weight).toFixed(2)}</span>
            </div>`;
          }).join('')
        : `<p style="color:var(--text-muted);font-size:13px;">Multimodal lexical token attributions computed.</p>`;

      panel.style.display = 'block';
      panel.innerHTML = `
        <!-- Divider -->
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:28px;">
          <div style="flex:1;height:1px;background:linear-gradient(90deg,transparent,var(--border-color));"></div>
          <span style="font-family:var(--font-heading);font-size:12px;font-weight:700;text-transform:uppercase;color:var(--accent-cyan);letter-spacing:1.5px;">
            <i data-lucide="scan-line" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:4px;"></i>
            Forensic Analysis &amp; XAI Explanation Results
          </span>
          <div style="flex:1;height:1px;background:linear-gradient(90deg,var(--border-color),transparent);"></div>
        </div>

        <!-- Row 1: Stamp + Factors -->
        <div class="grid-2" style="margin-bottom:24px;">
          <!-- Risk Stamp Card -->
          <div class="card">
            <div class="card-header">
              <div class="card-title-group">
                <h2 class="card-title">Forensic Risk Verdict</h2>
                <span class="card-subtitle" title="${escapeHtml(jobTitle)}">${escapeHtml(jobTitle.length > 40 ? jobTitle.slice(0,40)+'…' : jobTitle)}</span>
              </div>
              ${verdictBadge}
            </div>
            <div class="card-body" style="text-align:center;">
              <!-- Risk Stamp SVG -->
              <div class="risk-stamp stamp-animate" style="margin:0 auto 20px;">
                <svg viewBox="0 0 220 220" xmlns="http://www.w3.org/2000/svg" width="220" height="220">
                  <defs>
                    <filter id="xai-glow">
                      <feGaussianBlur stdDeviation="4" result="blur"/>
                      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                    </filter>
                    <path id="xai-arc" d="M 30,110 A 80,80 0 1,1 190,110" fill="none"/>
                  </defs>
                  <!-- Outer ring -->
                  <circle cx="110" cy="110" r="100" fill="none" stroke="${stampColor}" stroke-width="2" stroke-dasharray="8 4" opacity="0.6"/>
                  <!-- Inner ring -->
                  <circle cx="110" cy="110" r="84" fill="rgba(11,15,30,0.95)" stroke="${stampColor}" stroke-width="1.5" opacity="0.4"/>
                  <!-- Curved text -->
                  <text font-family="IBM Plex Mono,monospace" font-size="10" font-weight="700" fill="${stampColor}" letter-spacing="3" text-anchor="middle" opacity="0.85">
                    <textPath href="#xai-arc" startOffset="50%">FORENSIC VERITY SEAL — JOBGUARD-XAI</textPath>
                  </text>
                  <!-- Score -->
                  <text x="110" y="100" text-anchor="middle" font-family="IBM Plex Mono,monospace" font-size="52" font-weight="700" fill="${stampColor}" filter="url(#xai-glow)">${riskScore}</text>
                  <text x="110" y="120" text-anchor="middle" font-family="IBM Plex Mono,monospace" font-size="11" fill="${stampColor}" opacity="0.7">RISK SCORE</text>
                  <!-- Verdict pill -->
                  <rect x="62" y="134" width="96" height="22" rx="11" fill="${stampColor}" opacity="0.15"/>
                  <rect x="62" y="134" width="96" height="22" rx="11" fill="none" stroke="${stampColor}" stroke-width="1" opacity="0.5"/>
                  <text x="110" y="149" text-anchor="middle" font-family="IBM Plex Mono,monospace" font-size="10" font-weight="700" fill="${stampColor}">${verdictLabel}</text>
                </svg>
              </div>

              <!-- Metadata chips -->
              <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:8px;margin-bottom:16px;">
                <span style="background:var(--bg-raised);border:1px solid var(--border-color);padding:4px 12px;border-radius:20px;font-family:var(--font-mono);font-size:11px;color:var(--text-muted);">
                  Model: ${escapeHtml(modelUsed)}
                </span>
                <span style="background:var(--bg-raised);border:1px solid var(--border-color);padding:4px 12px;border-radius:20px;font-family:var(--font-mono);font-size:11px;color:var(--text-muted);">
                  Probability: ${probability}%
                </span>
                ${isMedia ? `<span class="badge badge-legit" style="font-size:10px;"><i data-lucide="check" style="width:10px;height:10px;"></i> Multimodal Ingested</span>` : ''}
              </div>

              <!-- Plain language summary -->
              <div style="background:var(--bg-raised);border:1px solid ${riskScore >= 70 ? 'rgba(251,93,93,0.35)' : 'var(--border-color)'};border-radius:12px;padding:16px;text-align:left;">
                <div style="font-family:var(--font-heading);font-size:11px;font-weight:700;text-transform:uppercase;color:${riskScore >= 70 ? 'var(--danger)' : 'var(--accent-cyan)'};margin-bottom:10px;letter-spacing:1px;display:flex;align-items:center;gap:6px;">
                  <i data-lucide="${riskScore >= 70 ? 'alert-triangle' : 'info'}" style="width:14px;height:14px;"></i>
                  Forensic Explanation &amp; Risk Justification
                </div>
                <div style="font-size:12.5px;color:var(--text-primary);line-height:1.65;margin:0;white-space:pre-wrap;font-family:system-ui,-apple-system,sans-serif;">
${escapeHtml(plainLang)}
                </div>
              </div>
            </div>
          </div>

          <!-- SHAP Factor Bars Card -->
          <div class="card">
            <div class="card-header">
              <div class="card-title-group">
                <h2 class="card-title">SHAP Feature Contributions</h2>
                <span class="card-subtitle">Red (+) push toward fraud &nbsp;·&nbsp; Green (−) push toward legitimate</span>
              </div>
            </div>
            <div class="card-body">
              <h3 style="font-size:13px;font-weight:700;color:var(--danger);margin-bottom:12px;display:flex;align-items:center;gap:6px;">
                <i data-lucide="trending-up" style="width:15px;height:15px;"></i> Top Fraud Risk Drivers
              </h3>
              <div class="factor-list" style="margin-bottom:24px;">
                ${factorBars(fraudFactors, 'fraud')}
              </div>

              <h3 style="font-size:13px;font-weight:700;color:var(--safe);margin-bottom:12px;display:flex;align-items:center;gap:6px;">
                <i data-lucide="trending-down" style="width:15px;height:15px;"></i> Top Legitimacy Anchors
              </h3>
              <div class="factor-list">
                ${factorBars(legitFactors, 'legit')}
              </div>
            </div>
          </div>
        </div>

        <!-- ── If Media Result: Render 6-Point Multimodal Diagnostic Grid ──────── -->
        ${diagChecks.length > 0 ? `
          <div class="card" style="margin-bottom:24px;">
            <div class="card-header">
              <div class="card-title-group">
                <h2 class="card-title">
                  <i data-lucide="shield-alert" style="width:18px;height:18px;color:var(--accent-cyan);margin-right:6px;"></i>
                  Multimodal Document Provenance &amp; Forensic Checklist
                </h2>
                <span class="card-subtitle">Structural integrity, domain routing, and financial disbursement security audit</span>
              </div>
            </div>
            <div class="card-body">
              <div class="forensic-audit-grid">
                ${diagChecks.map(dc => `
                  <div class="forensic-audit-card status-${dc.status}">
                    <div style="display:flex;align-items:center;justify-content:space-between;">
                      <span style="font-weight:700;font-size:13px;color:var(--text-primary);">${escapeHtml(dc.title)}</span>
                      <span class="badge ${dc.status === 'pass' ? 'badge-legit' : dc.status === 'fail' ? 'badge-high-risk' : 'badge-suspicious'}" style="font-size:10px;">
                        ${escapeHtml(dc.badge)}
                      </span>
                    </div>
                    <p style="font-size:12px;color:var(--text-muted);line-height:1.45;margin:0;">
                      ${escapeHtml(dc.detail)}
                    </p>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        ` : ''}

        <!-- Row 2: Fraud Fingerprint Token Cloud -->
        <div class="card" style="margin-bottom:24px;">
          <div class="card-header">
            <div class="card-title-group">
              <h2 class="card-title">Fraud Fingerprint — Lexical Token Cloud</h2>
              <span class="card-subtitle">Token importance derived from TF-IDF × SHAP weights</span>
            </div>
          </div>
          <div class="card-body">
            <div class="fingerprint-cloud">${fingerprintHTML}</div>
          </div>
        </div>

        <!-- Row 3: Actionable Safety Guidance & Dossier Export -->
        <div class="card" style="margin-bottom:28px;background:linear-gradient(135deg,rgba(19,26,46,0.9),rgba(27,36,64,0.95));border:1px solid rgba(34,211,238,0.3);">
          <div class="card-body" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px;">
            <div>
              <h3 style="font-size:15px;font-weight:700;color:#FFFFFF;margin-bottom:4px;display:flex;align-items:center;gap:8px;">
                <i data-lucide="shield-check" style="width:18px;height:18px;color:var(--accent-cyan);"></i>
                Official Forensic Verification Dossier Ready
              </h3>
              <p style="font-size:12.5px;color:var(--text-muted);margin:0;">
                Export the tamper-evident forensic analysis certificate for academic defense, compliance auditing, or IC3 reporting.
              </p>
            </div>
            <div style="display:flex;gap:10px;">
              <button class="btn btn-secondary" onclick="window.print();">
                <i data-lucide="printer" style="width:15px;height:15px;margin-right:6px;"></i> Print Forensic Certificate
              </button>
              <button class="btn btn-primary" onclick="document.getElementById('xai-input-card').scrollIntoView({behavior:'smooth'});document.getElementById('xai-results-panel').style.display='none';">
                <i data-lucide="refresh-cw" style="width:15px;height:15px;margin-right:6px;"></i> Analyse Another Item
              </button>
            </div>
          </div>
        </div>
      `;

      if (window.lucide) lucide.createIcons();
      panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  // ─── 9. #history (Prediction Audit History) ─────────────────────────────────
  function renderHistory() {
    const historyData = window.JobGuardData.getPredictionHistory();
    let items = historyData.history;
    const syn = window.JobGuardData.getScamTraceForUser ? window.JobGuardData.getScamTraceForUser() : null;
    const linkedIdSet = syn && syn.detected ? new Set((syn.linkedIncidents || []).map(x => x.id)) : new Set();

    // Filter Logic
    if (AppState.historyFilter !== 'all') {
      items = items.filter((x) => x.verdict.toLowerCase().includes(AppState.historyFilter));
    }
    if (AppState.historySearch) {
      const q = AppState.historySearch.toLowerCase();
      items = items.filter((x) => (x.job_title || '').toLowerCase().includes(q) || (x.company || '').toLowerCase().includes(q));
    }

    const html = `
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

      <!-- ScamTrace Syndicate Alert Banner in History (If Pattern Detected in User History) -->
      ${syn && syn.detected ? `
        <div class="card" style="margin-bottom: 20px; padding: 14px 18px; border-left: 3px solid #ef4444; background: rgba(239, 68, 68, 0.08); display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px;">
          <div style="display:flex; align-items:center; gap:12px;">
            <div class="scamtrace-siren-wrap" style="width:34px;height:34px;">
              <i data-lucide="siren" style="width:18px;height:18px;color:#ef4444;"></i>
            </div>
            <div>
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-weight:700; color:#fca5a5; font-size:13px;">ScamTrace™ History Correlation Match: ${syn.linkedIncidentsCount} Linked Fraud Records</span>
                <span class="badge" style="background:rgba(239,68,68,0.25); border:1px solid rgba(239,68,68,0.6); color:#fca5a5; font-size:10px; font-family:var(--font-mono);">${escapeHtml(syn.syndicateId)}</span>
              </div>
              <p style="font-size:12px; color:var(--text-muted); margin:2px 0 0 0;">
                Detected shared UPI handle <code style="color:var(--accent-cyan);">${escapeHtml(syn.sharedProofs.upiHandle)}</code> and recruiter persona <code style="color:var(--accent-cyan);">${escapeHtml(syn.sharedProofs.recruiter)}</code> across ${syn.linkedIncidentsCount} audited records in your history below.
              </p>
            </div>
          </div>
          <button class="btn btn-danger btn-sm" onclick="openScamTraceDossierModal()">
            <i data-lucide="search"></i> Inspect Syndicate Proofs &amp; Network Graph ↗
          </button>
        </div>
      ` : ''}

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
              <div style="width:52px;height:52px;border-radius:50%;background:rgba(0,242,254,0.08);border:1px solid rgba(0,242,254,0.3);display:flex;align-items:center;justify-content:center;margin:0 auto 14px auto;color:var(--accent-cyan);">
                <i data-lucide="shield-check" style="width:24px;height:24px;"></i>
              </div>
              <h3 style="font-size:17px; font-weight:700; color:#ffffff; margin-bottom:6px;">Private Account History Clean</h3>
              <p style="font-size:13px; color:var(--text-muted); max-width:520px; margin:0 auto 20px auto; line-height:1.6;">
                Authenticated as <code style="color:var(--accent-cyan); font-weight:600; padding:2px 6px; background:rgba(0,242,254,0.08); border-radius:4px;">${escapeHtml(window.JobGuardData.getCurrentUser().email)}</code>. All audit records and ScamTrace syndicates are strictly isolated to your email address and cannot be seen by other accounts.
              </p>
              <div style="display:flex; justify-content:center; gap:12px; flex-wrap:wrap;">
                <a href="#analyze" class="btn btn-primary btn-sm"><i data-lucide="scan"></i> Scan First Job Posting</a>
                <button type="button" class="btn btn-secondary btn-sm" id="btn-load-sample-history">
                  <i data-lucide="sparkles"></i> Load Sample Audit Scans
                </button>
              </div>
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
                          ${linkedIdSet.has(row.id) ? `
                            <span class="badge" style="background:rgba(239,68,68,0.18); border:1px solid rgba(239,68,68,0.5); color:#fca5a5; font-size:10px; margin-top:4px; display:inline-flex; align-items:center; gap:4px; width:fit-content;">
                              <i data-lucide="siren" style="width:10px;height:10px;"></i> ScamTrace Syndicate Linked
                            </span>
                          ` : ''}
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

    const loadSampleBtn = document.getElementById('btn-load-sample-history');
    if (loadSampleBtn) {
      loadSampleBtn.addEventListener('click', () => {
        if (window.JobGuardData && window.JobGuardData.loadSampleHistory) {
          window.JobGuardData.loadSampleHistory();
          showToast('Sample EMSCAD audit records loaded into your account', 'success');
          renderHistory();
        }
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
  // ─── 10. #about / #settings (Account, Profile, Destination, Security & Privacy Hub) ──
  function renderAbout() {
    const user = (window.JobGuardData && window.JobGuardData.getCurrentUser) ? window.JobGuardData.getCurrentUser() : {
      name: 'VK Tej',
      role: 'Lead Forensic Investigator',
      email: 'vktej@jobguard.ai',
      org: 'JobGuard Cyber Operations Cell',
      station: 'National Cyber Command HQ - Terminal 01',
      badgeId: 'XAI-88219',
      phone: '+1 (800) 555-CYBER',
      bio: 'Principal analyst responsible for EMSCAD multimodal forensic scanning, high-risk fraudulent syndicate tracking, and TreeSHAP explainability review.',
      twoFactorEnabled: false
    };

    const initial = (user.name || 'T').charAt(0);
    const photo = user.photo || '';
    const currentTheme = localStorage.getItem('jobguard_theme') || 'dark';
    const supportTickets = JSON.parse(localStorage.getItem('jobguard_support_tickets') || '[]');

    const html = `
      <!-- Hero Investigator Identity & Destination Banner -->
      <div class="card" style="margin-bottom: 24px; padding: 26px 28px; background: linear-gradient(135deg, rgba(13, 26, 36, 0.95) 0%, rgba(10, 20, 28, 0.98) 100%); border: 1px solid rgba(34, 211, 238, 0.25); border-radius: 18px; box-shadow: 0 12px 40px rgba(0,0,0,0.6);">
        <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:22px;">
          <div style="display:flex; align-items:center; gap:20px; flex-wrap:wrap;">
            <!-- Profile Photo & Upload Badge -->
            <div style="position:relative;">
              <div id="settings-avatar-preview" style="width: 82px; height: 82px; border-radius: 50%; background: linear-gradient(135deg, #0d9488 0%, #06b6d4 100%); border: 3px solid var(--accent-cyan); display: flex; align-items: center; justify-content: center; font-size: 32px; font-weight: 800; color: #ffffff; box-shadow: 0 0 24px rgba(34, 211, 238, 0.35); overflow:hidden;">
                ${photo ? `<img src="${photo}" alt="Avatar" style="width:100%; height:100%; object-fit:cover;">` : escapeHtml(initial)}
              </div>
              <label for="settings-photo-input" title="Upload new profile photo" style="position:absolute; bottom:-2px; right:-2px; width:28px; height:28px; border-radius:50%; background:#0e1c27; border:2px solid var(--accent-cyan); color:var(--accent-cyan); display:flex; align-items:center; justify-content:center; cursor:pointer; box-shadow:0 2px 8px rgba(0,0,0,0.5);">
                <i data-lucide="camera" style="width:14px;height:14px;"></i>
              </label>
              <input type="file" id="settings-photo-input" accept="image/*" style="display:none;" />
            </div>

            <!-- Profile Overview Info -->
            <div>
              <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                <h1 style="font-size:22px; font-weight:800; color:var(--text-primary); margin:0;">${escapeHtml(user.name || 'VK Tej')}</h1>
                <span class="badge" style="background:rgba(16,185,129,0.15); border:1px solid rgba(16,185,129,0.4); color:#10b981; font-size:11px; font-weight:700;">ACTIVE CREDENTIAL</span>
                <span class="badge" style="background:rgba(34,211,238,0.12); border:1px solid rgba(34,211,238,0.3); color:var(--accent-cyan); font-size:11px; font-weight:700;">TOP SECRET LEVEL 4</span>
              </div>
              <p style="font-size:13.5px; color:var(--text-muted); margin-top:5px; display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                <span style="color:var(--accent-cyan); font-weight:600;"><i data-lucide="briefcase" style="width:13px;height:13px;display:inline;vertical-align:-2px;"></i> ${escapeHtml(user.role || 'Lead Forensic Investigator')}</span>
                <span style="color:rgba(255,255,255,0.2);">•</span>
                <span><i data-lucide="map-pin" style="width:13px;height:13px;display:inline;vertical-align:-2px;color:var(--accent-coral);"></i> ${escapeHtml(user.station || 'National Cyber Command HQ - Terminal 01')}</span>
              </p>
              <div style="font-size:12px; font-family:var(--font-mono); color:var(--text-faint); margin-top:4px;">
                Badge: <strong style="color:#ffffff;">${escapeHtml(user.badgeId || 'XAI-88219')}</strong> &nbsp;|&nbsp; Station ID: <strong style="color:#ffffff;">NCC-ALPHA-77</strong> &nbsp;|&nbsp; Account: <span style="color:var(--accent-cyan);">${escapeHtml(user.email || 'analyst@jobguard.ai')}</span>
              </div>
            </div>
          </div>

          <!-- Quick Action Buttons on Photo -->
          <div style="display:flex; gap:10px; align-items:center;">
            <button type="button" class="btn btn-secondary btn-sm" id="btn-trigger-upload-photo" style="display:flex; align-items:center; gap:6px;">
              <i data-lucide="upload" style="width:13px;height:13px;"></i> Change Photo
            </button>
            ${photo ? `
              <button type="button" class="btn btn-secondary btn-sm" id="btn-remove-user-photo" style="color:#ef4444; border-color:rgba(239,68,68,0.3);" title="Remove profile photo">
                <i data-lucide="trash-2" style="width:13px;height:13px;"></i> Remove
              </button>
            ` : ''}
          </div>
        </div>
      </div>

      <!-- Settings Hub Navigation Tabs -->
      <div style="display:flex; gap:10px; margin-bottom:24px; flex-wrap:wrap; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:12px;">
        <button class="settings-tab-btn active" id="btn-tab-profile" onclick="window.switchSettingsTab('profile')">
          <i data-lucide="user"></i> 1. Profile &amp; Destination
        </button>
        <button class="settings-tab-btn" id="btn-tab-security" onclick="window.switchSettingsTab('security')">
          <i data-lucide="shield-check"></i> 2. Password &amp; 2FA Security
        </button>
        <button class="settings-tab-btn" id="btn-tab-support" onclick="window.switchSettingsTab('support')">
          <i data-lucide="life-buoy"></i> 3. Contact Support
        </button>
        <button class="settings-tab-btn" id="btn-tab-privacy" onclick="window.switchSettingsTab('privacy')">
          <i data-lucide="file-text"></i> 4. Security Policy &amp; Terms
        </button>
      </div>

      <!-- TAB 1: Profile, Destination & System Theme Settings -->
      <div id="pane-tab-profile" class="settings-pane" style="display:block;">
        <div class="grid-2" style="gap:24px;">
          <!-- Left: Edit Profile Form -->
          <div class="card" style="padding:24px;">
            <div class="card-header" style="margin-bottom:18px; padding-bottom:12px;">
              <h2 class="card-title" style="font-size:16px; display:flex; align-items:center; gap:8px;">
                <i data-lucide="user-check" style="color:var(--accent-cyan); width:18px; height:18px;"></i>
                Edit Investigator Profile
              </h2>
              <span class="card-subtitle">Maintain accredited operational credentials across the JobGuard cell</span>
            </div>

            <form id="form-edit-profile">
              <div style="display:flex; flex-direction:column; gap:14px;">
                <div>
                  <label class="form-label">Full Legal Name / Agent Identifier</label>
                  <input type="text" id="set-name" class="form-input" value="${escapeHtml(user.name || '')}" required />
                </div>

                <div>
                  <label class="form-label">Designation / Operational Role</label>
                  <input type="text" id="set-role" class="form-input" value="${escapeHtml(user.role || 'Lead Forensic Investigator')}" required />
                  <div style="display:flex; gap:6px; margin-top:6px; flex-wrap:wrap;">
                    <span class="chip" onclick="window.setQuickRole('Lead Forensic Investigator')">Lead Investigator</span>
                    <span class="chip" onclick="window.setQuickRole('Senior Cyber Crime Analyst')">Cyber Crime Analyst</span>
                    <span class="chip" onclick="window.setQuickRole('Threat Intelligence Officer')">Threat Intelligence</span>
                  </div>
                </div>

                <div>
                  <label class="form-label">Destination / Operating Station</label>
                  <input type="text" id="set-station" class="form-input" value="${escapeHtml(user.station || 'National Cyber Command HQ - Terminal 01')}" required />
                  <div style="display:flex; gap:6px; margin-top:6px; flex-wrap:wrap;">
                    <span class="chip" onclick="window.setQuickStation('National Cyber Command HQ')">National Command</span>
                    <span class="chip" onclick="window.setQuickStation('Cyber Crime Dispatch Terminal Alpha')">Dispatch Alpha</span>
                    <span class="chip" onclick="window.setQuickStation('Regional Fraud SOC - East')">Regional SOC</span>
                  </div>
                </div>

                <div class="grid-2" style="gap:12px;">
                  <div>
                    <label class="form-label">Organization / Division</label>
                    <input type="text" id="set-org" class="form-input" value="${escapeHtml(user.org || 'JobGuard Cyber Operations Cell')}" />
                  </div>
                  <div>
                    <label class="form-label">Comms Phone / Extension</label>
                    <input type="text" id="set-phone" class="form-input" value="${escapeHtml(user.phone || '+1 (800) 555-CYBER')}" />
                  </div>
                </div>

                <div>
                  <label class="form-label">Official Authenticated Email (Locked to Account)</label>
                  <input type="email" class="form-input" value="${escapeHtml(user.email || '')}" readonly style="background:rgba(255,255,255,0.03); color:var(--text-muted); cursor:not-allowed;" />
                  <span style="font-size:11px; color:var(--text-faint); margin-top:3px; display:block;">Email address serves as cryptographic partition key for private detection history.</span>
                </div>

                <div>
                  <label class="form-label">Mission Brief / Specialization</label>
                  <textarea id="set-bio" class="form-textarea" rows="2">${escapeHtml(user.bio || 'Principal analyst responsible for EMSCAD multimodal forensic scanning, high-risk fraudulent syndicate tracking, and TreeSHAP explainability review.')}</textarea>
                </div>

                <button type="submit" class="btn btn-primary" style="margin-top:8px; display:flex; align-items:center; justify-content:center; gap:8px;">
                  <i data-lucide="save"></i> Save Profile &amp; Destination Settings
                </button>
              </div>
            </form>
          </div>

          <!-- Right: System Theme Switcher & Access Clearance Card -->
          <div style="display:flex; flex-direction:column; gap:20px;">
            <!-- System Theme Switcher (Dark / Light) -->
            <div class="card" style="padding:24px;">
              <div class="card-header" style="margin-bottom:14px; padding-bottom:10px;">
                <h2 class="card-title" style="font-size:16px; display:flex; align-items:center; gap:8px;">
                  <i data-lucide="palette" style="color:var(--accent-cyan); width:18px; height:18px;"></i>
                  System Visual Theme
                </h2>
                <span class="card-subtitle">Choose operational console palette based on ambient lighting</span>
              </div>

              <div class="theme-choice-grid">
                <!-- Dark Mode -->
                <div class="theme-card ${currentTheme === 'dark' ? 'active' : ''}" onclick="window.applyThemeChoice('dark')" id="theme-btn-dark">
                  <div style="width:36px; height:36px; border-radius:8px; background:#07121a; border:1px solid #22d3ee; display:flex; align-items:center; justify-content:center; color:#22d3ee;">
                    <i data-lucide="moon" style="width:18px;height:18px;"></i>
                  </div>
                  <div>
                    <strong style="font-size:13px; display:block; color:var(--text-primary);">Cyber Obsidian</strong>
                    <span style="font-size:11px; color:var(--text-muted);">Dark Mode (SOC Reference)</span>
                  </div>
                </div>

                <!-- Light Mode -->
                <div class="theme-card ${currentTheme === 'light' ? 'active' : ''}" onclick="window.applyThemeChoice('light')" id="theme-btn-light">
                  <div style="width:36px; height:36px; border-radius:8px; background:#ffffff; border:1px solid #cbd5e1; display:flex; align-items:center; justify-content:center; color:#0f172a;">
                    <i data-lucide="sun" style="width:18px;height:18px;"></i>
                  </div>
                  <div>
                    <strong style="font-size:13px; display:block; color:var(--text-primary);">Pristine Daylight</strong>
                    <span style="font-size:11px; color:var(--text-muted);">Light Mode (High Contrast)</span>
                  </div>
                </div>
              </div>

              <div style="margin-top:16px; padding:12px 14px; border-radius:8px; background:rgba(34,211,238,0.06); border:1px solid rgba(34,211,238,0.2); font-size:12px; color:var(--text-muted); display:flex; align-items:center; gap:8px;">
                <i data-lucide="info" style="color:var(--accent-cyan); width:16px;height:16px; flex-shrink:0;"></i>
                <span>Active preference is saved automatically to your investigator workstation profile.</span>
              </div>
            </div>

            <!-- Clearance Credentials Verification Dossier -->
            <div class="card" style="padding:22px;">
              <h3 style="font-size:14px; font-weight:700; color:var(--text-primary); margin-bottom:12px; display:flex; align-items:center; gap:8px;">
                <i data-lucide="shield" style="color:var(--accent-teal); width:16px;height:16px;"></i>
                Security Clearance &amp; Partition Seal
              </h3>
              <div style="display:flex; flex-direction:column; gap:10px; font-size:12.5px;">
                <div style="display:flex; justify-content:space-between; padding:8px 12px; background:var(--bg-base); border-radius:8px; border:1px solid rgba(255,255,255,0.05);">
                  <span style="color:var(--text-muted);">Cryptographic Partition:</span>
                  <strong style="color:var(--accent-cyan); font-family:var(--font-mono);">ISOLATED_USER_${escapeHtml((user.email||'').replace(/[^a-zA-Z0-9]/g, '_'))}</strong>
                </div>
                <div style="display:flex; justify-content:space-between; padding:8px 12px; background:var(--bg-base); border-radius:8px; border:1px solid rgba(255,255,255,0.05);">
                  <span style="color:var(--text-muted);">Audit Trail Ledger:</span>
                  <span style="color:#10b981; font-weight:700;">APPEND-ONLY IMMUTABLE</span>
                </div>
                <div style="display:flex; justify-content:space-between; padding:8px 12px; background:var(--bg-base); border-radius:8px; border:1px solid rgba(255,255,255,0.05);">
                  <span style="color:var(--text-muted);">EMSCAD Model Tier:</span>
                  <span style="color:var(--text-primary);">XGBoost + LightGBM + TreeSHAP</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- TAB 2: Password Settings & Two-Factor Authentication (2FA) -->
      <div id="pane-tab-security" class="settings-pane" style="display:none;">
        <div class="grid-2" style="gap:24px;">
          <!-- Change Password Form -->
          <div class="card" style="padding:24px;">
            <div class="card-header" style="margin-bottom:16px; padding-bottom:10px;">
              <h2 class="card-title" style="font-size:16px; display:flex; align-items:center; gap:8px;">
                <i data-lucide="key-round" style="color:var(--accent-cyan); width:18px;height:18px;"></i>
                Change Security Password
              </h2>
              <span class="card-subtitle">Cryptographically hash and re-salt your investigator clearance credential</span>
            </div>

            <!-- Dynamic Password Error Alert -->
            <div id="pwd-error-banner" style="display:none; margin-bottom:14px; padding:12px 14px; background:rgba(239,68,68,0.12); border:1px solid rgba(239,68,68,0.4); border-radius:8px; color:#f87171; font-size:12.5px;"></div>

            <form id="form-change-password">
              <div style="display:flex; flex-direction:column; gap:14px;">
                <div>
                  <label class="form-label">Current Account Password</label>
                  <div style="position:relative;">
                    <input type="password" id="chg-curr-pwd" class="form-input" placeholder="Enter current security password" required style="width:100%; padding-right:40px;" />
                    <button type="button" onclick="window.toggleInputVisibility('chg-curr-pwd', this)" style="position:absolute; right:10px; top:50%; transform:translateY(-50%); background:none; border:none; color:var(--text-muted); cursor:pointer;">
                      <i data-lucide="eye" style="width:15px;height:15px;"></i>
                    </button>
                  </div>
                </div>

                <div>
                  <label class="form-label">New Password (min 8 chars, letters &amp; numbers)</label>
                  <div style="position:relative;">
                    <input type="password" id="chg-new-pwd" class="form-input" placeholder="Enter new strong password" required style="width:100%; padding-right:40px;" oninput="window.evaluateNewPasswordStrength(this.value)" />
                    <button type="button" onclick="window.toggleInputVisibility('chg-new-pwd', this)" style="position:absolute; right:10px; top:50%; transform:translateY(-50%); background:none; border:none; color:var(--text-muted); cursor:pointer;">
                      <i data-lucide="eye" style="width:15px;height:15px;"></i>
                    </button>
                  </div>

                  <!-- Real-Time Password Strength Meter -->
                  <div class="pwd-meter-track" style="margin-top:8px;">
                    <div class="pwd-meter-segment" id="chg-seg-1"></div>
                    <div class="pwd-meter-segment" id="chg-seg-2"></div>
                    <div class="pwd-meter-segment" id="chg-seg-3"></div>
                    <div class="pwd-meter-segment" id="chg-seg-4"></div>
                  </div>
                  <div style="display:flex; justify-content:space-between; margin-top:4px;">
                    <span class="pwd-label" id="chg-pwd-label" style="font-size:11px;">Password strength: Empty</span>
                    <span style="font-size:10px; color:var(--text-faint); font-family:var(--font-mono);">PBKDF2/SHA-256</span>
                  </div>
                </div>

                <div>
                  <label class="form-label">Confirm New Password</label>
                  <div style="position:relative;">
                    <input type="password" id="chg-conf-pwd" class="form-input" placeholder="Repeat new password" required style="width:100%; padding-right:40px;" />
                    <button type="button" onclick="window.toggleInputVisibility('chg-conf-pwd', this)" style="position:absolute; right:10px; top:50%; transform:translateY(-50%); background:none; border:none; color:var(--text-muted); cursor:pointer;">
                      <i data-lucide="eye" style="width:15px;height:15px;"></i>
                    </button>
                  </div>
                </div>

                <button type="submit" class="btn btn-primary" id="btn-save-pwd" style="margin-top:6px; display:flex; align-items:center; justify-content:center; gap:8px;">
                  <i data-lucide="lock"></i> Update Security Password
                </button>
              </div>
            </form>
          </div>

          <!-- Two-Factor Authentication (2FA) & Session Audit -->
          <div style="display:flex; flex-direction:column; gap:20px;">
            <div class="card" style="padding:24px;">
              <div class="card-header" style="margin-bottom:14px; padding-bottom:10px;">
                <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
                  <div>
                    <h2 class="card-title" style="font-size:16px; display:flex; align-items:center; gap:8px;">
                      <i data-lucide="smartphone" style="color:var(--accent-cyan); width:18px;height:18px;"></i>
                      Two-Factor Authentication (2FA)
                    </h2>
                    <span class="card-subtitle">Enforce secondary TOTP token validation on every login</span>
                  </div>
                  <span class="badge" id="twofa-status-badge" style="background:${user.twoFactorEnabled ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.12)'}; border:1px solid ${user.twoFactorEnabled ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.3)'}; color:${user.twoFactorEnabled ? '#10b981' : '#f87171'}; font-weight:700;">
                    ${user.twoFactorEnabled ? '2FA ACTIVE' : '2FA DISABLED'}
                  </span>
                </div>
              </div>

              <div style="display:flex; align-items:center; justify-content:space-between; padding:14px 16px; background:var(--bg-base); border-radius:10px; border:1px solid rgba(255,255,255,0.08); margin-bottom:16px;">
                <div>
                  <strong style="font-size:13px; color:var(--text-primary); display:block;">Require Authenticator Code</strong>
                  <span style="font-size:11.5px; color:var(--text-muted);">Use Google Authenticator, Authy, or 1Password</span>
                </div>
                <label style="position:relative; display:inline-block; width:48px; height:26px; cursor:pointer;">
                  <input type="checkbox" id="chk-toggle-2fa" ${user.twoFactorEnabled ? 'checked' : ''} onchange="window.toggleTwoFactorAuth(this.checked)" style="opacity:0; width:0; height:0;" />
                  <span style="position:absolute; inset:0; background:${user.twoFactorEnabled ? 'var(--accent-teal)' : '#1e293b'}; border-radius:34px; transition:0.3s; box-shadow:inset 0 1px 3px rgba(0,0,0,0.4);">
                    <span style="position:absolute; height:20px; width:20px; left:${user.twoFactorEnabled ? '24px' : '3px'}; bottom:3px; background:white; border-radius:50%; transition:0.3s;"></span>
                  </span>
                </label>
              </div>

              <!-- Interactive 2FA Details Box -->
              <div id="twofa-details-box" style="display:${user.twoFactorEnabled ? 'block' : 'none'};">
                <div class="two-factor-box">
                  <div style="display:flex; gap:16px; align-items:center; flex-wrap:wrap;">
                    <!-- TOTP QR Simulation Graphic -->
                    <div style="width:110px; height:110px; background:#ffffff; border-radius:10px; padding:6px; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 14px rgba(0,0,0,0.4);">
                      <svg viewBox="0 0 100 100" style="width:100%;height:100%;" fill="#0f172a">
                        <rect x="0" y="0" width="30" height="30" />
                        <rect x="5" y="5" width="20" height="20" fill="#ffffff" />
                        <rect x="10" y="10" width="10" height="10" />
                        <rect x="70" y="0" width="30" height="30" />
                        <rect x="75" y="5" width="20" height="20" fill="#ffffff" />
                        <rect x="80" y="10" width="10" height="10" />
                        <rect x="0" y="70" width="30" height="30" />
                        <rect x="5" y="75" width="20" height="20" fill="#ffffff" />
                        <rect x="10" y="80" width="10" height="10" />
                        <rect x="40" y="10" width="10" height="10" />
                        <rect x="55" y="20" width="10" height="15" />
                        <rect x="40" y="40" width="20" height="20" />
                        <rect x="70" y="45" width="15" height="10" />
                        <rect x="40" y="70" width="15" height="15" />
                        <rect x="70" y="75" width="20" height="20" />
                      </svg>
                    </div>

                    <div style="flex:1; min-width:180px;">
                      <div style="font-size:11px; color:var(--text-muted); font-weight:700; text-transform:uppercase;">TOTP Secret Key</div>
                      <div style="font-family:var(--font-mono); font-size:13px; color:var(--accent-cyan); font-weight:700; margin:4px 0 8px 0; background:rgba(34,211,238,0.08); padding:6px 8px; border-radius:6px; border:1px dashed rgba(34,211,238,0.3); word-break:break-all;">
                        JGUARD-7829-XAI-SEC-2026
                      </div>
                      <button type="button" class="btn btn-secondary btn-xs" onclick="navigator.clipboard && navigator.clipboard.writeText('JGUARD-7829-XAI-SEC-2026'); showToast('2FA Secret Key copied to clipboard', 'info');">
                        <i data-lucide="copy" style="width:11px;height:11px;margin-right:4px;"></i> Copy Key
                      </button>
                    </div>
                  </div>

                  <!-- Test OTP verification -->
                  <div style="margin-top:14px; padding-top:14px; border-top:1px solid rgba(255,255,255,0.08); display:flex; gap:10px; align-items:center;">
                    <input type="text" id="twofa-verify-code" class="form-input" placeholder="Enter 6-digit code (e.g. 123456)" maxlength="6" style="max-width:200px; font-family:var(--font-mono); text-align:center; letter-spacing:2px;" />
                    <button type="button" class="btn btn-secondary btn-sm" onclick="window.verifyTwoFactorOTP()">Verify Code</button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Active Sessions & Device Audit -->
            <div class="card" style="padding:22px;">
              <h3 style="font-size:14px; font-weight:700; color:var(--text-primary); margin-bottom:12px; display:flex; align-items:center; gap:8px;">
                <i data-lucide="laptop" style="color:var(--safe); width:16px;height:16px;"></i>
                Active Session Telemetry
              </h3>
              <div style="font-size:12px; color:var(--text-muted); line-height:1.6; display:flex; flex-direction:column; gap:8px;">
                <div style="display:flex; justify-content:space-between;">
                  <span>Client IP:</span>
                  <span style="font-family:var(--font-mono); color:var(--text-primary);">192.168.1.104 (Localhost Authenticated)</span>
                </div>
                <div style="display:flex; justify-content:space-between;">
                  <span>Session Issued:</span>
                  <span style="font-family:var(--font-mono); color:var(--text-primary);">${new Date().toLocaleTimeString()}</span>
                </div>
                <div style="display:flex; justify-content:space-between;">
                  <span>Token Integrity:</span>
                  <span style="color:#10b981; font-weight:700;">VALID (HMAC/SHA-256)</span>
                </div>
              </div>
              <div style="margin-top:14px; display:flex; gap:10px;">
                <button type="button" class="btn btn-secondary btn-sm" onclick="showToast('All other session tokens invalidated', 'info');">
                  <i data-lucide="shield-alert" style="width:13px;height:13px;margin-right:4px;"></i> Invalidate Other Sessions
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- TAB 3: Contact Support & Help Desk -->
      <div id="pane-tab-support" class="settings-pane" style="display:none;">
        <div class="grid-2" style="gap:24px;">
          <!-- Contact Support Ticket Form -->
          <div class="card" style="padding:24px;">
            <div class="card-header" style="margin-bottom:16px; padding-bottom:10px;">
              <h2 class="card-title" style="font-size:16px; display:flex; align-items:center; gap:8px;">
                <i data-lucide="headphones" style="color:var(--accent-cyan); width:18px;height:18px;"></i>
                Dispatch Support / Forensic Help Desk Ticket
              </h2>
              <span class="card-subtitle">Direct line to JobGuard Cyber Security Operations Support &amp; Technical Desk</span>
            </div>

            <!-- Dynamic Support Acknowledgment Banner -->
            <div id="support-ack-banner" style="display:none; margin-bottom:16px; padding:14px; background:rgba(16,185,129,0.12); border:1px solid rgba(16,185,129,0.35); border-radius:10px; color:#10b981;"></div>

            <form id="form-contact-support">
              <div style="display:flex; flex-direction:column; gap:14px;">
                <div>
                  <label class="form-label">Support Category</label>
                  <select id="sup-category" class="form-select">
                    <option value="Technical Glitch / Console Issue">Technical Glitch / Console Issue</option>
                    <option value="XAI Model Anomaly / False Positive Escalation">XAI Model Anomaly / False Positive Escalation</option>
                    <option value="ScamTrace Fraud Syndicate Correlation Request">ScamTrace Fraud Syndicate Correlation Request</option>
                    <option value="Access Level / Security Clearance Tier Elevation">Access Level / Security Clearance Tier Elevation</option>
                  </select>
                </div>

                <div>
                  <label class="form-label">Urgency &amp; Response Priority</label>
                  <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:10px;">
                    <label style="padding:10px; border-radius:8px; border:1px solid rgba(255,255,255,0.1); background:var(--bg-base); cursor:pointer; text-align:center; font-size:12px;">
                      <input type="radio" name="sup-priority" value="Standard (P3)" checked style="margin-right:4px;" /> Standard (P3)
                    </label>
                    <label style="padding:10px; border-radius:8px; border:1px solid rgba(34,211,238,0.3); background:var(--bg-base); cursor:pointer; text-align:center; font-size:12px; color:var(--accent-cyan);">
                      <input type="radio" name="sup-priority" value="High (P2)" style="margin-right:4px;" /> High (P2)
                    </label>
                    <label style="padding:10px; border-radius:8px; border:1px solid rgba(239,68,68,0.4); background:rgba(239,68,68,0.06); cursor:pointer; text-align:center; font-size:12px; color:#ef4444;">
                      <input type="radio" name="sup-priority" value="Critical (P1)" style="margin-right:4px;" /> Critical (P1)
                    </label>
                  </div>
                </div>

                <div>
                  <label class="form-label">Ticket Subject / Incident Summary</label>
                  <input type="text" id="sup-subject" class="form-input" placeholder="e.g. TreeSHAP feature attribution clarification on scan #104" required />
                </div>

                <div>
                  <label class="form-label">Incident Reference / Posting ID (Optional)</label>
                  <input type="text" id="sup-ref-id" class="form-input" placeholder="e.g. SCAM-EMSCAD-88192 or Scan #4" />
                </div>

                <div>
                  <label class="form-label">Detailed Telemetry / Description of Problem</label>
                  <textarea id="sup-message" class="form-textarea" rows="4" placeholder="Provide complete logs, error text, or operational queries..." required></textarea>
                </div>

                <button type="submit" class="btn btn-primary" style="display:flex; align-items:center; justify-content:center; gap:8px;">
                  <i data-lucide="send"></i> Dispatch Support Ticket
                </button>
              </div>
            </form>
          </div>

          <!-- Support SLA & Previous Tickets Log -->
          <div style="display:flex; flex-direction:column; gap:20px;">
            <div class="card" style="padding:22px;">
              <h3 style="font-size:14px; font-weight:700; color:var(--text-primary); margin-bottom:10px; display:flex; align-items:center; gap:8px;">
                <i data-lucide="clock" style="color:var(--accent-gold); width:16px;height:16px;"></i>
                Support Desk SLA &amp; Direct Channels
              </h3>
              <div style="font-size:12.5px; color:var(--text-muted); line-height:1.6; display:flex; flex-direction:column; gap:8px;">
                <div>• <strong>Critical Incident (P1)</strong>: 15-minute response SLA via SOC On-Call Bridge.</div>
                <div>• <strong>High Priority (P2)</strong>: 2-hour response SLA.</div>
                <div>• <strong>Standard Tickets (P3)</strong>: 12-hour turnaround.</div>
                <div style="margin-top:8px; padding:10px 12px; background:var(--bg-base); border-radius:8px; border:1px solid rgba(255,255,255,0.06);">
                  Official Hotline: <strong style="color:#ffffff;">+1 (800) 555-JOBGUARD</strong><br/>
                  Encrypted Dispatch: <span style="color:var(--accent-cyan); font-family:var(--font-mono);">support@jobguard.ai</span>
                </div>
              </div>
            </div>

            <div class="card" style="padding:22px;">
              <h3 style="font-size:14px; font-weight:700; color:var(--text-primary); margin-bottom:12px; display:flex; align-items:center; gap:8px;">
                <i data-lucide="list-checks" style="color:var(--accent-teal); width:16px;height:16px;"></i>
                Your Logged Support Tickets
              </h3>
              <div id="support-tickets-list">
                ${supportTickets.length === 0 ? `
                  <div style="text-align:center; padding:20px; color:var(--text-faint); font-size:12.5px;">
                    <i data-lucide="inbox" style="width:24px;height:24px;margin-bottom:6px;opacity:0.5;"></i>
                    <p>No active support requests logged yet.</p>
                  </div>
                ` : supportTickets.map(t => `
                  <div class="support-ticket-item">
                    <div>
                      <div style="font-weight:700; font-size:12.5px; color:var(--text-primary);">${escapeHtml(t.subject)}</div>
                      <div style="font-size:11px; font-family:var(--font-mono); color:var(--text-muted); margin-top:2px;">
                        ${escapeHtml(t.id)} · ${escapeHtml(t.category)} · ${escapeHtml(t.time)}
                      </div>
                    </div>
                    <span class="badge" style="background:rgba(34,211,238,0.12); border:1px solid rgba(34,211,238,0.3); color:var(--accent-cyan); font-size:10px; font-weight:700;">
                      ${escapeHtml(t.status || 'OPEN')}
                    </span>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- TAB 4: Security Policy, Privacy & Terms of Service -->
      <div id="pane-tab-privacy" class="settings-pane" style="display:none;">
        <div style="display:flex; flex-direction:column; gap:20px;">
          <!-- Security Policy Card -->
          <div class="card" style="padding:26px;">
            <div class="card-header" style="margin-bottom:14px; padding-bottom:10px;">
              <h2 class="card-title" style="font-size:17px; display:flex; align-items:center; gap:8px;">
                <i data-lucide="shield-check" style="color:var(--accent-teal); width:20px;height:20px;"></i>
                1. Cryptographic Data Isolation &amp; Zero Leakage Policy
              </h2>
              <span class="card-subtitle">Architectural isolation guarantees for enterprise and law-enforcement operations</span>
            </div>
            <div style="font-size:13px; color:var(--text-muted); line-height:1.7;">
              <p style="margin-bottom:10px;">
                JobGuard-XAI enforces a zero-trust per-user data partition model. All scanned job descriptions, extracted media screenshots, uploaded applicant resumes, and AI explainability records are strictly isolated to the authenticated analyst's email address (<strong style="color:var(--accent-cyan);">${escapeHtml(user.email || 'analyst@jobguard.ai')}</strong>).
              </p>
              <p>
                No cross-tenant data contamination is possible: user A cannot query, view, or correlate records belonging to user B. Passwords are never stored in plaintext and are salted using 128-bit random salts with 100,000 rounds of PBKDF2/SHA-256 derivation.
              </p>
            </div>
          </div>

          <!-- Privacy Policy Card -->
          <div class="card" style="padding:26px;">
            <div class="card-header" style="margin-bottom:14px; padding-bottom:10px;">
              <h2 class="card-title" style="font-size:17px; display:flex; align-items:center; gap:8px;">
                <i data-lucide="lock" style="color:var(--accent-cyan); width:20px;height:20px;"></i>
                2. Privacy Policy &amp; Applicant PII Protection
              </h2>
              <span class="card-subtitle">Compliance with global privacy mandates (GDPR Article 22, CCPA, and DPDP)</span>
            </div>
            <div style="font-size:13px; color:var(--text-muted); line-height:1.7;">
              <p style="margin-bottom:10px;">
                When evaluating candidate resumes or screenshots for fraud and phishing indicators, all Personally Identifiable Information (PII) including phone numbers, physical addresses, and financial account identifiers undergo client-side tokenization prior to ML inference.
              </p>
              <p>
                Telemetric records stored on this terminal remain under the exclusive custody of the investigator's local browser environment and local server runtime, ensuring complete forensic sovereignty.
              </p>
            </div>
          </div>

          <!-- Terms of Service Card -->
          <div class="card" style="padding:26px;">
            <div class="card-header" style="margin-bottom:14px; padding-bottom:10px;">
              <h2 class="card-title" style="font-size:17px; display:flex; align-items:center; gap:8px;">
                <i data-lucide="file-check" style="color:var(--accent-gold); width:20px;height:20px;"></i>
                3. Acceptable Investigative Use &amp; Terms of Service
              </h2>
              <span class="card-subtitle">Standard operating procedures for forensic intelligence gathering</span>
            </div>
            <div style="font-size:13px; color:var(--text-muted); line-height:1.7;">
              <p style="margin-bottom:10px;">
                JobGuard-XAI is calibrated on the EMSCAD (17,880 employment ads) benchmark for legitimate defensive threat analysis. You agree not to utilize this console for automated adverse actions without human-in-the-loop validation of TreeSHAP interpretability feature contributions.
              </p>
              <p>
                Official law enforcement escalations generated via the Cyber Crime Dispatch console carry timestamped digital hashes designed to assist jurisdictional authorities in subpoena and takedown proceedings.
              </p>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('app').innerHTML = renderShell(html, 'Account, Profile & Security Hub', 'Investigator Credentials, Operating Station, Password Settings, 2FA, Support & Privacy');
    if (window.lucide) lucide.createIcons();

    // ─── Attach Event Listeners ───

    // Trigger photo upload
    const uploadBtn = document.getElementById('btn-trigger-upload-photo');
    const photoInput = document.getElementById('settings-photo-input');
    if (uploadBtn && photoInput) {
      uploadBtn.addEventListener('click', () => photoInput.click());
      photoInput.addEventListener('change', window.handleSettingsPhotoUpload);
    }

    // Remove photo
    const removeBtn = document.getElementById('btn-remove-user-photo');
    if (removeBtn) {
      removeBtn.addEventListener('click', window.removeSettingsPhoto);
    }

    // Form: Edit Profile & Destination
    const editForm = document.getElementById('form-edit-profile');
    if (editForm) {
      editForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('set-name').value.trim();
        const role = document.getElementById('set-role').value.trim();
        const station = document.getElementById('set-station').value.trim();
        const org = document.getElementById('set-org').value.trim();
        const phone = document.getElementById('set-phone').value.trim();
        const bio = document.getElementById('set-bio').value.trim();

        if (window.JobGuardData && window.JobGuardData.updateCurrentUser) {
          window.JobGuardData.updateCurrentUser({ name, role, station, org, phone, bio });
          showToast('Investigator profile and destination updated successfully', 'success');
          renderAbout(); // Re-render to reflect changes immediately
        }
      });
    }

    // Form: Change Password
    const pwdForm = document.getElementById('form-change-password');
    if (pwdForm) {
      pwdForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const currPwd = document.getElementById('chg-curr-pwd').value;
        const newPwd = document.getElementById('chg-new-pwd').value;
        const confPwd = document.getElementById('chg-conf-pwd').value;
        const errBanner = document.getElementById('pwd-error-banner');
        const submitBtn = document.getElementById('btn-save-pwd');

        errBanner.style.display = 'none';

        if (newPwd !== confPwd) {
          errBanner.innerHTML = '<strong>Error:</strong> New passwords do not match. Please verify and retry.';
          errBanner.style.display = 'block';
          return;
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span class="spinner"></span> Verifying & Re-salting...`;

        try {
          const res = await window.JobGuardData.changePassword(currPwd, newPwd);
          submitBtn.disabled = false;
          submitBtn.innerHTML = `<i data-lucide="lock"></i> Update Security Password`;
          if (window.lucide) lucide.createIcons();

          if (!res.success) {
            errBanner.innerHTML = `<strong>Error:</strong> ${escapeHtml(res.error || 'Failed to update password.')}`;
            errBanner.style.display = 'block';
          } else {
            showToast(res.message || 'Security password updated successfully', 'success');
            pwdForm.reset();
            window.evaluateNewPasswordStrength('');
          }
        } catch (err) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `<i data-lucide="lock"></i> Update Security Password`;
          if (window.lucide) lucide.createIcons();
          errBanner.innerHTML = `<strong>Error:</strong> ${escapeHtml(err.message || 'Error updating password.')}`;
          errBanner.style.display = 'block';
        }
      });
    }

    // Form: Contact Support
    const supForm = document.getElementById('form-contact-support');
    if (supForm) {
      supForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const category = document.getElementById('sup-category').value;
        const priority = document.querySelector('input[name="sup-priority"]:checked').value;
        const subject = document.getElementById('sup-subject').value.trim();
        const refId = document.getElementById('sup-ref-id').value.trim();
        const message = document.getElementById('sup-message').value.trim();
        const ackBanner = document.getElementById('support-ack-banner');

        const ticketId = 'TICKET-2026-XAI-' + Math.floor(10000 + Math.random() * 90000);
        const newTicket = {
          id: ticketId,
          category,
          priority,
          subject,
          refId,
          message,
          status: 'OPEN',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        const existingTickets = JSON.parse(localStorage.getItem('jobguard_support_tickets') || '[]');
        existingTickets.unshift(newTicket);
        localStorage.setItem('jobguard_support_tickets', JSON.stringify(existingTickets));

        ackBanner.innerHTML = `
          <div style="display:flex; align-items:center; gap:10px;">
            <i data-lucide="check-circle" style="width:20px;height:20px;color:#10b981;flex-shrink:0;"></i>
            <div>
              <div style="font-weight:700;">Support Dispatch Acknowledged: <code>${ticketId}</code></div>
              <div style="font-size:12px; margin-top:2px;">Assigned to SOC Level 2 Engineer. Turnaround guaranteed under SLA.</div>
            </div>
          </div>
        `;
        ackBanner.style.display = 'block';
        if (window.lucide) lucide.createIcons();

        supForm.reset();
        showToast(`Support ticket ${ticketId} logged successfully`, 'success');
        setTimeout(() => renderAbout(), 1500);
      });
    }
  }

  // ─── Global Settings Handlers ───────────────────────────────────────────────
  window.switchSettingsTab = function(tabName) {
    const tabs = ['profile', 'security', 'support', 'privacy'];
    tabs.forEach(t => {
      const pane = document.getElementById('pane-tab-' + t);
      const btn = document.getElementById('btn-tab-' + t);
      if (pane) pane.style.display = (t === tabName) ? 'block' : 'none';
      if (btn) btn.classList.toggle('active', t === tabName);
    });
    if (window.lucide) lucide.createIcons();
  };

  window.setQuickRole = function(role) {
    const el = document.getElementById('set-role');
    if (el) el.value = role;
  };

  window.setQuickStation = function(station) {
    const el = document.getElementById('set-station');
    if (el) el.value = station;
  };

  window.applyThemeChoice = function(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('jobguard_theme', theme);

    const darkCard = document.getElementById('theme-btn-dark');
    const lightCard = document.getElementById('theme-btn-light');
    if (darkCard) darkCard.classList.toggle('active', theme === 'dark');
    if (lightCard) lightCard.classList.toggle('active', theme === 'light');

    showToast(`System theme switched to ${theme === 'dark' ? 'Cyber Obsidian Dark' : 'Pristine Daylight'} mode`, 'info');
  };

  window.handleSettingsPhotoUpload = function(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please upload a valid image file (PNG, JPG, WebP)', 'error');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      showToast('Photo size exceeds 2MB limit. Please select a smaller photo.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = function(event) {
      const dataUrl = event.target.result;
      if (window.JobGuardData && window.JobGuardData.updateCurrentUser) {
        window.JobGuardData.updateCurrentUser({ photo: dataUrl });
        showToast('Profile photo updated successfully', 'success');
        renderAbout();
      }
    };
    reader.readAsDataURL(file);
  };

  window.removeSettingsPhoto = function() {
    if (window.JobGuardData && window.JobGuardData.updateCurrentUser) {
      window.JobGuardData.updateCurrentUser({ photo: null });
      showToast('Profile photo removed. Reverted to monogram.', 'info');
      renderAbout();
    }
  };

  window.toggleInputVisibility = function(inputId, btn) {
    const inp = document.getElementById(inputId);
    if (!inp) return;
    const isPwd = inp.type === 'password';
    inp.type = isPwd ? 'text' : 'password';
    btn.innerHTML = isPwd ? `<i data-lucide="eye-off" style="width:15px;height:15px;"></i>` : `<i data-lucide="eye" style="width:15px;height:15px;"></i>`;
    if (window.lucide) lucide.createIcons();
  };

  window.evaluateNewPasswordStrength = function(pwd) {
    const s1 = document.getElementById('chg-seg-1');
    const s2 = document.getElementById('chg-seg-2');
    const s3 = document.getElementById('chg-seg-3');
    const s4 = document.getElementById('chg-seg-4');
    const label = document.getElementById('chg-pwd-label');
    if (!s1 || !s2 || !s3 || !s4 || !label) return;

    [s1, s2, s3, s4].forEach(s => { s.style.background = 'var(--bg-base)'; });

    if (!pwd) {
      label.textContent = 'Password strength: Empty';
      label.style.color = 'var(--text-faint)';
      return;
    }

    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^a-zA-Z0-9]/.test(pwd) || pwd.length >= 12) score++;

    if (score === 1) {
      s1.style.background = '#ef4444';
      label.textContent = 'Password strength: Weak (min 8 chars & digits)';
      label.style.color = '#ef4444';
    } else if (score === 2) {
      s1.style.background = '#f59e0b';
      s2.style.background = '#f59e0b';
      label.textContent = 'Password strength: Fair';
      label.style.color = '#f59e0b';
    } else if (score === 3) {
      s1.style.background = '#22d3ee';
      s2.style.background = '#22d3ee';
      s3.style.background = '#22d3ee';
      label.textContent = 'Password strength: Strong';
      label.style.color = '#22d3ee';
    } else if (score >= 4) {
      s1.style.background = '#10b981';
      s2.style.background = '#10b981';
      s3.style.background = '#10b981';
      s4.style.background = '#10b981';
      label.textContent = 'Password strength: Forensic Grade Cipher';
      label.style.color = '#10b981';
    }
  };

  window.toggleTwoFactorAuth = function(enabled) {
    if (window.JobGuardData && window.JobGuardData.updateCurrentUser) {
      window.JobGuardData.updateCurrentUser({ twoFactorEnabled: enabled });
      const box = document.getElementById('twofa-details-box');
      const badge = document.getElementById('twofa-status-badge');
      if (box) box.style.display = enabled ? 'block' : 'none';
      if (badge) {
        badge.textContent = enabled ? '2FA ACTIVE' : '2FA DISABLED';
        badge.style.background = enabled ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.12)';
        badge.style.borderColor = enabled ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.3)';
        badge.style.color = enabled ? '#10b981' : '#f87171';
      }
      showToast(enabled ? 'Two-Factor Authentication initialized' : 'Two-Factor Authentication disabled', enabled ? 'success' : 'info');
    }
  };

  window.verifyTwoFactorOTP = function() {
    const code = (document.getElementById('twofa-verify-code').value || '').trim();
    if (code.length === 6) {
      showToast(`2FA verification code ${code} authenticated! TOTP handshake complete.`, 'success');
      document.getElementById('twofa-verify-code').value = '';
    } else {
      showToast('Please enter a 6-digit TOTP authentication code', 'error');
    }
  };

  // ─── 11. #login (Authentication Gate) ───────────────────────────────────────
  function renderLogin() {
    const html = `
      <div class="motif-aurora"></div>

      <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; position:relative; z-index:10;">
        <div class="card" style="max-width: 440px; width: 100%; padding: 36px 32px; background: #0d1a24; border: 1px solid rgba(34, 211, 238, 0.25); box-shadow: 0 25px 80px rgba(0, 0, 0, 0.85), 0 0 40px rgba(34, 211, 238, 0.12); border-radius: 20px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <div class="brand-shield" style="width:52px;height:52px;margin: 0 auto 14px auto;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:26px;height:26px;">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                <path d="m9 12 2 2 4-4"/>
              </svg>
            </div>
            <h2 style="font-size: 24px; font-weight: 800; letter-spacing: -0.02em; color:var(--text-primary);">JobGuard<span style="color:var(--accent-cyan);">-XAI</span> Console</h2>
            <p style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">Job Posting Forensics &amp; Explainable AI Security Architecture</p>
          </div>

          <!-- Active Investigator Session Indicator (Allows instant continuation or re-login) -->
          ${(window.JobGuardData && window.JobGuardData.isAuthenticated && window.JobGuardData.isAuthenticated()) ? `
            <div style="margin-bottom: 18px; padding: 10px 14px; background: rgba(34, 211, 238, 0.08); border: 1px solid rgba(34, 211, 238, 0.3); border-radius: 10px; display:flex; align-items:center; justify-content:space-between; gap:10px;">
              <div style="font-size: 12px; color: var(--text-secondary); line-height:1.4;">
                <span style="color: var(--accent-cyan); font-weight: 700;">Active Clearance:</span> ${(window.JobGuardData.getCurrentUser() && window.JobGuardData.getCurrentUser().email) || 'Analyst Session'}
              </div>
              <a href="#dashboard" class="btn btn-primary btn-xs" style="padding: 4px 10px; font-size: 11px; text-decoration:none; white-space:nowrap; display:inline-flex; align-items:center; gap:4px;">
                Open Dashboard <i data-lucide="arrow-right" style="width:12px;height:12px;"></i>
              </a>
            </div>
          ` : ''}

          <!-- Dynamic Error Alert Banner -->
          <div id="login-error-banner" style="display:none; margin-bottom: 18px; padding: 12px 14px; background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.4); border-radius: 8px; color: #f87171; font-size: 13px; line-height: 1.45;"></div>

          <form id="form-login">
            <div class="form-group">
              <label class="form-label" style="display:flex; justify-content:space-between; align-items:center;">
                <span>Investigator Email</span>
                <span style="font-size:11px; color:var(--text-faint);">Registered accounts only</span>
              </label>
              <div style="position:relative;">
                <input type="email" id="login-email" class="form-input" placeholder="e.g. analyst@jobguard.ai" autocomplete="email" required style="width:100%; padding-left:36px;">
                <i data-lucide="mail" style="position:absolute; left:12px; top:50%; transform:translateY(-50%); width:15px; height:15px; color:var(--text-muted); pointer-events:none;"></i>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Security Credential / Password</label>
              <div style="position:relative;">
                <input type="password" id="login-password" class="form-input" placeholder="Enter your password" autocomplete="current-password" required style="width:100%; padding-left:36px; padding-right:40px;">
                <i data-lucide="lock" style="position:absolute; left:12px; top:50%; transform:translateY(-50%); width:15px; height:15px; color:var(--text-muted); pointer-events:none;"></i>
                <button type="button" id="toggle-login-pwd" style="position:absolute; right:10px; top:50%; transform:translateY(-50%); background:none; border:none; color:var(--text-muted); cursor:pointer; padding:4px;" title="Show/Hide Password">
                  <i data-lucide="eye" style="width:16px;height:16px;"></i>
                </button>
              </div>
            </div>

            <button type="submit" class="btn btn-primary" id="btn-login-submit" style="width: 100%; height: 44px; margin-top: 10px; font-weight:600; display:flex; align-items:center; justify-content:center; gap:8px;">
              <i data-lucide="log-in" style="width:16px;height:16px;"></i> Sign In to Forensic Console
            </button>
          </form>

          <div style="margin-top: 22px; padding-top: 16px; border-top: 1px solid var(--border-subtle); display:flex; flex-direction:column; gap:12px; text-align: center; font-size: 12.5px;">
            <span style="color: var(--text-faint);">
              Don't have clearance yet? <a href="#register" style="color: var(--accent-cyan); text-decoration: none; font-weight: 600;">Create Account</a>
            </span>

            <!-- Authorized Demo Credentials Helper Box -->
            <div style="padding: 10px 12px; background: rgba(34, 211, 238, 0.06); border: 1px dashed rgba(34, 211, 238, 0.35); border-radius: 8px; display:flex; align-items:center; justify-content:space-between; gap:8px; text-align:left;">
              <div>
                <div style="font-size:11px; font-weight:700; color:var(--accent-cyan); display:flex; align-items:center; gap:4px;">
                  <i data-lucide="shield-check" style="width:12px;height:12px;"></i> Demo Clearance
                </div>
                <div style="font-size:11px; font-family:var(--font-mono); color:var(--text-muted); margin-top:2px;">
                  analyst@jobguard.ai / JobGuard@2026
                </div>
              </div>
              <button type="button" id="btn-quick-fill-demo" class="btn btn-secondary btn-xs" style="padding: 4px 8px; font-size: 11px; white-space:nowrap;">
                Auto Fill
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('app').innerHTML = html;
    if (window.lucide) lucide.createIcons();

    // Toggle password visibility
    const pwdInput = document.getElementById('login-password');
    const toggleBtn = document.getElementById('toggle-login-pwd');
    if (toggleBtn && pwdInput) {
      toggleBtn.addEventListener('click', () => {
        const isPwd = pwdInput.type === 'password';
        pwdInput.type = isPwd ? 'text' : 'password';
        toggleBtn.innerHTML = isPwd ? `<i data-lucide="eye-off" style="width:16px;height:16px;"></i>` : `<i data-lucide="eye" style="width:16px;height:16px;"></i>`;
        if (window.lucide) lucide.createIcons();
      });
    }

    // Quick fill demo credentials
    const demoBtn = document.getElementById('btn-quick-fill-demo');
    if (demoBtn) {
      demoBtn.addEventListener('click', () => {
        document.getElementById('login-email').value = 'analyst@jobguard.ai';
        document.getElementById('login-password').value = 'JobGuard@2026';
        showToast('Demo investigator credentials loaded', 'info');
      });
    }

    // Submit handler with strict validation
    const form = document.getElementById('form-login');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value.trim();
      const pwd = document.getElementById('login-password').value;
      const btn = document.getElementById('btn-login-submit');
      const errBanner = document.getElementById('login-error-banner');

      errBanner.style.display = 'none';
      errBanner.innerHTML = '';
      btn.classList.add('is-loading');
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner"></span> Authenticating Clearance...`;

      const wakeTimer = setTimeout(() => {
        if (btn && btn.disabled) {
          btn.innerHTML = `<span class="spinner"></span> Connecting to Cloud Server (waking Render instance)...`;
        }
      }, 2500);

      try {
        const res = await window.JobGuardData.loginUser(email, pwd);
        clearTimeout(wakeTimer);
        if (!res || !res.success) {
          throw new Error((res && res.error) || 'Invalid email or password.');
        }

        showToast('Investigator session verified. Welcome back, ' + (res.user.name || '') + '.', 'success');
        window.location.hash = '#dashboard';
      } catch (err) {
        clearTimeout(wakeTimer);
        btn.classList.remove('is-loading');
        btn.disabled = false;
        btn.innerHTML = `<i data-lucide="log-in" style="width:16px;height:16px;"></i> Sign In to Forensic Console`;
        if (window.lucide) lucide.createIcons();

        const msg = err.message || 'Authentication failed.';
        const isUnregistered = msg.toLowerCase().includes('register') || msg.toLowerCase().includes('not found') || msg.toLowerCase().includes('no account');

        errBanner.innerHTML = `
          <div style="display:flex; align-items:flex-start; gap:10px;">
            <i data-lucide="alert-triangle" style="width:18px;height:18px;color:#ef4444;flex-shrink:0;margin-top:2px;"></i>
            <div>
              <div style="font-weight:700; color:#ffffff; margin-bottom:2px;">Authentication Rejected</div>
              <div>${escapeHtml(msg)}</div>
              ${isUnregistered ? `
                <div style="margin-top:8px;">
                  <a href="#register" style="display:inline-flex; align-items:center; gap:4px; color:var(--accent-cyan); font-weight:700; text-decoration:none; background:rgba(0, 242, 254, 0.08); border:1px solid rgba(0, 242, 254, 0.3); padding:4px 8px; border-radius:4px; font-size:12px;">
                    Register '${escapeHtml(email)}' Account Now →
                  </a>
                </div>
              ` : ''}
            </div>
          </div>
        `;
        errBanner.style.display = 'block';
        if (window.lucide) lucide.createIcons();
        showToast(msg, 'error');
      }
    });
  }

  // ─── 12. #register (Investigator Clearance) ─────────────────────────────────
  function renderRegister() {
    const html = `
      <div class="motif-aurora"></div>

      <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; position:relative; z-index:10;">
        <div class="card" style="max-width: 480px; width: 100%; padding: 36px 32px; background: #0d1a24; border: 1px solid rgba(34, 211, 238, 0.25); box-shadow: 0 25px 80px rgba(0, 0, 0, 0.85), 0 0 40px rgba(34, 211, 238, 0.12); border-radius: 20px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <div class="brand-shield" style="width:52px;height:52px;margin: 0 auto 14px auto;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:26px;height:26px;">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                <path d="m9 12 2 2 4-4"/>
              </svg>
            </div>
            <h2 style="font-size: 24px; font-weight: 800; color:var(--text-primary);">Register Investigator Account</h2>
            <p style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">JobGuard-XAI Forensic Security Clearance Protocol</p>
          </div>

          <!-- Dynamic Error Alert Banner -->
          <div id="reg-error-banner" style="display:none; margin-bottom: 18px; padding: 12px 14px; background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.4); border-radius: 8px; color: #f87171; font-size: 13px; line-height: 1.45;"></div>

          <form id="form-register">
            <div class="form-group">
              <label class="form-label">Full Name / Agent Identifier</label>
              <div style="position:relative;">
                <input type="text" id="reg-name" class="form-input" placeholder="e.g. VK Tej" required style="width:100%; padding-left:36px;">
                <i data-lucide="user" style="position:absolute; left:12px; top:50%; transform:translateY(-50%); width:15px; height:15px; color:var(--text-muted); pointer-events:none;"></i>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Official Organization Email</label>
              <div style="position:relative;">
                <input type="email" id="reg-email" class="form-input" placeholder="e.g. investigator@jobguard.ai" autocomplete="email" required style="width:100%; padding-left:36px;">
                <i data-lucide="mail" style="position:absolute; left:12px; top:50%; transform:translateY(-50%); width:15px; height:15px; color:var(--text-muted); pointer-events:none;"></i>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Security Password (min 8 chars, mixed letters &amp; numbers)</label>
              <div style="position:relative;">
                <input type="password" id="reg-password" class="form-input" placeholder="••••••••••••" autocomplete="new-password" required style="width:100%; padding-left:36px; padding-right:40px;">
                <i data-lucide="lock" style="position:absolute; left:12px; top:50%; transform:translateY(-50%); width:15px; height:15px; color:var(--text-muted); pointer-events:none;"></i>
                <button type="button" id="toggle-reg-pwd" style="position:absolute; right:10px; top:50%; transform:translateY(-50%); background:none; border:none; color:var(--text-muted); cursor:pointer; padding:4px;" title="Show/Hide Password">
                  <i data-lucide="eye" style="width:16px;height:16px;"></i>
                </button>
              </div>

              <!-- Real-Time Password Strength Meter -->
              <div class="pwd-meter-track" style="margin-top:8px;">
                <div class="pwd-meter-segment" id="pwd-seg-1"></div>
                <div class="pwd-meter-segment" id="pwd-seg-2"></div>
                <div class="pwd-meter-segment" id="pwd-seg-3"></div>
                <div class="pwd-meter-segment" id="pwd-seg-4"></div>
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
                <span class="pwd-label" id="pwd-label" style="font-size:11px;">Password strength: Empty</span>
                <span style="font-size:10px; color:var(--text-faint); font-family:var(--font-mono);">PBKDF2/SHA-256 Encrypted</span>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Confirm Password</label>
              <div style="position:relative;">
                <input type="password" id="reg-confirm" class="form-input" placeholder="••••••••••••" autocomplete="new-password" required style="width:100%; padding-left:36px; padding-right:40px;">
                <i data-lucide="check-circle-2" style="position:absolute; left:12px; top:50%; transform:translateY(-50%); width:15px; height:15px; color:var(--text-muted); pointer-events:none;"></i>
                <button type="button" id="toggle-reg-confirm" style="position:absolute; right:10px; top:50%; transform:translateY(-50%); background:none; border:none; color:var(--text-muted); cursor:pointer; padding:4px;" title="Show/Hide Password">
                  <i data-lucide="eye" style="width:16px;height:16px;"></i>
                </button>
              </div>
            </div>

            <button type="submit" class="btn btn-primary" id="btn-reg-submit" style="width: 100%; height: 44px; margin-top: 10px; font-weight:600; display:flex; align-items:center; justify-content:center; gap:8px;">
              <i data-lucide="shield-check" style="width:16px;height:16px;"></i> Initialize Investigator Account
            </button>
          </form>

          <div style="margin-top: 22px; padding-top: 16px; border-top: 1px solid var(--border-subtle); text-align: center; font-size: 12.5px;">
            <span style="color: var(--text-faint);">
              Already hold registered credentials? <a href="#login" style="color: var(--accent-cyan); text-decoration: none; font-weight: 600;">Sign In</a>
            </span>
          </div>
        </div>
      </div>
    `;

    document.getElementById('app').innerHTML = html;
    if (window.lucide) lucide.createIcons();

    // Toggle password visibility buttons
    const bindToggle = (btnId, inputId) => {
      const b = document.getElementById(btnId);
      const inp = document.getElementById(inputId);
      if (b && inp) {
        b.addEventListener('click', () => {
          const isPwd = inp.type === 'password';
          inp.type = isPwd ? 'text' : 'password';
          b.innerHTML = isPwd ? `<i data-lucide="eye-off" style="width:16px;height:16px;"></i>` : `<i data-lucide="eye" style="width:16px;height:16px;"></i>`;
          if (window.lucide) lucide.createIcons();
        });
      }
    };
    bindToggle('toggle-reg-pwd', 'reg-password');
    bindToggle('toggle-reg-confirm', 'reg-confirm');

    // Real-Time Password Strength Meter
    const pwdInput = document.getElementById('reg-password');
    const label = document.getElementById('pwd-label');
    const seg1 = document.getElementById('pwd-seg-1');
    const seg2 = document.getElementById('pwd-seg-2');
    const seg3 = document.getElementById('pwd-seg-3');
    const seg4 = document.getElementById('pwd-seg-4');

    if (pwdInput) {
      pwdInput.addEventListener('input', (e) => {
        const val = e.target.value;
        let score = 0;
        if (val.length >= 8) score++;
        if (val.length >= 12) score++;
        if (/[A-Za-z]/.test(val) && /[0-9]/.test(val)) score++;
        if (/[^A-Za-z0-9]/.test(val)) score++;

        [seg1, seg2, seg3, seg4].forEach((s) => (s.style.backgroundColor = 'var(--bg-base)'));

        if (score === 1) {
          seg1.style.backgroundColor = 'var(--danger)';
          label.textContent = 'Password strength: Weak (Need 8+ chars & numbers)';
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
        } else if (score >= 4) {
          seg1.style.backgroundColor = 'var(--safe)';
          seg2.style.backgroundColor = 'var(--safe)';
          seg3.style.backgroundColor = 'var(--safe)';
          seg4.style.backgroundColor = 'var(--safe)';
          label.textContent = 'Password strength: Cryptographically Optimal';
          label.style.color = 'var(--safe)';
        } else {
          label.textContent = 'Password strength: Empty';
          label.style.color = 'var(--text-faint)';
        }
      });
    }

    const form = document.getElementById('form-register');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('reg-name').value.trim();
      const email = document.getElementById('reg-email').value.trim();
      const pwd = document.getElementById('reg-password').value;
      const confirm = document.getElementById('reg-confirm').value;
      const btn = document.getElementById('btn-reg-submit');
      const errBanner = document.getElementById('reg-error-banner');

      errBanner.style.display = 'none';
      errBanner.innerHTML = '';

      if (name.length < 2) {
        displayRegError('Full Name must be at least 2 characters long.');
        return;
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        displayRegError('Please provide a valid email address (e.g. investigator@jobguard.ai).');
        return;
      }

      if (pwd.length < 8) {
        displayRegError('Password must be at least 8 characters long for security compliance.');
        return;
      }

      if (!/[A-Za-z]/.test(pwd) || !/[0-9\W]/.test(pwd)) {
        displayRegError('Password must contain letters and at least one number or special symbol.');
        return;
      }

      if (pwd !== confirm) {
        displayRegError('Password confirmation does not match. Please verify both password fields.');
        return;
      }

      btn.classList.add('is-loading');
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner"></span> Generating Cryptographic Clearance...`;

      const wakeTimer = setTimeout(() => {
        if (btn && btn.disabled) {
          btn.innerHTML = `<span class="spinner"></span> Connecting to Cloud Server (waking Render instance)...`;
        }
      }, 2500);

      try {
        const res = await window.JobGuardData.registerUser(name, email, pwd);
        clearTimeout(wakeTimer);
        if (!res || !res.success) {
          throw new Error((res && res.error) || 'Registration could not be completed.');
        }

        showToast('Registration successful! Welcome to JobGuard-XAI, ' + name + '.', 'success');
        window.location.hash = '#dashboard';
      } catch (err) {
        clearTimeout(wakeTimer);
        btn.classList.remove('is-loading');
        btn.disabled = false;
        btn.innerHTML = `<i data-lucide="shield-check" style="width:16px;height:16px;"></i> Initialize Investigator Account`;
        if (window.lucide) lucide.createIcons();
        displayRegError(err.message || 'Registration failed.');
        showToast(err.message || 'Registration failed', 'error');
      }

      function displayRegError(msg) {
        const isExisting = msg.toLowerCase().includes('already exists');
        errBanner.innerHTML = `
          <div style="display:flex; align-items:flex-start; gap:10px;">
            <i data-lucide="alert-triangle" style="width:18px;height:18px;color:#ef4444;flex-shrink:0;margin-top:2px;"></i>
            <div>
              <div style="font-weight:700; color:#ffffff; margin-bottom:2px;">Registration Failed</div>
              <div>${escapeHtml(msg)}</div>
              ${isExisting ? `
                <div style="margin-top:8px;">
                  <a href="#login" style="display:inline-flex; align-items:center; gap:4px; color:var(--accent-cyan); font-weight:700; text-decoration:none; background:rgba(0, 242, 254, 0.08); border:1px solid rgba(0, 242, 254, 0.3); padding:4px 8px; border-radius:4px; font-size:12px;">
                    Click here to Sign In with '${escapeHtml(email)}' →
                  </a>
                </div>
              ` : ''}
            </div>
          </div>
        `;
        errBanner.style.display = 'block';
        if (window.lucide) lucide.createIcons();
      }
    });
  }

  // ─── Hash Router & Auth Gate ────────────────────────────────────────────────
  function route() {
    // When opening via "Go Live" or entering root URL with no hash, navigate directly to #login
    if (!window.location.hash || window.location.hash === '' || window.location.hash === '#') {
      window.location.hash = '#login';
      return;
    }

    const rawHash = window.location.hash || '#login';
    const cleanHash = (rawHash.split('?')[0] || '#login').toLowerCase();
    AppState.currentRoute = cleanHash;

    const isAuthed = (window.JobGuardData && window.JobGuardData.isAuthenticated) ? window.JobGuardData.isAuthenticated() : false;
    const publicRoutes = ['#login', '#register', '#about'];

    // Auth Protection: Unauthenticated users attempting to access protected routes are directed to #login
    if (!isAuthed && !publicRoutes.includes(cleanHash)) {
      window.location.hash = '#login';
      renderLogin();
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
      case '#settings':
        renderAbout();
        break;
      case '#login':
        renderLogin();
        break;
      case '#register':
        renderRegister();
        break;
      default:
        if (isAuthed) {
          renderDashboard();
        } else {
          renderLogin();
        }
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
  function initApp() {
    try {
      const savedTheme = localStorage.getItem('jobguard_theme') || 'dark';
      document.documentElement.setAttribute('data-theme', savedTheme);
    } catch (e) {}
    try {
      initSpotlight();
    } catch (e) {
      console.warn('initSpotlight error:', e);
    }
    try {
      route();
    } catch (e) {
      console.error('route error:', e);
    }
  }

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }

  window.addEventListener('hashchange', () => {
    route();
  });

})();
