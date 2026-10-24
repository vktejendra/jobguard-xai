"""
Database connection and initialization module for JobGuard-XAI.
Handles SQLite connection lifecycle, schema initialization, and foreign key enforcement.
"""

import os
import sqlite3
from typing import Optional
from flask import g, current_app

# Default database path relative to project root
DEFAULT_DB_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "backend",
    "database",
    "jobguard.db"
)


def get_db_path() -> str:
    """Retrieve database path from environment variable or default configuration."""
    env_path = os.getenv("DATABASE_PATH")
    if env_path:
        # If relative path is provided, resolve relative to project root
        if not os.path.isabs(env_path):
            project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            return os.path.abspath(os.path.join(project_root, env_path))
        return os.path.abspath(env_path)
    return DEFAULT_DB_PATH


def get_db() -> sqlite3.Connection:
    """
    Get or create an SQLite database connection for the current Flask request context.
    Configures sqlite3.Row for dict-like column access and enables foreign key constraints.
    """
    db_path = get_db_path()

    # Ensure the directory exists
    db_dir = os.path.dirname(db_path)
    if db_dir and not os.path.exists(db_dir):
        os.makedirs(db_dir, exist_ok=True)

    try:
        # In Flask request context, use g._database
        if "g" in globals() and g is not None:
            if not hasattr(g, "_database") or g._database is None:
                conn = sqlite3.connect(db_path, detect_types=sqlite3.PARSE_DECLTYPES)
                conn.row_factory = sqlite3.Row
                conn.execute("PRAGMA foreign_keys = ON;")
                g._database = conn
            return g._database
    except RuntimeError:
        # Outside of Flask application context, return a standalone connection
        pass

    conn = sqlite3.connect(db_path, detect_types=sqlite3.PARSE_DECLTYPES)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def close_db(e: Optional[BaseException] = None) -> None:
    """Close the database connection at the end of the request."""
    try:
        if "g" in globals() and g is not None:
            db = getattr(g, "_database", None)
            if db is not None:
                db.close()
                g._database = None
    except RuntimeError:
        pass


def init_db(app=None) -> None:
    """
    Initialize SQLite database tables using backend/database/schema.sql.
    Can be called standalone or with a Flask app instance.
    """
    db_path = get_db_path()
    db_dir = os.path.dirname(db_path)
    if db_dir and not os.path.exists(db_dir):
        os.makedirs(db_dir, exist_ok=True)

    schema_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "schema.sql")

    if not os.path.exists(schema_path):
        raise FileNotFoundError(f"Schema file not found at {schema_path}")

    with open(schema_path, "r", encoding="utf-8") as f:
        schema_sql = f.read()

    conn = sqlite3.connect(db_path)
    try:
        conn.execute("PRAGMA foreign_keys = ON;")
        conn.executescript(schema_sql)
        conn.commit()
    finally:
        conn.close()


def register_db_teardown(app) -> None:
    """Register close_db with Flask app context teardown."""
    app.teardown_appcontext(close_db)
