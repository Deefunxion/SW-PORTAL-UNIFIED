"""
Database Models for SW Portal
Consolidated models file containing all SQLAlchemy model classes
"""

from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, UniqueConstraint, Index
from sqlalchemy.orm import relationship
from .extensions import db
from pgvector.sqlalchemy import Vector


# ============================================================================
# CORE MODELS
# ============================================================================

class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(120), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_seen = db.Column(db.DateTime, default=datetime.utcnow)
    presence_status = db.Column(db.String(50), default='offline')
    role = db.Column(db.String(50), default='guest')
    
    # Relationships
    posts = db.relationship('Post', backref='user', lazy=True)
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
    
    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'last_seen': self.last_seen.isoformat() if self.last_seen else None,
            'presence_status': self.presence_status,
            'role': self.role
        }


class Category(db.Model):
    __tablename__ = 'categories'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    discussions = db.relationship('Discussion', backref='category', lazy=True)


class Discussion(db.Model):
    __tablename__ = 'discussions'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    category_id = db.Column(db.Integer, db.ForeignKey('categories.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    posts = db.relationship('Post', backref='discussion', lazy=True, cascade='all, delete-orphan')
    
    @property
    def post_count(self):
        return len(self.posts)
    
    @property
    def last_post(self):
        return self.posts[-1] if self.posts else None


class Post(db.Model):
    __tablename__ = 'posts'
    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.Text, nullable=False)
    discussion_id = db.Column(db.Integer, db.ForeignKey('discussions.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Enhanced forum features
    parent_id = db.Column(db.Integer, db.ForeignKey('posts.id'), nullable=True)
    content_type = db.Column(db.String(20), default='text')
    edited_at = db.Column(db.DateTime, nullable=True)
    edit_count = db.Column(db.Integer, default=0)
    
    # Relationships for enhanced features
    attachments = db.relationship('PostAttachment', back_populates='post', cascade='all, delete-orphan')
    reactions = db.relationship('PostReaction', back_populates='post', cascade='all, delete-orphan')
    mentions = db.relationship('PostMention', back_populates='post', cascade='all, delete-orphan')
    
    def get_reactions_summary(self):
        """Get a summary of reactions for this post"""
        reactions = {}
        for reaction in self.reactions:
            if reaction.reaction_type not in reactions:
                reactions[reaction.reaction_type] = 0
            reactions[reaction.reaction_type] += 1
        return reactions
    
    def get_attachment_count(self):
        """Get the number of attachments for this post"""
        return len(self.attachments) if self.attachments else 0
    
    def has_user_reacted(self, user_id, reaction_type):
        """Check if a user has reacted to this post with a specific reaction"""
        for reaction in self.reactions:
            if reaction.user_id == user_id and reaction.reaction_type == reaction_type:
                return True
        return False


class FileItem(db.Model):
    __tablename__ = 'file_items'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    original_name = db.Column(db.String(255), nullable=False)
    path = db.Column(db.String(500), nullable=False)
    category = db.Column(db.String(200), nullable=False)
    file_type = db.Column(db.String(50), nullable=False)
    file_size = db.Column(db.Integer)
    uploaded_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


# ============================================================================
# ENHANCED FORUM MODELS
# ============================================================================

class PostAttachment(db.Model):
    """Model for file attachments on posts"""
    __tablename__ = 'post_attachment'
    
    id = db.Column(db.Integer, primary_key=True)
    post_id = db.Column(db.Integer, db.ForeignKey('posts.id', ondelete='CASCADE'), nullable=False)
    filename = db.Column(db.String(255), nullable=False)
    original_filename = db.Column(db.String(255), nullable=False)
    file_path = db.Column(db.String(500), nullable=False)
    file_type = db.Column(db.String(50), nullable=False)
    file_size = db.Column(db.Integer)
    mime_type = db.Column(db.String(100))
    is_image = db.Column(db.Boolean, default=False)
    thumbnail_path = db.Column(db.String(500))
    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow)
    uploaded_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    
    # Relationships
    post = db.relationship('Post', back_populates='attachments')
    uploader = db.relationship('User')


class PostReaction(db.Model):
    """Model for post reactions (like, dislike, etc.)"""
    __tablename__ = 'post_reaction'
    
    id = db.Column(db.Integer, primary_key=True)
    post_id = db.Column(db.Integer, db.ForeignKey('posts.id', ondelete='CASCADE'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    reaction_type = db.Column(db.String(50), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Ensure one reaction per user per post
    __table_args__ = (UniqueConstraint('post_id', 'user_id', name='unique_user_post_reaction'),)
    
    # Relationships
    post = db.relationship('Post', back_populates='reactions')
    user = db.relationship('User')


class PostMention(db.Model):
    """Model for user mentions in posts"""
    __tablename__ = 'post_mention'
    
    id = db.Column(db.Integer, primary_key=True)
    post_id = db.Column(db.Integer, db.ForeignKey('posts.id', ondelete='CASCADE'), nullable=False)
    mentioned_user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    mentioning_user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_read = db.Column(db.Boolean, default=False)
    
    # Relationships
    post = db.relationship('Post', back_populates='mentions')
    mentioned_user = db.relationship('User', foreign_keys=[mentioned_user_id])
    mentioning_user = db.relationship('User', foreign_keys=[mentioning_user_id])


class UserReputation(db.Model):
    """Model for user reputation tracking"""
    __tablename__ = 'user_reputation'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    reputation_score = db.Column(db.Integer, default=0)
    posts_count = db.Column(db.Integer, default=0)
    likes_received = db.Column(db.Integer, default=0)
    dislikes_received = db.Column(db.Integer, default=0)
    best_answers = db.Column(db.Integer, default=0)
    last_updated = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    user = db.relationship('User')


# ============================================================================
# MESSAGING MODELS
# ============================================================================

class Conversation(db.Model):
    """Conversation model - represents a private conversation between users"""
    __tablename__ = 'conversations'

    id = Column(Integer, primary_key=True)
    title = Column(String(255), nullable=True)
    is_group = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    participants = relationship('ConversationParticipant', back_populates='conversation', cascade='all, delete-orphan')
    messages = relationship('PrivateMessage', back_populates='conversation', cascade='all, delete-orphan')


class ConversationParticipant(db.Model):
    """Conversation participants - many-to-many relationship between users and conversations"""
    __tablename__ = 'conversation_participants'

    id = Column(Integer, primary_key=True)
    conversation_id = Column(Integer, ForeignKey('conversations.id'), nullable=False)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    joined_at = Column(DateTime, default=datetime.utcnow)
    last_read_at = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)
    role = Column(String(50), default='member')

    # Relationships
    conversation = relationship('Conversation', back_populates='participants')
    user = relationship('User')


class PrivateMessage(db.Model):
    """Private message model - individual messages within conversations"""
    __tablename__ = 'private_messages'

    id = Column(Integer, primary_key=True)
    conversation_id = Column(Integer, ForeignKey('conversations.id'), nullable=False)
    sender_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    content = Column(Text, nullable=False)
    content_type = Column(String(50), default='text')
    message_type = Column(String(50), default='message')
    created_at = Column(DateTime, default=datetime.utcnow)
    edited_at = Column(DateTime, nullable=True)
    is_deleted = Column(Boolean, default=False)
    is_system_message = Column(Boolean, default=False)
    reply_to_id = Column(Integer, ForeignKey('private_messages.id'), nullable=True)

    # Relationships
    conversation = relationship('Conversation', back_populates='messages')
    sender = relationship('User')
    reply_to = relationship('PrivateMessage', remote_side=[id])
    attachments = relationship('MessageAttachment', back_populates='message', cascade='all, delete-orphan')
    read_receipts = relationship('MessageReadReceipt', back_populates='message', cascade='all, delete-orphan')


class MessageAttachment(db.Model):
    """Message attachments - files attached to private messages"""
    __tablename__ = 'message_attachments'

    id = Column(Integer, primary_key=True)
    message_id = Column(Integer, ForeignKey('private_messages.id'), nullable=False)
    original_filename = Column(String(255), nullable=False)
    stored_filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer, nullable=False)
    file_type = Column(String(100), nullable=False)
    mime_type = Column(String(100), nullable=False)
    is_image = Column(Boolean, default=False)
    thumbnail_path = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    message = relationship('PrivateMessage', back_populates='attachments')


class MessageReadReceipt(db.Model):
    """Message read receipts - track when users read messages"""
    __tablename__ = 'message_read_receipts'

    id = Column(Integer, primary_key=True)
    message_id = Column(Integer, ForeignKey('private_messages.id'), nullable=False)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    read_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    message = relationship('PrivateMessage', back_populates='read_receipts')
    user = relationship('User')


class UserPresence(db.Model):
    """User presence tracking for real-time messaging"""
    __tablename__ = 'user_presence'

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    status = Column(String(50), default='offline')  # online, away, busy, offline
    last_seen = Column(DateTime, default=datetime.utcnow)
    is_typing_in_conversation = Column(Integer, ForeignKey('conversations.id'), nullable=True)
    typing_started_at = Column(DateTime, nullable=True)

    # Relationships
    user = relationship('User')
    typing_conversation = relationship('Conversation')


# ============================================================================
# USER PROFILE MODELS
# ============================================================================

class UserProfile(db.Model):
    """Extended user profile information"""
    __tablename__ = 'user_profiles'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), unique=True, nullable=False)
    display_name = db.Column(db.String(100))
    bio = db.Column(db.Text)
    location = db.Column(db.String(100))
    website = db.Column(db.String(200))
    avatar_url = db.Column(db.String(500))
    phone = db.Column(db.String(20))
    birth_date = db.Column(db.Date)
    timezone = db.Column(db.String(50))
    language = db.Column(db.String(10), default='el')
    privacy_settings = db.Column(db.Text)  # JSON string
    notification_settings = db.Column(db.Text)  # JSON string
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = db.relationship('User', backref=db.backref('profile', uselist=False))


class UserContact(db.Model):
    """User contact relationships (friends, following, etc.)"""
    __tablename__ = 'user_contacts'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    contact_user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    relationship_type = db.Column(db.String(50), nullable=False)  # friend, following, blocked
    status = db.Column(db.String(20), default='active')  # active, pending, declined
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = db.relationship('User', foreign_keys=[user_id])
    contact = db.relationship('User', foreign_keys=[contact_user_id])
    
    # Constraints
    __table_args__ = (
        db.UniqueConstraint('user_id', 'contact_user_id', name='unique_user_contact'),
        db.CheckConstraint('user_id != contact_user_id', name='check_no_self_contact')
    )


class UserBlock(db.Model):
    """User blocking relationships"""
    __tablename__ = 'user_blocks'
    
    id = db.Column(db.Integer, primary_key=True)
    blocker_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    blocked_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    reason = db.Column(db.String(500))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    blocker = db.relationship('User', foreign_keys=[blocker_id])
    blocked = db.relationship('User', foreign_keys=[blocked_id])
    
    # Constraints
    __table_args__ = (
        db.UniqueConstraint('blocker_id', 'blocked_id', name='unique_user_block'),
        db.CheckConstraint('blocker_id != blocked_id', name='check_no_self_block')
    )


# ============================================================================
# NOTIFICATION MODEL
# ============================================================================

class Notification(db.Model):
    """Notification system for user alerts"""
    __tablename__ = 'notifications'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text)
    notification_type = db.Column(db.String(50), nullable=False)
    is_read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    read_at = db.Column(db.DateTime)
    action_url = db.Column(db.String(500))
    meta_data = db.Column(db.Text)  # JSON string for additional data
    
    # Relationships
    user = db.relationship('User', backref='notifications')


