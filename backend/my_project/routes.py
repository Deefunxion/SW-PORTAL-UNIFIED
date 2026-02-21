"""
Flask Routes for ΠΥΛΗ ΚΟΙΝΩΝΙΚΗΣ ΜΕΡΙΜΝΑΣ
Consolidated routes file containing all Flask endpoints organized in a Blueprint
"""

from flask import Blueprint, jsonify, request, send_from_directory, send_file, current_app
import os
from datetime import datetime, timedelta
from werkzeug.utils import secure_filename
from flask_jwt_extended import jwt_required, get_jwt_identity, create_access_token

# Import db and models from the new consolidated structure
from .extensions import db, limiter
from .audit import log_action
from .models import (
    User, Category, Discussion, Post, FileItem, Notification,
    PostAttachment, PostReaction, PostMention, UserReputation,
    Conversation, ConversationParticipant, PrivateMessage,
    MessageAttachment, MessageReadReceipt, UserPresence,
    UserProfile, UserContact, UserBlock,
    ChatSession, ChatMessage,
    DocumentIndex, FileChunk
)

# Create Blueprint
main_bp = Blueprint('main', __name__)

# Utility functions
def get_file_type(filename):
    """Determine file type based on extension with enhanced categorization."""
    extension = filename.split('.')[-1].lower() if '.' in filename else ''
    type_map = {
        'pdf': 'pdf',
        'doc': 'document', 'docx': 'document', 'odt': 'document', 'rtf': 'document',
        'txt': 'text', 'md': 'text', 'rst': 'text', 'csv': 'text',
        'xlsx': 'spreadsheet', 'xls': 'spreadsheet', 'ods': 'spreadsheet',
        'ppt': 'presentation', 'pptx': 'presentation', 'odp': 'presentation',
        'zip': 'archive', 'rar': 'archive', '7z': 'archive', 'tar': 'archive', 'gz': 'archive',
        'jpg': 'image', 'jpeg': 'image', 'png': 'image', 'gif': 'image', 'bmp': 'image', 'svg': 'image', 'webp': 'image',
        'mp4': 'video', 'avi': 'video', 'mov': 'video', 'wmv': 'video', 'mkv': 'video', 'webm': 'video',
        'mp3': 'audio', 'wav': 'audio', 'flac': 'audio', 'aac': 'audio', 'ogg': 'audio',
        'html': 'web', 'htm': 'web', 'css': 'web', 'js': 'web', 'json': 'web',
        'py': 'code', 'java': 'code', 'cpp': 'code', 'c': 'code', 'php': 'code',
    }
    return type_map.get(extension, 'file')

def format_file_size(size_bytes):
    """Format file size in human readable format."""
    if size_bytes == 0:
        return "0 B"
    
    size_names = ["B", "KB", "MB", "GB", "TB"]
    import math
    i = int(math.floor(math.log(size_bytes, 1024)))
    p = math.pow(1024, i)
    s = round(size_bytes / p, 2)
    return f"{s} {size_names[i]}"

def scan_content_directory():
    """Scan content directory and return file structure"""
    content_dir = current_app.config['UPLOAD_FOLDER']
    # Make sure we have absolute path
    if not os.path.isabs(content_dir):
        content_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), content_dir)
    
    if not os.path.exists(content_dir):
        os.makedirs(content_dir)
        return []

    def list_items(path):
        """List directory items, handling Greek filenames"""
        try:
            return os.listdir(path)
        except UnicodeDecodeError:
            import glob
            return [os.path.basename(p) for p in glob.glob(os.path.join(path, '*'))]

    def make_file_info(name, rel_path, abs_path):
        """Create a file info dict"""
        return {
            'name': name,
            'path': rel_path,
            'size': os.path.getsize(abs_path),
            'modified': datetime.fromtimestamp(os.path.getmtime(abs_path)).isoformat(),
            'type': get_file_type(name)
        }

    def scan_folder(abs_path, rel_path):
        """Scan a folder and return its files and subfolders recursively"""
        files = []
        subfolders = []

        try:
            items = list_items(abs_path)
        except (OSError, PermissionError):
            return files, subfolders

        for item in sorted(items):
            if item.startswith('.'):
                continue
            item_abs = os.path.join(abs_path, item)
            item_rel = f"{rel_path}/{item}" if rel_path else item

            if os.path.isdir(item_abs):
                sub_files, sub_subfolders = scan_folder(item_abs, item_rel)
                subfolders.append({
                    'name': item,
                    'path': item_rel,
                    'files': sub_files,
                    'subfolders': sub_subfolders
                })
            elif os.path.isfile(item_abs):
                try:
                    files.append(make_file_info(item, item_rel, item_abs))
                except (OSError, PermissionError):
                    continue

        return files, subfolders

    # Scan root: each top-level directory becomes a category
    categories = []
    skip = {'.', 'uploads', 'welcome.txt', 'README.md'}
    try:
        root_items = list_items(content_dir)
    except (OSError, PermissionError):
        return []

    for item in sorted(root_items):
        if item.startswith('.') or item in skip:
            continue
        item_path = os.path.join(content_dir, item)
        if not os.path.isdir(item_path):
            continue

        files, subfolders = scan_folder(item_path, item)
        categories.append({
            'id': item.replace(' ', '_').replace('/', '_').replace('\\', '_'),
            'name': item,
            'category': item,
            'path': item,
            'files': files,
            'subfolders': subfolders
        })

    return categories


