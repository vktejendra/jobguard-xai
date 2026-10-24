"""
Prediction history routes for JobGuard-XAI.
Provides CRUD and export endpoints for authenticated users' prediction logs.
"""

import json
from flask import Blueprint, request, jsonify, g
from backend.database.db import get_db
from backend.utils.auth_helpers import require_auth

history_bp = Blueprint("history", __name__, url_prefix="/api/predictions")


@history_bp.route("/history", methods=["GET"])
@require_auth
def get_history():
    """
    Get paginated prediction history for the authenticated user.
    Query params:
        search: Filter by job title substring
        prediction: Filter by classification ('Legitimate', 'Potentially Suspicious', 'High Risk')
        limit: Number of records to return (default 20, max 100)
        offset: Number of records to skip (default 0)
    Response:
        200: { "predictions": [ ... ], "total": int, "limit": int, "offset": int }
    """
    user_id = g.current_user["user_id"]
    search = request.args.get("search", "").strip()
    prediction_filter = request.args.get("prediction", "").strip()

    try:
        limit = min(max(int(request.args.get("limit", 20)), 1), 100)
    except ValueError:
        limit = 20

    try:
        offset = max(int(request.args.get("offset", 0)), 0)
    except ValueError:
        offset = 0

    db = get_db()
    cursor = db.cursor()

    # Build parameterized query
    conditions = ["user_id = ?"]
    params = [user_id]

    if search:
        conditions.append("job_title LIKE ?")
        params.append(f"%{search}%")

    if prediction_filter:
        conditions.append("prediction = ?")
        params.append(prediction_filter)

    where_clause = " WHERE " + " AND ".join(conditions)

    # Get total count
    count_query = f"SELECT COUNT(*) FROM prediction_history{where_clause}"
    cursor.execute(count_query, params)
    total_count = cursor.fetchone()[0]

    # Fetch paginated rows
    fetch_query = f"""
        SELECT id, user_id, job_title, prediction, risk_score, model_used, shap_summary, timestamp
        FROM prediction_history
        {where_clause}
        ORDER BY timestamp DESC, id DESC
        LIMIT ? OFFSET ?
    """
    cursor.execute(fetch_query, params + [limit, offset])
    rows = cursor.fetchall()

    predictions = []
    for row in rows:
        shap_summary = None
        if row["shap_summary"]:
            try:
                shap_summary = json.loads(row["shap_summary"])
            except Exception:
                shap_summary = row["shap_summary"]

        predictions.append({
            "id": row["id"],
            "user_id": row["user_id"],
            "job_title": row["job_title"],
            "prediction": row["prediction"],
            "risk_score": row["risk_score"],
            "model_used": row["model_used"],
            "shap_summary": shap_summary,
            "timestamp": row["timestamp"]
        })

    return jsonify({
        "predictions": predictions,
        "total": total_count,
        "limit": limit,
        "offset": offset
    }), 200


@history_bp.route("/history/<int:history_id>", methods=["GET"])
@require_auth
def get_prediction_detail(history_id: int):
    """
    Get detailed breakdown of a specific historical prediction.
    Must belong to the authenticated user.
    """
    user_id = g.current_user["user_id"]
    db = get_db()
    cursor = db.cursor()

    cursor.execute(
        """
        SELECT id, user_id, job_title, prediction, risk_score, model_used, shap_summary, input_data, timestamp
        FROM prediction_history
        WHERE id = ? AND user_id = ?
        """,
        (history_id, user_id)
    )
    row = cursor.fetchone()

    if not row:
        return jsonify({"error": "Prediction record not found or access unauthorized"}), 404

    shap_summary = None
    if row["shap_summary"]:
        try:
            shap_summary = json.loads(row["shap_summary"])
        except Exception:
            shap_summary = row["shap_summary"]

    input_data = None
    if row["input_data"]:
        try:
            input_data = json.loads(row["input_data"])
        except Exception:
            input_data = row["input_data"]

    return jsonify({
        "id": row["id"],
        "user_id": row["user_id"],
        "job_title": row["job_title"],
        "prediction": row["prediction"],
        "risk_score": row["risk_score"],
        "model_used": row["model_used"],
        "shap_summary": shap_summary,
        "input_data": input_data,
        "timestamp": row["timestamp"]
    }), 200


@history_bp.route("/history/<int:history_id>", methods=["DELETE"])
@require_auth
def delete_prediction(history_id: int):
    """
    Delete a single prediction from user's history.
    Must belong to the authenticated user.
    """
    user_id = g.current_user["user_id"]
    db = get_db()
    cursor = db.cursor()

    # Check ownership
    cursor.execute(
        "SELECT id FROM prediction_history WHERE id = ? AND user_id = ?",
        (history_id, user_id)
    )
    if not cursor.fetchone():
        return jsonify({"error": "Prediction record not found or access unauthorized"}), 404

    cursor.execute(
        "DELETE FROM prediction_history WHERE id = ? AND user_id = ?",
        (history_id, user_id)
    )
    db.commit()

    return jsonify({
        "message": "Prediction deleted successfully",
        "id": history_id
    }), 200


@history_bp.route("/history/export", methods=["GET"])
@require_auth
def export_history():
    """
    Export all predictions belonging to authenticated user as a JSON array.
    """
    user_id = g.current_user["user_id"]
    db = get_db()
    cursor = db.cursor()

    cursor.execute(
        """
        SELECT id, user_id, job_title, prediction, risk_score, model_used, shap_summary, input_data, timestamp
        FROM prediction_history
        WHERE user_id = ?
        ORDER BY timestamp DESC
        """,
        (user_id,)
    )
    rows = cursor.fetchall()

    export_records = []
    for row in rows:
        shap_summary = None
        if row["shap_summary"]:
            try:
                shap_summary = json.loads(row["shap_summary"])
            except Exception:
                shap_summary = row["shap_summary"]

        input_data = None
        if row["input_data"]:
            try:
                input_data = json.loads(row["input_data"])
            except Exception:
                input_data = row["input_data"]

        export_records.append({
            "id": row["id"],
            "user_id": row["user_id"],
            "job_title": row["job_title"],
            "prediction": row["prediction"],
            "risk_score": row["risk_score"],
            "model_used": row["model_used"],
            "shap_summary": shap_summary,
            "input_data": input_data,
            "timestamp": row["timestamp"]
        })

    return jsonify(export_records), 200
