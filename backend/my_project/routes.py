"""
Flask Routes for SW Portal
Consolidated routes file containing all Flask endpoints organized in a Blueprint
"""

from flask import Blueprint, jsonify, request, send_from_directory, send_file, current_app
import os
from datetime import datetime
from werkzeug.utils import secure_filename

# Import db and models from the new consolidated structure
from .extensions import db
from .models import (
    User, Category, Discussion, Post, FileItem, Notification,
    PostAttachment, PostReaction, PostMention, UserReputation,
    Conversation, ConversationParticipant, PrivateMessage,
    MessageAttachment, MessageReadReceipt, UserPresence,
    UserProfile, UserContact, UserBlock
)

# Create Blueprint
main_bp = Blueprint('main', __name__)

# Utility functions
def get_file_type(filename):
    """Determine file type based on extension."""
    extension = filename.split('.')[-1].lower() if '.' in filename else ''
    type_map = {
        'pdf': 'pdf',
        'doc': 'document', 'docx': 'document',
        'txt': 'text', 'md': 'text',
        'xlsx': 'spreadsheet', 'xls': 'spreadsheet',
        'ppt': 'presentation', 'pptx': 'presentation',
        'zip': 'archive', 'rar': 'archive', '7z': 'archive',
        'jpg': 'image', 'jpeg': 'image', 'png': 'image', 'gif': 'image',
        'mp4': 'video', 'avi': 'video', 'mov': 'video',
        'mp3': 'audio', 'wav': 'audio',
    }
    return type_map.get(extension, 'file')

def scan_content_directory():
    """Scan content directory and return file structure"""
    content_dir = current_app.config['UPLOAD_FOLDER']
    if not os.path.exists(content_dir):
        os.makedirs(content_dir)
        return []

    def scan_recursive(path, relative_path=""):
        items = []
        try:
            for item in os.listdir(path):
                if item.startswith('.'):
                    continue
                    
                item_path = os.path.join(path, item)
                relative_item_path = os.path.join(relative_path, item) if relative_path else item
                
                if os.path.isdir(item_path):
                    items.append({
                        'id': relative_item_path.replace(os.sep, '_').replace(' ', '_'),
                        'category': item,
                        'path': relative_item_path.replace('\\', '/'),
                        'files': [],
                        'subfolders': scan_recursive(item_path, relative_item_path)
                    })
                else:
                    file_info = {
                        'name': item,
                        'path': relative_item_path.replace('\\', '/'),
                        'size': os.path.getsize(item_path),
                        'modified': datetime.fromtimestamp(os.path.getmtime(item_path)).isoformat(),
                        'type': get_file_type(item)
                    }
                    items.append(file_info)
        except PermissionError:
            pass
        return items

    return scan_recursive(content_dir)


# ============================================================================
# AUTHENTICATION ROUTES
# ============================================================================

@main_bp.route('/api/auth/login', methods=['POST'])
def login():
    """User login endpoint"""
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({'error': 'Username and password required'}), 400
    
    user = User.query.filter_by(username=username).first()
    
    if user and user.check_password(password):
        # Update last seen
        user.last_seen = datetime.utcnow()
        user.presence_status = 'online'
        db.session.commit()
        
        return jsonify({
            'message': 'Login successful',
            'user': user.to_dict()
        })
    else:
        return jsonify({'error': 'Invalid credentials'}), 401


@main_bp.route('/api/auth/register', methods=['POST'])
def register():
    """User registration endpoint"""
    data = request.get_json()
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    
    if not username or not email or not password:
        return jsonify({'error': 'Username, email and password required'}), 400
    
    # Check if user already exists
    if User.query.filter_by(username=username).first():
        return jsonify({'error': 'Username already exists'}), 400
    
    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'Email already exists'}), 400
    
    # Create new user
    user = User(username=username, email=email, role='guest')
    user.set_password(password)
    
    db.session.add(user)
    db.session.commit()
    
    return jsonify({
        'message': 'User created successfully',
        'user': user.to_dict()
    }), 201


@main_bp.route('/api/auth/me', methods=['GET'])
def get_current_user():
    """Get current user info"""
    # Simplified - in a real app you'd validate JWT tokens
    return jsonify({
        'id': 1,
        'username': 'admin',
        'email': 'admin@portal.gr',
        'role': 'admin'
    })


@main_bp.route('/api/auth/logout', methods=['POST'])
def logout():
    """User logout endpoint"""
    return jsonify({'message': 'Logout successful'})


@main_bp.route('/api/auth/users', methods=['GET'])
def get_users():
    """Get all users"""
    users = User.query.all()
    return jsonify([user.to_dict() for user in users])


