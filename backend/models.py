#!/usr/bin/env python3
"""
Core Database Models for SW Portal
Contains the main database models (User, Category, Discussion, Post, FileItem)
"""

from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from .extensions import db


class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(120), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_seen = db.Column(db.DateTime, default=datetime.utcnow)
    presence_status = db.Column(db.String(50), default='offline')
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)


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
    user = db.relationship('User', backref='posts')
    
    # Placeholder for enhancements
    parent_id = db.Column(db.Integer, db.ForeignKey('posts.id'), nullable=True)
    content_type = db.Column(db.String(20), default='text')
    edited_at = db.Column(db.DateTime, nullable=True)
    edit_count = db.Column(db.Integer, default=0)


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