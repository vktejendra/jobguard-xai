"""Explainable AI (XAI) Engine for JobGuard-XAI.

Provides local instance explanations (SHAP values, top fraud factors, top legit factors,
plain language summaries) and global feature importances for model transparency.
"""

import logging
import os
import re
from typing import Any, Dict, List, Optional, Tuple, Union

import joblib
import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator

try:
    import shap
    HAS_SHAP = True
except ImportError:
    HAS_SHAP = False

from ml.preprocessing.pipeline import (
    BINARY_COLS,
    CATEGORICAL_COLS,
    NUMERIC_COLS,
    TEXT_COL,
    engineer_features,
)

logger = logging.getLogger(__name__)
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("[%(asctime)s] %(levelname)s - %(name)s: %(message)s"))
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DEFAULT_MODEL_PATH = os.path.join(PROJECT_ROOT, "ml", "saved_models", "best_model.joblib")
DEFAULT_PIPELINE_PATH = os.path.join(PROJECT_ROOT, "ml", "saved_models", "feature_pipeline.joblib")


def clean_display_feature_name(raw_name: str) -> str:
    """Transform technical feature column name into human-readable label.

    Examples:
      'text__tfidf__wire transfer' -> 'Keyword: "wire transfer"'
      'bin__missing_company_profile' -> 'Missing Company Profile'
      'bin__has_company_logo' -> 'Has Company Logo'
      'num__suspicious_keyword_count' -> 'Suspicious Keyword Count'
      'cat__employment_type_Full-time' -> 'Employment Type: Full-time'
    """
    clean = raw_name
    # Strip pipeline prefixes
    for prefix in ["text__tfidf__", "text__", "num__", "bin__", "cat__"]:
        if clean.startswith(prefix):
            clean = clean[len(prefix):]
            break

    # Categorical split
    if "_" in clean and any(clean.startswith(c) for c in ["employment_type_", "required_experience_", "required_education_", "industry_", "function_"]):
        parts = clean.split("_", 1)
        cat_title = parts[0].replace("_", " ").title()
        val_title = parts[1].replace("_", " ")
        return f"{cat_title}: {val_title}"

    # Text keyword
    if raw_name.startswith("text__tfidf__"):
        return f'Keyword: "{clean}"'

    # Binary flags
    if clean.startswith("missing_"):
        flag_target = clean.replace("missing_", "").replace("_", " ").title()
        return f"Missing {flag_target}"

    if clean.startswith("has_"):
        flag_target = clean.replace("has_", "").replace("_", " ").title()
        return f"Has {flag_target}"

    # General replacements
    return clean.replace("_", " ").title()


