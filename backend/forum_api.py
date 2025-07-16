#!/usr/bin/env python3
"""
Enhanced Forum API for SW Portal
Provides endpoints for threading, attachments, reactions, and mentions
"""

import os
import re
from datetime import datetime
from flask import request, jsonify, send_file
from werkzeug.utils import secure_filename
from PIL import Image
import mimetypes
from auth import get_current_user_info
from roles import role_required

# Allowed file extensions
ALLOWED_EXTENSIONS = {
    'images': {'png', 'jpg', 'jpeg', 'gif', 'webp'},
    'documents': {'pdf', 'doc', 'docx', 'txt', 'rtf'},
    'archives': {'zip', 'rar', '7z'},
    'other': {'csv', 'xlsx', 'xls'}
}

ALL_ALLOWED_EXTENSIONS = set()
for ext_group in ALLOWED_EXTENSIONS.values():
    ALL_ALLOWED_EXTENSIONS.update(ext_group)

def allowed_file(filename):
    """Check if file extension is allowed"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALL_ALLOWED_EXTENSIONS

def is_image_file(filename):
    """Check if file is an image"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS['images']

def create_thumbnail(image_path, thumbnail_path, size=(200, 200)):
    """Create thumbnail for image files"""
    try:
        with Image.open(image_path) as img:
            img.thumbnail(size, Image.Resampling.LANCZOS)
            img.save(thumbnail_path, optimize=True, quality=85)
        return True
    except Exception as e:
        print(f"Error creating thumbnail: {e}")
        return False

def extract_mentions(content):
    """Extract @username mentions from content"""
    mention_pattern = r'@(\w+)'
    mentions = re.findall(mention_pattern, content)
    return list(set(mentions))  # Remove duplicates