# ============================================================================
# AUTHENTICATION ROUTES
# ============================================================================

@main_bp.route('/api/auth/login', methods=['POST'])
@limiter.limit("30 per minute")
def login():
    """User login endpoint"""
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({'error': 'Username and password required'}), 400
    
    user = User.query.filter_by(username=username).first()

    if user and not getattr(user, 'is_active', True):
        log_action('login_blocked', resource='auth', details=f'inactive user={username}')
        return jsonify({'error': 'Ο λογαριασμός σας έχει απενεργοποιηθεί. Επικοινωνήστε με τον διαχειριστή.'}), 403

    if user and user.check_password(password):
        # Update last seen
        user.last_seen = datetime.utcnow()
        user.presence_status = 'online'
        db.session.commit()

        # Generate JWT token (identity must be string)
        access_token = create_access_token(identity=str(user.id))

        log_action('login', resource='auth', user_id=user.id)

        return jsonify({
            'message': 'Login successful',
            'access_token': access_token,
            'user': user.to_dict()
        })
    else:
        log_action('login_failed', resource='auth', details=f'username={username}')
        return jsonify({'error': 'Λανθασμένα στοιχεία σύνδεσης'}), 401


@main_bp.route('/api/auth/register', methods=['POST'])
@jwt_required()
def register():
    """User registration endpoint (admin only)"""
    admin_check = require_admin()
    if admin_check:
        return admin_check
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


@main_bp.route('/api/auth/verify', methods=['GET'])
@jwt_required()
def verify_token():
    """Verify JWT token is still valid and return current user."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    return jsonify({'valid': True, 'user': user.to_dict()})


@main_bp.route('/api/auth/me', methods=['GET'])
@jwt_required()
def get_current_user():
    """Get current user info with enhanced user data"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if not user:
        return jsonify({'error': 'User not found'}), 404

    user_data = user.to_dict()
    # Add additional computed fields
    user_data['permissions'] = get_user_permissions_list(user.role)
    user_data['last_active'] = user.last_seen.isoformat() if user.last_seen else None
    return jsonify(user_data)

def get_user_permissions_list(role):
    """Get list of permissions based on user role."""
    permission_map = {
        'admin': ['read', 'write', 'admin', 'can_access_admin_dashboard', 'can_moderate', 'can_manage_users'],
        'staff': ['read', 'write', 'can_moderate'],
        'guest': ['read']
    }
    return permission_map.get(role, ['read'])


