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

# Load environment variables
load_dotenv()
http_client = httpx.Client()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"), http_client=http_client)
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

def scan_content_directory():
    """Scan the content directory and return a hierarchical structure."""
    content_dir = app.config['UPLOAD_FOLDER']
    if not os.path.exists(content_dir):
        os.makedirs(content_dir)
        return []

    # Create a nested dictionary to hold the directory structure
    dir_structure = {}

    for root, dirs, files in os.walk(content_dir):
        # Don't include the root directory itself in the path
        if root == content_dir:
            path_parts = []
        else:
            relative_path = os.path.relpath(root, content_dir)
            path_parts = relative_path.split(os.sep)

        # Navigate to the correct position in the nested dictionary
        current_level = dir_structure
        for part in path_parts:
            current_level = current_level.setdefault(part, {})

        # Add files to the current directory
        file_list = []
        for filename in files:
            file_path = os.path.join(root, filename)
            try:
                file_stat = os.stat(file_path)
                file_list.append({
                    'id': f"{'_'.join(path_parts)}_{filename}".replace(' ', '_'),
                    'name': filename,
                    'type': get_file_type(filename),
                    'extension': filename.split('.')[-1].lower() if '.' in filename else '',
                    'path': os.path.relpath(file_path, content_dir).replace('\\', '/'),
                    'downloadUrl': f"/api/files/download/{os.path.relpath(file_path, content_dir).replace(os.sep, '/')}",
                    'size': file_stat.st_size,
                    'lastModified': datetime.fromtimestamp(file_stat.st_mtime).isoformat()
                })
            except FileNotFoundError:
                # File might have been deleted during the scan
                continue
        
        if file_list:
            current_level['__files__'] = file_list

        # Add subdirectories
        for d in dirs:
            current_level.setdefault(d, {})

    # Recursive function to convert the nested dictionary to the desired list format
    def build_category_list(d, current_path=""):
        category_list = []
        for name, content in d.items():
            if name == '__files__':
                continue

            new_path = os.path.join(current_path, name) if current_path else name
            
            category_item = {
                'id': new_path.replace(os.sep, '_').replace(' ', '_'),
                'category': name,
                'path': new_path.replace('\\', '/'),
                'files': content.get('__files__', []),
                'subfolders': build_category_list(content, new_path)
            }
            category_list.append(category_item)
            
        return category_list

    return build_category_list(dir_structure)

def init_database():
    """Initialize database with default data."""
    with app.app_context():
        db.create_all()
        
        # Create default categories if they don't exist
        if Category.query.count() == 0:
            default_categories = [
                {
                    'title': 'ΓΕΝΙΚΑ ΘΕΜΑΤΑ',
                    'description': 'Γενικές συζητήσεις και θέματα'
                },
                {
                    'title': 'ΔΥΣΚΟΛΑ ΘΕΜΑΤΑ',
                    'description': 'Σύνθετα και δύσκολα θέματα που χρειάζονται ειδική προσοχή'
                },
                {
                    'title': 'ΕΜΠΙΣΤΕΥΤΙΚΑ ΘΕΜΑΤΑ',
                    'description': 'Εμπιστευτικές συζητήσεις για εσωτερική χρήση'
                },
                {
                    'title': 'ΝΟΜΙΚΑ ΘΕΜΑΤΑ',
                    'description': 'Νομικές συμβουλές και νομοθετικά θέματα'
                },
                {
                    'title': 'ΠΡΟΤΑΣΕΙΣ',
                    'description': 'Προτάσεις για βελτίωση και νέες ιδέες'
                },
                {
                    'title': 'ΝΕΑ - ΑΝΑΚΟΙΝΩΣΕΙΣ',
                    'description': 'Νέα και επίσημες ανακοινώσεις'
                }
            ]
            
            for cat_data in default_categories:
                category = Category(**cat_data)
                db.session.add(category)
            
            db.session.commit()
            print("✅ Default categories created")
        
        # Create default admin user if no users exist
        if User.query.count() == 0:
            admin_user = User(
                username='admin',
                email='admin@swportal.gr'
            )
            admin_user.set_password('admin123')
            db.session.add(admin_user)
            db.session.commit()
            print("✅ Default admin user created (admin/admin123)")

# ============================================================================
# API ROUTES - AUTHENTICATION
# ============================================================================

