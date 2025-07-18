"""
Extensions module for SW Portal
Centralizes initialization of Flask extensions to avoid circular imports
"""

from flask_sqlalchemy import SQLAlchemy
from celery import Celery

# Initialize SQLAlchemy without binding to app
db = SQLAlchemy()

# Initialize Celery without binding to app
celery = Celery(__name__, broker='redis://localhost:6379/0', backend='redis://localhost:6379/0')
