#!/usr/bin/env python3
"""
SW Portal Notifications Module
Provides real-time notification system for user activities
"""

from datetime import datetime
from flask import request, jsonify
from flask_jwt_extended import jwt_required
from .auth import get_current_user_info
from sqlalchemy import desc

# Notification model will be added to the main database models
class Notification:
    """
    Notification model - this should be added to the main app.py models section
    """
    pass

def create_notification_model(db):
    """
    Create the Notification model with the database instance
    """
    class Notification(db.Model):
        id = db.Column(db.Integer, primary_key=True)
        user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
        title = db.Column(db.String(200), nullable=False)
        message = db.Column(db.Text, nullable=False)
        type = db.Column(db.String(50), nullable=False, default='info')  # info, success, warning, error
        is_read = db.Column(db.Boolean, default=False)
        created_at = db.Column(db.DateTime, default=datetime.utcnow)
        
        # Relationships
        user = db.relationship('User', backref='notifications')
        
        def to_dict(self):
            return {
                'id': self.id,
                'title': self.title,
                'message': self.message,
                'type': self.type,
                'is_read': self.is_read,
                'created_at': self.created_at.isoformat(),
                'user_id': self.user_id
            }
    
    return Notification

def create_notification_routes(app, db, User, Notification):
    """
    Create notification routes for the application
    """
    
    @app.route('/api/notifications', methods=['GET'])
    @jwt_required()
    def get_notifications():
        """Get notifications for the current user."""
        try:
            user_info = get_current_user_info()
            if not user_info:
                return jsonify({'error': 'Χρήστης δεν βρέθηκε'}), 404
            
            # Get query parameters
            limit = request.args.get('limit', 20, type=int)
            offset = request.args.get('offset', 0, type=int)
            unread_only = request.args.get('unread_only', 'false').lower() == 'true'
            
            # Build query
            query = Notification.query.filter_by(user_id=user_info['id'])
            
            if unread_only:
                query = query.filter_by(is_read=False)
            
            # Get total count
            total_count = query.count()
            unread_count = Notification.query.filter_by(
                user_id=user_info['id'], 
                is_read=False
            ).count()
            
            # Get paginated results
            notifications = query.order_by(desc(Notification.created_at))\
                                .offset(offset)\
                                .limit(limit)\
                                .all()
            
            return jsonify({
                'notifications': [notif.to_dict() for notif in notifications],
                'total_count': total_count,
                'unread_count': unread_count,
                'has_more': (offset + limit) < total_count
            })
            
        except Exception as e:
            return jsonify({'error': f'Σφάλμα κατά τη λήψη ειδοποιήσεων: {str(e)}'}), 500
    
    @app.route('/api/notifications/mark-as-read', methods=['POST'])
    @jwt_required()
    def mark_notifications_as_read():
        """Mark notifications as read."""
        try:
            user_info = get_current_user_info()
            if not user_info:
                return jsonify({'error': 'Χρήστης δεν βρέθηκε'}), 404
            
            data = request.get_json()
            notification_ids = data.get('notification_ids', [])
            mark_all = data.get('mark_all', False)
            
            if mark_all:
                # Mark all notifications as read for this user
                Notification.query.filter_by(
                    user_id=user_info['id'],
                    is_read=False
                ).update({'is_read': True})
                
                db.session.commit()
                return jsonify({'message': 'Όλες οι ειδοποιήσεις σημειώθηκαν ως αναγνωσμένες'})
            
            elif notification_ids:
                # Mark specific notifications as read
                Notification.query.filter(
                    Notification.id.in_(notification_ids),
                    Notification.user_id == user_info['id']
                ).update({'is_read': True}, synchronize_session=False)
                
                db.session.commit()
                return jsonify({'message': f'{len(notification_ids)} ειδοποιήσεις σημειώθηκαν ως αναγνωσμένες'})
            
            else:
                return jsonify({'error': 'Δεν καθορίστηκαν ειδοποιήσεις'}), 400
                
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': f'Σφάλμα κατά τη σήμανση ειδοποιήσεων: {str(e)}'}), 500
    
    @app.route('/api/notifications/<int:notification_id>', methods=['DELETE'])
    @jwt_required()
    def delete_notification(notification_id):
        """Delete a specific notification."""
        try:
            user_info = get_current_user_info()
            if not user_info:
                return jsonify({'error': 'Χρήστης δεν βρέθηκε'}), 404
            
            notification = Notification.query.filter_by(
                id=notification_id,
                user_id=user_info['id']
            ).first()
            
            if not notification:
                return jsonify({'error': 'Ειδοποί\u00a0ηση δεν βρέθηκε'}), 404
            
            db.session.delete(notification)
            db.session.commit()
            
            return jsonify({'message': 'Η ειδοποίηση διαγράφηκε επιτυχώς'})
            
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': f'Σφάλμα κατά τη διαγραφή ειδοποίησης: {str(e)}'}), 500

