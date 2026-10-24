"""
Flask extensions instance registry for JobGuard-XAI.
Centralizes Flask-Bcrypt and other extension instances to prevent circular imports.
"""

from flask_bcrypt import Bcrypt

bcrypt = Bcrypt()
