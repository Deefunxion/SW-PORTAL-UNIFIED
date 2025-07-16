#!/usr/bin/env python3
"""
Private Messaging API Endpoints
Provides REST API for private messaging functionality
"""

import os
import uuid
from datetime import datetime, timedelta
from flask import request, jsonify, send_file
from werkzeug.utils import secure_filename
from sqlalchemy import and_, or_, desc, func
from PIL import Image
import mimetypes

from messaging_models import (
    Conversation, ConversationParticipant, PrivateMessage, MessageReadReceipt, UserPresence,
    get_or_create_conversation, mark_messages_as_read, get_unread_count, update_user_presence
)
from auth import jwt_required, get_current_user_info

def create_messaging_routes(app, db, User):
    """
    Create messaging-related API routes
    """
    
    # Models and helper functions are imported directly at the top of the file
    
    # Configuration
    UPLOAD_FOLDER = os.path.join(os.getcwd(), 'uploads', 'messages')
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp', 'pdf', 'doc', 'docx', 'txt', 'zip', 'rar'}
    MAX_FILE_SIZE = 16 * 1024 * 1024  # 16MB
    
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    
    def allowed_file(filename):
        return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS
    
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
    
    # ============================================================================
    # CONVERSATION ENDPOINTS
    # ============================================================================
    
    @app.route('/api/conversations', methods=['GET'])
    @jwt_required()
    def get_conversations():
        """
        Get user's conversations with pagination
        """
        try:
            user_info = get_current_user_info()
            user_id = user_info['id']
            
            page = request.args.get('page', 1, type=int)
            per_page = min(request.args.get('per_page', 20, type=int), 100)
            
            # Get conversations where user is a participant
            conversations_query = db.session.query(Conversation).join(
                ConversationParticipant
            ).filter(
                and_(
                    ConversationParticipant.user_id == user_id,
                    ConversationParticipant.is_active == True
                )
            ).order_by(desc(Conversation.updated_at))
            
            conversations = conversations_query.paginate(
                page=page, per_page=per_page, error_out=False
            )
            
            result = []
            for conversation in conversations.items:
                # Get other participants
                participants = db.session.query(ConversationParticipant).filter(
                    and_(
                        ConversationParticipant.conversation_id == conversation.id,
                        ConversationParticipant.is_active == True
                    )
                ).all()
                
                # Get last message
                last_message = db.session.query(PrivateMessage).filter(
                    PrivateMessage.conversation_id == conversation.id
                ).order_by(desc(PrivateMessage.created_at)).first()
                
                # Get unread count for this conversation
                user_participant = next((p for p in participants if p.user_id == user_id), None)
                unread_count = 0
                if user_participant:
                    unread_query = db.session.query(PrivateMessage).filter(
                        and_(
                            PrivateMessage.conversation_id == conversation.id,
                            PrivateMessage.sender_id != user_id
                        )
                    )
                    
                    if user_participant.last_read_at:
                        unread_query = unread_query.filter(
                            PrivateMessage.created_at > user_participant.last_read_at
                        )
                    
                    unread_count = unread_query.count()
                
                conversation_data = conversation.to_dict()
                conversation_data.update({
                    'participants': [p.to_dict() for p in participants],
                    'last_message': last_message.to_dict() if last_message else None,
                    'unread_count': unread_count
                })
                
                result.append(conversation_data)
            
            return jsonify({
                'conversations': result,
                'pagination': {
                    'page': conversations.page,
                    'pages': conversations.pages,
                    'per_page': conversations.per_page,
                    'total': conversations.total,
                    'has_next': conversations.has_next,
                    'has_prev': conversations.has_prev
                }
            })
            
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    @app.route('/api/conversations', methods=['POST'])
    @jwt_required()
    def create_conversation():
        """
        Create new conversation or get existing one
        """
        try:
            user_info = get_current_user_info()
            user_id = user_info['id']
            
            data = request.get_json()
            participant_ids = data.get('participant_ids', [])
            title = data.get('title')
            is_group = data.get('is_group', False)
            
            if not participant_ids:
                return jsonify({'error': 'Απαιτούνται συμμετέχοντες'}), 400
            
            # Add current user to participants if not already included
            if user_id not in participant_ids:
                participant_ids.append(user_id)
            
            # For direct messages (2 participants), check if conversation exists
            if len(participant_ids) == 2 and not is_group:
                other_user_id = next(pid for pid in participant_ids if pid != user_id)
                conversation = get_or_create_conversation(user_id, other_user_id, title)
            else:
                # Create group conversation
                conversation = Conversation(
                    title=title or f"Ομάδα {len(participant_ids)} μελών",
                    is_group=True
                )
                db.session.add(conversation)
                db.session.flush()
                
                # Add participants
                for participant_id in participant_ids:
                    participant = ConversationParticipant(
                        conversation_id=conversation.id,
                        user_id=participant_id,
                        role='admin' if participant_id == user_id else 'member'
                    )
                    db.session.add(participant)
                
                db.session.commit()
            
            return jsonify({
                'conversation': conversation.to_dict(),
                'message': 'Συζήτηση δημιουργήθηκε επιτυχώς'
            }), 201
            
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': str(e)}), 500
    
    @app.route('/api/conversations/<int:conversation_id>', methods=['GET'])
    @jwt_required()
    def get_conversation(conversation_id):
        """
        Get conversation details
        """
        try:
            user_info = get_current_user_info()
            user_id = user_info['id']
            
            # Check if user is participant
            participant = db.session.query(ConversationParticipant).filter(
                and_(
                    ConversationParticipant.conversation_id == conversation_id,
                    ConversationParticipant.user_id == user_id,
                    ConversationParticipant.is_active == True
                )
            ).first()
            
            if not participant:
                return jsonify({'error': 'Δεν έχετε πρόσβαση σε αυτή τη συζήτηση'}), 403
            
            conversation = db.session.query(Conversation).get(conversation_id)
            if not conversation:
                return jsonify({'error': 'Η συζήτηση δεν βρέθηκε'}), 404
            
            # Get all participants
            participants = db.session.query(ConversationParticipant).filter(
                and_(
                    ConversationParticipant.conversation_id == conversation_id,
                    ConversationParticipant.is_active == True
                )
            ).all()
            
            conversation_data = conversation.to_dict()
            conversation_data['participants'] = [p.to_dict() for p in participants]
            
            return jsonify({'conversation': conversation_data})
            
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    # ============================================================================
    # MESSAGE ENDPOINTS
    # ============================================================================
    
    @app.route('/api/conversations/<int:conversation_id>/messages', methods=['GET'])
    @jwt_required()
    def get_messages(conversation_id):
        """
        Get messages from a conversation with pagination
        """
        try:
            user_info = get_current_user_info()
            user_id = user_info['id']
            
            # Check if user is participant
            participant = db.session.query(ConversationParticipant).filter(
                and_(
                    ConversationParticipant.conversation_id == conversation_id,
                    ConversationParticipant.user_id == user_id,
                    ConversationParticipant.is_active == True
                )
            ).first()
            
            if not participant:
                return jsonify({'error': 'Δεν έχετε πρόσβαση σε αυτή τη συζήτηση'}), 403
            
            page = request.args.get('page', 1, type=int)
            per_page = min(request.args.get('per_page', 50, type=int), 100)
            
            # Get messages
            messages_query = db.session.query(PrivateMessage).filter(
                and_(
                    PrivateMessage.conversation_id == conversation_id,
                    PrivateMessage.is_deleted == False
                )
            ).order_by(desc(PrivateMessage.created_at))
            
            messages = messages_query.paginate(
                page=page, per_page=per_page, error_out=False
            )
            
            # Mark messages as read
            mark_messages_as_read(conversation_id, user_id)
            
            return jsonify({
                'messages': [msg.to_dict(include_read_receipts=True) for msg in reversed(messages.items)],
                'pagination': {
                    'page': messages.page,
                    'pages': messages.pages,
                    'per_page': messages.per_page,
                    'total': messages.total,
                    'has_next': messages.has_next,
                    'has_prev': messages.has_prev
                }
            })
            
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    @app.route('/api/conversations/<int:conversation_id>/messages', methods=['POST'])
    @jwt_required()
    def send_message(conversation_id):
        """
        Send a message to a conversation
        """
        try:
            user_info = get_current_user_info()
            user_id = user_info['id']
            
            # Check if user is participant
            participant = db.session.query(ConversationParticipant).filter(
                and_(
                    ConversationParticipant.conversation_id == conversation_id,
                    ConversationParticipant.user_id == user_id,
                    ConversationParticipant.is_active == True
                )
            ).first()
            
            if not participant:
                return jsonify({'error': 'Δεν έχετε πρόσβαση σε αυτή τη συζήτηση'}), 403
            
            data = request.get_json()
            content = data.get('content', '').strip()
            content_type = data.get('content_type', 'text')
            reply_to_id = data.get('reply_to_id')
            
            if not content:
                return jsonify({'error': 'Το μήνυμα δεν μπορεί να είναι κενό'}), 400
            
            # Create message
            message = PrivateMessage(
                conversation_id=conversation_id,
                sender_id=user_id,
                content=content,
                content_type=content_type,
                reply_to_id=reply_to_id
            )
            
            db.session.add(message)
            
            # Update conversation timestamp
            conversation = db.session.query(Conversation).get(conversation_id)
            if conversation:
                conversation.updated_at = datetime.utcnow()
            
            db.session.commit()
            
            return jsonify({
                'message': message.to_dict(),
                'success': 'Μήνυμα στάλθηκε επιτυχώς'
            }), 201
            
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': str(e)}), 500
    
    @app.route('/api/messages/<int:message_id>', methods=['PUT'])
    @jwt_required()
    def edit_message(message_id):
        """
        Edit a message (only by sender)
        """
        try:
            user_info = get_current_user_info()
            user_id = user_info['id']
            
            message = db.session.query(PrivateMessage).get(message_id)
            if not message:
                return jsonify({'error': 'Το μήνυμα δεν βρέθηκε'}), 404
            
            if message.sender_id != user_id:
                return jsonify({'error': 'Μπορείτε να επεξεργαστείτε μόνο τα δικά σας μηνύματα'}), 403
            
            data = request.get_json()
            new_content = data.get('content', '').strip()
            
            if not new_content:
                return jsonify({'error': 'Το μήνυμα δεν μπορεί να είναι κενό'}), 400
            
            message.content = new_content
            message.edited_at = datetime.utcnow()
            
            db.session.commit()
            
            return jsonify({
                'message': message.to_dict(),
                'success': 'Μήνυμα επεξεργάστηκε επιτυχώς'
            })
            
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': str(e)}), 500
    
    @app.route('/api/messages/<int:message_id>', methods=['DELETE'])
    @jwt_required()
    def delete_message(message_id):
        """
        Delete a message (only by sender)
        """
        try:
            user_info = get_current_user_info()
            user_id = user_info['id']
            
            message = db.session.query(PrivateMessage).get(message_id)
            if not message:
                return jsonify({'error': 'Το μήνυμα δεν βρέθηκε'}), 404
            
            if message.sender_id != user_id:
                return jsonify({'error': 'Μπορείτε να διαγράψετε μόνο τα δικά σας μηνύματα'}), 403
            
            message.is_deleted = True
            message.content = '[Μήνυμα διαγράφηκε]'
            
            db.session.commit()
            
            return jsonify({'success': 'Μήνυμα διαγράφηκε επιτυχώς'})
            
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': str(e)}), 500
    
    # ============================================================================
    # ATTACHMENT ENDPOINTS
    # ============================================================================
    
    @app.route('/api/messages/<int:message_id>/attachments', methods=['POST'])
    @jwt_required()
    def upload_message_attachment(message_id):
        """
        Upload attachment to a message
        """
        try:
            user_info = get_current_user_info()
            user_id = user_info['id']
            
            message = db.session.query(PrivateMessage).get(message_id)
            if not message:
                return jsonify({'error': 'Το μήνυμα δεν βρέθηκε'}), 404
            
            if message.sender_id != user_id:
                return jsonify({'error': 'Μπορείτε να προσθέσετε συνημμένα μόνο στα δικά σας μηνύματα'}), 403
            
            if 'file' not in request.files:
                return jsonify({'error': 'Δεν επιλέχθηκε αρχείο'}), 400
            
            file = request.files['file']
            if file.filename == '':
                return jsonify({'error': 'Δεν επιλέχθηκε αρχείο'}), 400
            
            if not allowed_file(file.filename):
                return jsonify({'error': 'Μη επιτρεπτός τύπος αρχείου'}), 400
            
            # Check file size
            file.seek(0, os.SEEK_END)
            file_size = file.tell()
            file.seek(0)
            
            if file_size > MAX_FILE_SIZE:
                return jsonify({'error': f'Το αρχείο είναι πολύ μεγάλο (μέγιστο {MAX_FILE_SIZE // (1024*1024)}MB)'}), 400
            
            # Generate unique filename
            original_filename = secure_filename(file.filename)
            file_extension = original_filename.rsplit('.', 1)[1].lower()
            stored_filename = f"{uuid.uuid4().hex}.{file_extension}"
            file_path = os.path.join(UPLOAD_FOLDER, stored_filename)
            
            # Save file
            file.save(file_path)
            
            # Determine file type and create thumbnail if image
            mime_type = mimetypes.guess_type(file_path)[0] or 'application/octet-stream'
            is_image = mime_type.startswith('image/')
            thumbnail_path = None
            
            if is_image:
                thumbnail_filename = f"thumb_{stored_filename}"
                thumbnail_path = os.path.join(UPLOAD_FOLDER, thumbnail_filename)
                if create_thumbnail(file_path, thumbnail_path):
                    thumbnail_path = thumbnail_filename
                else:
                    thumbnail_path = None
            
            # Update the message with attachment information
            message = PrivateMessage.query.get(message_id)
            if message:
                message.attachment_filename = original_filename
                message.attachment_path = file_path
                message.attachment_size = file_size
                message.attachment_mime_type = mime_type
                message.message_type = 'file' if not is_image else 'image'
            db.session.commit()
            
            return jsonify({
                'attachment': attachment.to_dict(),
                'success': 'Αρχείο ανέβηκε επιτυχώς'
            }), 201
            
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': str(e)}), 500
    
    @app.route('/api/message-attachments/<int:attachment_id>/download')
    @jwt_required()
    def download_message_attachment(attachment_id):
        """
        Download message attachment
        """
        try:
            # This endpoint may need to be updated to work with the new attachment structure
            # For now, return an error
            return jsonify({'error': 'Attachment download not yet implemented with new structure'}), 501
            
            # Check if user has access to the conversation
            message = db.session.query(PrivateMessage).get(attachment.message_id)
            participant = db.session.query(ConversationParticipant).filter(
                and_(
                    ConversationParticipant.conversation_id == message.conversation_id,
                    ConversationParticipant.user_id == user_id,
                    ConversationParticipant.is_active == True
                )
            ).first()
            
            if not participant:
                return jsonify({'error': 'Δεν έχετε πρόσβαση σε αυτό το αρχείο'}), 403
            
            if not os.path.exists(attachment.file_path):
                return jsonify({'error': 'Το αρχείο δεν βρέθηκε στον διακομιστή'}), 404
            
            return send_file(
                attachment.file_path,
                as_attachment=True,
                download_name=attachment.original_filename,
                mimetype=attachment.mime_type
            )
            
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    # ============================================================================
    # PRESENCE ENDPOINTS
    # ============================================================================
    
    @app.route('/api/users/presence', methods=['POST'])
    @jwt_required()
    def update_presence():
        """
        Update user presence status
        """
        try:
            user_info = get_current_user_info()
            user_id = user_info['id']
            
            data = request.get_json()
            status = data.get('status', 'online')
            custom_status = data.get('custom_status')
            
            if status not in ['online', 'away', 'busy', 'offline']:
                return jsonify({'error': 'Μη έγκυρη κατάσταση'}), 400
            
            presence = update_user_presence(user_id, status, custom_status)
            
            return jsonify({
                'presence': presence.to_dict(),
                'success': 'Κατάσταση ενημερώθηκε επιτυχώς'
            })
            
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    @app.route('/api/users/<int:user_id>/presence', methods=['GET'])
    @jwt_required()
    def get_user_presence(user_id):
        """
        Get user presence status
        """
        try:
            presence = db.session.query(UserPresence).filter_by(user_id=user_id).first()
            
            if not presence:
                # Create default presence
                presence = UserPresence(user_id=user_id, status='offline')
                db.session.add(presence)
                db.session.commit()
            
            return jsonify({'presence': presence.to_dict()})
            
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    @app.route('/api/users/unread-count', methods=['GET'])
    @jwt_required()
    def get_unread_count():
        """
        Get total unread message count for current user
        """
        try:
            user_info = get_current_user_info()
            user_id = user_info['id']
            
            unread_count = get_unread_count(user_id)
            
            return jsonify({'unread_count': unread_count})
            
        except Exception as e:
            return jsonify({'error': str(e)}), 500

