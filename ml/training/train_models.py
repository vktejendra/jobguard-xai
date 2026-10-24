"""Main Model Training Pipeline for JobGuard-XAI.

Trains and evaluates 7 classifiers on the preprocessed fake job postings dataset:
  1. Logistic Regression
  2. Complement Naive Bayes (on TF-IDF features only)
  3. Decision Tree
  4. Random Forest
  5. LinearSVC
  6. Gradient Boosting
  7. XGBoost

Evaluates models with fraud-class precision, recall, F1, ROC-AUC, PR-AUC, and timing.
Saves the best model, feature pipeline, confusion matrices, ROC curves, PR curves, and metrics.json.
"""

import json
import logging
import os
import time
from typing import Any, Dict, List, Optional, Tuple

import joblib
import matplotlib
matplotlib.use("Agg")  # Non-interactive backend safe for all environments
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, ClassifierMixin
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    confusion_matrix,
    ConfusionMatrixDisplay,
    f1_score,
    precision_recall_curve,
    precision_score,
    recall_score,
    roc_auc_score,
    roc_curve,
)
from sklearn.naive_bayes import ComplementNB
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.svm import LinearSVC
from sklearn.tree import DecisionTreeClassifier

try:
    import xgboost as xgb
    HAS_XGBOOST = True
except ImportError:
    HAS_XGBOOST = False

from ml.nlp.text_cleaning import TextCleanerTransformer, clean_text
from ml.preprocessing.pipeline import (
    BINARY_COLS,
    CATEGORICAL_COLS,
    NUMERIC_COLS,
    TEXT_COL,
    get_preprocessed_data,
)

# Logger setup
logger = logging.getLogger(__name__)
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("[%(asctime)s] %(levelname)s - %(name)s: %(message)s"))
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DEFAULT_SAVED_MODELS_DIR = os.path.join(PROJECT_ROOT, "ml", "saved_models")


class ComplementNBFeatureWrapper(BaseEstimator, ClassifierMixin):
    """Wrapper for ComplementNB to slice TF-IDF features from the combined feature space."""

    def __init__(self, cnb: ComplementNB, n_tfidf_features: int) -> None:
        self.cnb = cnb
        self.n_tfidf_features = n_tfidf_features
        self.classes_ = getattr(cnb, "classes_", np.array([0, 1]))

    def predict(self, X: Any) -> np.ndarray:
        return self.cnb.predict(X[:, : self.n_tfidf_features])

    def predict_proba(self, X: Any) -> np.ndarray:
        return self.cnb.predict_proba(X[:, : self.n_tfidf_features])


def build_feature_pipeline() -> ColumnTransformer:
    """Build the scikit-learn ColumnTransformer for text, numeric, binary, and categorical features.

    Pipeline specs:
      - TF-IDF on combined text blob (max_features=5000, ngram_range=(1,2), sublinear_tf=True) with TextCleanerTransformer
      - StandardScaler on numeric features (char_count, word_count, avg_word_length, suspicious_keyword_count)
      - Binary features pass-through (telecommuting, has_company_logo, has_questions, missing flags, has_salary_range)
      - OneHotEncoder (handle_unknown='ignore') on categoricals (employment_type, required_experience, required_education, industry, function)

    Returns:
        Configured ColumnTransformer object.
    """
    text_pipeline = Pipeline([
        ("cleaner", TextCleanerTransformer()),
        (
            "tfidf",
            TfidfVectorizer(
                max_features=5000,
                ngram_range=(1, 2),
                sublinear_tf=True,
            ),
        ),
    ])

    numeric_transformer = StandardScaler()
    categorical_transformer = OneHotEncoder(handle_unknown="ignore", sparse_output=True)

    feature_transformer = ColumnTransformer(
        transformers=[
            ("text", text_pipeline, TEXT_COL),
            ("num", numeric_transformer, NUMERIC_COLS),
            ("bin", "passthrough", BINARY_COLS),
            ("cat", categorical_transformer, CATEGORICAL_COLS),
        ],
        remainder="drop",
        sparse_threshold=0.3,
    )

    return feature_transformer