def require_admin():
    """Check if current user is admin. Returns error response or None."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if not user or user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403
    return None


@main_bp.route('/api/auth/logout', methods=['POST'])
def logout():
    """User logout endpoint"""
    return jsonify({'message': 'Logout successful'})


@main_bp.route('/api/auth/users', methods=['GET'])
@jwt_required()
def get_users():
    """Get all users (admin only)"""
    admin_check = require_admin()
    if admin_check:
        return admin_check
    users = User.query.all()
    return jsonify([user.to_dict() for user in users])


# ============================================================================
# FORUM ROUTES
# ============================================================================

@main_bp.route('/api/categories', methods=['GET'])
def get_categories():
    """Get all forum categories"""
    from sqlalchemy.orm import selectinload
    categories = Category.query.options(selectinload(Category.discussions)).all()
    return jsonify([{
        'id': cat.id,
        'title': cat.title,
        'description': cat.description,
        'discussion_count': len(cat.discussions)
    } for cat in categories])


@main_bp.route('/api/discussions', methods=['GET'])
def get_discussions():
    """Get all discussions grouped by category"""
    from sqlalchemy.orm import joinedload, selectinload
    discussions = Discussion.query.options(
        joinedload(Discussion.category),
        selectinload(Discussion.posts).joinedload(Post.user)
    ).all()
    
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
@jwt_required()
def create_discussion():
    """Create a new discussion"""
    data = request.get_json()
    user_id = int(get_jwt_identity())

    discussion = Discussion(
        title=data['title'],
        description=data.get('description', ''),
        category_id=data['category_id'],
        user_id=user_id
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
@jwt_required()
def create_post(discussion_id):
    """Create a new post in a discussion"""
    discussion = Discussion.query.get_or_404(discussion_id)
    data = request.get_json()
    user_id = int(get_jwt_identity())

    post = Post(
        content=data['content'],
        discussion_id=discussion_id,
        user_id=user_id
    )

    db.session.add(post)
    db.session.commit()

    return jsonify({'message': 'Post created', 'id': post.id}), 201


@main_bp.route('/api/posts/<int:post_id>/reactions', methods=['POST'])
@jwt_required()
def add_reaction(post_id):
    """Add reaction to a post"""
    post = Post.query.get_or_404(post_id)
    data = request.get_json()
    reaction_type = data.get('reaction_type', 'like')
    user_id = int(get_jwt_identity())

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
    """Get file directory structure with enhanced metadata"""
    try:
        structure = scan_content_directory()
        
        # Calculate metadata
        total_files = 0
        total_size = 0
        file_types = {}
        
        def count_files(items):
            """Recursively count files in a list of file-info dicts or folder dicts."""
            nonlocal total_files, total_size, file_types
            for item in items:
                if 'files' in item:  # It's a folder/category — recurse
                    count_files(item['files'])
                    if 'subfolders' in item:
                        count_files(item['subfolders'])
                else:  # It's a file
                    total_files += 1
                    total_size += item.get('size', 0)
                    file_type = item.get('type', 'unknown')
                    file_types[file_type] = file_types.get(file_type, 0) + 1

        count_files(structure)
        
        return jsonify({
            'categories': structure,
            'metadata': {
                'total_files': total_files,
                'total_size': total_size,
                'total_size_formatted': format_file_size(total_size),
                'file_types': file_types,
                'last_updated': datetime.now().isoformat()
            },
            'status': 'success'
        })
    except Exception as e:
        current_app.logger.error(f"Error getting file structure: {str(e)}")
        return jsonify({
            'error': 'Failed to retrieve file structure',
            'status': 'error'
        }), 500


@main_bp.route('/api/files/download/<path:file_path>', methods=['GET'])
def download_file(file_path):
    """Download a file"""
    content_dir = current_app.config['UPLOAD_FOLDER']
    if not os.path.isabs(content_dir):
        content_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), content_dir)
    full_path = os.path.join(content_dir, file_path)
    
    if not os.path.exists(full_path) or not os.path.isfile(full_path):
        return jsonify({'error': 'File not found'}), 404
    
    return send_file(full_path, as_attachment=True)


@main_bp.route('/api/files/upload', methods=['POST'])
@jwt_required()
def upload_file():
    """Upload a file"""
    uploaded_files = request.files.getlist('file')
    if not uploaded_files or all(f.filename == '' for f in uploaded_files):
        return jsonify({'error': 'No file provided'}), 400

    category = request.form.get('category', 'uploads')
    user_id = int(get_jwt_identity())

    category_path = os.path.join(current_app.config['UPLOAD_FOLDER'], category)
    os.makedirs(category_path, exist_ok=True)

    saved = []
    for file in uploaded_files:
        if not file or file.filename == '':
            continue
        filename = secure_filename(file.filename)
        file_path = os.path.join(category_path, filename)
        file.save(file_path)

        file_item = FileItem(
            name=filename,
            original_name=file.filename,
            path=os.path.join(category, filename),
            category=category,
            file_type=get_file_type(filename),
            file_size=os.path.getsize(file_path),
            uploaded_by=user_id
        )
        db.session.add(file_item)
        saved.append(file_item)

    db.session.commit()
    for item in saved:
        log_action('upload', resource='file', resource_id=item.id, user_id=user_id)

    return jsonify({
        'message': f'{len(saved)} file(s) uploaded successfully',
        'ids': [item.id for item in saved]
    }), 201


@main_bp.route('/api/folders/create', methods=['POST'])
@jwt_required()
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
@jwt_required()
def get_conversations():
    """Get user conversations"""
    user_id = int(get_jwt_identity())

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
@jwt_required()
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
@jwt_required()
def get_messages(conversation_id):
    """Get messages in a conversation (paginated)"""
    page = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 50, type=int), 100)
    pagination = PrivateMessage.query.filter_by(
        conversation_id=conversation_id,
        is_deleted=False
    ).order_by(PrivateMessage.created_at).paginate(
        page=page, per_page=per_page, error_out=False)

    return jsonify({
        'messages': [{
            'id': msg.id,
            'content': msg.content,
            'sender_id': msg.sender_id,
            'sender': msg.sender.username,
            'created_at': msg.created_at.isoformat(),
            'message_type': msg.message_type,
            'attachment_count': len(msg.attachments)
        } for msg in pagination.items],
        'total': pagination.total,
        'page': page,
        'pages': pagination.pages,
    })


@main_bp.route('/api/conversations/<int:conversation_id>/messages', methods=['POST'])
@jwt_required()
def send_message(conversation_id):
    """Send a message in a conversation"""
    data = request.get_json()
    user_id = int(get_jwt_identity())

    message = PrivateMessage(
        conversation_id=conversation_id,
        sender_id=user_id,
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
@jwt_required()
def update_user_profile():
    """Update user profile"""
    user_id = int(get_jwt_identity())
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
@jwt_required()
def get_notifications():
    """Get user notifications"""
    user_id = int(get_jwt_identity())

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
@jwt_required()
def mark_notifications_read():
    """Mark notifications as read"""
    data = request.get_json()
    notification_ids = data.get('notification_ids', [])
    user_id = int(get_jwt_identity())

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
@jwt_required()
@limiter.limit(lambda: current_app.config.get('AI_CHAT_RATE_LIMIT', '20 per minute'))
def ai_chat():
    """AI Assistant — chat with RAG context from social welfare documents."""
    data = request.get_json()
    message = data.get('message', '').strip()

    if not message:
        return jsonify({'error': 'Παρακαλώ εισάγετε μήνυμα'}), 400

    chat_history = data.get('chat_history', [])
    session_id = data.get('session_id')

    # If session_id provided, verify ownership and store user message
    user_id = int(get_jwt_identity())
    session = None
    if session_id:
        session = ChatSession.query.filter_by(id=session_id, user_id=user_id).first()
        if session:
            db.session.add(ChatMessage(
                session_id=session.id, role='user', content=message, sources='[]'
            ))
            try:
                db.session.commit()
            except Exception:
                db.session.rollback()

    user = db.session.get(User, user_id)
    user_context = {
        'username': user.username,
        'role': user.role,
    } if user else None

    try:
        from my_project.ai.copilot import get_chat_reply
        model_override = data.get('model')
        result = get_chat_reply(
            user_message=message,
            chat_history=chat_history,
            use_rag=True,
            user_context=user_context,
            model_override=model_override,
        )
    except Exception:
        result = {
            'reply': 'Λυπάμαι, αντιμετώπισα τεχνικό πρόβλημα. Παρακαλώ δοκιμάστε ξανά.',
            'sources': [],
        }

    # Store assistant reply in session
    if session:
        import json
        db.session.add(ChatMessage(
            session_id=session.id,
            role='assistant',
            content=result['reply'],
            sources=json.dumps(result.get('sources', [])),
        ))
        try:
            db.session.commit()
        except Exception:
            db.session.rollback()

    return jsonify(result), 200


# ============================================================================
# CHAT SESSION ROUTES
# ============================================================================

@main_bp.route('/api/chat/sessions', methods=['POST'])
@jwt_required()
def create_chat_session():
    """Create a new chat session."""
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}
    session = ChatSession(
        user_id=user_id,
        title=data.get('title', 'Νέα Συζήτηση')[:200],
    )
    db.session.add(session)
    db.session.commit()
    return jsonify(session.to_dict()), 201


@main_bp.route('/api/chat/sessions', methods=['GET'])
@jwt_required()
def list_chat_sessions():
    """List current user's chat sessions (newest first)."""
    user_id = int(get_jwt_identity())
    sessions = ChatSession.query.filter_by(user_id=user_id)\
        .order_by(ChatSession.updated_at.desc()).all()
    return jsonify([s.to_dict() for s in sessions]), 200


