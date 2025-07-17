#!/usr/bin/env python3
"""
SW Portal Role-Based Access Control (RBAC) Module
Provides decorators and utilities for granular permission control
"""

from functools import wraps
from flask import jsonify
from flask_jwt_extended import get_jwt_identity, jwt_required
from .auth import get_current_user_info

def role_required(allowed_roles):
    """
    Decorator που ελέγχει αν ο χρήστης έχει έναν από τους επιτρεπόμενους ρόλους
    
    Args:
        allowed_roles (list): Λίστα με τους επιτρεπόμενους ρόλους (π.χ. ['admin', 'staff'])
    
    Usage:
        @role_required(['admin'])
        def admin_only_endpoint():
            pass
            
        @role_required(['admin', 'staff'])
        def staff_and_admin_endpoint():
            pass
    """
    def decorator(f):
        @wraps(f)
        @jwt_required()
        def decorated_function(*args, **kwargs):
            try:
                # Λήψη πληροφοριών χρήστη
                user_info = get_current_user_info()
                
                if not user_info:
                    return jsonify({
                        'error': 'Μη έγκυρος χρήστης',
                        'message': 'Δεν βρέθηκαν πληροφορίες χρήστη'
                    }), 401
                
                user_role = user_info.get('role', 'guest')
                
                # Έλεγχος αν ο ρόλος του χρήστη είναι στους επιτρεπόμενους
                if user_role not in allowed_roles:
                    return jsonify({
                        'error': 'Ανεπαρκή δικαιώματα',
                        'message': f'Απαιτείται ρόλος: {", ".join(allowed_roles)}. Τρέχων ρόλος: {user_role}',
                        'required_roles': allowed_roles,
                        'current_role': user_role
                    }), 403
                
                # Αν ο έλεγχος περάσει, εκτέλεση της αρχικής συνάρτησης
                return f(*args, **kwargs)
                
            except Exception as e:
                return jsonify({
                    'error': 'Σφάλμα ελέγχου δικαιωμάτων',
                    'message': str(e)
                }), 500
                
        return decorated_function
    return decorator

def admin_only(f):
    """
    Shortcut decorator για endpoints που επιτρέπονται μόνο σε admin
    """
    return role_required(['admin'])(f)

def staff_and_admin(f):
    """
    Shortcut decorator για endpoints που επιτρέπονται σε staff και admin
    """
    return role_required(['admin', 'staff'])(f)

def check_user_permission(user_role, required_roles):
    """
    Utility function για έλεγχο δικαιωμάτων χωρίς decorator
    
    Args:
        user_role (str): Ο ρόλος του χρήστη
        required_roles (list): Οι απαιτούμενοι ρόλοι
    
    Returns:
        bool: True αν ο χρήστης έχει δικαίωμα, False αλλιώς
    """
    return user_role in required_roles

def get_role_permissions():
    """
    Επιστρέφει τα δικαιώματα κάθε ρόλου
    
    Returns:
        dict: Mapping ρόλων σε δικαιώματα
    """
    return {
        'admin': {
            'can_upload_files': True,
            'can_delete_files': True,
            'can_create_folders': True,
            'can_delete_folders': True,
            'can_create_forum_topics': True,
            'can_delete_forum_posts': True,
            'can_moderate_forum': True,
            'can_manage_users': True,
            'can_view_analytics': True,
            'can_access_admin_dashboard': True
        },
        'staff': {
            'can_upload_files': True,
            'can_delete_files': False,
            'can_create_folders': True,
            'can_delete_folders': False,
            'can_create_forum_topics': True,
            'can_delete_forum_posts': False,
            'can_moderate_forum': False,
            'can_manage_users': False,
            'can_view_analytics': False,
            'can_access_admin_dashboard': False
        },
        'guest': {
            'can_upload_files': False,
            'can_delete_files': False,
            'can_create_folders': False,
            'can_delete_folders': False,
            'can_create_forum_topics': False,
            'can_delete_forum_posts': False,
            'can_moderate_forum': False,
            'can_manage_users': False,
            'can_view_analytics': False,
            'can_access_admin_dashboard': False
        }
    }

def user_can(user_role, permission):
    """
    Ελέγχει αν ένας χρήστης έχει συγκεκριμένο δικαίωμα
    
    Args:
        user_role (str): Ο ρόλος του χρήστη
        permission (str): Το δικαίωμα προς έλεγχο
    
    Returns:
        bool: True αν ο χρήστης έχει το δικαίωμα
    """
    permissions = get_role_permissions()
    return permissions.get(user_role, {}).get(permission, False)

