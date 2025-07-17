#!/usr/bin/env python3
"""
Enhanced User Profiles Module
Provides extended user profile functionality for messaging and forum features
"""

from datetime import datetime
from flask import request, jsonify
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship

from .auth import jwt_required, get_current_user_info

def create_user_profile_models(db):
    """
    Create user profile related database models
    """
    
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
    
    return {
        'UserProfile': UserProfile,
        'UserContact': UserContact,
        'UserBlock': UserBlock
    }

def create_user_profile_routes(app, db, User):
    """
    Create user profile related API routes
    """
    
    # Get models
    models = create_user_profile_models(db)
    UserProfile = models['UserProfile']
    UserContact = models['UserContact']
    UserBlock = models['UserBlock']
    
    # ============================================================================
    # USER PROFILE ENDPOINTS
    # ============================================================================
    
    @app.route('/api/users/<int:user_id>/profile', methods=['GET'])
    @jwt_required()
    def get_enhanced_user_profile(user_id):
        """
        Get user profile information
        """
        try:
            current_user = get_current_user_info()
            is_own_profile = current_user['id'] == user_id
            
            # Check if user is blocked
            if not is_own_profile:
                block = db.session.query(UserBlock).filter_by(
                    user_id=user_id,
                    blocked_user_id=current_user['id']
                ).first()
                
                if block:
                    return jsonify({'error': 'Δεν έχετε πρόσβαση σε αυτό το προφίλ'}), 403
            
            # Get user
            user = db.session.query(User).get(user_id)
            if not user:
                return jsonify({'error': 'Ο χρήστης δεν βρέθηκε'}), 404
            
            # Get or create profile
            profile = db.session.query(UserProfile).filter_by(user_id=user_id).first()
            if not profile:
                profile = UserProfile(user_id=user_id)
                db.session.add(profile)
                db.session.commit()
            
            # Get contact status if not own profile
            contact_status = None
            if not is_own_profile:
                contact = db.session.query(UserContact).filter_by(
                    user_id=current_user['id'],
                    contact_user_id=user_id
                ).first()
                contact_status = contact.status if contact else None
            
            profile_data = profile.to_dict(include_private=is_own_profile)
            profile_data['user'] = user.to_dict()
            profile_data['contact_status'] = contact_status
            
            return jsonify({'profile': profile_data})
            
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    @app.route('/api/users/profile', methods=['PUT'])
    @jwt_required()
    def update_enhanced_user_profile():
        """
        Update current user's profile
        """
        try:
            current_user = get_current_user_info()
            user_id = current_user['id']
            
            data = request.get_json()
            
            # Get or create profile
            profile = db.session.query(UserProfile).filter_by(user_id=user_id).first()
            if not profile:
                profile = UserProfile(user_id=user_id)
                db.session.add(profile)
            
            # Update profile fields
            updatable_fields = [
                'display_name', 'bio', 'location', 'website', 'avatar_url',
                'allow_messages_from', 'show_online_status', 'show_read_receipts',
                'email_notifications', 'push_notifications', 'show_email',
                'show_location', 'show_website', 'default_post_privacy',
                'auto_subscribe_topics', 'email_digest'
            ]
            
            for field in updatable_fields:
                if field in data:
                    setattr(profile, field, data[field])
            
            profile.updated_at = datetime.utcnow()
            db.session.commit()
            
            return jsonify({
                'profile': profile.to_dict(include_private=True),
                'message': 'Το προφίλ ενημερώθηκε επιτυχώς'
            })
            
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': str(e)}), 500
    
    # ============================================================================
    # USER SEARCH ENDPOINTS
    # ============================================================================
    
    @app.route('/api/users/search', methods=['GET'])
    @jwt_required()
    def search_users():
        """
        Search for users
        """
        try:
            current_user = get_current_user_info()
            query = request.args.get('q', '').strip()
            page = request.args.get('page', 1, type=int)
            per_page = min(request.args.get('per_page', 20, type=int), 100)
            
            if len(query) < 2:
                return jsonify({'users': [], 'pagination': {}})
            
            # Search users by username or email
            users_query = db.session.query(User).filter(
                db.or_(
                    User.username.ilike(f'%{query}%'),
                    User.email.ilike(f'%{query}%')
                )
            ).filter(User.id != current_user['id'])  # Exclude current user
            
            users = users_query.paginate(
                page=page, per_page=per_page, error_out=False
            )
            
            # Get user profiles and contact status
            result = []
            for user in users.items:
                # Check if blocked
                block = db.session.query(UserBlock).filter_by(
                    user_id=user.id,
                    blocked_user_id=current_user['id']
                ).first()
                
                if block:
                    continue  # Skip blocked users
                
                # Get profile
                profile = db.session.query(UserProfile).filter_by(user_id=user.id).first()
                
                # Get contact status
                contact = db.session.query(UserContact).filter_by(
                    user_id=current_user['id'],
                    contact_user_id=user.id
                ).first()
                
                user_data = user.to_dict()
                user_data['profile'] = profile.to_dict() if profile else None
                user_data['contact_status'] = contact.status if contact else None
                
                result.append(user_data)
            
            return jsonify({
                'users': result,
                'pagination': {
                    'page': users.page,
                    'pages': users.pages,
                    'per_page': users.per_page,
                    'total': users.total,
                    'has_next': users.has_next,
                    'has_prev': users.has_prev
                }
            })
            
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    # ============================================================================
    # CONTACT MANAGEMENT ENDPOINTS
    # ============================================================================
    
    @app.route('/api/users/contacts', methods=['GET'])
    @jwt_required()
    def get_user_contacts():
        """
        Get user's contacts
        """
        try:
            current_user = get_current_user_info()
            user_id = current_user['id']
            
            status = request.args.get('status', 'accepted')
            page = request.args.get('page', 1, type=int)
            per_page = min(request.args.get('per_page', 50, type=int), 100)
            
            contacts_query = db.session.query(UserContact).filter_by(
                user_id=user_id,
                status=status
            ).order_by(UserContact.updated_at.desc())
            
            contacts = contacts_query.paginate(
                page=page, per_page=per_page, error_out=False
            )
            
            return jsonify({
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
    
    @app.route('/api/users/<int:user_id>/contact', methods=['POST'])
    @jwt_required()
    def add_contact(user_id):
        """
        Send contact request to user
        """
        try:
            current_user = get_current_user_info()
            current_user_id = current_user['id']
            
            if current_user_id == user_id:
                return jsonify({'error': 'Δεν μπορείτε να προσθέσετε τον εαυτό σας'}), 400
            
            # Check if user exists
            user = db.session.query(User).get(user_id)
            if not user:
                return jsonify({'error': 'Ο χρήστης δεν βρέθηκε'}), 404
            
            # Check if already exists
            existing_contact = db.session.query(UserContact).filter_by(
                user_id=current_user_id,
                contact_user_id=user_id
            ).first()
            
            if existing_contact:
                return jsonify({'error': 'Ο χρήστης είναι ήδη στη λίστα επαφών σας'}), 400
            
            # Create contact request
            contact = UserContact(
                user_id=current_user_id,
                contact_user_id=user_id,
                status='pending'
            )
            
            db.session.add(contact)
            db.session.commit()
            
            return jsonify({
                'contact': contact.to_dict(),
                'message': 'Το αίτημα επαφής στάλθηκε επιτυχώς'
            }), 201
            
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': str(e)}), 500
    
    @app.route('/api/users/contacts/<int:contact_id>', methods=['PUT'])
    @jwt_required()
    def update_contact_status(contact_id):
        """
        Accept or reject contact request
        """
        try:
            current_user = get_current_user_info()
            data = request.get_json()
            status = data.get('status')
            
            if status not in ['accepted', 'rejected']:
                return jsonify({'error': 'Μη έγκυρη κατάσταση'}), 400
            
            # Find contact request where current user is the contact
            contact = db.session.query(UserContact).filter_by(
                id=contact_id,
                contact_user_id=current_user['id'],
                status='pending'
            ).first()
            
            if not contact:
                return jsonify({'error': 'Το αίτημα επαφής δεν βρέθηκε'}), 404
            
            contact.status = status
            contact.updated_at = datetime.utcnow()
            
            # If accepted, create reverse contact
            if status == 'accepted':
                reverse_contact = UserContact(
                    user_id=current_user['id'],
                    contact_user_id=contact.user_id,
                    status='accepted'
                )
                db.session.add(reverse_contact)
            
            db.session.commit()
            
            return jsonify({
                'contact': contact.to_dict(),
                'message': f'Το αίτημα επαφής {"εγκρίθηκε" if status == "accepted" else "απορρίφθηκε"} επιτυχώς'
            })
            
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': str(e)}), 500
    
    # ============================================================================
    # BLOCK MANAGEMENT ENDPOINTS
    # ============================================================================
    
    @app.route('/api/users/<int:user_id>/block', methods=['POST'])
    @jwt_required()
    def block_user(user_id):
        """
        Block a user
        """
        try:
            current_user = get_current_user_info()
            current_user_id = current_user['id']
            
            if current_user_id == user_id:
                return jsonify({'error': 'Δεν μπορείτε να μπλοκάρετε τον εαυτό σας'}), 400
            
            data = request.get_json()
            reason = data.get('reason', '')
            
            # Check if user exists
            user = db.session.query(User).get(user_id)
            if not user:
                return jsonify({'error': 'Ο χρήστης δεν βρέθηκε'}), 404
            
            # Check if already blocked
            existing_block = db.session.query(UserBlock).filter_by(
                user_id=current_user_id,
                blocked_user_id=user_id
            ).first()
            
            if existing_block:
                return jsonify({'error': 'Ο χρήστης είναι ήδη μπλοκαρισμένος'}), 400
            
            # Create block
            block = UserBlock(
                user_id=current_user_id,
                blocked_user_id=user_id,
                reason=reason
            )
            
            db.session.add(block)
            
            # Remove from contacts if exists
            db.session.query(UserContact).filter(
                db.or_(
                    db.and_(UserContact.user_id == current_user_id, UserContact.contact_user_id == user_id),
                    db.and_(UserContact.user_id == user_id, UserContact.contact_user_id == current_user_id)
                )
            ).delete()
            
            db.session.commit()
            
            return jsonify({
                'block': block.to_dict(),
                'message': 'Ο χρήστης μπλοκαρίστηκε επιτυχώς'
            }), 201
            
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': str(e)}), 500
    
    @app.route('/api/users/<int:user_id>/unblock', methods=['DELETE'])
    @jwt_required()
    def unblock_user(user_id):
        """
        Unblock a user
        """
        try:
            current_user = get_current_user_info()
            current_user_id = current_user['id']
            
            # Find and delete block
            block = db.session.query(UserBlock).filter_by(
                user_id=current_user_id,
                blocked_user_id=user_id
            ).first()
            
            if not block:
                return jsonify({'error': 'Ο χρήστης δεν είναι μπλοκαρισμένος'}), 404
            
            db.session.delete(block)
            db.session.commit()
            
            return jsonify({'message': 'Ο χρήστης ξεμπλοκαρίστηκε επιτυχώς'})
            
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': str(e)}), 500
    
    @app.route('/api/users/blocked', methods=['GET'])
    @jwt_required()
    def get_blocked_users():
        """
        Get list of blocked users
        """
        try:
            current_user = get_current_user_info()
            user_id = current_user['id']
            
            page = request.args.get('page', 1, type=int)
            per_page = min(request.args.get('per_page', 50, type=int), 100)
            
            blocks_query = db.session.query(UserBlock).filter_by(
                user_id=user_id
            ).order_by(UserBlock.created_at.desc())
            
            blocks = blocks_query.paginate(
                page=page, per_page=per_page, error_out=False
            )
            
            return jsonify({
                'blocked_users': [block.to_dict() for block in blocks.items],
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

