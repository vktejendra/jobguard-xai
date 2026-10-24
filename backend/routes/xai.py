"""
Explainable AI (XAI) routes for JobGuard-XAI.
Provides SHAP values, feature importance waterfalls, top risk drivers,
and plain-language justification for individual predictions.
"""

import json
from typing import Any, Dict, List
from flask import Blueprint, request, jsonify, current_app
from backend.database.db import get_db
from backend.services.predictor import PredictorService
from backend.utils.validators import validate_predict_input

xai_bp = Blueprint("xai_routes", __name__, url_prefix="/api/xai")


def _format_xai_response(
    explanation_data: Dict[str, Any],
    risk_score: float,
    prediction: str
) -> Dict[str, Any]:
    """
    Format explanation data into a standardized structure containing
    fraud factors, legitimate factors, base value, narrative summary,
    and chart-ready series data.
    """
    important_features = explanation_data.get("important_features", [])
    shap_values = explanation_data.get("shap_values", {})
    base_value = explanation_data.get("base_value", 0.0484)
    plain_summary = explanation_data.get("explanation", "")

    # Segregate into fraud drivers and legitimacy drivers
    top_fraud_factors = []
    top_legit_factors = []
    chart_data = []

    for item in important_features:
        weight = item.get("weight", 0.0)
        feature_name = item.get("feature", "unknown")
        desc = item.get("description", "")
        impact = item.get("impact", "")

        factor_obj = {
            "feature": feature_name,
            "weight": round(weight, 4),
            "impact": impact,
            "description": desc
        }

        if weight > 0:
            top_fraud_factors.append(factor_obj)
        else:
            top_legit_factors.append(factor_obj)

        chart_data.append({
            "feature": feature_name,
            "importance": round(weight, 4),
            "direction": "Increases Fraud Risk" if weight > 0 else "Decreases Fraud Risk",
            "color": "#ef4444" if weight > 0 else "#10b981"
        })

    # Sort each list by absolute impact
    top_fraud_factors.sort(key=lambda x: abs(x["weight"]), reverse=True)
    top_legit_factors.sort(key=lambda x: abs(x["weight"]), reverse=True)
    chart_data.sort(key=lambda x: abs(x["importance"]), reverse=True)

    return {
        "shap_values": shap_values,
        "top_fraud_factors": top_fraud_factors,
        "top_legit_factors": top_legit_factors,
        "base_value": base_value,
        "risk_score": risk_score,
        "prediction": prediction,
        "plain_language_summary": plain_summary,
        "feature_importance_chart_data": chart_data
    }


@xai_bp.route("/explain", methods=["POST"])
def explain():
    """
    Generate or retrieve an explainable AI (XAI) feature attribution report.
    
    Request body:
        Either:
            { "prediction_id": int }
        Or:
            { "input_data": { "title": str, ... } }
            
    Response:
        200: {
            "shap_values": dict,
            "top_fraud_factors": list,
            "top_legit_factors": list,
            "base_value": float,
            "plain_language_summary": str,
            "feature_importance_chart_data": list
        }
        404: { "error": str }
        422: { "error": str }
    """
    data = request.get_json(silent=True)
    if not data or not isinstance(data, dict):
        return jsonify({"error": "Request body must be a valid JSON object"}), 422

    prediction_id = data.get("prediction_id")
    input_data = data.get("input_data")

    predictor_service: PredictorService = current_app.config.get("PREDICTOR_SERVICE")
    if not predictor_service:
        predictor_service = PredictorService()
        current_app.config["PREDICTOR_SERVICE"] = predictor_service

    # Case 1: Explain by existing prediction_id from DB
    if prediction_id is not None:
        try:
            pid = int(prediction_id)
        except ValueError:
            return jsonify({"error": "Field 'prediction_id' must be an integer"}), 422

        db = get_db()
        cursor = db.cursor()
        cursor.execute(
            """
            SELECT id, job_title, prediction, risk_score, model_used, shap_summary, input_data
            FROM prediction_history
            WHERE id = ?
            """,
            (pid,)
        )
        row = cursor.fetchone()
        if not row:
            return jsonify({"error": f"Prediction record with ID {pid} was not found"}), 404

        # If saved shap_summary exists and is complete, format and return
        shap_summary = None
        if row["shap_summary"]:
            try:
                shap_summary = json.loads(row["shap_summary"])
            except Exception:
                shap_summary = None

        if shap_summary and "important_features" in shap_summary:
            response_data = _format_xai_response(
                explanation_data=shap_summary,
                risk_score=row["risk_score"],
                prediction=row["prediction"]
            )
            return jsonify(response_data), 200

        # If input_data was saved, recompute explanation
        if row["input_data"]:
            try:
                parsed_input = json.loads(row["input_data"])
                df = predictor_service._build_dataframe(parsed_input)
                expl = predictor_service._generate_explanation(df, row["risk_score"], row["prediction"])
                response_data = _format_xai_response(
                    explanation_data=expl,
                    risk_score=row["risk_score"],
                    prediction=row["prediction"]
                )
                return jsonify(response_data), 200
            except Exception:
                pass

        return jsonify({"error": "No explanation data available for this prediction ID"}), 404

    # Case 2: Explain by input_data dictionary
    if input_data is not None:
        is_valid, error_msg = validate_predict_input(input_data)
        if not is_valid:
            return jsonify({"error": error_msg}), 422

        df = predictor_service._build_dataframe(input_data)

        # Estimate risk score if model is loaded, otherwise use heuristic
        if predictor_service.model_loaded:
            try:
                pred_result = predictor_service.predict(input_data)
                risk_score = pred_result["risk_score"]
                prediction = pred_result["prediction"]
                explanation_data = {
                    "important_features": pred_result["important_features"],
                    "explanation": pred_result["explanation"],
                    "shap_values": pred_result["shap_values"],
                    "base_value": pred_result.get("base_value", 0.0484)
                }
            except Exception:
                risk_score = 50.0
                prediction = "Potentially Suspicious"
                explanation_data = predictor_service._generate_explanation(df, risk_score, prediction)
        else:
            risk_score = 50.0
            prediction = "Potentially Suspicious"
            explanation_data = predictor_service._generate_explanation(df, risk_score, prediction)

        response_data = _format_xai_response(
            explanation_data=explanation_data,
            risk_score=risk_score,
            prediction=prediction
        )
        return jsonify(response_data), 200

    return jsonify({"error": "Either 'prediction_id' or 'input_data' must be provided"}), 422