# ============================================================================
# FORUM ROUTES
# ============================================================================

@main_bp.route('/api/categories', methods=['GET'])
def get_categories():
    """Get all forum categories"""
    categories = Category.query.all()
    return jsonify([{
        'id': cat.id,
        'title': cat.title,
        'description': cat.description,
        'discussion_count': len(cat.discussions)
    } for cat in categories])


@main_bp.route('/api/discussions', methods=['GET'])
def get_discussions():
    """Get all discussions grouped by category"""
    discussions = Discussion.query.all()
    
    categorized_discussions = {}
    for discussion in discussions:
        cat_title = discussion.category.title
        if cat_title not in categorized_discussions:
            categorized_discussions[cat_title] = {
                'category': discussion.category.title,
                'description': discussion.category.description,
                'discussions': []
            }
        
        last_post = discussion.last_post
        categorized_discussions[cat_title]['discussions'].append({
            'id': discussion.id,
            'title': discussion.title,
            'description': discussion.description,
            'post_count': discussion.post_count,
            'created_at': discussion.created_at.isoformat(),
            'updated_at': discussion.updated_at.isoformat(),
            'last_post': {
                'content': last_post.content[:100] + '...' if last_post and len(last_post.content) > 100 else last_post.content if last_post else '',
                'user': last_post.user.username if last_post else '',
                'created_at': last_post.created_at.isoformat() if last_post else ''
            } if last_post else None
        })
    
    return jsonify(list(categorized_discussions.values()))


@main_bp.route('/api/discussions', methods=['POST'])
def create_discussion():
    """Create a new discussion"""
    data = request.get_json()
    
    discussion = Discussion(
        title=data['title'],
        description=data.get('description', ''),
        category_id=data['category_id'],
        user_id=1  # Simplified - get from auth context
    )
    
    db.session.add(discussion)
    db.session.commit()
    
    return jsonify({'message': 'Discussion created', 'id': discussion.id}), 201


@main_bp.route('/api/discussions/<int:discussion_id>/posts', methods=['GET'])
def get_posts(discussion_id):
    """Get all posts in a discussion"""
    discussion = Discussion.query.get_or_404(discussion_id)
    posts = Post.query.filter_by(discussion_id=discussion_id).all()
    
    return jsonify({
        'discussion': {
            'id': discussion.id,
            'title': discussion.title,
            'description': discussion.description,
            'category': discussion.category.title
        },
        'posts': [{
            'id': post.id,
            'content': post.content,
            'user': post.user.username,
            'created_at': post.created_at.isoformat(),
            'reactions': post.get_reactions_summary(),
            'attachment_count': post.get_attachment_count()
        } for post in posts]
    })


@main_bp.route('/api/discussions/<int:discussion_id>/posts', methods=['POST'])
def create_post(discussion_id):
    """Create a new post in a discussion"""
    discussion = Discussion.query.get_or_404(discussion_id)
    data = request.get_json()
    
    post = Post(
        content=data['content'],
        discussion_id=discussion_id,
        user_id=1  # Simplified - get from auth context
    )
    
    db.session.add(post)
    db.session.commit()
    
    return jsonify({'message': 'Post created', 'id': post.id}), 201


@main_bp.route('/api/posts/<int:post_id>/reactions', methods=['POST'])
def add_reaction(post_id):
    """Add reaction to a post"""
    post = Post.query.get_or_404(post_id)
    data = request.get_json()
    reaction_type = data.get('reaction_type', 'like')
    user_id = 1  # Simplified - get from auth context
    
    # Check if user already reacted
    existing_reaction = PostReaction.query.filter_by(
        post_id=post_id, user_id=user_id
    ).first()
    
    if existing_reaction:
        if existing_reaction.reaction_type == reaction_type:
            # Remove reaction
            db.session.delete(existing_reaction)
        else:
            # Update reaction
            existing_reaction.reaction_type = reaction_type
    else:
        # Add new reaction
        reaction = PostReaction(
            post_id=post_id,
            user_id=user_id,
            reaction_type=reaction_type
        )
        db.session.add(reaction)
    
    db.session.commit()
    return jsonify({'message': 'Reaction updated'})


@main_bp.route('/api/posts/<int:post_id>/reactions', methods=['GET'])
def get_reactions(post_id):
    """Get reactions for a post"""
    post = Post.query.get_or_404(post_id)
    return jsonify(post.get_reactions_summary())


# ============================================================================
# FILE MANAGEMENT ROUTES
# ============================================================================

