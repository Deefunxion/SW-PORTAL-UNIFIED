"""
Extensions module for SW Portal
Centralizes initialization of Flask extensions to avoid circular imports
"""

from flask_sqlalchemy import SQLAlchemy
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

# Initialize SQLAlchemy without binding to app
db = SQLAlchemy()

# Initialize rate limiter (no default limits — applied per-route)
limiter = Limiter(
    key_func=get_remote_address,
    storage_uri="memory://",
    default_limits=[]
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
