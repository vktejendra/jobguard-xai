"""
Authentication routes for JobGuard-XAI.
Provides user registration, login with JWT issuance, and logout endpoints.
"""

from flask import Blueprint, request, jsonify
from backend.database.db import get_db
from backend.extensions import bcrypt
from backend.utils.auth_helpers import encode_jwt
from backend.utils.validators import validate_register, validate_login, sanitize_text

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


@auth_bp.route("/register", methods=["POST"])
def register():
    """
    Register a new user.
    Request body:
        { "name": str, "email": str, "password": str }
    Response:
        201: { "message": str, "token": str, "user": { "id": int, "name": str, "email": str } }
        422: { "error": str }
        409: { "error": str }
    """
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Request body must be valid JSON"}), 422

    is_valid, error_msg = validate_register(data)
    if not is_valid:
        return jsonify({"error": error_msg}), 422

    name = sanitize_text(data.get("name"), max_length=100)
    email = sanitize_text(data.get("email"), max_length=255).lower()
    password = data.get("password")

    db = get_db()
    cursor = db.cursor()

    # Check if email is already registered (parameterized query)
    cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
    existing_user = cursor.fetchone()
    if existing_user:
        return jsonify({"error": "An account with this email address already exists"}), 409

    # Hash the password securely with bcrypt
    password_hash = bcrypt.generate_password_hash(password).decode("utf-8")

    # Insert new user record
    cursor.execute(
        "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
        (name, email, password_hash)
    )
    db.commit()
    user_id = cursor.lastrowid

    # Generate JWT token
    token = encode_jwt(user_id=user_id, email=email)

    return jsonify({
        "message": "User registered successfully",
        "token": token,
        "user": {
            "id": user_id,
            "name": name,
            "email": email
        }
    }), 201


@auth_bp.route("/login", methods=["POST"])
def login():
    """
    Authenticate user and return a signed JWT token.
    Request body:
        { "email": str, "password": str }
    Response:
        200: { "message": str, "token": str, "user": { "id": int, "name": str, "email": str } }
        401: { "error": str }
        422: { "error": str }
    """
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Request body must be valid JSON"}), 422

    is_valid, error_msg = validate_login(data)
    if not is_valid:
        return jsonify({"error": error_msg}), 422

    email = sanitize_text(data.get("email"), max_length=255).lower()
    password = data.get("password")

    db = get_db()
    cursor = db.cursor()

    # Look up user by email (parameterized query)
    cursor.execute(
        "SELECT id, name, email, password_hash FROM users WHERE email = ?",
        (email,)
    )
    user = cursor.fetchone()

    if not user or not bcrypt.check_password_hash(user["password_hash"], password):
        return jsonify({"error": "Invalid email or password"}), 401

    token = encode_jwt(user_id=user["id"], email=user["email"])

    return jsonify({
        "message": "Login successful",
        "token": token,
        "user": {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"]
        }
    }), 200


@auth_bp.route("/logout", methods=["POST"])
def logout():
    """
    Stateless JWT logout endpoint.
    Instructs the client to remove the stored token.
    Response:
        200: { "success": true, "message": str }
    """
    return jsonify({
        "success": True,
        "message": "Successfully logged out. Please remove your token from client storage."
    }), 200