def create_enhanced_forum_routes(app, db, User, Post, Discussion, enhanced_models):
    """
    Create enhanced forum routes
    """
    PostAttachment = enhanced_models['PostAttachment']
    PostReaction = enhanced_models['PostReaction']
    UserReputation = enhanced_models['UserReputation']
    PostMention = enhanced_models['PostMention']
    
    # Import reputation update function
    from forum_models import create_reputation_triggers
    update_user_reputation = create_reputation_triggers(db, UserReputation, PostReaction)
    
    @app.route('/api/posts/<int:post_id>', methods=['PUT'])
    @role_required(['admin', 'staff'])
    def edit_post(post_id):
        """Edit an existing post"""
        try:
            user_info = get_current_user_info()
            if not user_info:
                return jsonify({'error': 'Χρήστης δεν βρέθηκε'}), 404
            
            post = Post.query.get(post_id)
            if not post:
                return jsonify({'error': 'Το μήνυμα δεν βρέθηκε'}), 404
            
            # Check if user owns the post or is admin
            if post.user_id != user_info['id'] and user_info.get('role') != 'admin':
                return jsonify({'error': 'Δεν έχετε δικαίωμα επεξεργασίας αυτού του μηνύματος'}), 403
            
            data = request.get_json()
            content = data.get('content', '').strip()
            
            if not content:
                return jsonify({'error': 'Το περιεχόμενο δεν μπορεί να είναι κενό'}), 400
            
            # Update post
            post.content = content
            post.content_type = data.get('content_type', 'text')
            post.edited_at = datetime.utcnow()
            post.edit_count = (post.edit_count or 0) + 1
            
            # Process mentions
            mentions = extract_mentions(content)
            if mentions:
                # Remove old mentions
                PostMention.query.filter_by(post_id=post.id).delete()
                
                # Add new mentions
                for username in mentions:
                    mentioned_user = User.query.filter_by(username=username).first()
                    if mentioned_user and mentioned_user.id != user_info['id']:
                        mention = PostMention(
                            post_id=post.id,
                            mentioned_user_id=mentioned_user.id,
                            mentioned_by_user_id=user_info['id']
                        )
                        db.session.add(mention)
            
            db.session.commit()
            
            return jsonify({
                'message': 'Το μήνυμα ενημερώθηκε επιτυχώς',
                'post': {
                    'id': post.id,
                    'content': post.content,
                    'content_type': post.content_type,
                    'edited_at': post.edited_at.isoformat(),
                    'edit_count': post.edit_count
                }
            })
            
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': f'Σφάλμα κατά την επεξεργασία: {str(e)}'}), 500
    
    @app.route('/api/posts/<int:post_id>/replies', methods=['GET'])
    def get_post_replies(post_id):
        """Get replies to a specific post"""
        try:
            post = Post.query.get(post_id)
            if not post:
                return jsonify({'error': 'Το μήνυμα δεν βρέθηκε'}), 404
            
            replies = Post.query.filter_by(parent_id=post_id)\
                                .order_by(Post.created_at)\
                                .all()
            
            replies_data = []
            for reply in replies:
                user = User.query.get(reply.user_id)
                reply_data = {
                    'id': reply.id,
                    'content': reply.content,
                    'content_type': getattr(reply, 'content_type', 'text'),
                    'created_at': reply.created_at.isoformat(),
                    'edited_at': reply.edited_at.isoformat() if getattr(reply, 'edited_at', None) else None,
                    'edit_count': getattr(reply, 'edit_count', 0),
                    'user': {
                        'id': user.id,
                        'username': user.username
                    } if user else None,
                    'depth': reply.get_thread_depth() if hasattr(reply, 'get_thread_depth') else 1,
                    'reaction_counts': reply.get_reaction_counts() if hasattr(reply, 'get_reaction_counts') else {},
                    'attachment_count': len(reply.attachments) if hasattr(reply, 'attachments') else 0
                }
                replies_data.append(reply_data)
            
            return jsonify({
                'replies': replies_data,
                'total_count': len(replies_data)
            })
            
        except Exception as e:
            return jsonify({'error': f'Σφάλμα κατά τη λήψη απαντήσεων: {str(e)}'}), 500
    
    @app.route('/api/posts/<int:post_id>/replies', methods=['POST'])
    @role_required(['admin', 'staff'])
    def create_reply(post_id):
        """Create a reply to a specific post"""
        try:
            user_info = get_current_user_info()
            if not user_info:
                return jsonify({'error': 'Χρήστης δεν βρέθηκε'}), 404
            
            parent_post = Post.query.get(post_id)
            if not parent_post:
                return jsonify({'error': 'Το γονικό μήνυμα δεν βρέθηκε'}), 404
            
            data = request.get_json()
            content = data.get('content', '').strip()
            
            if not content:
                return jsonify({'error': 'Το περιεχόμενο δεν μπορεί να είναι κενό'}), 400
            
            # Create reply
            reply = Post(
                content=content,
                content_type=data.get('content_type', 'text'),
                discussion_id=parent_post.discussion_id,
                user_id=user_info['id'],
                parent_id=post_id
            )
            
            db.session.add(reply)
            db.session.flush()  # Get the reply ID
            
            # Process mentions
            mentions = extract_mentions(content)
            if mentions:
                for username in mentions:
                    mentioned_user = User.query.filter_by(username=username).first()
                    if mentioned_user and mentioned_user.id != user_info['id']:
                        mention = PostMention(
                            post_id=reply.id,
                            mentioned_user_id=mentioned_user.id,
                            mentioned_by_user_id=user_info['id']
                        )
                        db.session.add(mention)
            
            db.session.commit()
            
            # Update user reputation
            update_user_reputation(user_info['id'])
            
            return jsonify({
                'message': 'Η απάντηση δημιουργήθηκε επιτυχώς',
                'reply': {
                    'id': reply.id,
                    'content': reply.content,
                    'parent_id': reply.parent_id,
                    'created_at': reply.created_at.isoformat()
                }
            }), 201
            
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': f'Σφάλμα κατά τη δημιουργία απάντησης: {str(e)}'}), 500
    
    @app.route('/api/posts/<int:post_id>/attachments', methods=['POST'])
    @role_required(['admin', 'staff'])
    def upload_post_attachment(post_id):
        """Upload attachment to a post"""
        try:
            user_info = get_current_user_info()
            if not user_info:
                return jsonify({'error': 'Χρήστης δεν βρέθηκε'}), 404
            
            post = Post.query.get(post_id)
            if not post:
                return jsonify({'error': 'Το μήνυμα δεν βρέθηκε'}), 404
            
            # Check if user owns the post or is admin
            if post.user_id != user_info['id'] and user_info.get('role') != 'admin':
                return jsonify({'error': 'Δεν έχετε δικαίωμα προσθήκης συνημμένων σε αυτό το μήνυμα'}), 403
            
            if 'file' not in request.files:
                return jsonify({'error': 'Δεν βρέθηκε αρχείο'}), 400
            
            file = request.files['file']
            if file.filename == '':
                return jsonify({'error': 'Δεν επιλέχθηκε αρχείο'}), 400
            
            if not allowed_file(file.filename):
                return jsonify({'error': 'Μη επιτρεπτός τύπος αρχείου'}), 400
            
            # Create upload directory
            upload_dir = os.path.join(app.config['UPLOAD_FOLDER'], 'forum_attachments')
            os.makedirs(upload_dir, exist_ok=True)
            
            # Generate secure filename
            original_filename = file.filename
            filename = secure_filename(f"{post_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{original_filename}")
            file_path = os.path.join(upload_dir, filename)
            
            # Save file
            file.save(file_path)
            
            # Get file info
            file_size = os.path.getsize(file_path)
            mime_type = mimetypes.guess_type(file_path)[0]
            is_image = is_image_file(original_filename)
            
            # Create thumbnail for images
            thumbnail_path = None
            if is_image:
                thumbnail_filename = f"thumb_{filename}"
                thumbnail_path = os.path.join(upload_dir, thumbnail_filename)
                if create_thumbnail(file_path, thumbnail_path):
                    thumbnail_path = f"forum_attachments/{thumbnail_filename}"
                else:
                    thumbnail_path = None
            
            # Save attachment record
            attachment = PostAttachment(
                post_id=post_id,
                filename=filename,
                original_filename=original_filename,
                file_path=f"forum_attachments/{filename}",
                file_type=original_filename.rsplit('.', 1)[1].lower(),
                file_size=file_size,
                mime_type=mime_type,
                is_image=is_image,
                thumbnail_path=thumbnail_path,
                uploaded_by=user_info['id']
            )
            
            db.session.add(attachment)
            db.session.commit()
            
            return jsonify({
                'message': 'Το αρχείο ανέβηκε επιτυχώς',
                'attachment': attachment.to_dict()
            }), 201
            
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': f'Σφάλμα κατά το ανέβασμα αρχείου: {str(e)}'}), 500
    
    @app.route('/api/posts/<int:post_id>/attachments', methods=['GET'])
    def get_post_attachments(post_id):
        """Get attachments for a post"""
        try:
            post = Post.query.get(post_id)
            if not post:
                return jsonify({'error': 'Το μήνυμα δεν βρέθηκε'}), 404
            
            attachments = PostAttachment.query.filter_by(post_id=post_id)\
                                             .order_by(PostAttachment.uploaded_at)\
                                             .all()
            
            return jsonify({
                'attachments': [att.to_dict() for att in attachments]
            })
            
        except Exception as e:
            return jsonify({'error': f'Σφάλμα κατά τη λήψη συνημμένων: {str(e)}'}), 500
    
    @app.route('/api/attachments/<int:attachment_id>/download', methods=['GET'])
    def download_attachment(attachment_id):
        """Download an attachment"""
        try:
            attachment = PostAttachment.query.get(attachment_id)
            if not attachment:
                return jsonify({'error': 'Το συνημμένο δεν βρέθηκε'}), 404
            
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], attachment.file_path)
            if not os.path.exists(file_path):
                return jsonify({'error': 'Το αρχείο δεν βρέθηκε στο σύστημα'}), 404
            
            return send_file(
                file_path,
                as_attachment=True,
                download_name=attachment.original_filename
            )
            
        except Exception as e:
            return jsonify({'error': f'Σφάλμα κατά τη λήψη αρχείου: {str(e)}'}), 500
    
    @app.route('/api/attachments/<int:attachment_id>/thumbnail', methods=['GET'])
    def get_attachment_thumbnail(attachment_id):
        """Get thumbnail for an image attachment"""
        try:
            attachment = PostAttachment.query.get(attachment_id)
            if not attachment:
                return jsonify({'error': 'Το συνημμένο δεν βρέθηκε'}), 404
            
            if not attachment.is_image or not attachment.thumbnail_path:
                return jsonify({'error': 'Δεν υπάρχει thumbnail για αυτό το αρχείο'}), 404
            
            thumbnail_path = os.path.join(app.config['UPLOAD_FOLDER'], attachment.thumbnail_path)
            if not os.path.exists(thumbnail_path):
                return jsonify({'error': 'Το thumbnail δεν βρέθηκε'}), 404
            
            return send_file(thumbnail_path)
            
        except Exception as e:
            return jsonify({'error': f'Σφάλμα κατά τη λήψη thumbnail: {str(e)}'}), 500
    
    @app.route('/api/posts/<int:post_id>/reactions', methods=['POST'])
    @role_required(['admin', 'staff', 'guest'])
    def toggle_post_reaction(post_id):
        """Add or remove a reaction to a post"""
        try:
            user_info = get_current_user_info()
            if not user_info:
                return jsonify({'error': 'Χρήστης δεν βρέθηκε'}), 404
            
            post = Post.query.get(post_id)
            if not post:
                return jsonify({'error': 'Το μήνυμα δεν βρέθηκε'}), 404
            
            data = request.get_json()
            reaction_type = data.get('reaction_type', 'like')
            
            # Valid reaction types
            valid_reactions = ['like', 'love', 'laugh', 'angry', 'sad']
            if reaction_type not in valid_reactions:
                return jsonify({'error': 'Μη έγκυρος τύπος αντίδρασης'}), 400
            
            # Check if user already reacted with this type
            existing_reaction = PostReaction.query.filter_by(
                post_id=post_id,
                user_id=user_info['id'],
                reaction_type=reaction_type
            ).first()
            
            if existing_reaction:
                # Remove reaction
                db.session.delete(existing_reaction)
                action = 'removed'
            else:
                # Add reaction
                reaction = PostReaction(
                    post_id=post_id,
                    user_id=user_info['id'],
                    reaction_type=reaction_type
                )
                db.session.add(reaction)
                action = 'added'
            
            db.session.commit()
            
            # Update reputation for post author
            update_user_reputation(post.user_id)
            
            # Get updated reaction counts
            reaction_counts = {}
            for reaction in PostReaction.query.filter_by(post_id=post_id).all():
                reaction_counts[reaction.reaction_type] = reaction_counts.get(reaction.reaction_type, 0) + 1
            
            return jsonify({
                'message': f'Αντίδραση {action}',
                'action': action,
                'reaction_type': reaction_type,
                'reaction_counts': reaction_counts
            })
            
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': f'Σφάλμα κατά την αντίδραση: {str(e)}'}), 500
    
    @app.route('/api/posts/<int:post_id>/reactions', methods=['GET'])
    def get_post_reactions(post_id):
        """Get reactions for a post"""
        try:
            post = Post.query.get(post_id)
            if not post:
                return jsonify({'error': 'Το μήνυμα δεν βρέθηκε'}), 404
            
            reactions = PostReaction.query.filter_by(post_id=post_id).all()
            
            # Group by reaction type
            reaction_counts = {}
            reaction_users = {}
            
            for reaction in reactions:
                reaction_type = reaction.reaction_type
                if reaction_type not in reaction_counts:
                    reaction_counts[reaction_type] = 0
                    reaction_users[reaction_type] = []
                
                reaction_counts[reaction_type] += 1
                user = User.query.get(reaction.user_id)
                if user:
                    reaction_users[reaction_type].append({
                        'id': user.id,
                        'username': user.username
                    })
            
            return jsonify({
                'reaction_counts': reaction_counts,
                'reaction_users': reaction_users,
                'total_reactions': sum(reaction_counts.values())
            })
            
        except Exception as e:
            return jsonify({'error': f'Σφάλμα κατά τη λήψη αντιδράσεων: {str(e)}'}), 500
    
    @app.route('/api/users/<int:user_id>/reputation', methods=['GET'])
    def get_user_reputation(user_id):
        """Get user reputation information"""
        try:
            user = User.query.get(user_id)
            if not user:
                return jsonify({'error': 'Χρήστης δεν βρέθηκε'}), 404
            
            reputation = UserReputation.query.filter_by(user_id=user_id).first()
            if not reputation:
                # Create initial reputation record
                reputation = UserReputation(user_id=user_id)
                db.session.add(reputation)
                db.session.commit()
                update_user_reputation(user_id)
                reputation = UserReputation.query.filter_by(user_id=user_id).first()
            
            return jsonify({
                'user': {
                    'id': user.id,
                    'username': user.username
                },
                'reputation': reputation.to_dict()
            })
            
        except Exception as e:
            return jsonify({'error': f'Σφάλμα κατά τη λήψη φήμης: {str(e)}'}), 500
    
    @app.route('/api/users/leaderboard', methods=['GET'])
    def get_reputation_leaderboard():
        """Get top users by reputation"""
        try:
            limit = request.args.get('limit', 10, type=int)
            
            top_users = db.session.query(UserReputation, User)\
                                 .join(User, UserReputation.user_id == User.id)\
                                 .order_by(UserReputation.reputation_score.desc())\
                                 .limit(limit)\
                                 .all()
            
            leaderboard = []
            for reputation, user in top_users:
                leaderboard.append({
                    'rank': len(leaderboard) + 1,
                    'user': {
                        'id': user.id,
                        'username': user.username
                    },
                    'reputation': reputation.to_dict()
                })
            
            return jsonify({
                'leaderboard': leaderboard,
                'total_users': len(leaderboard)
            })
            
        except Exception as e:
            return jsonify({'error': f'Σφάλμα κατά τη λήψη κατάταξης: {str(e)}'}), 500
    
    @app.route('/api/users/search', methods=['GET'])
    def search_users():
        """Search users for mentions"""
        try:
            query = request.args.get('q', '').strip()
            if len(query) < 2:
                return jsonify({'users': []})
            
            users = User.query.filter(
                User.username.ilike(f'%{query}%')
            ).limit(10).all()
            
            return jsonify({
                'users': [{
                    'id': user.id,
                    'username': user.username
                } for user in users]
            })
            
        except Exception as e:
            return jsonify({'error': f'Σφάλμα κατά την αναζήτηση χρηστών: {str(e)}'}), 500

