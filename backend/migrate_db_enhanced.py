#!/usr/bin/env python3
"""
SW Portal Forum Enhanced - Database Migration Script
Adapted for the existing Flask application context.
"""

import os
import sys
from datetime import datetime
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text

# --- App and DB Setup ---
# This setup is to allow running this script standalone
# It mimics the main app's configuration.
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{os.path.join(BASE_DIR, "sw_portal.db")}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# --- Model Imports ---
# Import existing models by defining them or importing from app
# For simplicity, we define the core ones needed for relationships.
class User(db.Model):
    __tablename__ = 'users' # Explicitly set table name
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(120), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Post(db.Model):
    __tablename__ = 'posts' # Explicitly set table name
    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.Text, nullable=False)
    discussion_id = db.Column(db.Integer, db.ForeignKey('discussions.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Discussion(db.Model):
    __tablename__ = 'discussions' # Explicitly set table name
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)

# Import and create new models
from .forum_models import create_enhanced_forum_models
from .messaging_models import create_messaging_models

enhanced_forum_models = create_enhanced_forum_models(db)
messaging_models = create_messaging_models(db)

# --- Migration Logic ---

def run_migration():
    """Run database migration from existing SW Portal to Enhanced version."""
    with app.app_context():
        print("Starting SW Portal Forum Enhanced Migration...")
        print(f"Migration started at: {datetime.now()}")
        
        try:
            # Step 1: Create new tables using SQLAlchemy's metadata
            print("\nStep 1: Creating new tables...")
            # The models are defined, so db.create_all() will create them if they don't exist.
            db.create_all()
            print("   New tables created (if they didn't exist).")

            # Step 2: Enhance existing tables by adding columns
            print("\nStep 2: Enhancing existing tables...")
            enhance_existing_tables(db.session)
            
            # No data migration step needed for this phase as we are adding new features
            # to a system without pre-existing enhanced data.

            db.session.commit()
            print("\nMigration completed successfully!")
            
        except Exception as e:
            db.session.rollback()
            print(f"\nMigration failed: {str(e)}")
            sys.exit(1)

def enhance_existing_tables(session):
    """Add new columns to existing tables safely."""
    enhancements = {
        'post': [
            "ALTER TABLE post ADD COLUMN parent_id INTEGER",
            "ALTER TABLE post ADD COLUMN content_type VARCHAR(20) DEFAULT 'text'",
            "ALTER TABLE post ADD COLUMN edited_at TIMESTAMP",
            "ALTER TABLE post ADD COLUMN edit_count INTEGER DEFAULT 0",
        ],
        'user': [
            # User profile fields will be in a separate table as per new models
            # but we can add presence status here for simplicity if needed.
                    "ALTER TABLE users ADD COLUMN last_seen TIMESTAMP",
        "ALTER TABLE users ADD COLUMN presence_status VARCHAR(50) DEFAULT 'offline'",
        ]
    }
    
    for table, queries in enhancements.items():
        print(f"   Enhancing table: {table}")
        for query in queries:
            try:
                session.execute(text(query))
                print(f"      Executed: {query}")
            except Exception as e:
                # This is expected if the column already exists.
                print(f"      Warning: Could not execute query. It might already exist. Details: {e}")

if __name__ == "__main__":
    run_migration()
