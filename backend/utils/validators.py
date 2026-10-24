"""
Input validation and sanitization helpers for JobGuard-XAI API.
Ensures incoming request payloads conform to schema expectations and security boundaries.
"""

import re
from typing import Any, Dict, Tuple

EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")


def sanitize_text(text: Any, max_length: int = 10000) -> str:
    """
    Sanitize text input by stripping whitespace and truncating to max_length characters.
    
    Args:
        text: Input string or object.
        max_length: Maximum allowed character length (default 10000).
        
    Returns:
        Cleaned string.
    """
    if text is None:
        return ""
    text_str = str(text).strip()
    if len(text_str) > max_length:
        return text_str[:max_length]
    return text_str


def validate_register(data: Any) -> Tuple[bool, str]:
    """
    Validate user registration payload.
    
    Expected payload:
        - name: str (2-100 characters)
        - email: str (valid email address)
        - password: str (minimum 6 characters)
        
    Returns:
        (is_valid, error_message)
    """
    if not isinstance(data, dict):
        return False, "Request payload must be a JSON object"

    name = data.get("name")
    if not name or not isinstance(name, str) or not name.strip():
        return False, "Full name is required"
    if len(name.strip()) < 2:
        return False, "Name must be at least 2 characters long"
    if len(name.strip()) > 100:
        return False, "Name cannot exceed 100 characters"

    email = data.get("email")
    if not email or not isinstance(email, str) or not email.strip():
        return False, "Email address is required"
    email_clean = email.strip()
    if len(email_clean) > 255:
        return False, "Email address cannot exceed 255 characters"
    if not EMAIL_REGEX.match(email_clean):
        return False, "Invalid email address format"

    password = data.get("password")
    if not password or not isinstance(password, str):
        return False, "Password is required"
    if len(password) < 6:
        return False, "Password must be at least 6 characters long"
    if len(password) > 128:
        return False, "Password cannot exceed 128 characters"

    return True, ""


def validate_login(data: Any) -> Tuple[bool, str]:
    """
    Validate user login payload.
    
    Expected payload:
        - email: str
        - password: str
        
    Returns:
        (is_valid, error_message)
    """
    if not isinstance(data, dict):
        return False, "Request payload must be a JSON object"

    email = data.get("email")
    if not email or not isinstance(email, str) or not email.strip():
        return False, "Email address is required"

    password = data.get("password")
    if not password or not isinstance(password, str):
        return False, "Password is required"

    return True, ""


def validate_predict_input(data: Any) -> Tuple[bool, str]:
    """
    Validate job posting data for prediction.
    Ensures essential textual fields are present and flags are boolean or 0/1 integers.
    
    Returns:
        (is_valid, error_message)
    """
    if not isinstance(data, dict):
        return False, "Request payload must be a JSON object with job posting fields"

    title = data.get("title")
    description = data.get("description")
    company_profile = data.get("company_profile")
    requirements = data.get("requirements")

    # A job post must have at least a title or a description
    has_text = any(
        isinstance(f, str) and f.strip()
        for f in (title, description, company_profile, requirements)
    )
    if not has_text:
        return False, "At least 'title' or 'description' must be provided for job analysis"

    # Validate boolean/flag values if provided
    flag_fields = ["telecommuting", "has_company_logo", "has_questions"]
    for field in flag_fields:
        if field in data and data[field] is not None:
            val = data[field]
            if val not in (0, 1, True, False, "0", "1", "true", "false", "True", "False"):
                return False, f"Field '{field}' must be a boolean or binary (0/1) value"

    return True, ""
