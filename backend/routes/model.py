"""
Model performance routes for JobGuard-XAI.
Exposes evaluation metrics, confusion matrices, ROC/PR curves, and training history.
"""

import json
import os
from flask import Blueprint, jsonify

model_bp = Blueprint("model_routes", __name__, url_prefix="/api")

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


@model_bp.route("/model-performance", methods=["GET"])
def model_performance():
    """
    Get evaluation metrics for all trained models.
    Reads from ml/saved_models/metrics.json.
    
    Response:
        200: {
            "best_model_name": str,
            "models": { ... },
            "comparison": [ ... ],
            "trained_at": str
        }
        200: { "status": "not_trained", "message": "Run ml/training/train_models.py first" }
    """
    metrics_path = os.path.join(PROJECT_ROOT, "ml", "saved_models", "metrics.json")
    if not os.path.exists(metrics_path):
        return jsonify({
            "status": "not_trained",
            "message": "Run ml/training/train_models.py first"
        }), 200

    try:
        with open(metrics_path, "r", encoding="utf-8") as f:
            metrics_data = json.load(f)
        return jsonify(metrics_data), 200
    except Exception as e:
        return jsonify({
            "error": f"Failed to load metrics data: {str(e)}"
        }), 500
