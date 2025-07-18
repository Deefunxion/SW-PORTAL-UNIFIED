from flask import Blueprint, jsonify, request, send_from_directory, send_file, current_app
import os
from datetime import datetime, timezone

# Import db from extensions
from ..extensions import db

# Import models
from ..models.main import User, Category, Discussion, Post, FileItem

# Import custom modules and utility functions
from backend.my_project.auth_and_permissions.auth import jwt_required, role_required, get_current_user_info
from backend.my_project.auth_and_permissions.notifications import notify_new_forum_post, notify_new_file_upload
from werkzeug.utils import secure_filename
from backend.my_project.services.tasks import process_document_pipeline # Import tasks here

# Import get_role_permissions
from backend.my_project.auth_and_permissions.roles import get_role_permissions

# Define the Blueprint
main_bp = Blueprint('main', __name__)

# Utility functions (moved from app.py)
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

def scan_content_directory(user_info, acl_manager, app_config):
    import os
    from datetime import datetime

    content_dir = app_config['UPLOAD_FOLDER']
    if not os.path.exists(content_dir):
        os.makedirs(content_dir)
        return []

    # ---------- helper ----------
    def _allowed(path, is_file=True):
        return acl_manager.check_permission(
            os.path.relpath(path, content_dir),
            'read',
            user_info=user_info,
            resource_type='file' if is_file else 'folder'
       )

    # ---------------------------

    tree = {}
    for root, dirs, files in os.walk(content_dir, topdown=True):
        rel_root = os.path.relpath(root, content_dir)
        if rel_root == '.':
            rel_root = ''

        # prune dirs early
        dirs[:] = [d for d in dirs if _allowed(os.path.join(root, d), False)]

        if rel_root and not _allowed(root, False):
            continue  # skip whole subtree

        node = tree
        if rel_root:
            for part in rel_root.split(os.sep):
                node = node.setdefault(part, {})

        # add files
        file_list = []
        for f in files:
            full = os.path.join(root, f)
            if not _allowed(full, True):
                continue
            stat = os.stat(full)
            file_list.append({
                'id': f"{rel_root.replace(os.sep, '_')}_{f}".strip('_').replace(' ', '_'),
                'name': f,
                'type': get_file_type(f),
                'extension': f.split('.')[-1].lower() if '.' in f else '',
                'path': os.path.relpath(full, content_dir).replace('\\', '/'),
                'downloadUrl': f"/api/files/download/{os.path.relpath(full, content_dir).replace(os.sep, '/')}",
                'size': stat.st_size,
                'lastModified': datetime.fromtimestamp(stat.st_mtime).isoformat()
            })

        if file_list:
            node['__files__'] = file_list

    # ---------- convert to list ----------
    def build_list(d, cur_path=""):
        out = []
        for name, content in d.items():
            if name == '__files__':
                continue
            new_path = os.path.join(cur_path, name) if cur_path else name
            out.append({
                'id': new_path.replace(os.sep, '_').replace(' ', '_'),
                'category': name,
                'path': new_path.replace('\\', '/'),
                'files': content.get('__files__', []),
                'subfolders': build_list(content, new_path)
            })
        return out

    return build_list(tree)

# ============================================================================
# API ROUTES - FORUM
# ============================================================================

@main_bp.route('/api/categories', methods=['GET'])
def get_categories():
    categories = Category.query.all()
    return jsonify([{
        'id': cat.id,
        'title': cat.title,
        'description': cat.description,
        'discussion_count': len(cat.discussions)
    } for cat in categories])

@main_bp.route('/api/discussions', methods=['GET'])
def get_discussions():
    discussions = Discussion.query.all()
    
    # Group discussions by category
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
@role_required(['admin', 'staff'])
def create_discussion():
    data = request.get_json()
    user_info = get_current_user_info()
    
    discussion = Discussion(
        title=data['title'],
        description=data.get('description', ''),
        category_id=data['category_id'],
        user_id=user_info['id']
    )
    
    db.session.add(discussion)
    db.session.commit()
    
    return jsonify({'message': 'Discussion created', 'id': discussion.id}), 201

