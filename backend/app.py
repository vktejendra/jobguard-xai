"""
Main Flask application entry point for JobGuard-XAI.
Initializes application factory, registers CORS, database, security middleware,
service singletons, and RESTful API route blueprints.
"""

import os
import sys
from datetime import datetime, timezone
from typing import Optional, Dict, Any

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS

# Ensure project root is in sys.path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

# Load environment variables from .env
load_dotenv(os.path.join(PROJECT_ROOT, ".env"))

from backend.database.db import init_db, register_db_teardown
from backend.extensions import bcrypt
from backend.routes.auth import auth_bp
from backend.routes.predict import predict_bp
from backend.routes.analytics import analytics_bp
from backend.routes.history import history_bp
from backend.routes.model import model_bp
from backend.routes.nlp import nlp_bp
from backend.routes.xai import xai_bp
from backend.services.predictor import PredictorService
from backend.services.analytics_service import AnalyticsService


def create_app(test_config: Optional[Dict[str, Any]] = None) -> Flask:
    """
    Application factory pattern for JobGuard-XAI REST API.
    
    Args:
        test_config: Optional configuration dictionary for testing.
        
    Returns:
        Configured Flask application instance.
    """
    app = Flask(__name__)

    # Default configuration
    app.config.from_mapping(
        SECRET_KEY=os.getenv("FLASK_SECRET_KEY", "jobguard-xai-insecure-secret-key-replace-me"),
        DATABASE_PATH=os.getenv("DATABASE_PATH", os.path.join(PROJECT_ROOT, "backend", "database", "jobguard.db")),
        JWT_SECRET_KEY=os.getenv("JWT_SECRET_KEY", "fallback-secret-key-jobguard-xai-2024"),
        JWT_EXPIRY_HOURS=int(os.getenv("JWT_EXPIRY_HOURS", "24")),
        JSON_SORT_KEYS=False
    )

    if test_config:
        app.config.update(test_config)

    # Initialize extensions
    bcrypt.init_app(app)
    register_db_teardown(app)

    # Configure CORS for frontend access (defaulting to VS Code Live Server)
    cors_origin_env = os.getenv("CORS_ORIGIN", "http://127.0.0.1:5500")
    allowed_origins = [o.strip() for o in cors_origin_env.split(",") if o.strip()]
    # Ensure standard local test origins are included if not present
    for default_origin in ("http://127.0.0.1:5500", "http://localhost:5500"):
        if default_origin not in allowed_origins:
            allowed_origins.append(default_origin)

    CORS(
        app,
        resources={r"/api/*": {"origins": allowed_origins}},
        supports_credentials=True,
        allow_headers=["Content-Type", "Authorization"],
        methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    )

    # Initialize SQLite database tables
    try:
        init_db(app)
    except Exception as e:
        app.logger.error(f"Failed to initialize SQLite database: {e}")

    # Initialize core services at startup with graceful fallback
    predictor_service = PredictorService()
    analytics_service = AnalyticsService()
    app.config["PREDICTOR_SERVICE"] = predictor_service
    app.config["ANALYTICS_SERVICE"] = analytics_service

    # Register blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(predict_bp)
    app.register_blueprint(analytics_bp)
    app.register_blueprint(history_bp)
    app.register_blueprint(model_bp)
    app.register_blueprint(nlp_bp)
    app.register_blueprint(xai_bp)

    # Health check endpoint
    @app.route("/api/health", methods=["GET"])
    def health():
        """
        System health check endpoint.
        Returns status, whether ML model is loaded, active model name, and UTC timestamp.
        """
        pred_service = app.config.get("PREDICTOR_SERVICE")
        is_loaded = pred_service.model_loaded if pred_service else False
        model_name = pred_service.model_name if pred_service else "None"

        return jsonify({
            "status": "ok",
            "model_loaded": is_loaded,
            "model_name": model_name,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }), 200

    # Job market aggregate overview endpoint
    @app.route("/api/job-market", methods=["GET"])
    def job_market():
        """
        Combined job market overview endpoint aggregating dataset totals,
        top industries, functional categories, and key fraud risk indicators.
        """
        service: AnalyticsService = app.config.get("ANALYTICS_SERVICE")
        if not service:
            service = AnalyticsService()

        overview_data = service.get_overview()
        industries_data = service.get_industries()[:10]
        functions_data = service.get_functions()[:10]
        fraud_by_logo = service.get_fraud_by_logo()
        fraud_by_remote = service.get_fraud_by_telecommuting()

        return jsonify({
            "overview": overview_data,
            "top_industries": industries_data,
            "top_functions": functions_data,
            "risk_signals": {
                "logo": fraud_by_logo,
                "telecommuting": fraud_by_remote
            },
            "timestamp": datetime.now(timezone.utc).isoformat()
        }), 200

    # Global Error Handlers (Consistent JSON error responses)
    @app.errorhandler(400)
    def bad_request(error):
        return jsonify({"error": "Bad request"}), 400

    @app.errorhandler(401)
    def unauthorized(error):
        return jsonify({"error": "Unauthorized access"}), 401

    @app.errorhandler(403)
    def forbidden(error):
        return jsonify({"error": "Forbidden"}), 403

    @app.errorhandler(404)
    def not_found(error):
        return jsonify({"error": "Requested resource was not found"}), 404

    @app.errorhandler(422)
    def unprocessable_entity(error):
        return jsonify({"error": "Unprocessable entity. Invalid or missing parameters."}), 422

    @app.errorhandler(500)
    def internal_server_error(error):
        return jsonify({"error": "Internal server error occurred"}), 500

    return app


# Module-level app instance for WSGI runners
app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