def create_notification(db, Notification, user_id, title, message, notification_type='info'):
    """
    Helper function to create a new notification
    
    Args:
        db: Database instance
        Notification: Notification model class
        user_id (int): ID of the user to notify
        title (str): Notification title
        message (str): Notification message
        notification_type (str): Type of notification (info, success, warning, error)
    
    Returns:
        Notification: Created notification object
    """
    try:
        notification = Notification(
            user_id=user_id,
            title=title,
            message=message,
            type=notification_type
        )
        
        db.session.add(notification)
        db.session.commit()
        
        return notification
        
    except Exception as e:
        db.session.rollback()
        print(f"Error creating notification: {e}")
        return None

def notify_new_forum_post(db, Notification, discussion_id, post_author_id, post_content):
    """
    Create notifications for new forum posts
    
    Args:
        db: Database instance
        Notification: Notification model class
        discussion_id (int): ID of the discussion
        post_author_id (int): ID of the user who created the post
        post_content (str): Content of the post
    """
    try:
        # Import here to avoid circular imports
        from app import Discussion, Post, User
        
        discussion = Discussion.query.get(discussion_id)
        if not discussion:
            return
        
        post_author = User.query.get(post_author_id)
        if not post_author:
            return
        
        # Get all users who have participated in this discussion (excluding the post author)
        participants = db.session.query(User)\
            .join(Post, User.id == Post.user_id)\
            .filter(Post.discussion_id == discussion_id)\
            .filter(User.id != post_author_id)\
            .distinct()\
            .all()
        
        # Also notify the discussion creator if they haven't posted yet
        if discussion.user_id != post_author_id:
            discussion_creator = User.query.get(discussion.user_id)
            if discussion_creator and discussion_creator not in participants:
                participants.append(discussion_creator)
        
        # Create notifications for all participants
        for participant in participants:
            title = f"Νέα απάντηση στο θέμα: {discussion.title}"
            message = f"{post_author.username} απάντησε: {post_content[:100]}{'...' if len(post_content) > 100 else ''}"
            
            create_notification(
                db, Notification, 
                participant.id, 
                title, 
                message, 
                'info'
            )
            
    except Exception as e:
        print(f"Error creating forum post notifications: {e}")

def notify_new_file_upload(db, Notification, file_name, uploader_id, category):
    """
    Create notifications for new file uploads
    
    Args:
        db: Database instance
        Notification: Notification model class
        file_name (str): Name of the uploaded file
        uploader_id (int): ID of the user who uploaded the file
        category (str): Category where the file was uploaded
    """
    try:
        from app import User
        
        uploader = User.query.get(uploader_id)
        if not uploader:
            return
        
        # Notify all admin and staff users about new file uploads
        admin_staff_users = User.query.filter(
            User.role.in_(['admin', 'staff']),
            User.id != uploader_id
        ).all()
        
        for user in admin_staff_users:
            title = f"Νέο αρχείο στην κατηγορία: {category}"
            message = f"{uploader.username} ανέβασε το αρχείο '{file_name}'"
            
            create_notification(
                db, Notification,
                user.id,
                title,
                message,
                'info'
            )
            
    except Exception as e:
        print(f"Error creating file upload notifications: {e}")

def notify_user_action(db, Notification, target_user_id, action, actor_username):
    """
    Create notifications for user management actions
    
    Args:
        db: Database instance
        Notification: Notification model class
        target_user_id (int): ID of the user being affected
        action (str): Action performed (created, updated, deleted)
        actor_username (str): Username of the admin who performed the action
    """
    try:
        action_messages = {
            'created': 'Ο λογαριασμός σας δημιουργήθηκε',
            'updated': 'Ο λογαριασμός σας ενημερώθηκε',
            'role_changed': 'Ο ρόλος σας άλλαξε'
        }
        
        title = "Ενημέρωση λογαριασμού"
        message = f"{action_messages.get(action, 'Ο λογαριασμός σας τροποποιήθηκε')} από τον διαχειριστή {actor_username}"
        
        create_notification(
            db, Notification,
            target_user_id,
            title,
            message,
            'info'
        )
        
    except Exception as e:
        print(f"Error creating user action notification: {e}")