# JobGuard-XAI (VerityFile)
## An Explainable NLP-Based Framework for Fraudulent Job Detection

> **Academic Project** — B.Tech CSE (Data Science) Major Project  
> **Product Brand:** VerityFile — "Job Posting Forensics"

---

## Overview

JobGuard-XAI is a complete end-to-end system for detecting fake job postings. It combines NLP, multiple ML classifiers, and SHAP Explainable AI to flag suspicious postings and explain *why* they were flagged — all through a premium dark-themed web dashboard.

**Dataset:** EMSCAD `fake_job_postings.csv` — 17,880 rows, 4.84% fraud rate.

---

## Quick Start

### 1. Install Python dependencies
```powershell
py -m pip install -r requirements.txt
```

### 2. Download NLTK data (one-time)
```powershell
py -c "import nltk; nltk.download('punkt'); nltk.download('stopwords'); nltk.download('wordnet'); nltk.download('averaged_perceptron_tagger')"
```

### 3. Place your dataset
Copy `fake_job_postings.csv` → `ml/data/fake_job_postings.csv`

### 4. Run the preprocessing check
```powershell
py ml/preprocessing/pipeline.py
```
Expected: `Dataset validated: 17880 rows × 18 columns. Split: 14304 train / 3576 test.`

### 5. Train all models
```powershell
py ml/training/train_models.py
```
Expected: prints each model's metrics, then `TRAINING COMPLETE. Best model: [name]`
Takes ~5-20 minutes depending on your machine.

### 6. Build the role index
```powershell
py ml/nlp/build_role_index.py
```
Expected: `roleIndex.js written to frontend/js/roleIndex.js (25 roles, N legitimate postings)`

### 7. Set up environment
```powershell
copy .env.example .env
# Edit .env and set your JWT_SECRET_KEY and FLASK_SECRET_KEY
```

### 8. Start the Flask backend
```powershell
py backend/app.py
```
Expected: `Running on http://localhost:5000`

### 9. Open the frontend
Open `frontend/index.html` in VS Code and click **Go Live** (Live Server extension).  
Browse to `http://127.0.0.1:5500/frontend/index.html`

---

## Project Structure

```
jobguard-xai/
├── frontend/
│   ├── index.html              # Single-page app, hash-router
│   ├── css/style.css           # Premium dark theme, all page motifs
│   └── js/
│       ├── app.js              # Router + all 10 page renderers
│       ├── data.js             # API layer (mock → real swap)
│       ├── charts.js           # Chart.js draw functions
│       └── roleIndex.js        # Precomputed role→skills index (from CSV)
├── backend/
│   ├── app.py                  # Flask app factory
│   ├── routes/                 # auth, predict, analytics, history, model, nlp, xai
│   ├── services/               # predictor, analytics_service
│   ├── utils/                  # auth_helpers, validators
│   └── database/               # schema.sql, db.py
├── ml/
│   ├── data/fake_job_postings.csv   # ← place dataset here
│   ├── preprocessing/pipeline.py
│   ├── nlp/text_cleaning.py
│   ├── nlp/build_role_index.py
│   ├── training/train_models.py
│   ├── xai/explain.py
│   └── saved_models/           # joblib + metrics.json + charts (generated)
├── requirements.txt
├── .env.example
└── README.md
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML5 + CSS3 + Vanilla JS (no build step) |
| Charts | Chart.js 4.x (CDN) |
| Icons | Lucide Icons (CDN) |
| Fonts | Sora, Inter, IBM Plex Mono (Google Fonts) |
| Backend | Python Flask 3.x |
| Auth | JWT (PyJWT) + bcrypt password hashing |
| Database | SQLite 3 |
| ML | scikit-learn, XGBoost, imbalanced-learn |
| NLP | NLTK (tokenize, stopwords, lemmatize), TF-IDF |
| XAI | SHAP (TreeExplainer / LinearExplainer) |

---

## Models Trained

| Model | class_weight |
|-------|-------------|
| Logistic Regression | balanced |
| Complement Naive Bayes | N/A |
| Decision Tree | balanced |
| Random Forest | balanced |
| LinearSVC | balanced |
| Gradient Boosting | via scale |
| XGBoost | scale_pos_weight=19.6 |

**Selection criterion:** Best fraud-class F1 score (secondary: PR-AUC). Never accuracy.

---

## Evaluation Metrics

- Precision, Recall, F1 (fraud class = positive)
- ROC-AUC, PR-AUC
- Confusion matrix
- Accuracy reported but de-emphasised (fraud is only 4.84% of data)

---

## Placeholders

Any metric not yet backed by a trained model is visibly labelled with a dotted notice strip in the UI. Once you run `train_models.py` and connect the backend, all placeholders are replaced automatically.

---

## Academic Note

This project is submitted as a B.Tech major project. All numbers come from the real EMSCAD dataset. SHAP explanations come from the actual trained model. No data or explanations are fabricated.