# ============================================================================
# AI / RAG MODELS
# ============================================================================

class DocumentIndex(db.Model):
    """Tracks documents that have been processed for RAG."""
    __tablename__ = 'document_index'

    id = db.Column(db.Integer, primary_key=True)
    file_path = db.Column(db.String(500), unique=True, nullable=False)
    file_name = db.Column(db.String(255), nullable=False)
    file_type = db.Column(db.String(20))  # pdf, docx, txt
    file_hash = db.Column(db.String(64))  # SHA-256 for change detection
    chunk_count = db.Column(db.Integer, default=0)
    status = db.Column(db.String(20), default='pending')  # pending, processing, ready, error
    error_message = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=db.func.now())
    updated_at = db.Column(db.DateTime, default=db.func.now(), onupdate=db.func.now())

    chunks = db.relationship('FileChunk', backref='document', lazy='dynamic',
                            cascade='all, delete-orphan')


class FileChunk(db.Model):
    """A chunk of text from a processed document, with vector embedding."""
    __tablename__ = 'file_chunk'

    id = db.Column(db.Integer, primary_key=True)
    document_id = db.Column(db.Integer, db.ForeignKey('document_index.id'), index=True)
    source_path = db.Column(db.String(500), index=True)
    content = db.Column(db.Text, nullable=False)
    chunk_index = db.Column(db.Integer, default=0)
    chunk_type = db.Column(db.String(20), default='text')  # text, table, header
    embedding = db.Column(Vector(1536))  # OpenAI text-embedding-3-small dimension
    embedding_model = db.Column(db.String(50))
    text_hash = db.Column(db.String(64), index=True)  # For deduplication
    created_at = db.Column(db.DateTime, default=db.func.now())


