"""JobGuard-XAI Data Preprocessing Pipeline.

This module handles loading, validating, cleaning, imputing, feature engineering,
and splitting the fake job postings dataset.
"""

import logging
import os
import re
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split

# Setup module logger
logger = logging.getLogger(__name__)
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("[%(asctime)s] %(levelname)s - %(name)s: %(message)s"))
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)

# Root directory resolution
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DEFAULT_DATA_PATH = os.path.join(PROJECT_ROOT, "ml", "data", "fake_job_postings.csv")

# Expected raw schema
RAW_COLUMNS: List[str] = [
    "job_id",
    "title",
    "location",
    "department",
    "salary_range",
    "company_profile",
    "description",
    "requirements",
    "benefits",
    "telecommuting",
    "has_company_logo",
    "has_questions",
    "employment_type",
    "required_experience",
    "required_education",
    "industry",
    "function",
    "fraudulent",
]

TARGET_COL: str = "fraudulent"

# Feature category definitions
TEXT_COL: str = "combined_text"

NUMERIC_COLS: List[str] = [
    "char_count",
    "word_count",
    "avg_word_length",
    "suspicious_keyword_count",
]

BINARY_COLS: List[str] = [
    "telecommuting",
    "has_company_logo",
    "has_questions",
    "missing_company_profile",
    "missing_requirements",
    "missing_benefits",
    "missing_department",
    "missing_salary_range",
    "missing_employment_type",
    "missing_experience",
    "missing_education",
    "missing_industry",
    "missing_function",
    "has_salary_range",
]

CATEGORICAL_COLS: List[str] = [
    "employment_type",
    "required_experience",
    "required_education",
    "industry",
    "function",
]

# Raw fields mapped to their missingness binary flags
MISSING_FLAG_MAP: Dict[str, str] = {
    "company_profile": "missing_company_profile",
    "requirements": "missing_requirements",
    "benefits": "missing_benefits",
    "department": "missing_department",
    "salary_range": "missing_salary_range",
    "employment_type": "missing_employment_type",
    "required_experience": "missing_experience",
    "required_education": "missing_education",
    "industry": "missing_industry",
    "function": "missing_function",
}

TEXT_FIELDS_TO_COMBINE: List[str] = [
    "title",
    "company_profile",
    "description",
    "requirements",
    "benefits",
]

SUSPICIOUS_KEYWORDS: List[str] = [
    "wire transfer",
    "processing fee",
    "no experience needed",
    "work from home",
    "make money fast",
    "guaranteed income",
    "send money",
    "western union",
    "money order",
    "investment required",
    "training fee",
    "registration fee",
    "upfront",
    "advance fee",
    "pyramid",
    "unlimited earning",
]


def resolve_dataset_path(data_path: Optional[str] = None) -> str:
    """Locate the dataset file, attempting fallback search paths if not found.

    Args:
        data_path: Optional user-supplied path to fake_job_postings.csv.

    Returns:
        Validated absolute path to the dataset file.

    Raises:
        FileNotFoundError: If the dataset cannot be found in default or fallback paths.
    """
    if data_path and os.path.exists(data_path):
        return os.path.abspath(data_path)

    if os.path.exists(DEFAULT_DATA_PATH):
        return os.path.abspath(DEFAULT_DATA_PATH)

    # Search common fallback paths (e.g. user downloads)
    fallbacks = [
        os.path.expanduser(r"~\Downloads\fake job_postings.csv\fake_job_postings.csv"),
        os.path.expanduser(r"~\Downloads\fake_job_postings.csv"),
        os.path.expanduser(r"~\Downloads\fake_job_postings-selected-columns.csv"),
    ]

    for candidate in fallbacks:
        if os.path.exists(candidate):
            logger.info("Found dataset at fallback path: %s. Copying to %s", candidate, DEFAULT_DATA_PATH)
            try:
                os.makedirs(os.path.dirname(DEFAULT_DATA_PATH), exist_ok=True)
                import shutil
                shutil.copyfile(candidate, DEFAULT_DATA_PATH)
                return os.path.abspath(DEFAULT_DATA_PATH)
            except Exception as e:
                logger.warning("Could not copy fallback dataset: %s. Using candidate directly.", e)
                return os.path.abspath(candidate)

    raise FileNotFoundError(
        f"Dataset not found at '{DEFAULT_DATA_PATH}' or any fallback locations. "
        f"Please place 'fake_job_postings.csv' in 'ml/data/'."
    )


