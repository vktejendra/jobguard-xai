"""
Analytics routes for JobGuard-XAI.
Provides exploratory data analysis, class imbalance metrics, feature distributions,
role indices, and fraud signal correlations.
"""

import json
import os
import sys
from typing import Optional
from flask import Blueprint, jsonify, request, current_app
from backend.services.analytics_service import AnalyticsService

analytics_bp = Blueprint("analytics", __name__, url_prefix="/api/analytics")

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


def get_analytics_service() -> AnalyticsService:
    """Retrieve AnalyticsService instance from current_app or instantiate fallback."""
    service = current_app.config.get("ANALYTICS_SERVICE")
    if service is None:
        service = AnalyticsService()
        current_app.config["ANALYTICS_SERVICE"] = service
    return service


@analytics_bp.route("/overview", methods=["GET"])
def overview():
    """
    Get high-level dataset statistics and fraud ratios.
    Response:
        200: {
            "total_jobs": int,
            "legit_count": int,
            "fraud_count": int,
            "fraud_rate": float,
            "class_imbalance_ratio": float
        }
    """
    service = get_analytics_service()
    return jsonify(service.get_overview()), 200


@analytics_bp.route("/industries", methods=["GET"])
def industries():
    """
    Get fraud distribution across top industries.
    Response:
        200: [ { "industry": str, "count": int, "fraud_count": int, "fraud_rate": float }, ... ]
    """
    service = get_analytics_service()
    return jsonify(service.get_industries()), 200


@analytics_bp.route("/functions", methods=["GET"])
def functions():
    """
    Get fraud rates across job functional categories.
    Response:
        200: [ { "function": str, "count": int, "fraud_count": int, "fraud_rate": float }, ... ]
    """
    service = get_analytics_service()
    return jsonify(service.get_functions()), 200


@analytics_bp.route("/roles", methods=["GET"])
def roles():
    """
    Get pre-indexed job roles and their risk profiles.
    Reads from ml/saved_models/role_index.json.
    Response:
        200: { "roles": [ ... ] } or JSON object
        404: { "error": "Role index not found. Train models or generate role index first." }
    """
    role_index_path = os.path.join(PROJECT_ROOT, "ml", "saved_models", "role_index.json")
    if not os.path.exists(role_index_path):
        return jsonify({
            "error": "Role index not found. Train models or generate role index first."
        }), 404

    try:
        with open(role_index_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return jsonify(data), 200
    except Exception as e:
        return jsonify({"error": f"Failed to read role index: {str(e)}"}), 500


@analytics_bp.route("/skills", methods=["GET"])
def skills():
    """
    Get top associated skills for a specific role or across all roles.
    Query param:
        ?role=<role_name>
    Response:
        200: { "role": str, "skills": [ ... ] }
        404: { "error": str }
    """
    role_index_path = os.path.join(PROJECT_ROOT, "ml", "saved_models", "role_index.json")
    if not os.path.exists(role_index_path):
        return jsonify({
            "error": "Role index not found. Train models or generate role index first."
        }), 404

    try:
        with open(role_index_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        return jsonify({"error": f"Failed to read role index: {str(e)}"}), 500

    target_role = request.args.get("role")
    if not target_role:
        # Return all roles with skills summary
        return jsonify(data), 200

    target_role_lower = target_role.strip().lower()
    
    # Handle dict or list format in role_index.json
    if isinstance(data, dict):
        # Look for exact or fuzzy match in keys
        for key, val in data.items():
            if key.lower() == target_role_lower or target_role_lower in key.lower():
                return jsonify({"role": key, "details": val}), 200
        return jsonify({"error": f"Role '{target_role}' not found in role index"}), 404
    elif isinstance(data, list):
        for item in data:
            if isinstance(item, dict) and item.get("role", "").lower() == target_role_lower:
                return jsonify(item), 200
        return jsonify({"error": f"Role '{target_role}' not found in role index"}), 404

    return jsonify({"error": "Invalid role index structure"}), 500


@analytics_bp.route("/experience", methods=["GET"])
def experience():
    """
    Get fraud distribution by required candidate experience level.
    Response:
        200: [ { "level": str, "count": int, "fraud_rate": float }, ... ]
    """
    service = get_analytics_service()
    return jsonify(service.get_experience_levels()), 200


@analytics_bp.route("/employment-types", methods=["GET"])
def employment_types():
    """
    Get fraud distribution by employment contract type (Full-time, Part-time, Contract, etc.).
    Response:
        200: [ { "type": str, "count": int, "fraud_rate": float }, ... ]
    """
    service = get_analytics_service()
    return jsonify(service.get_employment_types()), 200


@analytics_bp.route("/education", methods=["GET"])
def education():
    """
    Get fraud distribution by required educational credential.
    Response:
        200: [ { "level": str, "count": int, "fraud_rate": float }, ... ]
    """
    service = get_analytics_service()
    return jsonify(service.get_education_levels()), 200


@analytics_bp.route("/locations", methods=["GET"])
def locations():
    """
    Get top geographic posting locations and regional fraud rates.
    Response:
        200: [ { "location": str, "count": int, "fraud_rate": float }, ... ]
    """
    service = get_analytics_service()
    return jsonify(service.get_top_locations()), 200


@analytics_bp.route("/fraud-signals", methods=["GET"])
def fraud_signals():
    """
    Get key fraud predictor signals: Company Logo presence and Telecommuting/Remote work.
    Response:
        200: {
            "company_logo": { "with_logo": {...}, "without_logo": {...} },
            "telecommuting": { "remote": {...}, "onsite": {...} }
        }
    """
    service = get_analytics_service()
    return jsonify({
        "company_logo": service.get_fraud_by_logo(),
        "telecommuting": service.get_fraud_by_telecommuting()
    }), 200


@analytics_bp.route("/missingness", methods=["GET"])
def missingness():
    """
    Get rates of missing/unspecified data per column across the dataset.
    Response:
        200: [ { "column": str, "missing_count": int, "missing_pct": float }, ... ]
    """
    service = get_analytics_service()
    return jsonify(service.get_missingness_stats()), 200
