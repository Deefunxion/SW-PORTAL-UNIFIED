#!/usr/bin/env python3
"""
Database Creation Script for SW Portal
Creates all tables and initializes the database with proper schema
"""

import os
import sys
from flask import Flask

# Add the backend directory to the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import the extensions and models
from extensions import db

# Import all model classes to ensure they are registered with SQLAlchemy
from models import User, Category, Discussion, Post, FileItem
from forum_models import PostAttachment, PostReaction, PostMention, UserReputation
from messaging_models import Conversation, ConversationParticipant, PrivateMessage, MessageReadReceipt, UserPresence
from user_profiles import UserProfile, UserContact, UserBlock

def create_app():
    """Create Flask application for database initialization"""
    app = Flask(__name__)
    
    # Configuration
    app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'sw-portal-secret-key-2025')
    
    # Database configuration
    BASE_DIR = os.path.abspath(os.path.dirname(__file__))
    app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{os.path.join(BASE_DIR, "sw_portal.db")}'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    
    # Initialize extensions
    db.init_app(app)
    
    return app

def create_database():
    """Create all database tables"""
    app = create_app()
    
    with app.app_context():
        print("Creating database tables...")
        
        # Create all tables
        db.create_all()
        
        print("Database tables created successfully!")
        
        # List all tables that were created
        inspector = db.inspect(db.engine)
        tables = inspector.get_table_names()
        
        print(f"Created {len(tables)} tables:")
        for table in sorted(tables):
            print(f"  - {table}")
        
        # Seed database with default categories if they don't exist
        if Category.query.count() == 0:
            print("\nSeeding database with default forum categories...")
            default_categories = [
                {'title': 'Γενικά Θέματα', 'description': 'Συζητήσεις για οτιδήποτε δεν ταιριάζει στις άλλες κατηγορίες.'},
                {'title': 'Νομικά Θέματα', 'description': 'Ερωτήσεις και συζητήσεις νομικού περιεχομένου.'},
                {'title': 'Δύσκολα Θέματα', 'description': 'Για πιο σύνθετα και απαιτητικά ζητήματα.'},
                {'title': 'Νέα-Ανακοινώσεις', 'description': 'Ενημερώσεις και ανακοινώσεις από τη διαχείριση.'},
                {'title': 'Προτάσεις', 'description': 'Προτάσεις για τη βελτίωση του portal.'}
            ]
            for cat_data in default_categories:
                new_cat = Category(title=cat_data['title'], description=cat_data['description'])
                db.session.add(new_cat)
            db.session.commit()
            print("Default categories created.")
        
        print("\nDatabase initialization completed successfully!")

if __name__ == '__main__':
    create_database()