@main_bp.route('/api/chat/sessions/<int:session_id>/messages', methods=['GET'])
@jwt_required()
def get_session_messages(session_id):
    """Get all messages in a chat session."""
    user_id = int(get_jwt_identity())
    session = ChatSession.query.filter_by(id=session_id, user_id=user_id).first()
    if not session:
        return jsonify({'error': 'Session not found'}), 404
    messages = session.messages.all()
    return jsonify([m.to_dict() for m in messages]), 200


@main_bp.route('/api/chat/sessions/<int:session_id>', methods=['DELETE'])
@jwt_required()
def delete_chat_session(session_id):
    """Delete a chat session and all its messages."""
    user_id = int(get_jwt_identity())
    session = ChatSession.query.filter_by(id=session_id, user_id=user_id).first()
    if not session:
        return jsonify({'error': 'Session not found'}), 404
    db.session.delete(session)
    db.session.commit()
    return jsonify({'message': 'Session deleted'}), 200


@main_bp.route('/api/knowledge/search', methods=['POST'])
@jwt_required()
def knowledge_search():
    """Search document chunks for relevant content."""
    data = request.get_json()
    query = data.get('query', '').strip()

    if not query:
        return jsonify({'error': 'Παρακαλώ εισάγετε ερώτημα αναζήτησης'}), 400

    limit = data.get('limit', 5)

    from my_project.ai.knowledge import search_chunks
    results = search_chunks(query, limit=limit)

    return jsonify({'results': results, 'count': len(results)}), 200


@main_bp.route('/api/knowledge/stats', methods=['GET'])
@jwt_required()
def knowledge_stats():
    """Get statistics about the knowledge base."""
    total_docs = DocumentIndex.query.filter_by(status='ready').count()
    total_chunks = FileChunk.query.count()
    embedded_chunks = FileChunk.query.filter(FileChunk.embedding.isnot(None)).count()

    # Count physical files in knowledge directory
    knowledge_dir = current_app.config.get('KNOWLEDGE_FOLDER', '')
    file_count = 0
    folder_count = 0
    if os.path.exists(knowledge_dir):
        for entry in os.listdir(knowledge_dir):
            full = os.path.join(knowledge_dir, entry)
            if entry.startswith('.'):
                continue
            if os.path.isdir(full):
                folder_count += 1
                file_count += len([f for f in os.listdir(full) if not f.startswith('.')])
            elif os.path.isfile(full):
                file_count += 1

    return jsonify({
        'total_documents': total_docs,
        'total_chunks': total_chunks,
        'embedded_chunks': embedded_chunks,
        'knowledge_files': file_count,
        'knowledge_folders': folder_count,
    }), 200


# ============================================================================
# KNOWLEDGE BASE MANAGEMENT ROUTES (admin only)
# ============================================================================

@main_bp.route('/api/knowledge/files', methods=['GET'])
@jwt_required()
def knowledge_list_files():
    """List all folders and files in the knowledge base directory."""
    admin_check = require_admin()
    if admin_check:
        return admin_check

    knowledge_dir = current_app.config['KNOWLEDGE_FOLDER']
    if not os.path.isabs(knowledge_dir):
        knowledge_dir = os.path.abspath(knowledge_dir)

    if not os.path.exists(knowledge_dir):
        os.makedirs(knowledge_dir)

    tree = _scan_knowledge_dir(knowledge_dir)
    return jsonify({'folders': tree}), 200