def validate_dataset(df: pd.DataFrame) -> None:
    """Validate the loaded dataset columns and shape.

    Args:
        df: Loaded pandas DataFrame.

    Raises:
        ValueError: If required columns are missing or schema is invalid.
    """
    missing_columns = [col for col in RAW_COLUMNS if col not in df.columns]
    if missing_columns:
        raise ValueError(f"Dataset missing required columns: {missing_columns}")

    expected_cols = 18
    expected_rows = 17880

    if df.shape[1] != expected_cols:
        logger.warning(
            "Dataset column count is %d, expected %d.",
            df.shape[1],
            expected_cols,
        )

    if df.shape[0] != expected_rows:
        logger.warning(
            "Dataset row count is %d, expected %d. Continuing with provided rows.",
            df.shape[0],
            expected_rows,
        )
    else:
        logger.info("Dataset shape validated successfully: 17880 rows, 18 columns.")


def count_suspicious_keywords(text: str) -> int:
    """Count occurrences of suspicious phrases in the given text.

    Args:
        text: Input text string.

    Returns:
        Integer count of matched suspicious keywords.
    """
    if not isinstance(text, str) or not text.strip():
        return 0

    lower_text = text.lower()
    total_count = 0
    for kw in SUSPICIOUS_KEYWORDS:
        # Use simple substring count for efficiency
        total_count += lower_text.count(kw)
    return total_count


def compute_missing_flag(series: pd.Series) -> pd.Series:
    """Determine if a series value is missing (null, NaN, or whitespace-only).

    Args:
        series: Pandas series to evaluate.

    Returns:
        Integer series (1 if missing, 0 if present).
    """
    is_null = series.isna()
    is_empty_str = series.astype(str).str.strip().eq("") | series.astype(str).str.lower().eq("nan")
    return (is_null | is_empty_str).astype(int)


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """Perform missingness flag creation, imputation, text combination, and feature engineering.

    Rule: Never drop rows for missingness.

    Args:
        df: Input DataFrame with raw job posting columns.

    Returns:
        Transformed DataFrame with all engineered features added and values imputed.
    """
    data = df.copy()

    # 1. Create missingness flags for specified columns
    for raw_col, flag_col in MISSING_FLAG_MAP.items():
        if raw_col in data.columns:
            data[flag_col] = compute_missing_flag(data[raw_col])
        else:
            data[flag_col] = 1

    # 2. Add has_salary_range flag (1 if salary_range is non-empty and non-null)
    data["has_salary_range"] = (1 - data["missing_salary_range"]).astype(int)

    # 3. Binary flags pass-through verification (ensure integer 0/1)
    base_binary = ["telecommuting", "has_company_logo", "has_questions"]
    for col in base_binary:
        if col in data.columns:
            data[col] = pd.to_numeric(data[col], errors="coerce").fillna(0).astype(int)
        else:
            data[col] = 0

    # 4. Impute text fields with empty string
    for col in TEXT_FIELDS_TO_COMBINE:
        if col in data.columns:
            data[col] = data[col].fillna("").astype(str).str.strip()
        else:
            data[col] = ""

    # 5. Impute categorical fields with 'Not Specified'
    for col in CATEGORICAL_COLS:
        if col in data.columns:
            is_blank = data[col].isna() | data[col].astype(str).str.strip().eq("") | data[col].astype(str).str.lower().eq("nan")
            data[col] = data[col].astype(str)
            data.loc[is_blank, col] = "Not Specified"
        else:
            data[col] = "Not Specified"

    # 6. Combine text blob: title + ' ' + company_profile + ' ' + description + ' ' + requirements + ' ' + benefits
    data[TEXT_COL] = (
        data["title"]
        + " "
        + data["company_profile"]
        + " "
        + data["description"]
        + " "
        + data["requirements"]
        + " "
        + data["benefits"]
    ).str.replace(r"\s+", " ", regex=True).str.strip()

    # 7. Engineered numeric features
    data["char_count"] = data[TEXT_COL].str.len().astype(int)
    data["word_count"] = data[TEXT_COL].apply(lambda s: len(s.split()) if s else 0).astype(int)
    
    # avg_word_length = char_count / word_count (0.0 if word_count == 0)
    data["avg_word_length"] = np.where(
        data["word_count"] > 0,
        data["char_count"] / data["word_count"],
        0.0,
    ).astype(float)

    data["suspicious_keyword_count"] = data[TEXT_COL].apply(count_suspicious_keywords).astype(int)

    return data


