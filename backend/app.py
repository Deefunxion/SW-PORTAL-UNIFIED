#!/usr/bin/env python3
"""
SW Portal Unified Backend
Combines Forum, Apothecary (Files), and AI Assistant APIs
"""

import os
import json
from datetime import datetime, timezone
from flask import Flask, jsonify, request, send_from_directory, send_file
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
import openai
from dotenv import load_dotenv
import httpx
from openai import OpenAI

# Custom module imports
from auth import init_auth, create_auth_routes, jwt_required, admin_required, get_current_user_info
from acl import init_acl, create_acl_routes
from analytics import init_analytics, create_analytics_routes
from api_docs import init_api_docs
from roles import role_required, admin_only, staff_and_admin, user_can
from user_management import create_user_management_routes
from notifications import create_notification_model, create_notification_routes, create_notification, notify_new_forum_post, notify_new_file_upload

# Load environment variables
load_dotenv()
http_client = httpx.Client()
client = OpenAI(
    api_key=os.getenv("OPENAI_API_KEY"),
    default_headers={"OpenAI-Beta": "assistants=v2"}
)
assistant_id = os.getenv("OPENAI_ASSISTANT_ID")

# Initialize Flask app
app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'sw-portal-secret-key-2025')

# Database configuration
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{os.path.join(BASE_DIR, "sw_portal.db")}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# File upload configuration
UPLOAD_FOLDER = os.path.join(BASE_DIR, '..', 'content')
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# Initialize extensions
db = SQLAlchemy(app)
CORS(app, origins="*")  # Allow all origins for local development

# Custom modules are initialized after the database models are defined.

# ============================================================================
# DATABASE MODELS
# ============================================================================

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(120), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

