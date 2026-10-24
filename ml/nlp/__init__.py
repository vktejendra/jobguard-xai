"""NLP text cleaning, keyword extraction, and taxonomy index building for JobGuard-XAI."""

from ml.nlp.build_role_index import ROLE_DEFINITIONS, build_role_index
from ml.nlp.text_cleaning import (
    SUSPICIOUS_PHRASES,
    TextCleanerTransformer,
    clean_text,
    extract_keywords,
    find_suspicious_phrases,
)

__all__ = [
    "ROLE_DEFINITIONS",
    "SUSPICIOUS_PHRASES",
    "TextCleanerTransformer",
    "build_role_index",
    "clean_text",
    "extract_keywords",
    "find_suspicious_phrases",
]