def instantiate_models() -> Dict[str, Any]:
    """Instantiate the 7 target classifiers with required hyperparameters and class weighting.

    Classifiers:
      a. Logistic Regression (max_iter=1000, C=1.0, class_weight='balanced')
      b. Complement Naive Bayes (TF-IDF features only)
      c. Decision Tree (max_depth=15, class_weight='balanced')
      d. Random Forest (n_estimators=200, class_weight='balanced', n_jobs=-1)
      e. LinearSVC (class_weight='balanced', max_iter=2000)
      f. Gradient Boosting (n_estimators=200, learning_rate=0.1)
      g. XGBoost (n_estimators=200, scale_pos_weight=19.6, eval_metric='aucpr', n_jobs=-1)

    Returns:
        Dictionary mapping model names to un-fitted model objects.
    """
    models: Dict[str, Any] = {
        "Logistic Regression": LogisticRegression(
            max_iter=1000,
            C=1.0,
            class_weight="balanced",
            random_state=42,
        ),
        "Complement Naive Bayes": ComplementNB(
            alpha=1.0,
            norm=False,
        ),
        "Decision Tree": DecisionTreeClassifier(
            max_depth=15,
            class_weight="balanced",
            random_state=42,
        ),
        "Random Forest": RandomForestClassifier(
            n_estimators=200,
            class_weight="balanced",
            n_jobs=-1,
            random_state=42,
        ),
        "LinearSVC": LinearSVC(
            class_weight="balanced",
            max_iter=2000,
            random_state=42,
            dual="auto",
        ),
        "Gradient Boosting": GradientBoostingClassifier(
            n_estimators=200,
            learning_rate=0.1,
            random_state=42,
        ),
    }

    if HAS_XGBOOST:
        models["XGBoost"] = xgb.XGBClassifier(
            n_estimators=200,
            learning_rate=0.1,
            scale_pos_weight=19.6,
            eval_metric="aucpr",
            n_jobs=-1,
            random_state=42,
        )
    else:
        logger.warning("XGBoost library not available; substituting alternative boosting estimator.")
        models["XGBoost"] = GradientBoostingClassifier(
            n_estimators=200,
            learning_rate=0.1,
            random_state=42,
        )

    return models


def evaluate_model(
    model: Any,
    model_name: str,
    X_train: Any,
    y_train: pd.Series,
    X_test: Any,
    y_test: pd.Series,
    n_tfidf_features: int,
) -> Dict[str, Any]:
    """Train a single model and compute comprehensive evaluation metrics.

    Args:
        model: Estimator object.
        model_name: Display name of the model.
        X_train: Transformed training feature matrix.
        y_train: Training labels.
        X_test: Transformed testing feature matrix.
        y_test: Testing labels.
        n_tfidf_features: Number of TF-IDF text features (for ComplementNB).

    Returns:
        Dictionary of computed performance metrics and curves data.
    """
    logger.info("Training %s...", model_name)
    start_time = time.time()

    # Complement Naive Bayes only operates on TF-IDF features (non-negative)
    if model_name == "Complement Naive Bayes":
        X_tr = X_train[:, :n_tfidf_features]
        X_te = X_test[:, :n_tfidf_features]
    else:
        X_tr = X_train
        X_te = X_test

    model.fit(X_tr, y_train)
    training_time = time.time() - start_time

    # Predictions
    y_pred = model.predict(X_te)

    # Probabilities / decision scores for ROC and PR curves
    if hasattr(model, "predict_proba"):
        y_score = model.predict_proba(X_te)[:, 1]
    elif hasattr(model, "decision_function"):
        y_score = model.decision_function(X_te)
    else:
        y_score = y_pred.astype(float)

    # Metrics computation (fraud class = 1)
    acc = float(accuracy_score(y_test, y_pred))
    prec = float(precision_score(y_test, y_pred, pos_label=1, zero_division=0))
    rec = float(recall_score(y_test, y_pred, pos_label=1, zero_division=0))
    f1 = float(f1_score(y_test, y_pred, pos_label=1, zero_division=0))
    roc_auc = float(roc_auc_score(y_test, y_score))
    pr_auc = float(average_precision_score(y_test, y_score))
    cm = confusion_matrix(y_test, y_pred).tolist()

    logger.info(
        "Finished %s (%.2fs) | F1: %.4f | PR-AUC: %.4f | Recall: %.4f | Precision: %.4f | ROC-AUC: %.4f",
        model_name,
        training_time,
        f1,
        pr_auc,
        rec,
        prec,
        roc_auc,
    )

    return {
        "model_name": model_name,
        "model_obj": model,
        "accuracy": round(acc, 4),
        "precision": round(prec, 4),
        "recall": round(rec, 4),
        "f1": round(f1, 4),
        "roc_auc": round(roc_auc, 4),
        "pr_auc": round(pr_auc, 4),
        "training_time_seconds": round(training_time, 2),
        "confusion_matrix": cm,
        "y_score": y_score,
        "y_pred": y_pred,
    }


