"""
Extensions module for SW Portal
Centralizes initialization of Flask extensions to avoid circular imports
"""

from flask_sqlalchemy import SQLAlchemy

# Initialize SQLAlchemy without binding to app
db = SQLAlchemy()

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