def _scan_knowledge_dir(base_dir):
    """Scan knowledge directory and return folder/file tree."""
    result = []
    try:
        for entry in sorted(os.listdir(base_dir)):
            if entry.startswith('.'):
                continue
            full_path = os.path.join(base_dir, entry)
            rel_path = os.path.relpath(full_path, base_dir)

            if os.path.isdir(full_path):
                files = []
                for fname in sorted(os.listdir(full_path)):
                    if fname.startswith('.'):
                        continue
                    fpath = os.path.join(full_path, fname)
                    if os.path.isfile(fpath):
                        fpath_abs = os.path.abspath(fpath)
                        doc = DocumentIndex.query.filter_by(file_path=fpath_abs).first()
                        files.append({
                            'name': fname,
                            'path': os.path.relpath(fpath, base_dir),
                            'size': os.path.getsize(fpath),
                            'chunks': doc.chunk_count if doc else 0,
                            'status': doc.status if doc else 'not_indexed',
                        })
                result.append({
                    'name': entry,
                    'path': rel_path,
                    'files': files,
                    'file_count': len(files),
                })
            elif os.path.isfile(full_path):
                full_path_abs = os.path.abspath(full_path)
                doc = DocumentIndex.query.filter_by(file_path=full_path_abs).first()
                result.append({
                    'name': entry,
                    'path': rel_path,
                    'size': os.path.getsize(full_path),
                    'chunks': doc.chunk_count if doc else 0,
                    'status': doc.status if doc else 'not_indexed',
                    'is_file': True,
                })
    except OSError as e:
        current_app.logger.error(f"Error scanning knowledge dir: {e}")

    return result


@main_bp.route('/api/knowledge/folders', methods=['POST'])
@jwt_required()
def knowledge_create_folder():
    """Create a folder in the knowledge base."""
    admin_check = require_admin()
    if admin_check:
        return admin_check

    data = request.get_json()
    folder_name = data.get('name', '').strip()
    parent = data.get('parent', '').strip()

    if not folder_name:
        return jsonify({'error': 'Folder name required'}), 400

    # Sanitize: no path traversal
    if '..' in folder_name or '/' in folder_name or '\\' in folder_name:
        return jsonify({'error': 'Invalid folder name'}), 400

    knowledge_dir = current_app.config['KNOWLEDGE_FOLDER']
    if parent:
        folder_path = os.path.join(knowledge_dir, parent, folder_name)
    else:
        folder_path = os.path.join(knowledge_dir, folder_name)

    if os.path.exists(folder_path):
        return jsonify({'error': 'Folder already exists'}), 409

    try:
        os.makedirs(folder_path)
        return jsonify({'message': 'Folder created', 'path': os.path.relpath(folder_path, knowledge_dir)}), 201
    except OSError as e:
        return jsonify({'error': str(e)}), 500


KNOWLEDGE_ALLOWED_EXTENSIONS = {'.md', '.txt'}


def _safe_filename(filename):
    """Unicode-safe filename sanitizer (preserves Greek characters).

    secure_filename() strips all non-ASCII, which destroys Greek filenames.
    This keeps Unicode letters/digits and replaces dangerous characters.
    """
    import re
    import unicodedata
    # Normalize unicode
    filename = unicodedata.normalize('NFC', filename)
    # Get just the filename (no directory components)
    filename = filename.replace('\\', '/').split('/')[-1]
    # Replace path separators and null bytes
    for sep in (os.sep, os.altsep or '', '\x00'):
        if sep:
            filename = filename.replace(sep, '')
    # Keep unicode letters, digits, hyphens, underscores, dots, spaces
    filename = re.sub(r'[^\w\s\-.]', '', filename, flags=re.UNICODE).strip()
    # Collapse whitespace to underscore
    filename = re.sub(r'\s+', '_', filename)
    # Don't allow hidden files
    filename = filename.lstrip('.')
    return filename or 'unnamed'


@main_bp.route('/api/knowledge/upload', methods=['POST'])
@jwt_required()
def knowledge_upload():
    """Upload .md/.txt file to knowledge base and auto-ingest for RAG."""
    admin_check = require_admin()
    if admin_check:
        return admin_check

    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    file = request.files['file']
    folder = request.form.get('folder', '').strip()

    if not file.filename:
        return jsonify({'error': 'No file selected'}), 400

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in KNOWLEDGE_ALLOWED_EXTENSIONS:
        return jsonify({'error': f'Only .md and .txt files are allowed (got {ext})'}), 400

    filename = _safe_filename(file.filename)
    knowledge_dir = current_app.config['KNOWLEDGE_FOLDER']

    if folder:
        if '..' in folder:
            return jsonify({'error': 'Invalid folder path'}), 400
        target_dir = os.path.join(knowledge_dir, folder)
    else:
        target_dir = knowledge_dir

    os.makedirs(target_dir, exist_ok=True)
    file_path = os.path.join(target_dir, filename)
    file.save(file_path)

    # Auto-ingest: chunk + embed
    from my_project.ai.knowledge import process_file
    try:
        result = process_file(file_path, generate_vectors=True)
        chunk_count = result.chunk_count if result else 0
        status = result.status if result else 'error'
    except Exception as e:
        current_app.logger.error(f"Knowledge ingest failed for {filename}: {e}")
        chunk_count = 0
        status = 'error'

    return jsonify({
        'message': 'File uploaded and indexed',
        'filename': filename,
        'path': os.path.relpath(file_path, knowledge_dir),
        'chunks': chunk_count,
        'status': status,
    }), 201


