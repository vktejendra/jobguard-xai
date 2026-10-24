"""
Authentication helpers for JobGuard-XAI.
Provides JWT encoding, decoding, token validation, and the @require_auth decorator.
"""

import os
from datetime import datetime, timedelta, timezone
from functools import wraps
from typing import Optional, Dict, Any

import jwt
from flask import request, jsonify, g


def get_jwt_secret() -> str:
    """Retrieve the JWT secret key from environment or fallback default."""
    return os.getenv("JWT_SECRET_KEY", "fallback-secret-key-jobguard-xai-2024")


def get_jwt_expiry_hours() -> int:
    """Retrieve token lifetime in hours from environment or default to 24."""
    try:
        return int(os.getenv("JWT_EXPIRY_HOURS", "24"))
    except ValueError:
        return 24


def encode_jwt(user_id: int, email: str) -> str:
    """
    Generate a signed JWT token containing user identity and expiration timestamp.
    
    Args:
        user_id: The primary key ID of the user.
        email: The user's registered email address.
        
    Returns:
        Encoded JWT token string.
    """
    secret = get_jwt_secret()
    expiry_hours = get_jwt_expiry_hours()
    now = datetime.now(timezone.utc)
    
    payload = {
        "user_id": user_id,
        "email": email,
        "iat": now,
        "exp": now + timedelta(hours=expiry_hours)
    }
    
    token = jwt.encode(payload, secret, algorithm="HS256")
    # PyJWT >= 2.0 returns str, but handle potential bytes gracefully
    if isinstance(token, bytes):
        return token.decode("utf-8")
    return token


def decode_jwt(token: str) -> Optional[Dict[str, Any]]:
    """
    Decode and validate a JWT token string.
    
    Args:
        token: Bearer JWT string.
        
    Returns:
        Dict with 'user_id' and 'email' if valid, None if expired or invalid.
    """
    secret = get_jwt_secret()
    try:
        payload = jwt.decode(token, secret, algorithms=["HS256"])
        return {
            "user_id": payload.get("user_id"),
            "email": payload.get("email")
        }
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None
    except Exception:
        return None


def get_current_user_optional() -> Optional[Dict[str, Any]]:
    """
    Check if a valid Authorization header is present without rejecting the request.
    Useful for optional authentication endpoints like /api/predict.
    
    Returns:
        User dict if valid token is provided, None otherwise.
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        return None
    
    parts = auth_header.split()
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return decode_jwt(parts[1])
    return None


def require_auth(f):
    """
    Flask route decorator to enforce JWT bearer token authentication.
    Attaches the decoded user payload to flask.g.current_user.
    Returns HTTP 401 if missing, malformed, or invalid.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            return jsonify({"error": "Authorization header is missing"}), 401
        
        parts = auth_header.split()
        if len(parts) != 2 or parts[0].lower() != "bearer":
            return jsonify({"error": "Authorization header must be formatted as 'Bearer <token>'"}), 401
        
        token = parts[1]
        user_data = decode_jwt(token)
        if user_data is None:
            return jsonify({"error": "Invalid or expired authorization token"}), 401
        
        g.current_user = user_data
        return f(*args, **kwargs)
    
    return decorated_function
