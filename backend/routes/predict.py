"""
Prediction routes for JobGuard-XAI.
Handles single-instance job posting evaluation, risk scoring, feature attribution,
and optional prediction logging for authenticated users.
"""

import json
from flask import Blueprint, request, jsonify, current_app
from backend.database.db import get_db
from backend.utils.auth_helpers import get_current_user_optional
from backend.utils.validators import validate_predict_input

predict_bp = Blueprint("predict", __name__, url_prefix="/api")


@predict_bp.route("/predict", methods=["POST"])
def predict():
    """
    Evaluate a job posting for fraudulent characteristics.
    
    Request body:
        JSON object containing job posting attributes:
        title, location, department, salary_range, company_profile,
        description, requirements, benefits, telecommuting (0/1),
        has_company_logo (0/1), has_questions (0/1), employment_type,
        required_experience, required_education, industry, function.
        
    Response:
        200: {
            "prediction": "Legitimate" | "Potentially Suspicious" | "High Risk",
            "prediction_probability": float,
            "risk_score": float,
            "model_used": str,
            "important_features": list,
            "explanation": str,
            "shap_values": dict,
            "timestamp": str,
            "history_id": int | null
        }
        422: { "error": str }
        503: { "error": "Model not trained yet. Please run ml/training/train_models.py first.", "status": 503 }
    """
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Request body must be a valid JSON object"}), 422

    # Validate incoming job posting payload
    is_valid, error_msg = validate_predict_input(data)
    if not is_valid:
        return jsonify({"error": error_msg}), 422

    # Retrieve predictor service from application configuration
    predictor_service = current_app.config.get("PREDICTOR_SERVICE")
    if not predictor_service or not predictor_service.model_loaded:
        return jsonify({
            "error": "Model not trained yet. Please run ml/training/train_models.py first.",
            "status": 503
        }), 503

    try:
        result = predictor_service.predict(data)
    except Exception as e:
        return jsonify({"error": f"Prediction failed: {str(e)}"}), 500

    # Optional authentication: if user is logged in, persist to prediction_history
    history_id = None
    user = get_current_user_optional()
    if user and user.get("user_id"):
        try:
            db = get_db()
            cursor = db.cursor()
            job_title = data.get("title", "Untitled Job")
            shap_summary_str = json.dumps({
                "important_features": result.get("important_features", []),
                "explanation": result.get("explanation", ""),
                "shap_values": result.get("shap_values", {})
            })
            input_data_str = json.dumps(data)

            cursor.execute(
                """
                INSERT INTO prediction_history
                (user_id, job_title, prediction, risk_score, model_used, shap_summary, input_data)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    user["user_id"],
                    job_title,
                    result["prediction"],
                    result["risk_score"],
                    result["model_used"],
                    shap_summary_str,
                    input_data_str
                )
            )
            db.commit()
            history_id = cursor.lastrowid
        except Exception:
            # History recording error shouldn't crash prediction response
            pass

    response_payload = {
        "prediction": result["prediction"],
        "prediction_probability": result["prediction_probability"],
        "risk_score": result["risk_score"],
        "model_used": result["model_used"],
        "important_features": result["important_features"],
        "explanation": result["explanation"],
        "shap_values": result["shap_values"],
        "base_value": result.get("base_value", 0.0484),
        "timestamp": result["timestamp"],
        "history_id": history_id
    }

    return jsonify(response_payload), 200