@main_bp.route('/api/knowledge/files/<path:file_path>', methods=['DELETE'])
@jwt_required()
def knowledge_delete_file(file_path):
    """Delete a file from knowledge base and remove its chunks."""
    admin_check = require_admin()
    if admin_check:
        return admin_check

    knowledge_dir = current_app.config['KNOWLEDGE_FOLDER']
    full_path = os.path.abspath(os.path.join(knowledge_dir, file_path))

    # Security: ensure path is inside knowledge_dir
    if not full_path.startswith(os.path.abspath(knowledge_dir)):
        return jsonify({'error': 'Invalid path'}), 400

    if not os.path.isfile(full_path):
        return jsonify({'error': 'File not found'}), 404

    # Remove chunks from database
    doc = DocumentIndex.query.filter_by(file_path=full_path).first()
    if doc:
        db.session.delete(doc)  # cascade deletes FileChunks
        db.session.commit()

    # Remove physical file
    os.remove(full_path)

    return jsonify({'message': 'File deleted'}), 200


@main_bp.route('/api/knowledge/folders/<path:folder_path>', methods=['DELETE'])
@jwt_required()
def knowledge_delete_folder(folder_path):
    """Delete a folder and all its files/chunks from knowledge base."""
    admin_check = require_admin()
    if admin_check:
        return admin_check

    knowledge_dir = current_app.config['KNOWLEDGE_FOLDER']
    full_path = os.path.abspath(os.path.join(knowledge_dir, folder_path))

    if not full_path.startswith(os.path.abspath(knowledge_dir)):
        return jsonify({'error': 'Invalid path'}), 400

    if not os.path.isdir(full_path):
        return jsonify({'error': 'Folder not found'}), 404

    # Remove all indexed documents under this folder
    docs = DocumentIndex.query.filter(DocumentIndex.file_path.startswith(full_path)).all()
    for doc in docs:
        db.session.delete(doc)
    db.session.commit()

    # Remove physical folder
    import shutil
    shutil.rmtree(full_path)

    return jsonify({'message': 'Folder deleted'}), 200


@main_bp.route('/api/knowledge/reindex', methods=['POST'])
@jwt_required()
def knowledge_reindex():
    """Re-ingest all files in the knowledge directory."""
    admin_check = require_admin()
    if admin_check:
        return admin_check

    knowledge_dir = current_app.config['KNOWLEDGE_FOLDER']
    if not os.path.exists(knowledge_dir):
        return jsonify({'error': 'Knowledge directory not found'}), 404

    from my_project.ai.knowledge import process_file

    processed = 0
    errors = 0
    for root, dirs, files in os.walk(knowledge_dir):
        for fname in files:
            ext = os.path.splitext(fname)[1].lower()
            if ext not in KNOWLEDGE_ALLOWED_EXTENSIONS:
                continue
            fpath = os.path.join(root, fname)
            try:
                process_file(fpath, generate_vectors=True)
                processed += 1
            except Exception as e:
                current_app.logger.error(f"Reindex error for {fname}: {e}")
                errors += 1

    return jsonify({
        'message': 'Reindex complete',
        'processed': processed,
        'errors': errors,
    }), 200


# ============================================================================
# ADMIN ROUTES
# ============================================================================

@main_bp.route('/api/admin/users', methods=['GET'])
@jwt_required()
def admin_list_users():
    """List users. Admin only. Defaults to active users."""
    admin_check = require_admin()
    if admin_check:
        return admin_check
    include_inactive = request.args.get('include_inactive', 'false').lower() == 'true'
    query = User.query
    if not include_inactive:
        query = query.filter(User.is_active != False)
    users = query.order_by(User.created_at.desc()).all()
    return jsonify({'users': [u.to_dict() for u in users]}), 200


@main_bp.route('/api/admin/stats', methods=['GET'])
@jwt_required()
def admin_stats():
    """Get admin dashboard statistics. Admin only."""
    admin_check = require_admin()
    if admin_check:
        return admin_check

    thirty_days_ago = datetime.utcnow() - timedelta(days=30)

    total_users = User.query.filter(User.is_active != False).count()
    active_users = User.query.filter(
        User.is_active != False,
        User.presence_status != 'offline'
    ).count()
    recent_users = User.query.filter(
        User.is_active != False,
        User.created_at >= thirty_days_ago
    ).count()

    from sqlalchemy import func
    role_counts = dict(
        db.session.query(User.role, func.count(User.id))
        .filter(User.is_active != False)
        .group_by(User.role)
        .all()
    )

    return jsonify({
        'users': {
            'total': total_users,
            'active': active_users,
            'recent': recent_users,
            'by_role': role_counts,
        },
        'total_discussions': Discussion.query.count(),
        'total_posts': Post.query.count(),
    }), 200


