#!/usr/bin/env python3
"""
Extensions module for SW Portal
Centralizes initialization of Flask extensions to avoid circular imports
"""

from flask_sqlalchemy import SQLAlchemy

# Initialize SQLAlchemy without binding to app
db = SQLAlchemy()