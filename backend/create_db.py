import os
from app import app # Only import app
from .extensions import db # Import db from extensions.py

# Import all model classes directly
from .models import User, Category, Discussion, Post, FileItem
from .forum_models import ForumPost, ForumDiscussion, ForumCategory, ForumAttachment, ForumReaction, ForumUserReputation
from .messaging_models import Message, Conversation, Participant, ReadReceipt
from .user_profiles import UserProfile, UserContact, UserBlock

with app.app_context():
    # All models are now directly imported and registered with db.metadata
    db.create_all()
    print("Database tables created successfully.")