@main_bp.route('/api/admin/users', methods=['POST'])
@jwt_required()
def admin_create_user():
    """Create a new user. Admin only."""
    admin_check = require_admin()
    if admin_check:
        return admin_check
    data = request.get_json()
    if not data.get('username') or not data.get('email') or not data.get('password'):
        return jsonify({'error': 'Username, email, and password are required'}), 400
    if User.query.filter_by(username=data['username']).first():
        return jsonify({'error': 'Username already exists'}), 409
    if User.query.filter_by(email=data['email']).first():
        return jsonify({'error': 'Email already exists'}), 409
    user = User(
        username=data['username'],
        email=data['email'],
        role=data.get('role', 'guest'),
    )
    user.set_password(data['password'])
    db.session.add(user)
    db.session.commit()
    return jsonify(user.to_dict()), 201


@main_bp.route('/api/admin/users/<int:user_id>', methods=['PUT'])
@jwt_required()
def admin_update_user(user_id):
    """Update a user. Admin only."""
    admin_check = require_admin()
    if admin_check:
        return admin_check
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    data = request.get_json()
    if 'username' in data:
        user.username = data['username']
    if 'email' in data:
        user.email = data['email']
    if 'role' in data:
        user.role = data['role']
    if 'password' in data and data['password']:
        user.set_password(data['password'])
    db.session.commit()
    return jsonify(user.to_dict()), 200


