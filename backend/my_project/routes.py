"""
Flask Routes for SW Portal
Consolidated routes file containing all Flask endpoints organized in a Blueprint
"""

from flask import Blueprint, jsonify, request, send_from_directory, send_file, current_app
import os
from datetime import datetime
from werkzeug.utils import secure_filename
from flask_jwt_extended import jwt_required, get_jwt_identity, create_access_token

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

    def scan_directory(path, is_root=False):
        """Scan a directory and return categorized structure"""
        categories = []
        
        try:
            # Handle Greek characters in filenames
            items = []
            try:
                items = os.listdir(path)
            except UnicodeDecodeError:
                # Fallback for encoding issues
                import glob
                items = [os.path.basename(p) for p in glob.glob(os.path.join(path, '*'))]
            
            # Filter out hidden files and system files
            items = [item for item in items if not item.startswith('.') and item not in ['uploads', 'welcome.txt', 'README.md']]
            
            for item in items:
                item_path = os.path.join(path, item)
                
                if os.path.isdir(item_path):
                    # This is a category folder
                    category_files = []
                    category_subfolders = []
                    
                    # Scan the category folder
                    try:
                        category_items = []
                        try:
                            category_items = os.listdir(item_path)
                        except UnicodeDecodeError:
                            import glob
                            category_items = [os.path.basename(p) for p in glob.glob(os.path.join(item_path, '*'))]
                        
                        for category_item in category_items:
                            if category_item.startswith('.'):
                                continue
                                
                            category_item_path = os.path.join(item_path, category_item)
                            
                            if os.path.isdir(category_item_path):
                                # This is a subfolder - scan it recursively
                                subfolder_result = scan_directory(category_item_path)
                                
                                # Collect all files from this subfolder
                                subfolder_files = []
                                for sub_item in subfolder_result:
                                    if 'files' in sub_item:
                                        subfolder_files.extend(sub_item['files'])
                                    if 'subfolders' in sub_item:
                                        for sub_subfolder in sub_item['subfolders']:
                                            if 'files' in sub_subfolder:
                                                subfolder_files.extend(sub_subfolder['files'])
                                
                                category_subfolders.append({
                                    'name': category_item,
                                    'path': f"{item}/{category_item}",
                                    'files': subfolder_files
                                })
                            else:
                                # This is a file in the category
                                try:
                                    file_info = {
                                        'name': category_item,
                                        'path': f"{item}/{category_item}",
                                        'size': os.path.getsize(category_item_path),
                                        'modified': datetime.fromtimestamp(os.path.getmtime(category_item_path)).isoformat(),
                                        'type': get_file_type(category_item)
                                    }
                                    category_files.append(file_info)
                                except (OSError, PermissionError):
                                    continue
                    except (OSError, PermissionError):
                        continue
                    
                    # Add this category to the results
                    categories.append({
                        'id': item.replace(' ', '_').replace('/', '_').replace('\\', '_'),
                        'name': item,
                        'category': item,  # Keep this for compatibility
                        'path': item,
                        'files': category_files,
                        'subfolders': category_subfolders
                    })
                    
        except (OSError, PermissionError):
            pass
        
        return categories

    return scan_directory(content_dir, is_root=True)


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

        # Generate JWT token (identity must be string)
        access_token = create_access_token(identity=str(user.id))

        return jsonify({
            'message': 'Login successful',
            'access_token': access_token,
            'user': user.to_dict()
        })
    else:
        return jsonify({'error': 'Invalid credentials'}), 401


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
            nonlocal total_files, total_size, file_types
            for item in items:
                if 'name' in item:  # It's a file
                    total_files += 1
                    total_size += item.get('size', 0)
                    file_type = item.get('type', 'unknown')
                    file_types[file_type] = file_types.get(file_type, 0) + 1
                elif 'files' in item:  # It's a folder with files
                    count_files(item['files'])
                    if 'subfolders' in item:
                        count_files(item['subfolders'])
        
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
    full_path = os.path.join(content_dir, file_path)
    
    if not os.path.exists(full_path) or not os.path.isfile(full_path):
        return jsonify({'error': 'File not found'}), 404
    
    return send_file(full_path, as_attachment=True)