class Category(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    discussions = db.relationship('Discussion', backref='category', lazy=True)

class Discussion(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    category_id = db.Column(db.Integer, db.ForeignKey('category.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    posts = db.relationship('Post', backref='discussion', lazy=True, cascade='all, delete-orphan')
    
    @property
    def post_count(self):
        return len(self.posts)
    
    @property
    def last_post(self):
        return self.posts[-1] if self.posts else None

class Post(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.Text, nullable=False)
    discussion_id = db.Column(db.Integer, db.ForeignKey('discussion.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    user = db.relationship('User', backref='posts')

class FileItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    original_name = db.Column(db.String(255), nullable=False)
    path = db.Column(db.String(500), nullable=False)
    category = db.Column(db.String(200), nullable=False)
    file_type = db.Column(db.String(50), nullable=False)
    file_size = db.Column(db.Integer)
    uploaded_by = db.Column(db.Integer, db.ForeignKey('user.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

# Create Notification model
Notification = None  # Will be initialized in initialize_modules

# ============================================================================
# INITIALIZE CUSTOM MODULES
# ============================================================================

# These will be initialized within an application context
jwt = None
acl_manager = None
analytics_manager = None

def initialize_modules(app, db, User):
    global jwt, acl_manager, analytics_manager, Notification
    jwt = init_auth(app, db, User)
    acl_manager = init_acl(app, db)
    analytics_manager = init_analytics(app, db)
    init_api_docs(app)
    
    # Initialize Notification model
    Notification = create_notification_model(db)

    # Register module blueprints
    create_auth_routes(app, db, User)
    create_acl_routes(app, db, acl_manager)
    create_analytics_routes(app, db, analytics_manager)
    create_user_management_routes(app, db, User)
    create_notification_routes(app, db, User, Notification)



# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

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

def scan_content_directory(user_info, acl_manager):
    """
    Hierarchical file tree **with ACL filtering**.
    Keeps original JSON shape; only filters out inaccessible items.
    """
    import os
    from datetime import datetime

    content_dir = app.config['UPLOAD_FOLDER']
    if not os.path.exists(content_dir):
        os.makedirs(content_dir)
        return []

    user_role = user_info.get('role', 'guest')

    # ---------- helper ----------
    def _allowed(path, is_file=True):
        return acl_manager.check_permission(
            user_role,
            os.path.relpath(path, content_dir),
            'read',
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
# API ROUTES - AUTHENTICATION
# ============================================================================
# Authentication routes are now handled by the 'auth' module.

# ============================================================================
# API ROUTES - FORUM
# ============================================================================

@app.route('/api/categories', methods=['GET'])
def get_categories():
    categories = Category.query.all()
    return jsonify([{
        'id': cat.id,
        'title': cat.title,
        'description': cat.description,
        'discussion_count': len(cat.discussions)
    } for cat in categories])

@app.route('/api/discussions', methods=['GET'])
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

@app.route('/api/discussions', methods=['POST'])
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

@app.route('/api/discussions/<int:discussion_id>/posts', methods=['GET'])
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

@app.route('/api/discussions/<int:discussion_id>/posts', methods=['POST'])
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
    if Notification:
        notify_new_forum_post(db, Notification, discussion_id, user_info['id'], data['content'])
    
    return jsonify({'message': 'Post created', 'id': post.id}), 201

# ============================================================================
# API ROUTES - FILES (APOTHECARY)
# ============================================================================

@app.route('/api/files/structure', methods=['GET'])
@jwt_required()
def get_file_structure():
    """Get the complete file structure for Apothecary."""
    user_info = get_current_user_info()
    # Pass user_info and acl_manager to the scanning function
    categories = scan_content_directory(user_info, acl_manager)
    
    return jsonify({
        'categories': categories,
        'metadata': {
            'total_categories': len(categories),
            'total_files': sum(len(cat['files']) for cat in categories),
            'last_updated': datetime.now().isoformat(),
            'version': '2.0'
        }
    })

@app.route('/api/files/download/<path:file_path>', methods=['GET'])
def download_file(file_path):
    """Download a file from the content directory."""
    try:
        # Normalize the file path to handle different OS path separators
        safe_path = os.path.normpath(file_path)
        
        # Prevent directory traversal attacks
        if '..' in safe_path.split(os.sep):
            return jsonify({'error': 'Invalid path'}), 400

        content_dir = app.config['UPLOAD_FOLDER']
        full_path = os.path.join(content_dir, safe_path)
        
        if not os.path.exists(full_path) or not os.path.isfile(full_path):
            return jsonify({'error': 'File not found'}), 404
        
        return send_file(full_path, as_attachment=True)
    except Exception as e:
        app.logger.error(f"File download error: {e}")
        return jsonify({'error': 'An internal error occurred'}), 500

@app.route('/api/files/upload', methods=['POST'])
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
        target_dir = os.path.join(app.config['UPLOAD_FOLDER'], target_folder)
        
        if not os.path.exists(target_dir):
            os.makedirs(target_dir)
        
        file_path = os.path.join(target_dir, filename)
        file.save(file_path)
        
        # Save file info to database
        file_item = FileItem(
            name=filename,
            original_name=file.filename,
            path=os.path.relpath(file_path, app.config['UPLOAD_FOLDER']),
            category=target_folder,
            file_type=get_file_type(filename),
            file_size=os.path.getsize(file_path),
            uploaded_by=user_info['id']
        )
        
        db.session.add(file_item)
        db.session.commit()
        
        # Create notifications for file upload
        if Notification:
            notify_new_file_upload(db, Notification, filename, user_info['id'], target_folder)
        
        return jsonify({
            'message': 'File uploaded successfully',
            'filename': filename,
            'path': file_item.path
        }), 201

@app.route('/api/folders/create', methods=['POST'])
@role_required(['admin', 'staff'])
def create_folder():
    """Create a new folder in the content directory."""
    data = request.get_json()
    folder_name = data.get('name', '').strip()
    parent_folder = data.get('parentFolder', '')
    
    if not folder_name:
        return jsonify({'error': 'Folder name is required'}), 400
    
    folder_path = os.path.join(app.config['UPLOAD_FOLDER'], parent_folder, folder_name)
    
    try:
        os.makedirs(folder_path, exist_ok=True)
        return jsonify({
            'message': 'Folder created successfully',
            'path': os.path.relpath(folder_path, app.config['UPLOAD_FOLDER'])
        }), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/user/permissions', methods=['GET'])
@jwt_required()
def get_user_permissions():
    """Get current user's permissions based on their role."""
    user_info = get_current_user_info()
    user_role = user_info.get('role', 'guest')
    
    from roles import get_role_permissions
    permissions = get_role_permissions().get(user_role, {})
    
    return jsonify({
        'role': user_role,
        'permissions': permissions,
        'user': user_info
    })

# ============================================================================
# API ROUTES - AI ASSISTANT
# ============================================================================

@app.route('/api/chat', methods=['POST'])
@jwt_required()
def chat():
    data = request.get_json()
    message = data.get('message')

    if not message:
        return jsonify({'error': 'Message is required'}), 400

    print(f"Received user message: {message}")
    print(f"Using API Key: {client.api_key}")
    print(f"Using Assistant ID: {assistant_id}")

    try:
        response = client.chat.completions.create(
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

@app.route('/content/<path:filename>')
def serve_content(filename):
    """Serve files from the content directory."""
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

# ============================================================================
# HEALTH CHECK
# ============================================================================

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'version': '1.0.0',
        'components': {
            'database': 'connected',
            'files': 'accessible',
            'ai_assistant': 'configured' if client.api_key and assistant_id else 'not_configured'
        }
    })

# ============================================================================
# APPLICATION STARTUP
# ============================================================================

from flask import send_from_directory

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_frontend(path):
    if path != "" and os.path.exists(os.path.join('build', path)):
        return send_from_directory('build', path)
    else:
        return send_from_directory('build', 'index.html')


if __name__ == '__main__':
    with app.app_context():
        # Initialize database and custom modules
        db.create_all()
        initialize_modules(app, db, User)
    
    # Ensure content directory exists
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    
    print("SW Portal Backend Starting...")
    print(f"Content directory: {app.config['UPLOAD_FOLDER']}")
    print(f"Database: {app.config['SQLALCHEMY_DATABASE_URI']}")
    print(f"AI Assistant: {'Configured' if client.api_key and assistant_id else 'Not configured'}")
    print("Server running on http://localhost:5000")
    
    # Run the Flask development server
    app.run(
        host='0.0.0.0',
        port=5000,
        debug=True
    )