def save_confusion_matrix_plot(
    cm: List[List[int]],
    model_name: str,
    output_dir: str,
) -> str:
    """Generate and save confusion matrix figure for a single model."""
    clean_name = model_name.lower().replace(" ", "_").replace("-", "_")
    output_path = os.path.join(output_dir, f"confusion_matrix_{clean_name}.png")

    fig, ax = plt.subplots(figsize=(5, 4), dpi=150)
    disp = ConfusionMatrixDisplay(
        confusion_matrix=np.array(cm),
        display_labels=["Legitimate", "Fraud"],
    )
    disp.plot(ax=ax, cmap="Blues", values_format="d", colorbar=False)
    ax.set_title(f"Confusion Matrix: {model_name}", fontsize=12, pad=10)
    plt.tight_layout()
    fig.savefig(output_path)
    plt.close(fig)
    return output_path


def save_roc_curves_plot(
    results: List[Dict[str, Any]],
    y_test: pd.Series,
    output_dir: str,
) -> str:
    """Plot overlaid ROC curves for all models and save figure."""
    output_path = os.path.join(output_dir, "roc_curves.png")

    plt.figure(figsize=(9, 7), dpi=150)
    for res in results:
        fpr, tpr, _ = roc_curve(y_test, res["y_score"])
        plt.plot(
            fpr,
            tpr,
            lw=2,
            label=f"{res['model_name']} (AUC = {res['roc_auc']:.4f})",
        )

    plt.plot([0, 1], [0, 1], color="gray", lw=1.5, linestyle="--", label="Random Chance (AUC = 0.50)")
    plt.xlim([0.0, 1.0])
    plt.ylim([0.0, 1.05])
    plt.xlabel("False Positive Rate (1 - Specificity)", fontsize=11)
    plt.ylabel("True Positive Rate (Recall / Sensitivity)", fontsize=11)
    plt.title("Receiver Operating Characteristic (ROC) - All Models", fontsize=13, pad=12)
    plt.legend(loc="lower right", fontsize=9)
    plt.grid(alpha=0.3)
    plt.tight_layout()
    plt.savefig(output_path)
    plt.close()
    return output_path


def save_pr_curves_plot(
    results: List[Dict[str, Any]],
    y_test: pd.Series,
    output_dir: str,
) -> str:
    """Plot overlaid Precision-Recall curves for all models and save figure."""
    output_path = os.path.join(output_dir, "pr_curves.png")

    plt.figure(figsize=(9, 7), dpi=150)
    baseline = float(y_test.mean())
    plt.axhline(
        y=baseline,
        color="gray",
        linestyle="--",
        lw=1.5,
        label=f"Baseline Fraud Rate ({baseline:.3f})",
    )

    for res in results:
        prec, rec, _ = precision_recall_curve(y_test, res["y_score"])
        plt.plot(
            rec,
            prec,
            lw=2,
            label=f"{res['model_name']} (PR-AUC = {res['pr_auc']:.4f})",
        )

    plt.xlim([0.0, 1.0])
    plt.ylim([0.0, 1.05])
    plt.xlabel("Recall", fontsize=11)
    plt.ylabel("Precision", fontsize=11)
    plt.title("Precision-Recall (PR) Curves - All Models", fontsize=13, pad=12)
    plt.legend(loc="upper right", fontsize=9)
    plt.grid(alpha=0.3)
    plt.tight_layout()
    plt.savefig(output_path)
    plt.close()
    return output_path