@main_bp.route('/api/files/upload', methods=['POST'])
@jwt_required()
def upload_file():
    """Upload a file"""
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    file = request.files['file']
    category = request.form.get('category', 'uploads')
    user_id = int(get_jwt_identity())

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
            uploaded_by=user_id
        )

        db.session.add(file_item)
        db.session.commit()

        return jsonify({'message': 'File uploaded successfully', 'id': file_item.id}), 201


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
def ai_chat():
    """AI Assistant — chat with RAG context from social welfare documents."""
    data = request.get_json()
    message = data.get('message', '').strip()

    if not message:
        return jsonify({'error': 'Παρακαλώ εισάγετε μήνυμα'}), 400

    chat_history = data.get('chat_history', [])

    from my_project.ai.copilot import get_chat_reply
    result = get_chat_reply(
        user_message=message,
        chat_history=chat_history,
        use_rag=True,
    )

    return jsonify(result), 200


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
    """Get statistics about indexed documents."""
    from my_project.models import DocumentIndex, FileChunk

    total_docs = DocumentIndex.query.filter_by(status='ready').count()
    total_chunks = FileChunk.query.count()
    embedded_chunks = FileChunk.query.filter(FileChunk.embedding.isnot(None)).count()

    return jsonify({
        'total_documents': total_docs,
        'total_chunks': total_chunks,
        'embedded_chunks': embedded_chunks,
    }), 200


# ============================================================================
# UTILITY ROUTES
# ============================================================================

@main_bp.route('/content/<path:filename>')
def serve_content(filename):
    """Serve files from the content directory"""
    return send_from_directory(current_app.config['UPLOAD_FOLDER'], filename)


@main_bp.route('/api/health', methods=['GET'])
def health_check():
    """Enhanced health check endpoint with detailed system status"""
    try:
        health_status = {
            'status': 'healthy',
            'timestamp': datetime.now().isoformat(),
            'version': '1.0.0',
            'environment': current_app.config.get('ENV', 'development'),
            'components': {}
        }
        
        # Database health check
        try:
            db.session.execute(db.text('SELECT 1'))
            health_status['components']['database'] = {
                'status': 'healthy',
                'details': 'Connection successful'
            }
        except Exception as e:
            health_status['components']['database'] = {
                'status': 'unhealthy',
                'details': str(e)
            }
            health_status['status'] = 'degraded'
        
        # File system health check
        try:
            content_dir = current_app.config['UPLOAD_FOLDER']
            if os.path.exists(content_dir) and os.access(content_dir, os.R_OK | os.W_OK):
                health_status['components']['files'] = {
                    'status': 'healthy',
                    'details': f'Directory accessible at {content_dir}'
                }
            else:
                health_status['components']['files'] = {
                    'status': 'unhealthy',
                    'details': 'Directory not accessible'
                }
                health_status['status'] = 'degraded'
        except Exception as e:
            health_status['components']['files'] = {
                'status': 'unhealthy',
                'details': str(e)
            }
            health_status['status'] = 'degraded'
        
        # AI Assistant health check
        if hasattr(current_app, 'client') and current_app.client:
            health_status['components']['ai_assistant'] = {
                'status': 'configured',
                'details': 'AI client initialized'
            }
        else:
            health_status['components']['ai_assistant'] = {
                'status': 'not_configured',
                'details': 'AI client not initialized - running in demo mode'
            }
        
        # System metrics
        health_status['metrics'] = {
            'uptime_seconds': (datetime.now() - datetime.now().replace(second=0, microsecond=0)).total_seconds(),
            'total_users': User.query.count(),
            'total_discussions': Discussion.query.count(),
            'total_files': FileItem.query.count()
        }
        
        status_code = 200 if health_status['status'] == 'healthy' else 503
        return jsonify(health_status), status_code
        
    except Exception as e:
        return jsonify({
            'status': 'unhealthy',
            'timestamp': datetime.now().isoformat(),
            'error': str(e)
        }), 503


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
        
        categories = Category.query.all()
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
    build_dir = os.path.abspath(current_app.config.get('FRONTEND_DIR', ''))

    if not os.path.isdir(build_dir):
        return jsonify({'message': 'SW Portal API is running. Frontend not built.'}), 200

    # Serve static files directly if they exist
    if path and os.path.exists(os.path.join(build_dir, path)):
        return send_from_directory(build_dir, path)

    # SPA catch-all: return index.html for React Router
    index_path = os.path.join(build_dir, 'index.html')
    if os.path.exists(index_path):
        return send_from_directory(build_dir, 'index.html')

    return jsonify({'message': 'SW Portal API is running. Frontend not built.'}), 200