@main_bp.route('/api/admin/users/<int:user_id>', methods=['DELETE'])
@jwt_required()
def delete_user(user_id):
    """Anonymize a user's data (GDPR right to erasure). Admin only."""
    admin_check = require_admin()
    if admin_check:
        return admin_check

    user = db.session.get(User, user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    # Don't allow deleting yourself
    current_user_id = int(get_jwt_identity())
    if user.id == current_user_id:
        return jsonify({'error': 'Cannot delete your own account'}), 400

    # Anonymize instead of hard delete to preserve referential integrity
    user.username = f'deleted_{user.id}'
    user.email = f'deleted_{user.id}@removed.local'
    user.password_hash = 'ANONYMIZED'
    user.presence_status = 'offline'
    user.is_active = False
    user.irida_username = None
    user.irida_password = None
    user.irida_x_profile = None
    user.irida_base_url = None

    # Anonymize profile if exists
    profile = UserProfile.query.filter_by(user_id=user.id).first()
    if profile:
        profile.display_name = None
        profile.bio = None
        profile.location = None
        profile.website = None
        profile.avatar_url = None
        profile.phone = None
        profile.birth_date = None

    db.session.commit()

    log_action('user_deleted', resource='user', resource_id=user_id,
               user_id=current_user_id)

    return jsonify({'message': f'User {user_id} anonymized successfully'})


# ============================================================================
# UTILITY ROUTES
# ============================================================================

@main_bp.route('/content/<path:filename>')
def serve_content(filename):
    """Serve files from the content directory"""
    return send_from_directory(current_app.config['UPLOAD_FOLDER'], filename)


@main_bp.route('/api/health', methods=['GET'])
def health_check():
    """Liveness probe — always returns 200 so Render/k8s keeps the service alive.
    Optional ?detail=true returns component diagnostics."""
    result = {
        'status': 'ok',
        'timestamp': datetime.now().isoformat(),
        'version': '1.0.0',
    }

    if request.args.get('detail') == 'true':
        result['environment'] = current_app.config.get('ENV', 'unknown')
        # Database check
        try:
            db.session.execute(db.text('SELECT 1'))
            result['database'] = 'healthy'
        except Exception as e:
            result['database'] = f'unhealthy: {e}'

    return jsonify(result), 200


@main_bp.route('/api/user/permissions', methods=['GET'])
@jwt_required()
def get_user_permissions():
    """Get current user permissions"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if not user:
        return jsonify({'error': 'User not found'}), 404

    permissions = get_user_permissions_list(user.role)
    return jsonify({
        'role': user.role,
        'permissions': permissions,
        'can_access_admin_dashboard': 'can_access_admin_dashboard' in permissions,
        'can_moderate': 'can_moderate' in permissions,
        'can_manage_users': 'can_manage_users' in permissions
    })


# ============================================================================
# ANALYTICS AND DASHBOARD ROUTES
# ============================================================================

@main_bp.route('/api/analytics/dashboard', methods=['GET'])
def get_dashboard_analytics():
    """Get dashboard analytics data"""
    try:
        # File statistics
        file_stats = {
            'total_files': FileItem.query.count(),
            'files_by_type': {},
            'recent_uploads': []
        }
        
        # Get file type distribution
        files = FileItem.query.all()
        for file in files:
            file_type = file.file_type or 'unknown'
            file_stats['files_by_type'][file_type] = file_stats['files_by_type'].get(file_type, 0) + 1
        
        # Recent uploads
        recent_files = FileItem.query.order_by(FileItem.created_at.desc()).limit(5).all()
        file_stats['recent_uploads'] = [{
            'name': f.name,
            'type': f.file_type,
            'size': format_file_size(f.file_size),
            'uploaded_at': f.created_at.isoformat() if f.created_at else None
        } for f in recent_files]
        
        # Discussion statistics
        discussion_stats = {
            'total_discussions': Discussion.query.count(),
            'total_posts': Post.query.count(),
            'active_discussions': Discussion.query.filter(
                Discussion.updated_at >= datetime.now().replace(day=1)  # This month
            ).count(),
            'discussions_by_category': {}
        }
        
        from sqlalchemy.orm import selectinload
        categories = Category.query.options(selectinload(Category.discussions)).all()
        for category in categories:
            discussion_stats['discussions_by_category'][category.title] = len(category.discussions)
        
        # User statistics
        user_stats = {
            'total_users': User.query.count(),
            'active_users': User.query.filter(
                User.last_seen >= datetime.now().replace(day=1)
            ).count() if User.query.first() and hasattr(User.query.first(), 'last_seen') else 0,
            'users_by_role': {}
        }
        
        users = User.query.all()
        for user in users:
            role = user.role or 'guest'
            user_stats['users_by_role'][role] = user_stats['users_by_role'].get(role, 0) + 1
        
        return jsonify({
            'files': file_stats,
            'discussions': discussion_stats,
            'users': user_stats,
            'system': {
                'uptime': 'Available',
                'version': '1.0.0',
                'environment': current_app.config.get('ENV', 'development')
            },
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        current_app.logger.error(f"Error getting dashboard analytics: {str(e)}")
        return jsonify({'error': 'Failed to retrieve analytics'}), 500


@main_bp.route('/api/search', methods=['GET'])
def global_search():
    """Global search across files, discussions, and posts"""
    try:
        query = request.args.get('q', '').strip()
        search_type = request.args.get('type', 'all')  # all, files, discussions, posts
        limit = min(int(request.args.get('limit', 20)), 100)  # Max 100 results
        
        if not query or len(query) < 2:
            return jsonify({'error': 'Search query must be at least 2 characters'}), 400
        
        results = {
            'query': query,
            'results': {},
            'total_results': 0
        }
        
        # Search files
        if search_type in ['all', 'files']:
            files = FileItem.query.filter(
                FileItem.name.contains(query) | 
                FileItem.original_name.contains(query)
            ).limit(limit).all()
            
            results['results']['files'] = [{
                'id': f.id,
                'name': f.name,
                'original_name': f.original_name,
                'type': f.file_type,
                'size': format_file_size(f.file_size),
                'category': f.category,
                'uploaded_at': f.created_at.isoformat() if f.created_at else None
            } for f in files]
        
        # Search discussions
        if search_type in ['all', 'discussions']:
            discussions = Discussion.query.filter(
                Discussion.title.contains(query) | 
                Discussion.description.contains(query)
            ).limit(limit).all()
            
            results['results']['discussions'] = [{
                'id': d.id,
                'title': d.title,
                'description': d.description[:200] + '...' if len(d.description) > 200 else d.description,
                'category': d.category.title if d.category else 'Unknown',
                'post_count': d.post_count,
                'created_at': d.created_at.isoformat()
            } for d in discussions]
        
        # Search posts
        if search_type in ['all', 'posts']:
            posts = Post.query.filter(
                Post.content.contains(query)
            ).limit(limit).all()
            
            results['results']['posts'] = [{
                'id': p.id,
                'content': p.content[:200] + '...' if len(p.content) > 200 else p.content,
                'discussion_title': p.discussion.title if p.discussion else 'Unknown',
                'discussion_id': p.discussion_id,
                'user': p.user.username if p.user else 'Unknown',
                'created_at': p.created_at.isoformat()
            } for p in posts]
        
        # Calculate total results
        for category in results['results']:
            results['total_results'] += len(results['results'][category])
        
        return jsonify(results)
        
    except Exception as e:
        current_app.logger.error(f"Error in global search: {str(e)}")
        return jsonify({'error': 'Search failed'}), 500


# ============================================================================
# FRONTEND SERVING (production: serves built React SPA)
# ============================================================================

@main_bp.route('/', defaults={'path': ''})
@main_bp.route('/<path:path>')
def serve_frontend(path):
    """Serve the React SPA.

    Static assets (js, css, images) are served directly.
    All other paths return index.html for client-side routing.
    """
    # Never intercept API routes — let Flask blueprints handle them
    if path.startswith('api/'):
        return jsonify({'error': 'Not found'}), 404

    build_dir = os.path.abspath(current_app.config.get('FRONTEND_DIR', ''))

    if not os.path.isdir(build_dir):
        return jsonify({'message': 'ΠΥΛΗ ΚΟΙΝΩΝΙΚΗΣ ΜΕΡΙΜΝΑΣ API is running. Frontend not built.'}), 200

    # Serve static files directly if they exist
    if path and os.path.exists(os.path.join(build_dir, path)):
        return send_from_directory(build_dir, path)

    # SPA catch-all: return index.html for React Router
    index_path = os.path.join(build_dir, 'index.html')
    if os.path.exists(index_path):
        return send_from_directory(build_dir, 'index.html')

    return jsonify({'message': 'ΠΥΛΗ ΚΟΙΝΩΝΙΚΗΣ ΜΕΡΙΜΝΑΣ API is running. Frontend not built.'}), 200