@main_bp.route('/api/discussions/<int:discussion_id>/posts', methods=['GET'])
def get_posts(discussion_id):
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
            'created_at': post.created_at.isoformat()
        } for post in posts]
    })

@main_bp.route('/api/discussions/<int:discussion_id>/posts', methods=['POST'])
@role_required(['admin', 'staff'])
def create_post(discussion_id):
    data = request.get_json()
    user_info = get_current_user_info()
    
    post = Post(
        content=data['content'],
        discussion_id=discussion_id,
        user_id=user_info['id']
    )
    
    db.session.add(post)
    db.session.commit()
    
    # Create notifications for forum participants
    if hasattr(current_app, 'Notification') and current_app.Notification:
        notify_new_forum_post(db, current_app.Notification, discussion_id, user_info['id'], data['content'])
    
    return jsonify({'message': 'Post created', 'id': post.id}), 201

# ============================================================================
# API ROUTES - FILES (APOTHECARY)
# ============================================================================

@main_bp.route('/api/files/structure', methods=['GET'])
@jwt_required()
def get_file_structure():
    """Get the complete file structure for Apothecary."""
    user_info = get_current_user_info()
    # Pass user_info and acl_manager to the scanning function
    acl_manager = getattr(current_app, 'acl_manager', None)
    if acl_manager:
        categories = scan_content_directory(user_info, acl_manager, current_app.config)
    else:
        categories = [] # Fallback if acl_manager is not available
    print(f"DEBUG /api/files/structure categories: {categories}")
    
    return jsonify({
        'categories': categories,
        'metadata': {
            'total_categories': len(categories),
            'total_files': sum(len(cat['files']) for cat in categories),
            'last_updated': datetime.now().isoformat(),
            'version': '2.0'
        }
    })

@main_bp.route('/api/files/download/<path:file_path>', methods=['GET'])
def download_file(file_path):
    """Download a file from the content directory."""
    try:
        # Normalize the file path to handle different OS path separators
        safe_path = os.path.normpath(file_path)
        
        # Prevent directory traversal attacks
        if '..' in safe_path.split(os.sep):
            return jsonify({'error': 'Invalid path'}), 400

        content_dir = current_app.config['UPLOAD_FOLDER']
        full_path = os.path.join(content_dir, safe_path)
        
        if not os.path.exists(full_path) or not os.path.isfile(full_path):
            return jsonify({'error': 'File not found'}), 404
        
        return send_file(full_path, as_attachment=True)
    except Exception as e:
        current_app.logger.error(f"File download error: {e}")
        return jsonify({'error': 'An internal error occurred'}), 500

@main_bp.route('/api/files/upload', methods=['POST'])
@role_required(['admin', 'staff'])
def upload_file():
    """Upload a new file to the content directory."""
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    target_folder = request.form.get('targetFolder', 'uploads')
    
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    if file:
        user_info = get_current_user_info()
        filename = secure_filename(file.filename)
        target_dir = os.path.join(current_app.config['UPLOAD_FOLDER'], target_folder)
        
        if not os.path.exists(target_dir):
            os.makedirs(target_dir)
        
        file_path = os.path.join(target_dir, filename)
        file.save(file_path)

        # Redact PII from the file if it's a supported format
        # Temporarily disabled until PyMuPDF is installed
        # try:
        #     redact_pii_in_file(file_path)
        # except Exception as e:
        #     current_app.logger.error(f"Error during PII redaction for {file_path}: {e}")
        #     # Decide if you want to fail the upload or just log the error
        #     # For now, we'll just log it and continue.
        
        # Save file info to database
        file_item = FileItem(
            name=filename,
            original_name=file.filename,
            path=os.path.relpath(file_path, current_app.config['UPLOAD_FOLDER']),
            category=target_folder,
            file_type=get_file_type(filename),
            file_size=os.path.getsize(file_path),
            uploaded_by=user_info['id']
        )
        
        db.session.add(file_item)
        db.session.commit()
        
        # Create notifications for file upload
        if hasattr(current_app, 'Notification') and current_app.Notification:
            notify_new_file_upload(db, current_app.Notification, filename, user_info['id'], target_folder)
        
        # Ξεκίνα το pipeline στο background!
        process_document_pipeline.delay(file_path, file.filename, file_item.id)

        return jsonify({
            'message': 'Το αρχείο ανέβηκε και η επεξεργασία ξεκίνησε στο background.',
            'filename': filename,
            'path': file_item.path
        }), 201

