"""Routes package for JobGuard-XAI backend."""
from backend.routes.auth import auth_bp
from backend.routes.predict import predict_bp
from backend.routes.analytics import analytics_bp
from backend.routes.history import history_bp
from backend.routes.model import model_bp
from backend.routes.nlp import nlp_bp
from backend.routes.xai import xai_bp

__all__ = [
    "auth_bp",
    "predict_bp",
    "analytics_bp",
    "history_bp",
    "model_bp",
    "nlp_bp",
    "xai_bp"
]
