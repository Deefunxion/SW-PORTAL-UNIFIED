"""
Extensions module for ΠΥΛΗ ΚΟΙΝΩΝΙΚΗΣ ΜΕΡΙΜΝΑΣ
Centralizes initialization of Flask extensions to avoid circular imports
"""

from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

# Initialize SQLAlchemy without binding to app
db = SQLAlchemy()

# Initialize Flask-Migrate (Alembic)
migrate = Migrate()

# Initialize rate limiter with sensible defaults
import os
limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=os.getenv('REDIS_URL', 'memory://'),
    default_limits=["200 per minute", "2000 per hour"],
)

# Initialize Celery (optional — only needed for background tasks)
try:
    from celery import Celery
    celery = Celery(__name__, broker='redis://localhost:6379/0', backend='redis://localhost:6379/0')
except ImportError:
    # Celery not installed — create a stub
    class CeleryStub:
        class conf:
            @staticmethod
            def update(**kwargs): pass
        class Task:
            def __call__(self, *args, **kwargs):
                return self.run(*args, **kwargs)
    celery = CeleryStub()