@main_bp.route('/api/folders/create', methods=['POST'])
@role_required(['admin', 'staff'])
def create_folder():
    """Create a new folder in the content directory."""
    data = request.get_json()
    folder_name = data.get('name', '').strip()
    parent_folder = data.get('parentFolder', '')
    
    if not folder_name:
        return jsonify({'error': 'Folder name is required'}), 400
    
    folder_path = os.path.join(current_app.config['UPLOAD_FOLDER'], parent_folder, folder_name)
    
    try:
        os.makedirs(folder_path, exist_ok=True)
        return jsonify({
            'message': 'Folder created successfully',
            'path': os.path.relpath(folder_path, current_app.config['UPLOAD_FOLDER'])
        }), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@main_bp.route('/api/user/permissions', methods=['GET'])
@jwt_required()
def get_user_permissions():
    """Get current user's permissions based on their role."""
    user_info = get_current_user_info()
    user_role = user_info.get('role', 'guest')
    
    permissions = get_role_permissions().get(user_role, {})

    return jsonify({
        'role': user_role,
        'permissions': permissions,
        'user': user_info
    })

# ============================================================================
# API ROUTES - AI ASSISTANT
# ============================================================================

@main_bp.route('/api/chat', methods=['POST'])
@jwt_required()
def chat():
    data = request.get_json()
    message = data.get('message')

    if not message:
        return jsonify({'error': 'Message is required'}), 400

    # Check if OpenAI client is available
    if current_app.client is None:
        return jsonify({
            'response': 'AI Assistant is not configured. Please set OPENAI_API_KEY in your environment.'
        })

    print(f"Received user message: {message}")
    print(f"Using API Key: {current_app.client.api_key}")
    print(f"Using Assistant ID: {current_app.assistant_id}")

    try:
        response = current_app.client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "Είσαι ένας ευγενικός βοηθός που απαντά σε ερωτήσεις χρηστών για την Ελλάδα."},
                {"role": "user", "content": message}
            ]
        )

        reply = response.choices[0].message.content

        return jsonify({
            'response': reply
        })
    except Exception as e:
        print(f"Error during AI request: {e}")
        return jsonify({
            'response': f'Λυπάμαι, το AI Assistant δεν είναι διαθέσιμο αυτή τη στιγμή. Το μήνυμά σας ήταν: \"{message}\"'
        })


# ============================================================================
# STATIC FILE SERVING
# ============================================================================

@main_bp.route('/content/<path:filename>')
def serve_content(filename):
    """Serve files from the content directory."""
    return send_from_directory(current_app.config['UPLOAD_FOLDER'], filename)

# ============================================================================
# HEALTH CHECK
# ============================================================================

@main_bp.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'version': '1.0.0',
        'components': {
            'database': 'connected',
            'files': 'accessible',
            'ai_assistant': 'configured' if current_app.client and current_app.client.api_key and current_app.assistant_id else 'not_configured'
        }
    })

# ============================================================================
# APPLICATION STARTUP
# ============================================================================

@main_bp.route('/', defaults={'path': ''})
@main_bp.route('/<path:path>')
def serve_frontend(path):
    # This route should ideally be handled by the frontend server or a separate static file server
    # For development, we can serve from the build directory
    build_dir = os.path.join(current_app.root_path, '..', 'frontend', 'dist') # Assuming frontend build is in frontend/dist
    if path != "" and os.path.exists(os.path.join(build_dir, path)):
        return send_from_directory(build_dir, path)
    else:
        return send_from_directory(build_dir, 'index.html')