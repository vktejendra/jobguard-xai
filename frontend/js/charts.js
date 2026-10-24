/**
 * JobGuard-XAI / VerityFile
 * Chart.js Visualization Engine & Dark Theme Configurations
 */

const ChartEngine = (function () {
  const chartInstances = {};

  // Theme Palette Tokens
  const THEME = {
    baseBg: '#0B0F1E',
    surface: '#131A2E',
    raised: '#1B2440',
    border: '#2C3757',
    borderFaint: 'rgba(44, 55, 87, 0.4)',
    text: '#F3F5FC',
    muted: '#9AA4C4',
    faint: '#626C8F',
    violet: '#8B5CF6',
    violetGlow: 'rgba(139, 92, 246, 0.35)',
    cyan: '#22D3EE',
    cyanGlow: 'rgba(34, 211, 238, 0.35)',
    safe: '#34D399',
    safeGlow: 'rgba(52, 211, 153, 0.25)',
    caution: '#FBBF24',
    danger: '#FB5D5D',
    dangerGlow: 'rgba(251, 93, 93, 0.3)'
  };

  function initChartDefaults() {
    if (typeof Chart === 'undefined') return;

    Chart.defaults.font.family = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    Chart.defaults.color = THEME.muted;
    Chart.defaults.borderColor = THEME.borderFaint;
    Chart.defaults.responsive = true;
    Chart.defaults.maintainAspectRatio = false;

    // Custom Tooltip Configuration
    Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(19, 26, 46, 0.95)';
    Chart.defaults.plugins.tooltip.titleColor = THEME.text;
    Chart.defaults.plugins.tooltip.titleFont = { family: "'Sora', sans-serif", weight: 'bold', size: 13 };
    Chart.defaults.plugins.tooltip.bodyColor = THEME.muted;
    Chart.defaults.plugins.tooltip.bodyFont = { family: "'IBM Plex Mono', monospace", size: 12 };
    Chart.defaults.plugins.tooltip.borderColor = THEME.border;
    Chart.defaults.plugins.tooltip.borderWidth = 1;
    Chart.defaults.plugins.tooltip.padding = 12;
    Chart.defaults.plugins.tooltip.cornerRadius = 8;
    Chart.defaults.plugins.tooltip.displayColors = true;

    // Legend Configuration
    Chart.defaults.plugins.legend.labels.color = THEME.muted;
    Chart.defaults.plugins.legend.labels.font = { family: "'Sora', sans-serif", size: 12 };
  }

  function destroyChart(canvasId) {
    if (chartInstances[canvasId]) {
      chartInstances[canvasId].destroy();
      delete chartInstances[canvasId];
    }
  }

  function getCanvas(canvasId) {
    if (typeof Chart === 'undefined') return null;
    const el = document.getElementById(canvasId);
    if (!el) return null;
    return el.getContext('2d');
  }

  // ─── 1. Class Balance Donut Chart ──────────────────────────────────────────
  function drawClassBalanceDonut(canvasId) {
    const ctx = getCanvas(canvasId);
    if (!ctx) return;
    destroyChart(canvasId);

    const stats = window.JobGuardData ? window.JobGuardData.DATASET_STATS : { legitimateCount: 17014, fraudulentCount: 866 };

    chartInstances[canvasId] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Legitimate Postings', 'Fraudulent Postings'],
        datasets: [
          {
            data: [stats.legitimateCount, stats.fraudulentCount],
            backgroundColor: ['#34D399', '#FB5D5D'],
            hoverBackgroundColor: ['#10B981', '#EF4444'],
            borderColor: '#131A2E',
            borderWidth: 3,
            hoverOffset: 6
          }
        ]
      },
      options: {
        cutout: '72%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { boxWidth: 14, padding: 16 }
          },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                const total = stats.legitimateCount + stats.fraudulentCount;
                const val = ctx.parsed;
                const pct = ((val / total) * 100).toFixed(2);
                return ` ${ctx.label}: ${val.toLocaleString()} (${pct}%)`;
              }
            }
          }
        }
      }
    });
    return chartInstances[canvasId];
  }

  // ─── 2. Fraud Rate by Company Logo ─────────────────────────────────────────
  function drawFraudByLogoBar(canvasId) {
    const ctx = getCanvas(canvasId);
    if (!ctx) return;
    destroyChart(canvasId);

    chartInstances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['With Verified Logo', 'Without Company Logo'],
        datasets: [
          {
            label: 'Fraud Rate (%)',
            data: [1.99, 15.93],
            backgroundColor: ['rgba(52, 211, 153, 0.85)', 'rgba(251, 93, 93, 0.85)'],
            borderColor: ['#34D399', '#FB5D5D'],
            borderWidth: 1.5,
            borderRadius: 8,
            barThickness: 36
          }
        ]
      },
      options: {
        scales: {
          y: {
            beginAtZero: true,
            max: 20,
            grid: { color: THEME.borderFaint },
            ticks: {
              callback: (v) => v + '%',
              font: { family: "'IBM Plex Mono', monospace" }
            }
          },
          x: {
            grid: { display: false }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` Fraud Probability: ${ctx.parsed.y}% (8.0x difference)`
            }
          }
        }
      }
    });
    return chartInstances[canvasId];
  }

  // ─── 3. Fraud Rate by Telecommuting ────────────────────────────────────────
  function drawFraudByTelecommutingBar(canvasId) {
    const ctx = getCanvas(canvasId);
    if (!ctx) return;
    destroyChart(canvasId);

    chartInstances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Remote / Telecommuting', 'On-Site Location'],
        datasets: [
          {
            label: 'Fraud Rate (%)',
            data: [8.34, 4.69],
            backgroundColor: ['rgba(251, 191, 36, 0.85)', 'rgba(52, 211, 153, 0.85)'],
            borderColor: ['#FBBF24', '#34D399'],
            borderWidth: 1.5,
            borderRadius: 8,
            barThickness: 36
          }
        ]
      },
      options: {
        scales: {
          y: {
            beginAtZero: true,
            max: 12,
            grid: { color: THEME.borderFaint },
            ticks: {
              callback: (v) => v + '%',
              font: { family: "'IBM Plex Mono', monospace" }
            }
          },
          x: {
            grid: { display: false }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` Fraud Incident Rate: ${ctx.parsed.y}%`
            }
          }
        }
      }
    });
    return chartInstances[canvasId];
  }

  // ─── 4. Employment Type Distribution ───────────────────────────────────────
  function drawEmploymentTypeBar(canvasId) {
    const ctx = getCanvas(canvasId);
    if (!ctx) return;
    destroyChart(canvasId);

    const labels = ['Full-time', 'Contract', 'Part-time', 'Temporary', 'Other'];
    const counts = [11620, 1524, 797, 241, 227];

    chartInstances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Total Postings',
            data: counts,
            backgroundColor: 'rgba(139, 92, 246, 0.75)',
            hoverBackgroundColor: '#8B5CF6',
            borderColor: '#A78BFA',
            borderWidth: 1.5,
            borderRadius: 6
          }
        ]
      },
      options: {
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: THEME.borderFaint },
            ticks: { font: { family: "'IBM Plex Mono', monospace" } }
          },
          x: { grid: { display: false } }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` Postings: ${ctx.parsed.y.toLocaleString()}`
            }
          }
        }
      }
    });
    return chartInstances[canvasId];
  }

  // ─── 5. Top Industries Bar (Horizontal) ────────────────────────────────────
  function drawTopIndustriesBar(canvasId) {
    const ctx = getCanvas(canvasId);
    if (!ctx) return;
    destroyChart(canvasId);

    const industries = [
      'IT & Services',
      'Computer Software',
      'Internet',
      'Marketing & Ads',
      'Financial Services',
      'Hospital & Health',
      'Consumer Services',
      'Telecommunications'
    ];
    const counts = [1734, 1376, 1062, 828, 779, 497, 358, 342];

    chartInstances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: industries,
        datasets: [
          {
            label: 'Job Volume',
            data: counts,
            backgroundColor: 'rgba(34, 211, 238, 0.75)',
            hoverBackgroundColor: '#22D3EE',
            borderColor: '#67E8F9',
            borderWidth: 1.5,
            borderRadius: 6
          }
        ]
      },
      options: {
        indexAxis: 'y',
        scales: {
          x: {
            beginAtZero: true,
            grid: { color: THEME.borderFaint },
            ticks: { font: { family: "'IBM Plex Mono', monospace" } }
          },
          y: { grid: { display: false } }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` Volume: ${ctx.parsed.x.toLocaleString()} postings`
            }
          }
        }
      }
    });
    return chartInstances[canvasId];
  }

  // ─── 6. Required Experience Distribution ───────────────────────────────────
  function drawExperienceBar(canvasId) {
    const ctx = getCanvas(canvasId);
    if (!ctx) return;
    destroyChart(canvasId);

    const labels = ['Mid-Senior', 'Entry Level', 'Associate', 'Not Applicable', 'Director', 'Internship', 'Executive'];
    const counts = [3809, 2697, 2297, 1116, 389, 381, 141];

    chartInstances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Postings Count',
            data: counts,
            backgroundColor: 'rgba(167, 139, 250, 0.7)',
            borderColor: '#C4B5FD',
            borderWidth: 1.5,
            borderRadius: 6
          }
        ]
      },
      options: {
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: THEME.borderFaint },
            ticks: { font: { family: "'IBM Plex Mono', monospace" } }
          },
          x: { grid: { display: false } }
        },
        plugins: {
          legend: { display: false }
        }
      }
    });
    return chartInstances[canvasId];
  }

  // ─── 7. Fraud Rate by Industry (Sorted Bar) ────────────────────────────────
  function drawFraudByIndustryBar(canvasId) {
    const ctx = getCanvas(canvasId);
    if (!ctx) return;
    destroyChart(canvasId);

    const labels = [
      'Oil & Energy',
      'Accounting',
      'Real Estate',
      'Telecommunications',
      'Hospital & Health',
      'Consumer Services',
      'Marketing & Ads',
      'Financial Services',
      'IT & Services',
      'Computer Software',
      'Internet'
    ];
    const rates = [34.06, 20.73, 14.54, 11.11, 10.26, 6.42, 5.43, 4.49, 1.9, 1.24, 0.66];

    // Color gradient based on danger
    const colors = rates.map((r) => (r > 15 ? 'rgba(251, 93, 93, 0.85)' : r > 5 ? 'rgba(251, 191, 36, 0.85)' : 'rgba(52, 211, 153, 0.85)'));
    const borders = rates.map((r) => (r > 15 ? '#FB5D5D' : r > 5 ? '#FBBF24' : '#34D399'));

    chartInstances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Fraud Rate (%)',
            data: rates,
            backgroundColor: colors,
            borderColor: borders,
            borderWidth: 1.5,
            borderRadius: 6
          }
        ]
      },
      options: {
        indexAxis: 'y',
        scales: {
          x: {
            beginAtZero: true,
            max: 40,
            grid: { color: THEME.borderFaint },
            ticks: {
              callback: (v) => v + '%',
              font: { family: "'IBM Plex Mono', monospace" }
            }
          },
          y: { grid: { display: false } }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` Fraud Probability: ${ctx.parsed.x}%`
            }
          }
        }
      }
    });
    return chartInstances[canvasId];
  }

  // ─── 8. Missing Data Rates Bar ─────────────────────────────────────────────
  function drawMissingnessBar(canvasId) {
    const ctx = getCanvas(canvasId);
    if (!ctx) return;
    destroyChart(canvasId);

    const features = [
      'salary_range',
      'department',
      'required_education',
      'required_experience',
      'benefits',
      'function',
      'industry',
      'company_profile',
      'requirements'
    ];
    const missingRates = [83.9, 64.6, 42.1, 39.4, 36.5, 36.1, 27.4, 18.5, 15.1];

    chartInstances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: features,
        datasets: [
          {
            label: 'Missing Rate (%)',
            data: missingRates,
            backgroundColor: 'rgba(244, 63, 94, 0.75)',
            borderColor: '#FB7185',
            borderWidth: 1.5,
            borderRadius: 6
          }
        ]
      },
      options: {
        indexAxis: 'y',
        scales: {
          x: {
            beginAtZero: true,
            max: 100,
            grid: { color: THEME.borderFaint },
            ticks: {
              callback: (v) => v + '%',
              font: { family: "'IBM Plex Mono', monospace" }
            }
          },
          y: { grid: { display: false } }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` Missingness: ${ctx.parsed.x}% of postings empty`
            }
          }
        }
      }
    });
    return chartInstances[canvasId];
  }

  // ─── 9. Model Comparison Grouped Bar (Placeholder Aware) ───────────────────
  function drawModelComparisonBar(canvasId, modelsData) {
    const ctx = getCanvas(canvasId);
    if (!ctx) return;
    destroyChart(canvasId);

    const perf = modelsData || (window.JobGuardData && window.JobGuardData.getModelPerformance().models) || [];
    const labels = perf.map((m) => m.name.split(' ')[0] + ' ' + (m.name.split(' ')[1] || ''));
    const f1s = perf.map((m) => m.f1 * 100);
    const recalls = perf.map((m) => m.recall * 100);
    const precisions = perf.map((m) => m.precision * 100);

    chartInstances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'F1 Score (%)',
            data: f1s,
            backgroundColor: 'rgba(139, 92, 246, 0.85)',
            borderColor: '#8B5CF6',
            borderWidth: 1,
            borderRadius: 4
          },
          {
            label: 'Recall (%)',
            data: recalls,
            backgroundColor: 'rgba(34, 211, 238, 0.85)',
            borderColor: '#22D3EE',
            borderWidth: 1,
            borderRadius: 4
          },
          {
            label: 'Precision (%)',
            data: precisions,
            backgroundColor: 'rgba(52, 211, 153, 0.85)',
            borderColor: '#34D399',
            borderWidth: 1,
            borderRadius: 4
          }
        ]
      },
      options: {
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            grid: { color: THEME.borderFaint },
            ticks: {
              callback: (v) => v + '%',
              font: { family: "'IBM Plex Mono', monospace" }
            }
          },
          x: { grid: { display: false } }
        },
        plugins: {
          legend: { position: 'top', labels: { boxWidth: 12, padding: 12 } },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}%`
            }
          }
        }
      }
    });
    return chartInstances[canvasId];
  }

  // ─── 10. ROC Curves Overlay ────────────────────────────────────────────────
  function drawROCCurves(canvasId) {
    const ctx = getCanvas(canvasId);
    if (!ctx) return;
    destroyChart(canvasId);

    chartInstances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        datasets: [
          {
            label: 'Ensemble XGBoost (AUC = 0.978)',
            data: [
              { x: 0, y: 0 },
              { x: 0.02, y: 0.82 },
              { x: 0.05, y: 0.91 },
              { x: 0.12, y: 0.96 },
              { x: 0.25, y: 0.98 },
              { x: 1, y: 1 }
            ],
            borderColor: '#8B5CF6',
            backgroundColor: 'rgba(139, 92, 246, 0.1)',
            fill: true,
            tension: 0.35,
            borderWidth: 2.5
          },
          {
            label: 'LightGBM (AUC = 0.971)',
            data: [
              { x: 0, y: 0 },
              { x: 0.03, y: 0.78 },
              { x: 0.08, y: 0.88 },
              { x: 0.18, y: 0.94 },
              { x: 0.35, y: 0.97 },
              { x: 1, y: 1 }
            ],
            borderColor: '#22D3EE',
            tension: 0.35,
            borderWidth: 2
          },
          {
            label: 'Random Guess (AUC = 0.500)',
            data: [
              { x: 0, y: 0 },
              { x: 1, y: 1 }
            ],
            borderColor: THEME.faint,
            borderDash: [5, 5],
            borderWidth: 1.5,
            pointRadius: 0
          }
        ]
      },
      options: {
        scales: {
          x: {
            type: 'linear',
            min: 0,
            max: 1,
            title: { display: true, text: 'False Positive Rate (1 - Specificity)', color: THEME.muted },
            grid: { color: THEME.borderFaint },
            ticks: { font: { family: "'IBM Plex Mono', monospace" } }
          },
          y: {
            type: 'linear',
            min: 0,
            max: 1,
            title: { display: true, text: 'True Positive Rate (Recall)', color: THEME.muted },
            grid: { color: THEME.borderFaint },
            ticks: { font: { family: "'IBM Plex Mono', monospace" } }
          }
        },
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12 } }
        }
      }
    });
    return chartInstances[canvasId];
  }

  // ─── 11. PR Curves Overlay ─────────────────────────────────────────────────
  function drawPRCurves(canvasId) {
    const ctx = getCanvas(canvasId);
    if (!ctx) return;
    destroyChart(canvasId);

    chartInstances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        datasets: [
          {
            label: 'Ensemble XGBoost (PR-AUC = 0.884)',
            data: [
              { x: 0.05, y: 0.96 },
              { x: 0.40, y: 0.93 },
              { x: 0.70, y: 0.89 },
              { x: 0.86, y: 0.82 },
              { x: 0.94, y: 0.65 },
              { x: 1.00, y: 0.12 }
            ],
            borderColor: '#34D399',
            backgroundColor: 'rgba(52, 211, 153, 0.1)',
            fill: true,
            tension: 0.35,
            borderWidth: 2.5
          },
          {
            label: 'LightGBM (PR-AUC = 0.861)',
            data: [
              { x: 0.05, y: 0.94 },
              { x: 0.35, y: 0.90 },
              { x: 0.65, y: 0.85 },
              { x: 0.84, y: 0.77 },
              { x: 0.92, y: 0.58 },
              { x: 1.00, y: 0.09 }
            ],
            borderColor: '#FBBF24',
            tension: 0.35,
            borderWidth: 2
          },
          {
            label: 'Baseline (Class Prevalence: 4.84%)',
            data: [
              { x: 0, y: 0.0484 },
              { x: 1, y: 0.0484 }
            ],
            borderColor: '#FB5D5D',
            borderDash: [4, 4],
            borderWidth: 1.5,
            pointRadius: 0
          }
        ]
      },
      options: {
        scales: {
          x: {
            type: 'linear',
            min: 0,
            max: 1,
            title: { display: true, text: 'Recall (Coverage of Scams)', color: THEME.muted },
            grid: { color: THEME.borderFaint },
            ticks: { font: { family: "'IBM Plex Mono', monospace" } }
          },
          y: {
            type: 'linear',
            min: 0,
            max: 1,
            title: { display: true, text: 'Precision (True Scam Ratio)', color: THEME.muted },
            grid: { color: THEME.borderFaint },
            ticks: { font: { family: "'IBM Plex Mono', monospace" } }
          }
        },
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12 } }
        }
      }
    });
    return chartInstances[canvasId];
  }

  // ─── 12. Confusion Matrix Visual ───────────────────────────────────────────
  function drawConfusionMatrix(canvasId, matrix) {
    const el = document.getElementById(canvasId);
    if (!el) return;
    const m = matrix || [
      [3385, 18],
      [24, 150]
    ];

    const tn = m[0][0];
    const fp = m[0][1];
    const fn = m[1][0];
    const tp = m[1][1];

    el.innerHTML = `
      <div class="matrix-wrapper">
        <div class="matrix-header-top">
          <span class="matrix-axis-label">PREDICTED CLASS</span>
          <div class="matrix-col-headers">
            <span>Predicted Legit</span>
            <span>Predicted Fraud</span>
          </div>
        </div>
        <div class="matrix-body-row">
          <div class="matrix-axis-side">
            <span>ACTUAL CLASS</span>
          </div>
          <div class="matrix-cells-grid">
            <div class="matrix-cell cell-tn">
              <span class="cell-tag">True Negative (TN)</span>
              <span class="cell-val">${tn.toLocaleString()}</span>
              <span class="cell-sub">Correctly Identified Legit</span>
            </div>
            <div class="matrix-cell cell-fp">
              <span class="cell-tag">False Positive (FP)</span>
              <span class="cell-val">${fp.toLocaleString()}</span>
              <span class="cell-sub">False Accusation (Error)</span>
            </div>
            <div class="matrix-cell cell-fn">
              <span class="cell-tag">False Negative (FN)</span>
              <span class="cell-val">${fn.toLocaleString()}</span>
              <span class="cell-sub">Missed Scam (Hazard)</span>
            </div>
            <div class="matrix-cell cell-tp">
              <span class="cell-tag">True Positive (TP)</span>
              <span class="cell-val">${tp.toLocaleString()}</span>
              <span class="cell-sub">Scam Caught</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ─── 13. Role Skills Bar Chart (Horizontal) ────────────────────────────────
  function drawSkillsBar(canvasId, skills) {
    const ctx = getCanvas(canvasId);
    if (!ctx) return;
    destroyChart(canvasId);

    const safeSkills = (skills && skills.length > 0)
      ? skills
      : [
          { name: 'Python', count: 120 },
          { name: 'SQL', count: 95 },
          { name: 'Machine Learning', count: 88 },
          { name: 'Cloud (AWS/GCP)', count: 70 },
          { name: 'Git & CI/CD', count: 62 }
        ];

    const labels = safeSkills.map((s) => s.name);
    const counts = safeSkills.map((s) => s.count);

    chartInstances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Skill Mentions',
            data: counts,
            backgroundColor: 'rgba(34, 211, 238, 0.75)',
            hoverBackgroundColor: '#22D3EE',
            borderColor: '#67E8F9',
            borderWidth: 1.5,
            borderRadius: 6
          }
        ]
      },
      options: {
        indexAxis: 'y',
        scales: {
          x: {
            beginAtZero: true,
            grid: { color: THEME.borderFaint },
            ticks: { font: { family: "'IBM Plex Mono', monospace" } }
          },
          y: { grid: { display: false } }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` Frequency: ${ctx.parsed.x} occurrences`
            }
          }
        }
      }
    });
    return chartInstances[canvasId];
  }

  // ─── 14. Radar Chart (Red Flag Radar / NLP Fraud Signal) ───────────────────
  function drawRadarChart(canvasId, labels, data, datasetLabel, customColor) {
    const ctx = getCanvas(canvasId);
    if (!ctx) return;
    destroyChart(canvasId);

    const color = customColor || THEME.violet;
    const colorBg = customColor ? customColor.replace('rgb', 'rgba').replace(')', ', 0.25)') : 'rgba(139, 92, 246, 0.25)';

    chartInstances[canvasId] = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: labels || ['Keyword Density', 'Profile Completeness', 'Urgency', 'Credential Mismatch', 'Vague Location', 'Missing Info'],
        datasets: [
          {
            label: datasetLabel || 'Fraud Dimension Risk',
            data: data || [65, 30, 75, 40, 80, 70],
            backgroundColor: colorBg,
            borderColor: color,
            borderWidth: 2,
            pointBackgroundColor: color,
            pointBorderColor: '#0B0F1E',
            pointHoverRadius: 6
          }
        ]
      },
      options: {
        scales: {
          r: {
            angleLines: { color: THEME.borderFaint },
            grid: { color: THEME.borderFaint },
            pointLabels: {
              font: { family: "'Sora', sans-serif", size: 11, weight: '500' },
              color: THEME.muted
            },
            ticks: {
              display: false,
              backdropColor: 'transparent',
              stepSize: 20
            },
            min: 0,
            max: 100
          }
        },
        plugins: {
          legend: { display: false }
        }
      }
    });
    return chartInstances[canvasId];
  }

  // ─── 15. SOC Incident Volume Trend Area Chart ──────────────────────────────
  function drawIncidentVolumeArea(canvasId) {
    const ctx = getCanvas(canvasId);
    if (!ctx) return;
    destroyChart(canvasId);

    const gradient = ctx.createLinearGradient(0, 0, 0, 180);
    gradient.addColorStop(0, 'rgba(0, 242, 254, 0.38)');
    gradient.addColorStop(0.5, 'rgba(13, 242, 201, 0.12)');
    gradient.addColorStop(1, 'rgba(6, 12, 20, 0.0)');

    const secondaryGrad = ctx.createLinearGradient(0, 0, 0, 180);
    secondaryGrad.addColorStop(0, 'rgba(255, 59, 92, 0.22)');
    secondaryGrad.addColorStop(1, 'rgba(6, 12, 20, 0.0)');

    chartInstances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
        datasets: [
          {
            label: 'Received',
            data: [42, 48, 54, 57, 61, 47],
            borderColor: '#00f2fe',
            borderWidth: 2.2,
            backgroundColor: gradient,
            fill: true,
            tension: 0.42,
            pointBackgroundColor: '#00f2fe',
            pointBorderColor: '#070d15',
            pointBorderWidth: 2,
            pointRadius: (ctx) => (ctx.dataIndex === 4 ? 6 : 3),
            pointHoverRadius: 7
          },
          {
            label: 'Escalated',
            data: [26, 31, 33, 37, 40, 30],
            borderColor: 'rgba(13, 242, 201, 0.85)',
            borderWidth: 1.6,
            borderDash: [4, 4],
            backgroundColor: 'transparent',
            fill: false,
            tension: 0.42,
            pointRadius: 0
          },
          {
            label: 'New',
            data: [16, 20, 24, 23, 28, 19],
            borderColor: 'rgba(255, 59, 92, 0.7)',
            borderWidth: 1.5,
            backgroundColor: secondaryGrad,
            fill: true,
            tension: 0.42,
            pointRadius: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(10, 17, 26, 0.95)',
            titleColor: '#f0f6fc',
            titleFont: { family: "'Sora', sans-serif", weight: 'bold', size: 12 },
            bodyColor: '#00f2fe',
            bodyFont: { family: "'IBM Plex Mono', monospace", size: 11 },
            borderColor: 'rgba(0, 242, 254, 0.35)',
            borderWidth: 1,
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: function(ctx) {
                return ` ${ctx.dataset.label}: ${ctx.parsed.y} incidents`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              color: 'rgba(255, 255, 255, 0.04)',
              drawBorder: false
            },
            ticks: {
              color: '#6e828a',
              font: { family: "'IBM Plex Mono', monospace", size: 10 }
            }
          },
          y: {
            min: 0,
            max: 80,
            ticks: {
              stepSize: 20,
              color: '#6e828a',
              font: { family: "'IBM Plex Mono', monospace", size: 10 }
            },
            grid: {
              color: 'rgba(255, 255, 255, 0.04)',
              drawBorder: false
            }
          }
        }
      }
    });
    return chartInstances[canvasId];
  }

  // ─── 16. Export Chart Canvas as PNG ─────────────────────────────────────────
  function exportChartToPng(canvasId, filename) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = (filename || 'jobguard-chart') + '.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return {
    initChartDefaults,
    destroyChart,
    drawClassBalanceDonut,
    drawFraudByLogoBar,
    drawFraudByTelecommutingBar,
    drawEmploymentTypeBar,
    drawTopIndustriesBar,
    drawExperienceBar,
    drawFraudByIndustryBar,
    drawMissingnessBar,
    drawModelComparisonBar,
    drawROCCurves,
    drawPRCurves,
    drawConfusionMatrix,
    drawSkillsBar,
    drawRadarChart,
    drawIncidentVolumeArea,
    exportChartToPng
  };
})();

// Attach to window
if (typeof window !== 'undefined') {
  window.ChartEngine = ChartEngine;
}
