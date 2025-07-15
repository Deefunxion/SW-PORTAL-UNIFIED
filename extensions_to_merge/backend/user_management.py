#!/usr/bin/env python3
"""
SW Portal User Management Module
Provides endpoints for user profile management and admin dashboard
"""

import bcrypt
from datetime import datetime
from flask import request, jsonify
from flask_jwt_extended import jwt_required
from auth import get_current_user_info
from roles import admin_only, role_required

def create_user_management_routes(app, db, User):
    """
    Create user management routes for profile and admin dashboard
    """
    
    @app.route('/api/user/profile', methods=['GET'])
    @jwt_required()
    def get_user_profile():
        """Get current user's profile information."""
        try:
            user_info = get_current_user_info()
            if not user_info:
                return jsonify({'error': 'Χρήστης δεν βρέθηκε'}), 404
            
            # Get full user data from database
            user = User.query.get(user_info['id'])
            if not user:
                return jsonify({'error': 'Χρήστης δεν βρέθηκε στη βάση δεδομένων'}), 404
            
            return jsonify({
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'role': getattr(user, 'role', 'guest'),
                'is_active': getattr(user, 'is_active', True),
                'created_at': user.created_at.isoformat() if user.created_at else None,
                'last_login': getattr(user, 'last_login', None).isoformat() if getattr(user, 'last_login', None) else None
            })
            
        except Exception as e:
            return jsonify({'error': f'Σφάλμα κατά τη λήψη προφίλ: {str(e)}'}), 500
    
    @app.route('/api/user/profile', methods=['PUT'])
    @jwt_required()
    def update_user_profile():
        """Update current user's profile information."""
        try:
            user_info = get_current_user_info()
            if not user_info:
                return jsonify({'error': 'Χρήστης δεν βρέθηκε'}), 404
            
            user = User.query.get(user_info['id'])
            if not user:
                return jsonify({'error': 'Χρήστης δεν βρέθηκε στη βάση δεδομένων'}), 404
            
            data = request.get_json()
            
            # Update email if provided
            if 'email' in data and data['email']:
                # Check if email is already taken by another user
                existing_user = User.query.filter(User.email == data['email'], User.id != user.id).first()
                if existing_user:
                    return jsonify({'error': 'Το email χρησιμοποιείται ήδη από άλλον χρήστη'}), 400
                user.email = data['email']
            
            # Update password if provided
            if 'current_password' in data and 'new_password' in data:
                if not user.check_password(data['current_password']):
                    return jsonify({'error': 'Λάθος τρέχων κωδικός πρόσβασης'}), 400
                
                if len(data['new_password']) < 6:
                    return jsonify({'error': 'Ο νέος κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες'}), 400
                
                user.set_password(data['new_password'])
            
            db.session.commit()
            
            return jsonify({
                'message': 'Το προφίλ ενημερώθηκε επιτυχώς',
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'email': user.email,
                    'role': getattr(user, 'role', 'guest')
                }
            })
            
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': f'Σφάλμα κατά την ενημέρωση προφίλ: {str(e)}'}), 500
    
    @app.route('/api/admin/users', methods=['GET'])
    @admin_only
    def get_all_users():
        """Get all users (admin only)."""
        try:
            users = User.query.all()
            
            return jsonify({
                'users': [{
                    'id': user.id,
                    'username': user.username,
                    'email': user.email,
                    'role': getattr(user, 'role', 'guest'),
                    'is_active': getattr(user, 'is_active', True),
                    'created_at': user.created_at.isoformat() if user.created_at else None,
                    'last_login': getattr(user, 'last_login', None).isoformat() if getattr(user, 'last_login', None) else None
                } for user in users],
                'total_count': len(users)
            })
            
        except Exception as e:
            return jsonify({'error': f'Σφάλμα κατά τη λήψη χρηστών: {str(e)}'}), 500
    
    @app.route('/api/admin/users', methods=['POST'])
    @admin_only
    def create_user():
        """Create a new user (admin only)."""
        try:
            data = request.get_json()
            
            # Validation
            required_fields = ['username', 'email', 'password']
            for field in required_fields:
                if field not in data or not data[field]:
                    return jsonify({'error': f'Το πεδίο {field} είναι υποχρεωτικό'}), 400
            
            # Check if username or email already exists
            if User.query.filter_by(username=data['username']).first():
                return jsonify({'error': 'Το όνομα χρήστη υπάρχει ήδη'}), 400
            
            if User.query.filter_by(email=data['email']).first():
                return jsonify({'error': 'Το email υπάρχει ήδη'}), 400
            
            # Create new user
            user = User(
                username=data['username'],
                email=data['email']
            )
            user.set_password(data['password'])
            
            # Set role if provided
            if 'role' in data and data['role'] in ['admin', 'staff', 'guest']:
                if hasattr(user, 'role'):
                    user.role = data['role']
            
            db.session.add(user)
            db.session.commit()
            
            return jsonify({
                'message': 'Ο χρήστης δημιουργήθηκε επιτυχώς',
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'email': user.email,
                    'role': getattr(user, 'role', 'guest')
                }
            }), 201
            
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': f'Σφάλμα κατά τη δημιουργία χρήστη: {str(e)}'}), 500
    
    @app.route('/api/admin/users/<int:user_id>', methods=['PUT'])
    @admin_only
    def update_user(user_id):
        """Update a user (admin only)."""
        try:
            user = User.query.get(user_id)
            if not user:
                return jsonify({'error': 'Χρήστης δεν βρέθηκε'}), 404
            
            data = request.get_json()
            
            # Update email if provided
            if 'email' in data and data['email']:
                existing_user = User.query.filter(User.email == data['email'], User.id != user.id).first()
                if existing_user:
                    return jsonify({'error': 'Το email χρησιμοποιείται ήδη'}), 400
                user.email = data['email']
            
            # Update role if provided
            if 'role' in data and data['role'] in ['admin', 'staff', 'guest']:
                if hasattr(user, 'role'):
                    user.role = data['role']
            
            # Update active status if provided
            if 'is_active' in data:
                if hasattr(user, 'is_active'):
                    user.is_active = bool(data['is_active'])
            
            # Update password if provided
            if 'password' in data and data['password']:
                if len(data['password']) < 6:
                    return jsonify({'error': 'Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες'}), 400
                user.set_password(data['password'])
            
            db.session.commit()
            
            return jsonify({
                'message': 'Ο χρήστης ενημερώθηκε επιτυχώς',
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'email': user.email,
                    'role': getattr(user, 'role', 'guest'),
                    'is_active': getattr(user, 'is_active', True)
                }
            })
            
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': f'Σφάλμα κατά την ενημέρωση χρήστη: {str(e)}'}), 500
    
    @app.route('/api/admin/users/<int:user_id>', methods=['DELETE'])
    @admin_only
    def delete_user(user_id):
        """Delete a user (admin only)."""
        try:
            current_user_info = get_current_user_info()
            
            # Prevent admin from deleting themselves
            if current_user_info['id'] == user_id:
                return jsonify({'error': 'Δεν μπορείτε να διαγράψετε τον εαυτό σας'}), 400
            
            user = User.query.get(user_id)
            if not user:
                return jsonify({'error': 'Χρήστης δεν βρέθηκε'}), 404
            
            username = user.username
            db.session.delete(user)
            db.session.commit()
            
            return jsonify({
                'message': f'Ο χρήστης {username} διαγράφηκε επιτυχώς'
            })
            
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': f'Σφάλμα κατά τη διαγραφή χρήστη: {str(e)}'}), 500
    
    @app.route('/api/admin/stats', methods=['GET'])
    @admin_only
    def get_admin_stats():
        """Get admin dashboard statistics."""
        try:
            from sqlalchemy import func
            
            # User statistics
            total_users = User.query.count()
            active_users = User.query.filter(getattr(User, 'is_active', True) == True).count() if hasattr(User, 'is_active') else total_users
            
            # Role distribution
            role_stats = {}
            if hasattr(User, 'role'):
                role_counts = db.session.query(User.role, func.count(User.id)).group_by(User.role).all()
                role_stats = {role: count for role, count in role_counts}
            else:
                role_stats = {'guest': total_users}
            
            # Recent users (last 30 days)
            from datetime import datetime, timedelta
            thirty_days_ago = datetime.utcnow() - timedelta(days=30)
            recent_users = User.query.filter(User.created_at >= thirty_days_ago).count()
            
            return jsonify({
                'users': {
                    'total': total_users,
                    'active': active_users,
                    'recent': recent_users,
                    'by_role': role_stats
                },
                'system': {
                    'uptime': 'Running',
                    'version': '2.0.0',
                    'last_updated': datetime.utcnow().isoformat()
                }
            })
            
        except Exception as e:
            return jsonify({'error': f'Σφάλμα κατά τη λήψη στατιστικών: {str(e)}'}), 500