@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.get_json()
    
    if User.query.filter_by(username=data['username']).first():
        return jsonify({'error': 'Username already exists'}), 400
    
    if User.query.filter_by(email=data['email']).first():
        return jsonify({'error': 'Email already exists'}), 400
    
    user = User(
        username=data['username'],
        email=data['email']
    )
    user.set_password(data['password'])
    
    db.session.add(user)
    db.session.commit()
    
    return jsonify({'message': 'User created successfully'}), 201

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    user = User.query.filter_by(username=data['username']).first()
    
    if user and user.check_password(data['password']):
        return jsonify({
            'message': 'Login successful',
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email
            }
        })
    
    return jsonify({'error': 'Invalid credentials'}), 401

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
def create_discussion():
    data = request.get_json()
    
    discussion = Discussion(
        title=data['title'],
        description=data.get('description', ''),
        category_id=data['category_id'],
        user_id=1  # Default to admin user for now
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
def create_post(discussion_id):
    data = request.get_json()
    
    post = Post(
        content=data['content'],
        discussion_id=discussion_id,
        user_id=1  # Default to admin user for now
    )
    
    db.session.add(post)
    db.session.commit()
    
    return jsonify({'message': 'Post created', 'id': post.id}), 201

# ============================================================================
# API ROUTES - FILES (APOTHECARY)
# ============================================================================

@app.route('/api/files/structure', methods=['GET'])
def get_file_structure():
    """Get the complete file structure for Apothecary."""
    categories = scan_content_directory()
    
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
def upload_file():
    """Upload a new file to the content directory."""
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    target_folder = request.form.get('targetFolder', 'uploads')
    
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    if file:
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
            uploaded_by=1  # Default to admin user
        )
        
        db.session.add(file_item)
        db.session.commit()
        
        return jsonify({
            'message': 'File uploaded successfully',
            'filename': filename,
            'path': file_item.path
        }), 201

@app.route('/api/folders/create', methods=['POST'])
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

# ============================================================================
# API ROUTES - AI ASSISTANT
# ============================================================================

@app.route('/api/chat', methods=['POST'])
def chat():
    """Handle AI Assistant chat requests."""
    data = request.get_json()
    message = data.get('message')
    thread_id = data.get('thread_id')
    
    if not message:
        return jsonify({'error': 'Message is required'}), 400
    
    try:
        if not client.api_key or not assistant_id:
            return jsonify({
                'response': f'Λυπάμαι, το AI Assistant δεν είναι διαθέσιμο αυτή τη στιγμή. Το μήνυμά σας ήταν: "{message}"',
                'thread_id': thread_id or 'mock-thread-id'
            })

        # Validate thread_id if it exists
        if thread_id:
            try:
                client.beta.threads.retrieve(thread_id)
            except openai.NotFoundError:
                # If thread is not found, create a new one
                thread_id = None
        
        if not thread_id:
            thread = client.beta.threads.create()
            thread_id = thread.id
        
        client.beta.threads.messages.create(
            thread_id=thread_id,
            role="user",
            content=message
        )
        
        run = client.beta.threads.runs.create(
            thread_id=thread_id,
            assistant_id=assistant_id
        )
        
        # Wait for completion, with a timeout
        start_time = datetime.now()
        while run.status not in ['completed', 'failed']:
            if (datetime.now() - start_time).seconds > 30: # 30-second timeout
                return jsonify({'error': 'Assistant request timed out.'}), 504

            run = client.beta.threads.runs.retrieve(
                thread_id=thread_id,
                run_id=run.id
            )
        
        if run.status == 'failed':
            return jsonify({'error': 'Assistant run failed.'}), 500
        
        messages = client.beta.threads.messages.list(thread_id=thread_id)
        response_text = messages.data[0].content[0].text.value
        
        return jsonify({
            'response': response_text,
            'thread_id': thread_id
        })
        
    except openai.APIError as e:
        # Handle specific OpenAI API errors
        app.logger.error(f"OpenAI API error: {e}")
        return jsonify({'error': f'An error occurred with the AI service: {e}'}), 502
    except Exception as e:
        app.logger.error(f"Chat error: {e}")
        return jsonify({'error': 'An internal error occurred.'}), 500

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

if __name__ == '__main__':
    # Initialize database
    init_database()
    
    # Ensure content directory exists
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    
    print("SW Portal Backend Starting...")
    print(f"Content directory: {app.config['UPLOAD_FOLDER']}")
    print(f"Database: {app.config['SQLALCHEMY_DATABASE_URI']}")
    print(f"AI Assistant: {'Configured' if openai.api_key and assistant_id else 'Not configured'}")
    print("Server running on http://localhost:5000")
    
    # Run the Flask development server
    app.run(
        host='0.0.0.0',
        port=5000,
        debug=True
    )