def get_preprocessed_data(
    data_path: Optional[str] = None,
    test_size: float = 0.20,
    random_state: int = 42,
) -> Tuple[pd.DataFrame, pd.DataFrame, pd.Series, pd.Series, Dict[str, Any]]:
    """Load, validate, feature-engineer, and split the fake job postings dataset.

    Performs a stratified 80/20 train/test split. Does NOT drop any rows for missingness.
    Does NOT apply SMOTE before the split.

    Args:
        data_path: Optional file path to fake_job_postings.csv.
        test_size: Fraction of samples assigned to the test split (default 0.20).
        random_state: Random state for deterministic stratified split (default 42).

    Returns:
        Tuple containing:
            - X_train: Training features DataFrame
            - X_test: Testing features DataFrame
            - y_train: Training target Series (0=legit, 1=fraud)
            - y_test: Testing target Series (0=legit, 1=fraud)
            - feature_config: Dict with metadata and feature column groupings
    """
    resolved_path = resolve_dataset_path(data_path)
    logger.info("Loading dataset from: %s", resolved_path)

    df = pd.read_csv(resolved_path, low_memory=False)
    validate_dataset(df)

    # Validate target presence
    if TARGET_COL not in df.columns:
        raise ValueError(f"Target column '{TARGET_COL}' not present in dataset.")

    # Convert target to integer 0/1
    df[TARGET_COL] = pd.to_numeric(df[TARGET_COL], errors="coerce").fillna(0).astype(int)

    # Log class distribution
    total_rows = len(df)
    fraud_count = int(df[TARGET_COL].sum())
    fraud_pct = (fraud_count / total_rows) * 100 if total_rows > 0 else 0.0
    logger.info(
        "Dataset summary: %d rows, %d fraud (%.2f%%)",
        total_rows,
        fraud_count,
        fraud_pct,
    )

    # Feature engineering without dropping rows
    processed_df = engineer_features(df)

    feature_columns = [TEXT_COL] + NUMERIC_COLS + BINARY_COLS + CATEGORICAL_COLS
    X = processed_df[feature_columns].copy()
    y = processed_df[TARGET_COL].copy()

    # Stratified train/test split (80/20)
    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=test_size,
        random_state=random_state,
        stratify=y,
    )

    logger.info(
        "Stratified split completed: X_train=%s, X_test=%s, train_fraud=%d, test_fraud=%d",
        X_train.shape,
        X_test.shape,
        int(y_train.sum()),
        int(y_test.sum()),
    )

    feature_config: Dict[str, Any] = {
        "text_col": TEXT_COL,
        "numeric_cols": NUMERIC_COLS,
        "binary_cols": BINARY_COLS,
        "categorical_cols": CATEGORICAL_COLS,
        "all_feature_cols": feature_columns,
        "target_col": TARGET_COL,
        "raw_columns": RAW_COLUMNS,
        "suspicious_keywords": SUSPICIOUS_KEYWORDS,
    }

    return X_train, X_test, y_train, y_test, feature_config


if __name__ == "__main__":
    try:
        X_tr, X_te, y_tr, y_te, cfg = get_preprocessed_data()
        print(f"Data pipeline test successful!")
        print(f"X_train: {X_tr.shape}, X_test: {X_te.shape}")
        print(f"y_train fraud rate: {y_tr.mean():.4f}, y_test fraud rate: {y_te.mean():.4f}")
        print(f"Numeric features: {cfg['numeric_cols']}")
        print(f"Binary features: {cfg['binary_cols']}")
        print(f"Categorical features: {cfg['categorical_cols']}")
    except Exception as exc:
        print(f"Pipeline executed with note: {exc}")
