"""Text Cleaning and Natural Language Processing Utilities for JobGuard-XAI.

Provides text cleaning, HTML/URL stripping, tokenization, stopword removal,
lemmatization, keyword extraction, and suspicious phrase detection.
"""

import logging
import re
from collections import Counter
from typing import Any, Iterable, List, Optional, Tuple, Union

from bs4 import BeautifulSoup
import nltk
from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer
from nltk.tokenize import word_tokenize
from sklearn.base import BaseEstimator, TransformerMixin

# Setup module logger
logger = logging.getLogger(__name__)
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("[%(asctime)s] %(levelname)s - %(name)s: %(message)s"))
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)

# Suspicious keywords/phrases list
SUSPICIOUS_PHRASES: List[str] = [
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

_NLTK_INITIALIZED = False
_STOP_WORDS = set()
_LEMMATIZER: Optional[WordNetLemmatizer] = None


def ensure_nltk_resources() -> None:
    """Download required NLTK resources if not already present."""
    global _NLTK_INITIALIZED, _STOP_WORDS, _LEMMATIZER
    if _NLTK_INITIALIZED:
        return

    resources = [
        ("tokenizers/punkt", "punkt"),
        ("tokenizers/punkt_tab", "punkt_tab"),
        ("corpora/stopwords", "stopwords"),
        ("corpora/wordnet", "wordnet"),
        ("corpora/omw-1.4", "omw-1.4"),
        ("taggers/averaged_perceptron_tagger", "averaged_perceptron_tagger"),
        ("taggers/averaged_perceptron_tagger_eng", "averaged_perceptron_tagger_eng"),
    ]

    for path, pkg in resources:
        try:
            nltk.data.find(path)
        except LookupError:
            try:
                logger.info("Downloading NLTK package: %s", pkg)
                nltk.download(pkg, quiet=True)
            except Exception as e:
                logger.warning("Could not download NLTK package %s: %s", pkg, e)

    try:
        _STOP_WORDS = set(stopwords.words("english"))
    except Exception:
        # Fallback minimal stop words if NLTK stopwords unavailable
        _STOP_WORDS = {
            "a", "about", "above", "after", "again", "against", "all", "am", "an",
            "and", "any", "are", "as", "at", "be", "because", "been", "before",
            "being", "below", "between", "both", "but", "by", "could", "did", "do",
            "does", "doing", "down", "during", "each", "few", "for", "from",
            "further", "had", "has", "have", "having", "he", "her", "here", "hers",
            "herself", "him", "himself", "his", "how", "i", "if", "in", "into",
            "is", "it", "its", "itself", "just", "me", "more", "most", "my",
            "myself", "no", "nor", "not", "of", "off", "on", "once", "only",
            "or", "other", "our", "ours", "ourselves", "out", "over", "own",
            "same", "she", "should", "so", "some", "such", "than", "that", "the",
            "their", "theirs", "them", "themselves", "then", "there", "these",
            "they", "this", "those", "through", "to", "too", "under", "until",
            "up", "very", "was", "we", "were", "what", "when", "where", "which",
            "while", "who", "whom", "why", "with", "would", "you", "your",
            "yours", "yourself", "yourselves",
        }

    try:
        _LEMMATIZER = WordNetLemmatizer()
    except Exception:
        _LEMMATIZER = None

    _NLTK_INITIALIZED = True


# Initialize at import time
ensure_nltk_resources()


def clean_text(text: Union[str, Any]) -> str:
    """Clean and normalize raw text for NLP models.

    Steps:
      1. Handle non-strings and empty input
      2. Strip HTML tags via BeautifulSoup
      3. Strip URLs using regex
      4. Lowercase
      5. Remove non-letter characters (preserve single spaces)
      6. Tokenize (NLTK or whitespace fallback)
      7. Remove English stopwords and short tokens (<2 chars)
      8. Lemmatize tokens via WordNetLemmatizer
      9. Re-join tokens into space-separated string

    Args:
        text: Raw text string (or any object to be cast/cleaned).

    Returns:
        Cleaned, lemmatized text string.
    """
    if text is None:
        return ""
    if not isinstance(text, str):
        text = str(text)

    text = text.strip()
    if not text:
        return ""

    # 1. Strip HTML tags
    try:
        if "<" in text and ">" in text:
            soup = BeautifulSoup(text, "html.parser")
            text = soup.get_text(separator=" ")
    except Exception:
        # Fallback regex HTML stripping if BeautifulSoup fails
        text = re.sub(r"<[^>]+>", " ", text)

    # 2. Strip URLs
    text = re.sub(r"https?://\S+|www\.\S+", " ", text)

    # 3. Lowercase
    text = text.lower()

    # 4. Remove non-letter characters (retain letters and spaces)
    text = re.sub(r"[^a-z\s]", " ", text)

    # 5. Tokenize
    ensure_nltk_resources()
    try:
        tokens = word_tokenize(text)
    except Exception:
        tokens = text.split()

    # 6. Stopwords removal and length filter
    tokens = [t for t in tokens if t not in _STOP_WORDS and len(t) > 1]

    # 7. Lemmatize
    if _LEMMATIZER is not None:
        try:
            tokens = [_LEMMATIZER.lemmatize(t) for t in tokens]
        except Exception:
            pass

    return " ".join(tokens)


def extract_keywords(text: str, top_n: int = 20) -> List[Tuple[str, int]]:
    """Extract top N most frequent keywords from text after cleaning.

    Args:
        text: Input text string.
        top_n: Number of top keywords to return (default: 20).

    Returns:
        List of (word, count) tuples ordered by descending frequency.
    """
    if not text:
        return []

    cleaned = clean_text(text)
    words = cleaned.split()
    if not words:
        return []

    counts = Counter(words)
    return counts.most_common(top_n)


def find_suspicious_phrases(text: str) -> List[str]:
    """Find occurrences of known fraudulent/suspicious phrases in the input text.

    Args:
        text: Raw or processed text string.

    Returns:
        List of suspicious phrases found in the text.
    """
    if not isinstance(text, str) or not text.strip():
        return []

    lower_text = text.lower()
    found: List[str] = []

    for phrase in SUSPICIOUS_PHRASES:
        if phrase in lower_text:
            found.append(phrase)

    return found


class TextCleanerTransformer(BaseEstimator, TransformerMixin):
    """Scikit-learn compatible transformer that applies clean_text across text inputs."""

    def __init__(self) -> None:
        pass

    def fit(self, X: Any, y: Any = None) -> "TextCleanerTransformer":
        """No-op fit method for compatibility."""
        return self

    def transform(self, X: Iterable[Any]) -> List[str]:
        """Apply clean_text to each element in X.

        Args:
            X: Iterable of strings (e.g. pandas Series or list).

        Returns:
            List of cleaned strings.
        """
        # If X is 2D or DataFrame slice, flatten
        if hasattr(X, "iloc"):
            if getattr(X, "ndim", 1) == 2 and X.shape[1] == 1:
                items = X.iloc[:, 0]
            else:
                items = X
        elif hasattr(X, "ndim") and X.ndim == 2 and X.shape[1] == 1:
            items = X.ravel()
        else:
            items = X

        return [clean_text(item) for item in items]

    def get_feature_names_out(self, input_features: Any = None) -> Any:
        """Provide output feature names for scikit-learn pipeline compatibility."""
        import numpy as np
        if input_features is not None:
            return np.asarray(input_features, dtype=object)
        return np.array(["cleaned_text"], dtype=object)



if __name__ == "__main__":
    sample = (
        "<h1>Urgent Wire Transfer Specialist Needed!</h1><br>"
        "Earn up to $5000/week! No experience needed. Work from home now. "
        "Visit https://fakework.com to apply. Make money fast!"
    )
    print("Original:", sample)
    print("Cleaned:", clean_text(sample))
    print("Keywords:", extract_keywords(sample, top_n=5))
    print("Suspicious Phrases:", find_suspicious_phrases(sample))
