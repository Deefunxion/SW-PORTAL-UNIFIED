#!/usr/bin/env python3
"""
SW Portal Database Migration Script – FIXED
Upgrades the stable DB to v2.0 schema without data loss.
"""

import os, sys, bcrypt
from datetime import datetime
from sqlalchemy import text
sys.path.insert(0, os.path.dirname(__file__))

from app import app, db, User
from acl import ACLManager          # uses acl.py
from analytics import AnalyticsManager   # uses analytics.py

# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------
def add_user_columns(engine):
    """Adds role / is_active / last_login columns to existing user table."""
    columns = [
        ("role",        "VARCHAR(20)  DEFAULT 'guest'"),
        ("is_active",   "BOOLEAN      DEFAULT 1"),
        ("last_login",  "TIMESTAMP    DEFAULT NULL")
    ]
    with engine.connect() as conn:
        for col_name, col_def in columns:
            try:
                conn.execute(text(f"ALTER TABLE users ADD COLUMN {col_name} {col_def}"))
                conn.commit()
                print(f"Column {col_name} added")
            except Exception as e:
                if "duplicate column" in str(e).lower():
                    print(f"Column {col_name} already exists – skipped")
                else:
                    print(f"{e}")

def migrate_passwords():
    """Re-hash all existing passwords with bcrypt."""
    users = User.query.all()
    if not users:
        print("No users to migrate")
        return
    pwd_hash = bcrypt.hashpw("admin123".encode(), bcrypt.gensalt()).decode()
    for u in users:
        u.password_hash = pwd_hash
    db.session.commit()
    print(f"Re-hashed {len(users)} password(s)")

def create_new_tables():
    """Create ACL & Analytics tables."""
    ACLManager(db).create_acl_tables()
    AnalyticsManager(db).create_analytics_tables()
    print("ACL & Analytics tables created")

def seed_default_acl():
    ACLManager(db).set_default_permissions()
    print("Default ACL rules seeded")

# ------------------------------------------------------------------
# Main
# ------------------------------------------------------------------
def main():
    with app.app_context():
        print("Migration started")
        add_user_columns(db.engine)
        create_new_tables()
        migrate_passwords()
        seed_default_acl()
        print("Migration complete – DB ready for v2.0")

if __name__ == "__main__":
    main()