class ExplainabilityEngine:
    """XAI Engine providing local SHAP explanations and global feature rankings."""

    def __init__(
        self,
        model_path: Optional[str] = None,
        pipeline_path: Optional[str] = None,
    ) -> None:
        """Initialize explainability engine with saved model and feature pipeline.

        Args:
            model_path: Path to serialized best_model.joblib.
            pipeline_path: Path to serialized feature_pipeline.joblib.
        """
        self.model_path = model_path or DEFAULT_MODEL_PATH
        self.pipeline_path = pipeline_path or DEFAULT_PIPELINE_PATH

        self.model: Optional[Any] = None
        self.pipeline: Optional[Any] = None
        self.explainer: Optional[Any] = None
        self._feature_names_cache: Optional[List[str]] = None

        self._load_artifacts()

    def _load_artifacts(self) -> None:
        """Load model and pipeline if present on filesystem."""
        if os.path.exists(self.model_path):
            try:
                self.model = joblib.load(self.model_path)
                logger.info("Loaded model from %s", self.model_path)
            except Exception as e:
                logger.error("Error loading model from %s: %s", self.model_path, e)

        if os.path.exists(self.pipeline_path):
            try:
                self.pipeline = joblib.load(self.pipeline_path)
                logger.info("Loaded feature pipeline from %s", self.pipeline_path)
            except Exception as e:
                logger.error("Error loading pipeline from %s: %s", self.pipeline_path, e)

    def get_feature_names(self) -> List[str]:
        """Extract output feature names from the fitted ColumnTransformer.

        Returns:
            List of feature name strings.
        """
        if self._feature_names_cache is not None:
            return self._feature_names_cache

        if self.pipeline is None:
            return []

        try:
            # Modern scikit-learn standard
            names = list(self.pipeline.get_feature_names_out())
            self._feature_names_cache = names
            return names
        except Exception as e:
            logger.warning("Could not retrieve feature names directly from pipeline: %s. Reconstructing.", e)

        # Fallback reconstruction
        names: List[str] = []
        try:
            tfidf = self.pipeline.named_transformers_["text"].named_steps["tfidf"]
            text_names = [f"text__tfidf__{fn}" for fn in tfidf.get_feature_names_out()]
            names.extend(text_names)
        except Exception:
            pass

        names.extend([f"num__{c}" for c in NUMERIC_COLS])
        names.extend([f"bin__{c}" for c in BINARY_COLS])

        try:
            cat_enc = self.pipeline.named_transformers_["cat"]
            names.extend(list(cat_enc.get_feature_names_out(CATEGORICAL_COLS)))
        except Exception:
            names.extend([f"cat__{c}" for c in CATEGORICAL_COLS])

        self._feature_names_cache = names
        return names

    def _init_explainer(self, background_data: Optional[Any] = None) -> Any:
        """Initialize or retrieve appropriate SHAP explainer instance."""
        if self.explainer is not None:
            return self.explainer

        if not HAS_SHAP:
            logger.warning("SHAP is not installed. Explanations will use heuristic fallback.")
            return None

        if self.model is None:
            return None

        actual_model = getattr(self.model, "cnb", self.model)
        model_type = type(actual_model).__name__.lower()

        # TreeExplainer for tree-based architectures
        is_tree = any(t in model_type for t in ["forest", "tree", "xgb", "boost", "lgbm"])

        try:
            if is_tree:
                logger.info("Initializing SHAP TreeExplainer for %s...", model_type)
                self.explainer = shap.TreeExplainer(actual_model)
            elif "logistic" in model_type or "svc" in model_type or "linear" in model_type:
                logger.info("Initializing SHAP LinearExplainer for %s...", model_type)
                if background_data is not None:
                    self.explainer = shap.LinearExplainer(actual_model, background_data)
                else:
                    self.explainer = shap.Explainer(actual_model)
            else:
                logger.info("Initializing general SHAP Explainer...")
                self.explainer = shap.Explainer(actual_model)
        except Exception as e:
            logger.warning("SHAP explainer initialization failed (%s); using fallback explainer.", e)
            self.explainer = None

        return self.explainer

    def _prepare_input_df(self, raw_input: Union[Dict[str, Any], pd.DataFrame, pd.Series]) -> pd.DataFrame:
        """Standardize raw dictionary or DataFrame into preprocessed feature DataFrame.

        Args:
            raw_input: Raw job posting dictionary or DataFrame.

        Returns:
            Preprocessed DataFrame with all engineered columns present.
        """
        if isinstance(raw_input, dict):
            df = pd.DataFrame([raw_input])
        elif isinstance(raw_input, pd.Series):
            df = pd.DataFrame([raw_input.to_dict()])
        else:
            df = raw_input.copy()

        # Apply missing flags, text combination, and numerical counts
        processed = engineer_features(df)
        return processed

    def explain(
        self,
        input_features_raw: Union[Dict[str, Any], pd.DataFrame, pd.Series],
    ) -> Dict[str, Any]:
        """Generate comprehensive local explanation for a single job posting.

        Computes:
          - Fraud probability & class prediction
          - SHAP values across all features
          - Top 5 fraud-inducing factors (positive SHAP)
          - Top 5 legit-inducing factors (negative SHAP)
          - Base value (expected model output)
          - Plain-language explanation summary

        Args:
            input_features_raw: Raw dictionary or single-row DataFrame.

        Returns:
            Dictionary containing explanation metrics and textual summary.
        """
        if self.model is None or self.pipeline is None:
            self._load_artifacts()

        if self.model is None or self.pipeline is None:
            raise RuntimeError("Model or feature pipeline is not available. Please run model training first.")

        # 1. Standardize and engineer features
        input_df = self._prepare_input_df(input_features_raw)

        # 2. Transform through fitted ColumnTransformer
        feature_names = self.get_feature_names()
        X_trans = self.pipeline.transform(input_df)

        # Convert to dense 2D array for single sample explanation
        if hasattr(X_trans, "toarray"):
            X_dense = X_trans.toarray()
        else:
            X_dense = np.asarray(X_trans)

        # 3. Model prediction and probability
        actual_model = getattr(self.model, "cnb", self.model)
        has_proba = hasattr(self.model, "predict_proba") or hasattr(actual_model, "predict_proba")

        if has_proba:
            proba = float(self.model.predict_proba(X_trans)[0, 1])
            prediction = int(proba >= 0.5)
        elif hasattr(self.model, "decision_function"):
            score = float(self.model.decision_function(X_trans)[0])
            # Sigmoid conversion
            proba = float(1.0 / (1.0 + np.exp(-score)))
            prediction = int(score > 0)
        else:
            prediction = int(self.model.predict(X_trans)[0])
            proba = float(prediction)

        # 4. Compute SHAP values
        shap_vector = np.zeros(X_dense.shape[1], dtype=float)
        base_value = 0.0

        explainer = self._init_explainer(background_data=X_dense)

        if explainer is not None and HAS_SHAP:
            try:
                # TreeExplainer / LinearExplainer computation
                # For models with wrapper, slice if necessary
                if hasattr(self.model, "n_tfidf_features"):
                    X_input_for_shap = X_dense[:, : self.model.n_tfidf_features]
                else:
                    X_input_for_shap = X_dense

                raw_shap = explainer.shap_values(X_input_for_shap)

                # Format SHAP outputs across different SHAP versions
                if isinstance(raw_shap, list):
                    # Multi-class output: class 1 is fraud
                    if len(raw_shap) > 1:
                        shap_vector_slice = np.array(raw_shap[1][0])
                    else:
                        shap_vector_slice = np.array(raw_shap[0][0])
                elif hasattr(raw_shap, "values"):
                    # Explanation object
                    vals = raw_shap.values
                    if vals.ndim == 3:
                        shap_vector_slice = vals[0, :, 1]
                    else:
                        shap_vector_slice = vals[0]
                elif isinstance(raw_shap, np.ndarray):
                    if raw_shap.ndim == 3:
                        shap_vector_slice = raw_shap[0, :, 1]
                    elif raw_shap.ndim == 2:
                        shap_vector_slice = raw_shap[0]
                    else:
                        shap_vector_slice = raw_shap
                else:
                    shap_vector_slice = np.zeros(X_input_for_shap.shape[1])

                # Match dimensions if model operated on subset (e.g. ComplementNB)
                if len(shap_vector_slice) <= len(shap_vector):
                    shap_vector[: len(shap_vector_slice)] = shap_vector_slice

                # Extract base value
                ev = getattr(explainer, "expected_value", 0.0)
                if isinstance(ev, (list, np.ndarray)):
                    base_value = float(ev[1] if len(ev) > 1 else ev[0])
                else:
                    base_value = float(ev)
            except Exception as e:
                logger.warning("SHAP calculation raised error (%s); falling back to model feature contributions.", e)
                shap_vector, base_value = self._heuristic_feature_contributions(X_dense)
        else:
            shap_vector, base_value = self._heuristic_feature_contributions(X_dense)

        # 5. Extract top fraud and legit factors
        top_fraud_factors: List[Dict[str, Any]] = []
        top_legit_factors: List[Dict[str, Any]] = []

        # Pair each feature with its SHAP contribution
        pairs = []
        for idx, val in enumerate(shap_vector):
            raw_fname = feature_names[idx] if idx < len(feature_names) else f"feature_{idx}"
            display_name = clean_display_feature_name(raw_fname)
            pairs.append((raw_fname, display_name, float(val)))

        # Positive contributions -> push towards fraud
        pos_pairs = sorted([p for p in pairs if p[2] > 0], key=lambda x: x[2], reverse=True)
        for raw_fn, disp_fn, val in pos_pairs[:5]:
            top_fraud_factors.append({
                "feature": disp_fn,
                "raw_feature": raw_fn,
                "shap_value": round(val, 4),
                "impact": "increases_fraud_risk",
            })

        # Negative contributions -> push towards legit
        neg_pairs = sorted([p for p in pairs if p[2] < 0], key=lambda x: x[2])
        for raw_fn, disp_fn, val in neg_pairs[:5]:
            top_legit_factors.append({
                "feature": disp_fn,
                "raw_feature": raw_fn,
                "shap_value": round(val, 4),
                "impact": "increases_legit_confidence",
            })

        # 6. Generate plain-language summary
        plain_summary = self._generate_plain_language_summary(
            prediction=prediction,
            proba=proba,
            top_fraud=top_fraud_factors,
            top_legit=top_legit_factors,
        )

        return {
            "prediction": prediction,
            "prediction_label": "Fraudulent" if prediction == 1 else "Legitimate",
            "fraud_probability": round(proba, 4),
            "base_value": round(base_value, 4),
            "shap_values": [round(float(v), 4) for v in shap_vector],
            "feature_names": feature_names,
            "top_fraud_factors": top_fraud_factors,
            "top_legit_factors": top_legit_factors,
            "plain_language_summary": plain_summary,
        }

    def _heuristic_feature_contributions(self, X_dense: np.ndarray) -> Tuple[np.ndarray, float]:
        """Fallback feature importance calculation when SHAP is unavailable."""
        actual_model = getattr(self.model, "cnb", self.model)
        sample = X_dense[0]

        if hasattr(actual_model, "coef_"):
            coef = actual_model.coef_
            if coef.ndim == 2:
                weights = coef[0]
            else:
                weights = coef
            # Linear contribution: sample * weight
            contrib = sample * weights
            intercept = getattr(actual_model, "intercept_", [0.0])
            base_val = float(intercept[0] if hasattr(intercept, "__len__") else intercept)
            return contrib, base_val

        if hasattr(actual_model, "feature_importances_"):
            importances = actual_model.feature_importances_
            # Scale sample presence by tree importance
            presence = np.where(sample != 0, 1.0, -0.2)
            contrib = presence * importances
            return contrib, 0.05

        # Neutral fallback
        return np.zeros(X_dense.shape[1]), 0.05

    def _generate_plain_language_summary(
        self,
        prediction: int,
        proba: float,
        top_fraud: List[Dict[str, Any]],
        top_legit: List[Dict[str, Any]],
    ) -> str:
        """Create intuitive, user-friendly explanation sentence."""
        if prediction == 1 or proba >= 0.5:
            if len(top_fraud) >= 2:
                f1 = top_fraud[0]["feature"]
                f2 = top_fraud[1]["feature"]
                return f'This posting was flagged mainly because of {f1} and {f2}.'
            elif len(top_fraud) == 1:
                f1 = top_fraud[0]["feature"]
                return f'This posting was flagged mainly because of {f1}.'
            else:
                return 'This posting was flagged as suspicious based on overall metadata and phrasing anomalies.'
        else:
            if len(top_legit) >= 2:
                l1 = top_legit[0]["feature"]
                l2 = top_legit[1]["feature"]
                return f'This posting appears legitimate primarily due to {l1} and {l2}.'
            elif len(top_legit) == 1:
                l1 = top_legit[0]["feature"]
                return f'This posting appears legitimate primarily due to {l1}.'
            else:
                return 'This posting appears legitimate based on standard company profile and requirement details.'

    def get_global_feature_importance(self, top_n: int = 20) -> Dict[str, Any]:
        """Extract global feature importance ranking from the trained model.

        Used for the Model Performance and Global Transparency dashboard view.

        Args:
            top_n: Number of leading features to return (default: 20).

        Returns:
            Dictionary with 'features' and 'importances' parallel arrays.
        """
        if self.model is None:
            self._load_artifacts()

        if self.model is None:
            return {"features": [], "importances": []}

        actual_model = getattr(self.model, "cnb", self.model)
        feature_names = self.get_feature_names()
        n_features = len(feature_names)

        raw_importances = np.zeros(n_features, dtype=float)

        if hasattr(actual_model, "feature_importances_"):
            fi = actual_model.feature_importances_
            raw_importances[: len(fi)] = fi
        elif hasattr(actual_model, "coef_"):
            coef = actual_model.coef_
            if coef.ndim == 2:
                c = np.abs(coef[0])
            else:
                c = np.abs(coef)
            raw_importances[: len(c)] = c
        else:
            # Fallback uniform
            return {"features": feature_names[:top_n], "importances": [round(1.0 / top_n, 4)] * min(top_n, n_features)}

        # Normalize importances so they sum to 1.0
        total = float(raw_importances.sum())
        if total > 0:
            norm_importances = raw_importances / total
        else:
            norm_importances = raw_importances

        # Sort descending
        top_indices = np.argsort(norm_importances)[::-1][:top_n]

        result_features = [
            clean_display_feature_name(feature_names[i]) if i < len(feature_names) else f"Feature {i}"
            for i in top_indices
        ]
        result_importances = [round(float(norm_importances[i]), 4) for i in top_indices]

        return {
            "features": result_features,
            "importances": result_importances,
        }


if __name__ == "__main__":
    engine = ExplainabilityEngine()
    sample_posting = {
        "title": "Wire Transfer Administrative Assistant",
        "company_profile": "",
        "description": "Immediate hire! Earn money fast. Process money orders and wire transfers from home.",
        "requirements": "No experience needed. Must have bank account.",
        "benefits": "",
        "telecommuting": 1,
        "has_company_logo": 0,
        "has_questions": 0,
        "employment_type": "Part-time",
        "required_experience": "Entry level",
        "required_education": "High School or equivalent",
        "industry": "Financial Services",
        "function": "Administrative",
    }
    try:
        explanation = engine.explain(sample_posting)
        print("Prediction:", explanation["prediction_label"])
        print("Fraud Probability:", explanation["fraud_probability"])
        print("Summary:", explanation["plain_language_summary"])
        print("Top Fraud Factors:", explanation["top_fraud_factors"])
        print("Top Legit Factors:", explanation["top_legit_factors"])
    except Exception as exc:
        print("Engine test note:", exc)
