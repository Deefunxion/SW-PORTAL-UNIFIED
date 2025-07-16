#!/usr/bin/env python3
"""
Enhanced Forum Models for SW Portal
Adds threading, attachments, reactions, and reputation features
"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship

# Import db from app.py
from app import db # Import db from app.py

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
    # post = db.relationship('Post', backref='attachments') # This will be handled by enhance_post_model
    uploader = db.relationship('User')
    
    def to_dict(self):
        return {
            'id': self.id,
            'filename': self.filename,
            'original_filename': self.original_filename,
            'file_type': self.file_type,
            'file_size': self.file_size,
            'mime_type': self.mime_type,
            'is_image': self.is_image,
            'thumbnail_path': self.thumbnail_path,
            'uploaded_at': self.uploaded_at.isoformat() if self.uploaded_at else None,
            'uploaded_by': self.uploaded_by
        }
    
class PostReaction(db.Model):
    """Model for post reactions (like, love, etc.)"""
    __tablename__ = 'post_reaction'
    
    id = db.Column(db.Integer, primary_key=True)
    post_id = db.Column(db.Integer, db.ForeignKey('posts.id', ondelete='CASCADE'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    reaction_type = db.Column(db.String(20), nullable=False)  # 'like', 'love', 'laugh', 'angry', 'sad'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Unique constraint to prevent duplicate reactions
    __table_args__ = (UniqueConstraint('post_id', 'user_id', 'reaction_type', name='unique_post_user_reaction'),)
    
    # Relationships
    # post = db.relationship('Post', backref='reactions') # This will be handled by enhance_post_model
    user = db.relationship('User')
    
    def to_dict(self):
        return {
            'id': self.id,
            'post_id': self.post_id,
            'user_id': self.user_id,
            'reaction_type': self.reaction_type,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
    
class UserReputation(db.Model):
    """Model for user reputation/karma system"""
    __tablename__ = 'user_reputation'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, unique=True)
    reputation_score = db.Column(db.Integer, default=0)
    posts_count = db.Column(db.Integer, default=0)
    likes_received = db.Column(db.Integer, default=0)
    likes_given = db.Column(db.Integer, default=0)
    comments_count = db.Column(db.Integer, default=0)
    last_updated = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    user = db.relationship('User', backref='reputation')
    
    def to_dict(self):
        return {
            'user_id': self.user_id,
            'reputation_score': self.reputation_score,
            'posts_count': self.posts_count,
            'likes_received': self.likes_received,
            'likes_given': self.likes_given,
            'comments_count': self.comments_count,
            'last_updated': self.last_updated.isoformat() if self.last_updated else None
        }
    
    def calculate_reputation(self):
        """Calculate reputation score based on activity"""
        # Simple reputation formula
        score = (
            self.likes_received * 5 +  # 5 points per like received
            self.posts_count * 2 +     # 2 points per post
            self.comments_count * 1 +  # 1 point per comment
            self.likes_given * 0.5     # 0.5 points per like given (encourages engagement)
        )
        self.reputation_score = int(score)
        self.last_updated = datetime.utcnow()
        return self.reputation_score
    
class PostMention(db.Model):
    """Model for user mentions in posts"""
    __tablename__ = 'post_mention'
    
    id = db.Column(db.Integer, primary_key=True)
    post_id = db.Column(db.Integer, db.ForeignKey('posts.id', ondelete='CASCADE'), nullable=False)
    mentioned_user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    mentioned_by_user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    # post = db.relationship('Post', backref='mentions') # This will be handled by enhance_post_model
    mentioned_user = db.relationship('User', foreign_keys=[mentioned_user_id])
    mentioned_by = db.relationship('User', foreign_keys=[mentioned_by_user_id])
    
    def to_dict(self):
        return {
            'id': self.id,
            'post_id': self.post_id,
            'mentioned_user_id': self.mentioned_user_id,
            'mentioned_by_user_id': self.mentioned_by_user_id,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

def enhance_post_model(Post):
    """
    Add new fields to existing Post model for enhanced functionality
    This should be called after the Post model is defined
    """
    # Add threading support
    if not hasattr(Post, 'parent_id'):
        Post.parent_id = Column(Integer, ForeignKey('posts.id'), nullable=True)
        Post.children = relationship('Post', backref='parent', remote_side=[Post.id])
    
    # Add content type support
    if not hasattr(Post, 'content_type'):
        Post.content_type = Column(String(20), default='text')  # 'text', 'rich_html'
    
    # Add edit tracking
    if not hasattr(Post, 'edited_at'):
        Post.edited_at = Column(DateTime, nullable=True)
        Post.edit_count = Column(Integer, default=0)
    
    # Add helper methods
    def get_replies(self):
        """Get direct replies to this post"""
        return Post.query.filter_by(parent_id=self.id).order_by(Post.created_at).all()
    
    def get_thread_depth(self):
        """Calculate the depth of this post in the thread"""
        depth = 0
        current = self
        while current.parent_id:
            depth += 1
            current = Post.query.get(current.parent_id)
            if not current:  # Safety check
                break
        return depth
    
    def get_reaction_counts(self):
        """Get reaction counts for this post"""
        from collections import defaultdict
        counts = defaultdict(int)
        for reaction in self.reactions:
            counts[reaction.reaction_type] += 1
        return dict(counts)
    
    def has_user_reacted(self, user_id, reaction_type):
        """Check if user has reacted to this post with specific reaction"""
        return any(r.user_id == user_id and r.reaction_type == reaction_type for r in self.reactions)
    
    # Add methods to Post class
    Post.get_replies = get_replies
    Post.get_thread_depth = get_thread_depth
    Post.get_reaction_counts = get_reaction_counts
    Post.has_user_reacted = has_user_reacted
    
    return Post

def create_reputation_triggers(db, UserReputation, PostReaction):
    """
    Create database triggers or helper functions for automatic reputation updates
    """
    
    def update_user_reputation(user_id):
        """Update user reputation based on current activity"""
        reputation = UserReputation.query.filter_by(user_id=user_id).first()
        if not reputation:
            reputation = UserReputation(user_id=user_id)
            db.session.add(reputation)
        
        # Count posts
        from app import Post  # Import here to avoid circular imports
        reputation.posts_count = Post.query.filter_by(user_id=user_id).count()
        
        # Count comments (posts with parent_id)
        reputation.comments_count = Post.query.filter_by(user_id=user_id).filter(Post.parent_id.isnot(None)).count()
        
        # Count likes received
        user_posts = Post.query.filter_by(user_id=user_id).all()
        likes_received = 0
        for post in user_posts:
            likes_received += PostReaction.query.filter_by(post_id=post.id, reaction_type='like').count()
        reputation.likes_received = likes_received
        
        # Count likes given
        reputation.likes_given = PostReaction.query.filter_by(user_id=user_id, reaction_type='like').count()
        
        # Calculate final score
        reputation.calculate_reputation()
        
        try:
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            print(f"Error updating reputation for user {user_id}: {e}")
        
        return reputation
    
    return update_user_reputation