# ============================================================================
# AI CHAT SESSION MODELS
# ============================================================================

class ChatSession(db.Model):
    """A conversation session with the AI assistant."""
    __tablename__ = 'chat_sessions'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    title = db.Column(db.String(200), default='Νέα Συζήτηση')
    created_at = db.Column(db.DateTime, default=db.func.now())
    updated_at = db.Column(db.DateTime, default=db.func.now(), onupdate=db.func.now())

    messages = db.relationship('ChatMessage', backref='session', lazy='dynamic',
                               cascade='all, delete-orphan',
                               order_by='ChatMessage.created_at')

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'message_count': self.messages.count(),
        }


class ChatMessage(db.Model):
    """A single message in a chat session."""
    __tablename__ = 'chat_messages'

    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey('chat_sessions.id'), nullable=False, index=True)
    role = db.Column(db.String(20), nullable=False)  # 'user' or 'assistant'
    content = db.Column(db.Text, nullable=False)
    sources = db.Column(db.Text, default='')  # JSON list of source paths
    created_at = db.Column(db.DateTime, default=db.func.now())

    def to_dict(self):
        import json
        return {
            'id': self.id,
            'role': self.role,
            'content': self.content,
            'sources': json.loads(self.sources) if self.sources else [],
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


# ============================================================================
# AUDIT LOG MODEL
# ============================================================================

class AuditLog(db.Model):
    """Tracks security-relevant actions for compliance."""
    __tablename__ = 'audit_logs'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    action = db.Column(db.String(100), nullable=False)  # login, login_failed, upload, delete, admin_action
    resource = db.Column(db.String(100))  # auth, file, discussion, user
    resource_id = db.Column(db.String(100))  # ID of the affected resource
    details = db.Column(db.Text)  # JSON string with extra context
    ip_address = db.Column(db.String(45))  # IPv4 or IPv6
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', backref='audit_logs')