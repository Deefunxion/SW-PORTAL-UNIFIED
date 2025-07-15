#!/usr/bin/env python3
"""
SW Portal Database Migration Script
This script upgrades the database from the stable version to the enhanced version.
"""

import os
import sys
from datetime import datetime
import bcrypt
from sqlalchemy import text

sys.stdout.reconfigure(encoding='utf-8') # Fix for UnicodeEncodeError

# --- Start of New Fix ---
# This block ensures that the script can find the other modules (app, acl, etc.)
# by adding the script's own directory to the Python path.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
# --- End of New Fix ---

from app import app, db, User, initialize_modules # Import initialize_modules
from acl import ACLManager
from analytics import AnalyticsManager

def add_user_columns(engine):
    """Adds the new columns to the User table if they don't exist."""
    print("Step 1: Checking and adding new columns to User table...")
    
    # The User model in the new app.py won't have these columns yet,
    # so we need to add them with raw SQL.
    # A more robust solution would use Flask-Migrate, but for this one-off
    # script, raw SQL is sufficient.
    
    column_commands = [
        "ALTER TABLE user ADD COLUMN role VARCHAR(20) DEFAULT 'guest'",
        "ALTER TABLE user ADD COLUMN is_active BOOLEAN DEFAULT 1",
        "ALTER TABLE user ADD COLUMN last_login TIMESTAMP"
    ]
    
    with engine.connect() as conn:
        for command in column_commands:
            try:
                conn.execute(text(command))
                print(f"  - Executed: {command}")
            except Exception as e:
                if "duplicate column name" in str(e).lower():
                    print(f"  - Column already exists, skipping: {command.split(' ')[4]}")
                else:
                    print(f"  - SQL Error: {e}")
    print("Step 1 Complete.\n")

def migrate_passwords():
    """
    Resets all user passwords using the new bcrypt hashing algorithm.
    """
    print("Step 2: Migrating user passwords to bcrypt...")
    print("  - WARNING: All user passwords will be reset to 'admin123'.")
    
    try:
        users = User.query.all()
        if not users:
            print("  - No users found to migrate.")
            return

        hashed_password = bcrypt.hashpw('admin123'.encode('utf-8'), bcrypt.gensalt())
        
        for user in users:
            user.password_hash = hashed_password.decode('utf-8')
            db.session.add(user)
            
        db.session.commit()
        print(f"  - Successfully reset passwords for {len(users)} user(s).")
        
    except Exception as e:
        print(f"  - ERROR during password migration: {e}")
        db.session.rollback()
        
    print("Step 2 Complete.\n")

def create_new_tables(engine):
    """Creates the new tables for ACL and Analytics."""
    print("Step 3: Creating new tables for ACL and Analytics...")
    
    try:
        # The managers will handle the table creation.
        acl_manager = ACLManager(db)
        analytics_manager = AnalyticsManager(db)
        
        print("  - Creating ACL tables...")
        acl_manager.create_acl_tables()
        
        print("  - Creating Analytics tables...")
        analytics_manager.create_analytics_tables()
        
    except Exception as e:
        print(f"  - ERROR creating new tables: {e}")
        
    print("Step 3 Complete.\n")

def set_default_permissions(acl_manager):
    """Sets the default permissions for roles."""
    print("Step 4: Setting default ACL permissions...")
    try:
        acl_manager.set_default_permissions()
    except Exception as e:
        print(f"  - ERROR setting default permissions: {e}")
        
    print("Step 4 Complete.\n")


def main():
    """Main migration function."""
    with app.app_context():
        engine = db.engine
        
        print("=================================================")
        print("  SW Portal Database Migration Started")
        print("=================================================\n")
        
        # Initialize the modules within the app context
        print("Initializing modules...")
        initialize_modules(app, db, User) # Call the new initialization function
        
        # Now that modules are initialized, acl_manager and analytics_manager are available globally from app.py
        from app import acl_manager, analytics_manager 
        
        print("Modules initialized.\n")

        add_user_columns(engine)
        migrate_passwords()
        
        print("Step 3: Creating new tables for ACL and Analytics...")
        acl_manager.create_acl_tables()
        analytics_manager.create_analytics_tables() # Call directly from the initialized manager
        print("Step 3 Complete.\n")

        set_default_permissions(acl_manager)
        
        print("=================================================")
        print("  Database Migration Complete!")
        print("=================================================")

if __name__ == '__main__':
    main()