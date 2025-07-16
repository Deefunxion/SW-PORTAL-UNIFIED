import os
from app import app # Only import app
from extensions import db # Import db from extensions.py

# Import all model classes directly
from models import User, Category, Discussion, Post, FileItem
from forum_models import PostAttachment, PostReaction, UserReputation, PostMention
from messaging_models import Conversation, ConversationParticipant, PrivateMessage, MessageAttachment, MessageReadReceipt, UserPresence
from user_profiles import UserProfile, UserContact, UserBlock

with app.app_context():
    # All models are now directly imported and registered with db.metadata
    db.create_all()
    print("Database tables created successfully.")