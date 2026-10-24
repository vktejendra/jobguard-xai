"""
NLP analysis routes for JobGuard-XAI.
Provides detailed linguistic, lexical, and scam pattern scanning for job postings.
"""

import re
from collections import Counter
from typing import Any, Dict, List
from flask import Blueprint, request, jsonify

nlp_bp = Blueprint("nlp_routes", __name__, url_prefix="/api/nlp")

# Common English stopwords to ignore in keyword frequency extraction
STOPWORDS = {
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are",
    "aren't", "as", "at", "be", "because", "been", "before", "being", "below", "between", "both",
    "but", "by", "can", "can't", "cannot", "could", "couldn't", "did", "didn't", "do", "does",
    "doesn't", "doing", "don't", "down", "during", "each", "few", "for", "from", "further", "had",
    "hadn't", "has", "hasn't", "have", "haven't", "having", "he", "he'd", "he'll", "he's", "her",
    "here", "here's", "hers", "herself", "him", "himself", "his", "how", "how's", "i", "i'd",
    "i'll", "i'm", "i've", "if", "in", "into", "is", "isn't", "it", "it's", "its", "itself", "let's",
    "me", "more", "most", "mustn't", "my", "myself", "no", "nor", "not", "of", "off", "on", "once",
    "only", "or", "other", "ought", "our", "ours", "ourselves", "out", "over", "own", "same",
    "shan't", "she", "she'd", "she'll", "she's", "should", "shouldn't", "so", "some", "such", "than",
    "that", "that's", "the", "their", "theirs", "them", "themselves", "then", "there", "there's",
    "these", "they", "they'd", "they'll", "they're", "they've", "this", "those", "through", "to",
    "too", "under", "until", "up", "very", "was", "wasn't", "we", "we'd", "we'll", "we're", "we've",
    "were", "weren't", "what", "what's", "when", "when's", "where", "where's", "which", "while",
    "who", "who's", "whom", "why", "why's", "with", "won't", "would", "wouldn't", "you", "you'd",
    "you'll", "you're", "you've", "your", "yours", "yourself", "yourselves"
}

# High-risk scam phrases frequently found in fraudulent postings
SUSPICIOUS_PATTERNS = [
    r"wire\s+transfer",
    r"western\s+union",
    r"money\s*gram",
    r"cashier['s]*\s+check",
    r"check\s+deposit",
    r"crypto(?:currency)?|bitcoin|usdt",
    r"processing\s+fee|application\s+fee|equipment\s+fee",
    r"starter\s+kit",
    r"package\s+forwarding|reshipping",
    r"no\s+experience\s+(?:needed|required|necessary)",
    r"work\s+from\s+home\s+guaranteed",
    r"earn\s+\$?\d+[\d,]*\s*(?:per\s+week|weekly|a\s+day|daily)",
    r"unlimited\s+earning\s+potential",
    r"telegram(?:\s*id|:|\s*@)",
    r"whatsapp(?:\s*number|:|\s*\+)",
    r"send\s+(?:your\s+)?(?:resume|cv)\s+to\s+[\w\.-]+@(?:gmail|yahoo|hotmail|outlook)\.com",
    r"pay\s+upfront|advance\s+fee",
    r"immediate\s+start\s+no\s+interview",
    r"secret\s+shopper|mystery\s+shopper"
]


def _extract_suspicious_phrases(text: str) -> List[Dict[str, str]]:
    """Scan text for common fraudulent phrasing and return matched context windows."""
    findings = []
    text_lower = text.lower()
    
    for pattern in SUSPICIOUS_PATTERNS:
        for match in re.finditer(pattern, text_lower):
            start = max(0, match.start() - 35)
            end = min(len(text), match.end() + 35)
            context = text[start:end].replace("\n", " ").strip()
            matched_phrase = match.group(0)
            findings.append({
                "phrase": matched_phrase,
                "context": f"...{context}..." if start > 0 or end < len(text) else context
            })
    return findings


@nlp_bp.route("/analyze", methods=["POST"])
def analyze():
    """
    Perform natural language processing and suspicious pattern scanning on job posting text.
    
    Request body:
        { "text": str }
        
    Response:
        200: {
            "char_count": int,
            "word_count": int,
            "avg_word_length": float,
            "sentence_count": int,
            "keywords": [ { "word": str, "count": int }, ... ],
            "suspicious_phrases": [ { "phrase": str, "context": str }, ... ],
            "cleaned_tokens": [ str, ... ]
        }
        422: { "error": str }
    """
    data = request.get_json(silent=True)
    if not data or not isinstance(data, dict):
        return jsonify({"error": "Request body must be a valid JSON object"}), 422

    text = data.get("text")
    if text is None or not isinstance(text, str):
        return jsonify({"error": "Field 'text' is required and must be a string"}), 422

    raw_text = text.strip()
    if not raw_text:
        return jsonify({
            "char_count": 0,
            "word_count": 0,
            "avg_word_length": 0.0,
            "sentence_count": 0,
            "keywords": [],
            "suspicious_phrases": [],
            "cleaned_tokens": []
        }), 200

    # Try external ml.nlp.text_cleaning if available
    try:
        from ml.nlp.text_cleaning import analyze_text
        result = analyze_text(raw_text)
        return jsonify(result), 200
    except Exception:
        pass

    # Built-in robust NLP analyzer
    char_count = len(raw_text)
    
    # Tokenization: extract alphanumeric words
    tokens = re.findall(r"\b[a-zA-Z0-9_\'-]+\b", raw_text)
    word_count = len(tokens)
    
    avg_word_length = (
        round(sum(len(t) for t in tokens) / word_count, 2) if word_count > 0 else 0.0
    )

    # Sentence boundary estimation
    sentences = re.split(r"[.!?]+(?:\s+|$)", raw_text)
    sentence_count = len([s for s in sentences if s.strip()])

    # Clean tokens (lowercase, stripped of punctuation, length >= 2)
    cleaned_tokens = [
        re.sub(r"[^\w]", "", t.lower())
        for t in tokens
        if len(re.sub(r"[^\w]", "", t.lower())) >= 2
    ]

    # Keyword frequency calculation (filtering out stopwords and digits)
    content_tokens = [
        t for t in cleaned_tokens
        if t not in STOPWORDS and not t.isdigit() and len(t) >= 3
    ]
    token_counts = Counter(content_tokens).most_common(20)
    keywords = [{"word": word, "count": count} for word, count in token_counts]

    # Suspicious phrase detection
    suspicious_phrases = _extract_suspicious_phrases(raw_text)

    return jsonify({
        "char_count": char_count,
        "word_count": word_count,
        "avg_word_length": avg_word_length,
        "sentence_count": sentence_count,
        "keywords": keywords,
        "suspicious_phrases": suspicious_phrases,
        "cleaned_tokens": cleaned_tokens[:100]  # Return top 100 tokens
    }), 200
