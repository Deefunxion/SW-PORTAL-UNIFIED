#!/usr/bin/env python3
"""
Enhanced Forum Models for SW Portal
Adds threading, attachments, reactions, and reputation features
"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from .extensions import db


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
    
    def __repr__(self):
        return f'<PostAttachment {self.filename}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'post_id': self.post_id,
            'filename': self.filename,
            'original_filename': self.original_filename,
            'file_type': self.file_type,
            'file_size': self.file_size,
            'mime_type': self.mime_type,
            'is_image': self.is_image,
            'uploaded_at': self.uploaded_at.isoformat() if self.uploaded_at else None,
            'uploaded_by': self.uploaded_by
        }


class PostReaction(db.Model):
    """Model for post reactions (like, dislike, etc.)"""
    __tablename__ = 'post_reaction'
    
    id = db.Column(db.Integer, primary_key=True)
    post_id = db.Column(db.Integer, db.ForeignKey('posts.id', ondelete='CASCADE'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    reaction_type = db.Column(db.String(50), nullable=False)  # 'like', 'dislike', 'love', 'laugh', etc.
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Ensure one reaction per user per post
    __table_args__ = (UniqueConstraint('post_id', 'user_id', name='unique_user_post_reaction'),)
    
    # Relationships
    post = db.relationship('Post', back_populates='reactions')
    user = db.relationship('User')
    
    def __repr__(self):
        return f'<PostReaction {self.reaction_type} by {self.user_id} on {self.post_id}>'
    
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
    post = db.relationship('Post', back_populates='mentions')
    mentioned_user = db.relationship('User', foreign_keys=[mentioned_user_id])
    mentioning_user = db.relationship('User', foreign_keys=[mentioning_user_id])
    
    def __repr__(self):
        return f'<PostMention {self.mentioned_user_id} in {self.post_id}>'
    
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
    user = db.relationship('User', back_populates='reputation')
    
    def __repr__(self):
        return f'<UserReputation {self.user_id}: {self.reputation_score}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'reputation_score': self.reputation_score,
            'posts_count': self.posts_count,
            'likes_received': self.likes_received,
            'dislikes_received': self.dislikes_received,
            'best_answers': self.best_answers,
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


def create_enhanced_forum_models(db):
    """
    Create and return enhanced forum models
    """
    return {
        'PostAttachment': PostAttachment,
        'PostReaction': PostReaction,
        'PostMention': PostMention,
        'UserReputation': UserReputation
    }


def create_reputation_triggers(db, UserReputation, PostReaction):
    """
    Create reputation update triggers
    """
    def update_user_reputation(user_id):
        """Update user reputation based on reactions and posts"""
        user_reputation = UserReputation.query.filter_by(user_id=user_id).first()
        if not user_reputation:
            user_reputation = UserReputation(user_id=user_id)
            db.session.add(user_reputation)
        
        # Count likes and dislikes
        likes = PostReaction.query.filter_by(user_id=user_id, reaction_type='like').count()
        dislikes = PostReaction.query.filter_by(user_id=user_id, reaction_type='dislike').count()
        
        # Update reputation score (likes +1, dislikes -1)
        user_reputation.likes_received = likes
        user_reputation.dislikes_received = dislikes
        user_reputation.reputation_score = likes - dislikes
        user_reputation.last_updated = datetime.utcnow()
        
        db.session.commit()
    
    return update_user_reputation

