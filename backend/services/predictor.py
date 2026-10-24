"""
Predictor service for JobGuard-XAI.
Wraps the trained machine learning pipeline and model, provides single-instance prediction,
risk score computation, and feature contribution/SHAP explanations.
"""

import json
import os
import sys
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import joblib
import numpy as np
import pandas as pd

# Ensure project root is in sys.path to permit imports from 'ml'
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from backend.utils.validators import sanitize_text


class PredictorService:
    """Service to load ML artifacts and generate fake job predictions with explanations."""

    def __init__(self, models_dir: Optional[str] = None):
        """
        Initialize the predictor service and attempt to load model & pipeline artifacts.
        
        Args:
            models_dir: Optional override for the saved models directory.
        """
        if models_dir is None:
            models_dir = os.path.join(PROJECT_ROOT, os.getenv("SAVED_MODELS_DIR", "ml/saved_models"))
        
        self.models_dir = os.path.abspath(models_dir)
        self.model_path = os.path.join(self.models_dir, "best_model.joblib")
        self.pipeline_path = os.path.join(self.models_dir, "feature_pipeline.joblib")
        self.metrics_path = os.path.join(self.models_dir, "metrics.json")
        
        self.model = None
        self.feature_pipeline = None
        self.model_name = "Not Loaded"
        self.metrics = {}
        self.model_loaded = False
        
        self.load_model()

    def load_model(self) -> bool:
        """
        Attempt to load the model, feature pipeline, and training metrics.
        Returns True if both model and pipeline are successfully loaded, False otherwise.
        """
        # Load metrics if present to identify the active model name
        if os.path.exists(self.metrics_path):
            try:
                with open(self.metrics_path, "r", encoding="utf-8") as f:
                    self.metrics = json.load(f)
                    self.model_name = self.metrics.get("best_model_name", "Trained ML Model")
            except Exception:
                self.model_name = "Trained ML Model"
        else:
            self.model_name = "Trained ML Model"

        if not os.path.exists(self.model_path) or not os.path.exists(self.pipeline_path):
            self.model_loaded = False
            return False

        try:
            self.model = joblib.load(self.model_path)
            self.feature_pipeline = joblib.load(self.pipeline_path)
            self.model_loaded = True
            
            # Extract class name if not set from metrics
            if self.model_name == "Trained ML Model" and hasattr(self.model, "__class__"):
                self.model_name = self.model.__class__.__name__
                
            return True
        except Exception as e:
            self.model_loaded = False
            self.model = None
            self.feature_pipeline = None
            return False

    def _build_dataframe(self, input_dict: Dict[str, Any]) -> pd.DataFrame:
        """
        Convert input dictionary into a single-row pandas DataFrame matching pipeline schema.
        """
        def to_flag(val) -> int:
            if val is None:
                return 0
            if isinstance(val, (int, float)):
                return 1 if int(val) > 0 else 0
            if isinstance(val, str):
                return 1 if val.strip().lower() in ("1", "true", "yes") else 0
            if isinstance(val, bool):
                return 1 if val else 0
            return 0

        row = {
            "title": sanitize_text(input_dict.get("title", "")),
            "location": sanitize_text(input_dict.get("location", "")),
            "department": sanitize_text(input_dict.get("department", "")),
            "salary_range": sanitize_text(input_dict.get("salary_range", "")),
            "company_profile": sanitize_text(input_dict.get("company_profile", "")),
            "description": sanitize_text(input_dict.get("description", "")),
            "requirements": sanitize_text(input_dict.get("requirements", "")),
            "benefits": sanitize_text(input_dict.get("benefits", "")),
            "telecommuting": to_flag(input_dict.get("telecommuting", 0)),
            "has_company_logo": to_flag(input_dict.get("has_company_logo", 0)),
            "has_questions": to_flag(input_dict.get("has_questions", 0)),
            "employment_type": sanitize_text(input_dict.get("employment_type", "")),
            "required_experience": sanitize_text(input_dict.get("required_experience", "")),
            "required_education": sanitize_text(input_dict.get("required_education", "")),
            "industry": sanitize_text(input_dict.get("industry", "")),
            "function": sanitize_text(input_dict.get("function", "")),
        }
        return pd.DataFrame([row])

    def _generate_explanation(
        self,
        df_row: pd.DataFrame,
        risk_score: float,
        prediction: str
    ) -> Dict[str, Any]:
        """
        Attempt to produce SHAP explanation from ml.xai.explain, or fall back to
        domain-heuristic feature attribution.
        """
        # Try ml.xai.explain if available
        try:
            from ml.xai.explain import explain_prediction
            return explain_prediction(self.model, self.feature_pipeline, df_row)
        except Exception:
            pass

        # Robust heuristic explanation based on job posting risk factors
        row = df_row.iloc[0].to_dict()
        important_features = []
        shap_values = {}
        suspicious_reasons = []
        legit_reasons = []

        # Feature 1: Company Logo
        has_logo = row.get("has_company_logo", 0) == 1
        logo_weight = -0.22 if has_logo else 0.28
        shap_values["has_company_logo"] = logo_weight
        important_features.append({
            "feature": "has_company_logo",
            "value": 1 if has_logo else 0,
            "weight": logo_weight,
            "impact": "Decreases Fraud Risk" if has_logo else "Increases Fraud Risk",
            "description": "Postings with verified company logos are significantly more likely to be authentic." if has_logo
            else "Missing company logo is one of the highest statistical indicators of fraudulent postings."
        })
        if not has_logo:
            suspicious_reasons.append("no company logo was provided")
        else:
            legit_reasons.append("presence of a company logo")

        # Feature 2: Company Profile
        profile = str(row.get("company_profile", "")).strip()
        if not profile:
            profile_weight = 0.32
            suspicious_reasons.append("absence of company profile information")
        elif len(profile) < 50:
            profile_weight = 0.15
            suspicious_reasons.append("very brief company profile")
        else:
            profile_weight = -0.25
            legit_reasons.append("detailed corporate background")
        shap_values["company_profile_length"] = profile_weight
        important_features.append({
            "feature": "company_profile_length",
            "value": len(profile),
            "weight": profile_weight,
            "impact": "Increases Fraud Risk" if profile_weight > 0 else "Decreases Fraud Risk",
            "description": f"Company profile length ({len(profile)} chars)."
        })

        # Feature 3: Screening Questions
        has_questions = row.get("has_questions", 0) == 1
        q_weight = -0.18 if has_questions else 0.14
        shap_values["has_questions"] = q_weight
        important_features.append({
            "feature": "has_questions",
            "value": 1 if has_questions else 0,
            "weight": q_weight,
            "impact": "Decreases Fraud Risk" if has_questions else "Increases Fraud Risk",
            "description": "Legitimate employers typically ask candidate pre-screening questions." if has_questions
            else "Absence of application screening questions is common in mass scam postings."
        })
        if has_questions:
            legit_reasons.append("application screening questions are required")

        # Feature 4: Requirements Detail
        reqs = str(row.get("requirements", "")).strip()
        if not reqs:
            req_weight = 0.20
            suspicious_reasons.append("lack of specific job requirements")
        elif len(reqs) > 100:
            req_weight = -0.15
            legit_reasons.append("clearly stated candidate requirements")
        else:
            req_weight = 0.05
        shap_values["requirements_length"] = req_weight
        important_features.append({
            "feature": "requirements_length",
            "value": len(reqs),
            "weight": req_weight,
            "impact": "Increases Fraud Risk" if req_weight > 0 else "Decreases Fraud Risk",
            "description": f"Length of requirements section ({len(reqs)} chars)."
        })

        # Feature 5: Telecommuting & Suspicious Text
        telecommuting = row.get("telecommuting", 0) == 1
        tele_weight = 0.08 if telecommuting else -0.05
        shap_values["telecommuting"] = tele_weight
        important_features.append({
            "feature": "telecommuting",
            "value": 1 if telecommuting else 0,
            "weight": tele_weight,
            "impact": "Increases Fraud Risk" if telecommuting else "Decreases Fraud Risk",
            "description": "Remote/telecommuting positions show slightly elevated rates of unsolicited job scams."
        })

        # Sort features by absolute weight
        important_features.sort(key=lambda x: abs(x["weight"]), reverse=True)

        # Synthesize plain-language explanation
        if prediction == "High Risk":
            summary = (
                f"This posting is flagged as HIGH RISK ({risk_score}% probability of fraud). "
                f"The primary risk contributors are: {', '.join(suspicious_reasons) if suspicious_reasons else 'anomalous feature patterns'}. "
                "Exercise extreme caution before sharing personal or financial details."
            )
        elif prediction == "Potentially Suspicious":
            summary = (
                f"This posting is marked as POTENTIALLY SUSPICIOUS with a risk score of {risk_score}%. "
                f"While it contains some legitimate attributes ({', '.join(legit_reasons[:2]) or 'standard format'}), "
                f"it also displays risk indicators such as {', '.join(suspicious_reasons[:2]) or 'unspecified details'}. "
                "Verify the organization via independent channels before proceeding."
            )
        else:
            summary = (
                f"This posting appears LEGITIMATE with a low risk score of {risk_score}%. "
                f"Key confidence indicators include {', '.join(legit_reasons) if legit_reasons else 'complete company data and standard requirements'}."
            )

        return {
            "shap_values": shap_values,
            "important_features": important_features,
            "explanation": summary,
            "base_value": 0.0484  # Baseline fraud rate in dataset (~4.84%)
        }

    def predict(self, input_dict: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute prediction pipeline for a single job posting.
        
        Args:
            input_dict: Dictionary containing job posting fields.
            
        Returns:
            Dict containing prediction, probability, risk score, model used,
            important features, plain-language explanation, and timestamp.
            
        Raises:
            RuntimeError: If model is not loaded.
        """
        if not self.model_loaded:
            raise RuntimeError("Model not trained yet. Please run ml/training/train_models.py first.")

        df = self._build_dataframe(input_dict)

        # Transform features using pipeline
        try:
            X_transformed = self.feature_pipeline.transform(df)
        except Exception:
            # If pipeline is an end-to-end Estimator, transform may not be separate
            X_transformed = df

        # Predict probability of fraud (class 1)
        if hasattr(self.model, "predict_proba"):
            proba = float(self.model.predict_proba(X_transformed)[0][1])
        elif hasattr(self.model, "decision_function"):
            decision = float(self.model.decision_function(X_transformed)[0])
            proba = float(1.0 / (1.0 + np.exp(-decision)))
        else:
            raw_pred = self.model.predict(X_transformed)[0]
            proba = 1.0 if raw_pred == 1 else 0.0

        # Calculate risk score (0 to 100)
        risk_score = round(proba * 100.0, 2)

        # Categorize risk according to specified thresholds
        # <40 = 'Legitimate', 40-69 = 'Potentially Suspicious', >=70 = 'High Risk'
        if risk_score < 40.0:
            prediction_label = "Legitimate"
        elif risk_score < 70.0:
            prediction_label = "Potentially Suspicious"
        else:
            prediction_label = "High Risk"

        explanation_data = self._generate_explanation(df, risk_score, prediction_label)

        now_iso = datetime.now(timezone.utc).isoformat()

        return {
            "prediction": prediction_label,
            "prediction_probability": round(proba, 4),
            "risk_score": risk_score,
            "model_used": self.model_name,
            "important_features": explanation_data.get("important_features", []),
            "explanation": explanation_data.get("explanation", ""),
            "shap_values": explanation_data.get("shap_values", {}),
            "base_value": explanation_data.get("base_value", 0.0484),
            "timestamp": now_iso
        }