@main_bp.route('/api/files/structure', methods=['GET'])
def get_file_structure():
    """Get file directory structure"""
    return jsonify(scan_content_directory())


@main_bp.route('/api/files/download/<path:file_path>', methods=['GET'])
def download_file(file_path):
    """Download a file"""
    content_dir = current_app.config['UPLOAD_FOLDER']
    full_path = os.path.join(content_dir, file_path)
    
    if not os.path.exists(full_path) or not os.path.isfile(full_path):
        return jsonify({'error': 'File not found'}), 404
    
    return send_file(full_path, as_attachment=True)


@main_bp.route('/api/files/upload', methods=['POST'])
def upload_file():
    """Upload a file"""
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    category = request.form.get('category', 'uploads')
    
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    if file:
        filename = secure_filename(file.filename)
        category_path = os.path.join(current_app.config['UPLOAD_FOLDER'], category)
        os.makedirs(category_path, exist_ok=True)
        
        file_path = os.path.join(category_path, filename)
        file.save(file_path)
        
        # Save to database
        file_item = FileItem(
            name=filename,
            original_name=file.filename,
            path=os.path.join(category, filename),
            category=category,
            file_type=get_file_type(filename),
            file_size=os.path.getsize(file_path),
            uploaded_by=1  # Simplified - get from auth context
        )
        
        db.session.add(file_item)
        db.session.commit()
        
        return jsonify({'message': 'File uploaded successfully', 'id': file_item.id}), 201


