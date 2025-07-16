#!/usr/bin/env python3
"""
Enhanced User Profiles Module
Provides extended user profile functionality for messaging and forum features
"""

from datetime import datetime
from flask import request, jsonify
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from extensions import db

from auth import jwt_required, get_current_user_info


class UserProfile(db.Model):
    """
    Extended user profile with messaging preferences
    """
    __tablename__ = 'user_profiles'
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, unique=True)
    
    # Profile Information
    display_name = Column(String(100), nullable=True)
    bio = Column(Text, nullable=True)
    location = Column(String(100), nullable=True)
    website = Column(String(255), nullable=True)
    avatar_url = Column(String(500), nullable=True)
    
    # Messaging Preferences
    allow_messages_from = Column(String(20), default='everyone')  # everyone, contacts, nobody
    show_online_status = Column(Boolean, default=True)
    show_read_receipts = Column(Boolean, default=True)
    email_notifications = Column(Boolean, default=True)
    push_notifications = Column(Boolean, default=True)
    
    # Privacy Settings
    show_email = Column(Boolean, default=False)
    show_location = Column(Boolean, default=True)
    show_website = Column(Boolean, default=True)
    
    # Forum Preferences
    default_post_privacy = Column(String(20), default='public')  # public, private, contacts
    auto_subscribe_topics = Column(Boolean, default=True)
    email_digest = Column(Boolean, default=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship('User')
    
    def to_dict(self, include_private=False):
        result = {
            'id': self.id,
            'user_id': self.user_id,
            'display_name': self.display_name,
            'bio': self.bio,
            'avatar_url': self.avatar_url,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
        
        # Add public fields based on privacy settings
        if self.show_location:
            result['location'] = self.location
        if self.show_website:
            result['website'] = self.website
        if self.show_email and self.user:
            result['email'] = self.user.email
        
        # Add private fields if requested (for own profile)
        if include_private:
            result.update({
                'allow_messages_from': self.allow_messages_from,
                'show_online_status': self.show_online_status,
                'show_read_receipts': self.show_read_receipts,
                'email_notifications': self.email_notifications,
                'push_notifications': self.push_notifications,
                'show_email': self.show_email,
                'show_location': self.show_location,
                'show_website': self.show_website,
                'default_post_privacy': self.default_post_privacy,
                'auto_subscribe_topics': self.auto_subscribe_topics,
                'email_digest': self.email_digest
            })
        
        return result


class UserContact(db.Model):
    """
    User contacts/friends system
    """
    __tablename__ = 'user_contacts'
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    contact_user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    status = Column(String(20), default='pending')  # pending, accepted, blocked
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship('User', foreign_keys=[user_id])
    contact_user = relationship('User', foreign_keys=[contact_user_id])
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'contact_user_id': self.contact_user_id,
            'contact_user': self.contact_user.to_dict() if self.contact_user else None,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class UserBlock(db.Model):
    """
    User blocking system
    """
    __tablename__ = 'user_blocks'
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    blocked_user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    reason = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship('User', foreign_keys=[user_id])
    blocked_user = relationship('User', foreign_keys=[blocked_user_id])
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'blocked_user_id': self.blocked_user_id,
            'blocked_user': self.blocked_user.to_dict() if self.blocked_user else None,
            'reason': self.reason,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


def create_user_profile_routes(app, db, User):
    """
    Create user profile management routes
    """
    
    @app.route('/api/profiles/me', methods=['GET'])
    @jwt_required()
    def get_my_profile():
        """Get current user's profile"""
        try:
            current_user = get_current_user_info()
            if not current_user:
                return jsonify({'error': 'User not found'}), 404
            
            profile = UserProfile.query.filter_by(user_id=current_user['id']).first()
            if not profile:
                # Create default profile
                profile = UserProfile(user_id=current_user['id'])
                db.session.add(profile)
                db.session.commit()
            
            return jsonify({
                'success': True,
                'profile': profile.to_dict(include_private=True)
            })
            
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    @app.route('/api/profiles/me', methods=['PUT'])
    @jwt_required()
    def update_my_profile():
        """Update current user's profile"""
        try:
            current_user = get_current_user_info()
            if not current_user:
                return jsonify({'error': 'User not found'}), 404
            
            data = request.get_json()
            
            profile = UserProfile.query.filter_by(user_id=current_user['id']).first()
            if not profile:
                profile = UserProfile(user_id=current_user['id'])
                db.session.add(profile)
            
            # Update allowed fields
            allowed_fields = [
                'display_name', 'bio', 'location', 'website', 'avatar_url',
                'allow_messages_from', 'show_online_status', 'show_read_receipts',
                'email_notifications', 'push_notifications', 'show_email',
                'show_location', 'show_website', 'default_post_privacy',
                'auto_subscribe_topics', 'email_digest'
            ]
            
            for field in allowed_fields:
                if field in data:
                    setattr(profile, field, data[field])
            
            profile.updated_at = datetime.utcnow()
            db.session.commit()
            
            return jsonify({
                'success': True,
                'profile': profile.to_dict(include_private=True)
            })
            
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    @app.route('/api/profiles/<int:user_id>', methods=['GET'])
    @jwt_required()
    def get_profile_by_id(user_id):
        """Get another user's public profile"""
        try:
            current_user = get_current_user_info()
            if not current_user:
                return jsonify({'error': 'User not found'}), 404
            
            user = User.query.get(user_id)
            if not user:
                return jsonify({'error': 'User not found'}), 404
            
            profile = UserProfile.query.filter_by(user_id=user_id).first()
            if not profile:
                # Create default profile
                profile = UserProfile(user_id=user_id)
                db.session.add(profile)
                db.session.commit()
            
            # Check if this is the user's own profile
            include_private = (current_user['id'] == user_id)
            
            return jsonify({
                'success': True,
                'profile': profile.to_dict(include_private=include_private),
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'created_at': user.created_at.isoformat() if user.created_at else None
                }
            })
            
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    @app.route('/api/contacts', methods=['GET'])
    @jwt_required()
    def get_contacts():
        """Get user's contacts"""
        try:
            current_user = get_current_user_info()
            if not current_user:
                return jsonify({'error': 'User not found'}), 404
            
            page = request.args.get('page', 1, type=int)
            per_page = min(request.args.get('per_page', 20, type=int), 100)
            status = request.args.get('status', 'accepted')
            
            contacts = UserContact.query.filter_by(
                user_id=current_user['id'],
                status=status
            ).paginate(
                page=page,
                per_page=per_page,
                error_out=False
            )
            
            return jsonify({
                'success': True,
                'contacts': [contact.to_dict() for contact in contacts.items],
                'pagination': {
                    'page': contacts.page,
                    'pages': contacts.pages,
                    'per_page': contacts.per_page,
                    'total': contacts.total,
                    'has_next': contacts.has_next,
                    'has_prev': contacts.has_prev
                }
            })
            
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    @app.route('/api/contacts/<int:contact_user_id>', methods=['POST'])
    @jwt_required()
    def add_contact(contact_user_id):
        """Add a contact/friend"""
        try:
            current_user = get_current_user_info()
            if not current_user:
                return jsonify({'error': 'User not found'}), 404
            
            if current_user['id'] == contact_user_id:
                return jsonify({'error': 'Cannot add yourself as contact'}), 400
            
            # Check if contact user exists
            contact_user = User.query.get(contact_user_id)
            if not contact_user:
                return jsonify({'error': 'Contact user not found'}), 404
            
            # Check if contact already exists
            existing_contact = UserContact.query.filter_by(
                user_id=current_user['id'],
                contact_user_id=contact_user_id
            ).first()
            
            if existing_contact:
                return jsonify({'error': 'Contact already exists'}), 400
            
            # Create new contact
            contact = UserContact(
                user_id=current_user['id'],
                contact_user_id=contact_user_id,
                status='pending'
            )
            db.session.add(contact)
            db.session.commit()
            
            return jsonify({
                'success': True,
                'contact': contact.to_dict()
            })
            
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    @app.route('/api/contacts/<int:contact_id>', methods=['PUT'])
    @jwt_required()
    def update_contact(contact_id):
        """Update contact status (accept/reject)"""
        try:
            current_user = get_current_user_info()
            if not current_user:
                return jsonify({'error': 'User not found'}), 404
            
            data = request.get_json()
            status = data.get('status')
            
            if status not in ['accepted', 'blocked']:
                return jsonify({'error': 'Invalid status'}), 400
            
            contact = UserContact.query.filter_by(
                id=contact_id,
                contact_user_id=current_user['id']  # Only the contact can accept/reject
            ).first()
            
            if not contact:
                return jsonify({'error': 'Contact not found'}), 404
            
            contact.status = status
            contact.updated_at = datetime.utcnow()
            db.session.commit()
            
            return jsonify({
                'success': True,
                'contact': contact.to_dict()
            })
            
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    @app.route('/api/contacts/<int:contact_id>', methods=['DELETE'])
    @jwt_required()
    def remove_contact(contact_id):
        """Remove a contact"""
        try:
            current_user = get_current_user_info()
            if not current_user:
                return jsonify({'error': 'User not found'}), 404
            
            contact = UserContact.query.filter_by(
                id=contact_id,
                user_id=current_user['id']
            ).first()
            
            if not contact:
                return jsonify({'error': 'Contact not found'}), 404
            
            db.session.delete(contact)
            db.session.commit()
            
            return jsonify({'success': True})
            
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    @app.route('/api/blocks', methods=['GET'])
    @jwt_required()
    def get_blocks():
        """Get user's blocked users"""
        try:
            current_user = get_current_user_info()
            if not current_user:
                return jsonify({'error': 'User not found'}), 404
            
            page = request.args.get('page', 1, type=int)
            per_page = min(request.args.get('per_page', 20, type=int), 100)
            
            blocks = UserBlock.query.filter_by(
                user_id=current_user['id']
            ).paginate(
                page=page,
                per_page=per_page,
                error_out=False
            )
            
            return jsonify({
                'success': True,
                'blocks': [block.to_dict() for block in blocks.items],
                'pagination': {
                    'page': blocks.page,
                    'pages': blocks.pages,
                    'per_page': blocks.per_page,
                    'total': blocks.total,
                    'has_next': blocks.has_next,
                    'has_prev': blocks.has_prev
                }
            })
            
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    @app.route('/api/blocks/<int:blocked_user_id>', methods=['POST'])
    @jwt_required()
    def block_user(blocked_user_id):
        """Block a user"""
        try:
            current_user = get_current_user_info()
            if not current_user:
                return jsonify({'error': 'User not found'}), 404
            
            if current_user['id'] == blocked_user_id:
                return jsonify({'error': 'Cannot block yourself'}), 400
            
            data = request.get_json()
            reason = data.get('reason', '')
            
            # Check if user exists
            blocked_user = User.query.get(blocked_user_id)
            if not blocked_user:
                return jsonify({'error': 'User not found'}), 404
            
            # Check if already blocked
            existing_block = UserBlock.query.filter_by(
                user_id=current_user['id'],
                blocked_user_id=blocked_user_id
            ).first()
            
            if existing_block:
                return jsonify({'error': 'User already blocked'}), 400
            
            # Create block
            block = UserBlock(
                user_id=current_user['id'],
                blocked_user_id=blocked_user_id,
                reason=reason
            )
            db.session.add(block)
            db.session.commit()
            
            return jsonify({
                'success': True,
                'block': block.to_dict()
            })
            
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    @app.route('/api/blocks/<int:block_id>', methods=['DELETE'])
    @jwt_required()
    def unblock_user(block_id):
        """Unblock a user"""
        try:
            current_user = get_current_user_info()
            if not current_user:
                return jsonify({'error': 'User not found'}), 404
            
            block = UserBlock.query.filter_by(
                id=block_id,
                user_id=current_user['id']
            ).first()
            
            if not block:
                return jsonify({'error': 'Block not found'}), 404
            
            db.session.delete(block)
            db.session.commit()
            
            return jsonify({'success': True})
            
        except Exception as e:
            return jsonify({'error': str(e)}), 500