def run_training_pipeline(
    data_path: Optional[str] = None,
    saved_models_dir: Optional[str] = None,
) -> Tuple[str, Dict[str, Any]]:
    """Execute the full model training, evaluation, comparison, and export pipeline.

    Args:
        data_path: Optional path to the raw dataset CSV.
        saved_models_dir: Directory where trained artifacts will be written.

    Returns:
        Tuple of (best_model_name, full_metrics_dict).
    """
    output_dir = saved_models_dir or DEFAULT_SAVED_MODELS_DIR
    os.makedirs(output_dir, exist_ok=True)

    # 1. Load and split preprocessed data
    logger.info("Step 1: Loading preprocessed data...")
    X_train, X_test, y_train, y_test, feature_config = get_preprocessed_data(data_path=data_path)

    # 2. Build and fit ColumnTransformer
    logger.info("Step 2: Fitting feature ColumnTransformer on training split...")
    feature_pipeline = build_feature_pipeline()
    X_train_trans = feature_pipeline.fit_transform(X_train)
    X_test_trans = feature_pipeline.transform(X_test)

    # Determine TF-IDF feature slice dimension
    tfidf_step = feature_pipeline.named_transformers_["text"].named_steps["tfidf"]
    n_tfidf_features = len(tfidf_step.get_feature_names_out())
    logger.info("Feature extraction complete. Total features: %d (TF-IDF: %d)", X_train_trans.shape[1], n_tfidf_features)

    # 3. Instantiate classifiers
    logger.info("Step 3: Instantiating 7 candidate classifiers...")
    models = instantiate_models()

    # 4. Train and evaluate all models
    results: List[Dict[str, Any]] = []
    for model_name, model_obj in models.items():
        res = evaluate_model(
            model=model_obj,
            model_name=model_name,
            X_train=X_train_trans,
            y_train=y_train,
            X_test=X_test_trans,
            y_test=y_test,
            n_tfidf_features=n_tfidf_features,
        )
        results.append(res)

    # 5. Select best model: primary = fraud-class F1, secondary = PR-AUC
    # Sort descending by (f1, pr_auc)
    results_sorted = sorted(results, key=lambda r: (r["f1"], r["pr_auc"]), reverse=True)
    best_result = results_sorted[0]
    best_model_name = best_result["model_name"]
    best_model_obj = best_result["model_obj"]

    logger.info("Winner identified: %s (F1=%.4f, PR-AUC=%.4f)", best_model_name, best_result["f1"], best_result["pr_auc"])

    # If ComplementNB won, wrap it so it slices TF-IDF features automatically upon prediction
    if best_model_name == "Complement Naive Bayes":
        best_model_to_save = ComplementNBFeatureWrapper(best_model_obj, n_tfidf_features)
    else:
        best_model_to_save = best_model_obj

    # 6. Save artifacts
    logger.info("Step 4: Saving model artifacts to %s...", output_dir)

    # Save best model
    best_model_path = os.path.join(output_dir, "best_model.joblib")
    joblib.dump(best_model_to_save, best_model_path)
    logger.info("Saved best model to %s", best_model_path)

    # Save fitted feature pipeline
    feature_pipeline_path = os.path.join(output_dir, "feature_pipeline.joblib")
    joblib.dump(feature_pipeline, feature_pipeline_path)
    logger.info("Saved feature pipeline to %s", feature_pipeline_path)

    # Save confusion matrices for each model
    for res in results:
        save_confusion_matrix_plot(res["confusion_matrix"], res["model_name"], output_dir)

    # Save overlaid ROC and PR curves
    save_roc_curves_plot(results, y_test, output_dir)
    save_pr_curves_plot(results, y_test, output_dir)

    # Structure metrics dictionary
    metrics_summary: Dict[str, Any] = {
        "best_model": best_model_name,
        "best_model_name": best_model_name,
        "best_f1": best_result["f1"],
        "best_pr_auc": best_result["pr_auc"],
        "trained_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "models": {},
        "comparison": [
            {
                "model_name": r["model_name"],
                "f1": r["f1"],
                "pr_auc": r["pr_auc"],
                "recall": r["recall"],
                "precision": r["precision"],
                "roc_auc": r["roc_auc"],
                "accuracy": r["accuracy"],
                "training_time_seconds": r["training_time_seconds"],
            }
            for r in results_sorted
        ],
    }

    for res in results:
        metrics_summary["models"][res["model_name"]] = {
            "accuracy": res["accuracy"],
            "precision": res["precision"],
            "recall": res["recall"],
            "f1": res["f1"],
            "roc_auc": res["roc_auc"],
            "pr_auc": res["pr_auc"],
            "training_time_seconds": res["training_time_seconds"],
            "confusion_matrix": res["confusion_matrix"],
        }

    metrics_json_path = os.path.join(output_dir, "metrics.json")
    with open(metrics_json_path, "w", encoding="utf-8") as f:
        json.dump(metrics_summary, f, indent=2)
    logger.info("Saved metrics JSON to %s", metrics_json_path)

    # 7. Print summary and completion message
    print("\n" + "=" * 70)
    print("JOBGUARD-XAI MODEL EVALUATION SUMMARY")
    print("=" * 70)
    print(f"{'Model Name':<26} | {'F1':<7} | {'PR-AUC':<7} | {'Recall':<7} | {'Prec':<7} | {'Time (s)':<8}")
    print("-" * 70)
    for res in results_sorted:
        print(
            f"{res['model_name']:<26} | "
            f"{res['f1']:<7.4f} | "
            f"{res['pr_auc']:<7.4f} | "
            f"{res['recall']:<7.4f} | "
            f"{res['precision']:<7.4f} | "
            f"{res['training_time_seconds']:<8.2f}"
        )
    print("=" * 70)
    print(
        f"TRAINING COMPLETE. Best model: {best_model_name} | "
        f"F1={best_result['f1']:.4f} | PR-AUC={best_result['pr_auc']:.4f}"
    )

    return best_model_name, metrics_summary


if __name__ == "__main__":
    run_training_pipeline()