@main_bp.route('/api/folders/create', methods=['POST'])
def create_folder():
    """Create a new folder"""
    data = request.get_json()
    folder_name = data.get('name')
    parent_path = data.get('parent', '')
    
    if not folder_name:
        return jsonify({'error': 'Folder name required'}), 400
    
    folder_path = os.path.join(current_app.config['UPLOAD_FOLDER'], parent_path, folder_name)
    
    try:
        os.makedirs(folder_path, exist_ok=True)
        return jsonify({'message': 'Folder created successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ============================================================================
# MESSAGING ROUTES
# ============================================================================

@main_bp.route('/api/conversations', methods=['GET'])
def get_conversations():
    """Get user conversations"""
    user_id = 1  # Simplified - get from auth context
    
    conversations = db.session.query(Conversation).join(ConversationParticipant).filter(
        ConversationParticipant.user_id == user_id,
        ConversationParticipant.is_active == True
    ).all()
    
    return jsonify([{
        'id': conv.id,
        'title': conv.title,
        'is_group': conv.is_group,
        'updated_at': conv.updated_at.isoformat(),
        'participant_count': len(conv.participants),
        'message_count': len(conv.messages)
    } for conv in conversations])


@main_bp.route('/api/conversations', methods=['POST'])
def create_conversation():
    """Create a new conversation"""
    data = request.get_json()
    participant_ids = data.get('participants', [])
    title = data.get('title')
    
    conversation = Conversation(
        title=title,
        is_group=len(participant_ids) > 2
    )
    
    db.session.add(conversation)
    db.session.flush()  # Get the ID
    
    # Add participants
    for user_id in participant_ids:
        participant = ConversationParticipant(
            conversation_id=conversation.id,
            user_id=user_id
        )
        db.session.add(participant)
    
    db.session.commit()
    
    return jsonify({'message': 'Conversation created', 'id': conversation.id}), 201


@main_bp.route('/api/conversations/<int:conversation_id>/messages', methods=['GET'])
def get_messages(conversation_id):
    """Get messages in a conversation"""
    messages = PrivateMessage.query.filter_by(
        conversation_id=conversation_id,
        is_deleted=False
    ).order_by(PrivateMessage.created_at).all()
    
    return jsonify([{
        'id': msg.id,
        'content': msg.content,
        'sender_id': msg.sender_id,
        'sender': msg.sender.username,
        'created_at': msg.created_at.isoformat(),
        'message_type': msg.message_type,
        'attachment_count': len(msg.attachments)
    } for msg in messages])


@main_bp.route('/api/conversations/<int:conversation_id>/messages', methods=['POST'])
def send_message(conversation_id):
    """Send a message in a conversation"""
    data = request.get_json()
    
    message = PrivateMessage(
        conversation_id=conversation_id,
        sender_id=1,  # Simplified - get from auth context
        content=data['content'],
        content_type=data.get('content_type', 'text')
    )
    
    db.session.add(message)
    
    # Update conversation timestamp
    conversation = Conversation.query.get(conversation_id)
    conversation.updated_at = datetime.utcnow()
    
    db.session.commit()
    
    return jsonify({'message': 'Message sent', 'id': message.id}), 201


# ============================================================================
# USER PROFILE ROUTES
# ============================================================================

@main_bp.route('/api/users/<int:user_id>/profile', methods=['GET'])
def get_user_profile(user_id):
    """Get user profile"""
    user = User.query.get_or_404(user_id)
    profile = UserProfile.query.filter_by(user_id=user_id).first()
    
    result = user.to_dict()
    if profile:
        result.update({
            'display_name': profile.display_name,
            'bio': profile.bio,
            'location': profile.location,
            'website': profile.website,
            'avatar_url': profile.avatar_url
        })
    
    return jsonify(result)


@main_bp.route('/api/users/profile', methods=['PUT'])
def update_user_profile():
    """Update user profile"""
    user_id = 1  # Simplified - get from auth context
    data = request.get_json()
    
    profile = UserProfile.query.filter_by(user_id=user_id).first()
    if not profile:
        profile = UserProfile(user_id=user_id)
        db.session.add(profile)
    
    # Update profile fields
    for field in ['display_name', 'bio', 'location', 'website', 'avatar_url']:
        if field in data:
            setattr(profile, field, data[field])
    
    profile.updated_at = datetime.utcnow()
    db.session.commit()
    
    return jsonify({'message': 'Profile updated'})


# ============================================================================
# NOTIFICATION ROUTES
# ============================================================================

@main_bp.route('/api/notifications', methods=['GET'])
def get_notifications():
    """Get user notifications"""
    user_id = 1  # Simplified - get from auth context
    
    notifications = Notification.query.filter_by(user_id=user_id).order_by(
        Notification.created_at.desc()
    ).limit(50).all()
    
    return jsonify([{
        'id': notif.id,
        'title': notif.title,
        'content': notif.content,
        'type': notif.notification_type,
        'is_read': notif.is_read,
        'created_at': notif.created_at.isoformat(),
        'action_url': notif.action_url
    } for notif in notifications])


@main_bp.route('/api/notifications/mark-as-read', methods=['POST'])
def mark_notifications_read():
    """Mark notifications as read"""
    data = request.get_json()
    notification_ids = data.get('notification_ids', [])
    user_id = 1  # Simplified - get from auth context
    
    Notification.query.filter(
        Notification.id.in_(notification_ids),
        Notification.user_id == user_id
    ).update({'is_read': True, 'read_at': datetime.utcnow()})
    
    db.session.commit()
    
    return jsonify({'message': 'Notifications marked as read'})


# ============================================================================
# AI CHAT ROUTES
# ============================================================================

@main_bp.route('/api/chat', methods=['POST'])
def ai_chat():
    """AI chat endpoint"""
    data = request.get_json()
    message = data.get('message', '')
    
    try:
        if hasattr(current_app, 'client') and current_app.client:
            # Simplified AI response - in real implementation would use OpenAI API
            reply = f"AI Response to: {message}"
        else:
            reply = f'Λυπάμαι, το AI Assistant δεν είναι διαθέσιμο αυτή τη στιγμή. Το μήνυμά σας ήταν: "{message}"'
        
        return jsonify({'response': reply})
    except Exception as e:
        print(f"Error during AI request: {e}")
        return jsonify({
            'response': f'Λυπάμαι, το AI Assistant δεν είναι διαθέσιμο αυτή τη στιγμή. Το μήνυμά σας ήταν: "{message}"'
        })


# ============================================================================
# UTILITY ROUTES
# ============================================================================

@main_bp.route('/content/<path:filename>')
def serve_content(filename):
    """Serve files from the content directory"""
    return send_from_directory(current_app.config['UPLOAD_FOLDER'], filename)


@main_bp.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'version': '1.0.0',
        'components': {
            'database': 'connected',
            'files': 'accessible',
            'ai_assistant': 'configured' if hasattr(current_app, 'client') and current_app.client else 'not_configured'
        }
    })


@main_bp.route('/api/user/permissions', methods=['GET'])
def get_user_permissions():
    """Get current user permissions"""
    return jsonify({
        'role': 'admin',
        'permissions': ['read', 'write', 'admin']
    })


# ============================================================================
# FRONTEND SERVING (for development)
# ============================================================================

@main_bp.route('/', defaults={'path': ''})
@main_bp.route('/<path:path>')
def serve_frontend(path):
    """Serve frontend files (for development only)"""
    build_dir = os.path.join(current_app.root_path, '..', 'frontend', 'dist')
    if path != "" and os.path.exists(os.path.join(build_dir, path)):
        return send_from_directory(build_dir, path)
    else:
        # Return a simple JSON response if frontend build doesn't exist
        return jsonify({'message': 'SW Portal Backend API is running'})