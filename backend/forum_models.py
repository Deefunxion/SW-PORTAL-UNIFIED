#!/usr/bin/env python3
"""
Enhanced Forum Models for SW Portal
Adds threading, attachments, reactions, and reputation features
"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from extensions import db


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
    post = db.relationship('Post', backref='attachments')
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
    reaction_type = db.Column(db.String(50), nullable=False)  # like, love, laugh, angry, etc.
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    post = db.relationship('Post', backref='reactions')
    user = db.relationship('User')
    
    # Unique constraint to prevent duplicate reactions
    __table_args__ = (
        UniqueConstraint('post_id', 'user_id', 'reaction_type', name='unique_post_user_reaction'),
    )
    
    def to_dict(self):
        return {
            'id': self.id,
            'post_id': self.post_id,
            'user_id': self.user_id,
            'reaction_type': self.reaction_type,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


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
    post = db.relationship('Post', backref='mentions')
    mentioned_user = db.relationship('User', foreign_keys=[mentioned_user_id])
    mentioning_user = db.relationship('User', foreign_keys=[mentioning_user_id])
    
    def to_dict(self):
        return {
            'id': self.id,
            'post_id': self.post_id,
            'mentioned_user_id': self.mentioned_user_id,
            'mentioning_user_id': self.mentioning_user_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'is_read': self.is_read
        }


class UserReputation(db.Model):
    """Model for user reputation system"""
    __tablename__ = 'user_reputation'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    reputation_score = db.Column(db.Integer, default=0)
    posts_count = db.Column(db.Integer, default=0)
    helpful_posts_count = db.Column(db.Integer, default=0)
    last_updated = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = db.relationship('User', backref='reputation')
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'reputation_score': self.reputation_score,
            'posts_count': self.posts_count,
            'helpful_posts_count': self.helpful_posts_count,
            'last_updated': self.last_updated.isoformat() if self.last_updated else None
        }


def enhance_post_model(Post):
    """
    Enhance the existing Post model with additional methods and properties
    """
    
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
    
    def get_mention_count(self):
        """Get the number of mentions in this post"""
        return len(self.mentions) if self.mentions else 0
    
    def has_user_reacted(self, user_id, reaction_type):
        """Check if a user has reacted to this post with a specific reaction"""
        for reaction in self.reactions:
            if reaction.user_id == user_id and reaction.reaction_type == reaction_type:
                return True
        return False
    
    def get_thread_children(self):
        """Get child posts in a threaded discussion"""
        return Post.query.filter_by(parent_id=self.id).all()
    
    def get_thread_depth(self):
        """Get the depth of this post in a threaded discussion"""
        depth = 0
        current_post = self
        while current_post.parent_id:
            depth += 1
            current_post = Post.query.get(current_post.parent_id)
            if not current_post:  # Safety check
                break
        return depth
    
    # Add methods to the Post class
    Post.get_reactions_summary = get_reactions_summary
    Post.get_attachment_count = get_attachment_count
    Post.get_mention_count = get_mention_count
    Post.has_user_reacted = has_user_reacted
    Post.get_thread_children = get_thread_children
    Post.get_thread_depth = get_thread_depth
    
    return Post

