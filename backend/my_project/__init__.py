"""
Application Factory for SW Portal
Creates and configures the Flask application instance
"""

from flask import Flask
from flask_cors import CORS
import os
import httpx
from openai import OpenAI
import chromadb

def create_app():
    """Create and configure the Flask application"""
    app = Flask(__name__)
    
    # Enable CORS for all origins (for development)
    CORS(app, origins="*")
    
    # Load configuration
    import sys
    import os
    sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from config import Config
    app.config.from_object(Config)
    
    # Initialize extensions
    from .extensions import db, celery
    db.init_app(app)
    
    # Configure Celery
    celery.conf.update(
        broker_url=app.config['CELERY_BROKER_URL'],
        result_backend=app.config['CELERY_RESULT_BACKEND'],
        task_serializer='json',
        accept_content=['json'],
        result_serializer='json',
        timezone='Europe/Athens',
        enable_utc=True,
    )
    
    # Configure Celery task context
    class ContextTask(celery.Task):
        def __call__(self, *args, **kwargs):
            with app.app_context():
                return self.run(*args, **kwargs)
    
    celery.Task = ContextTask
    
    # Initialize OpenAI client
    if app.config.get('OPENAI_API_KEY'):
        app.client = OpenAI(
            api_key=app.config['OPENAI_API_KEY'],
            default_headers={"OpenAI-Beta": "assistants=v2"}
        )
        app.assistant_id = app.config.get('OPENAI_ASSISTANT_ID')
    else:
        app.client = None
        app.assistant_id = None
    
    # Initialize HTTP client
    app.http_client = httpx.Client()
    
    # Initialize ChromaDB
    app.chroma_client = chromadb.Client()
    app.document_collection = app.chroma_client.get_or_create_collection(name="sw_portal_documents")
    
    # Register blueprints
    from .routes import main_bp
    app.register_blueprint(main_bp)
    
    # Create database tables and seed data
    with app.app_context():
        # Import models to ensure they are registered
        from .models import User, Category, Discussion, Post, FileItem
        
        # Create all tables
        db.create_all()
        
        # Seed database with default users if they don't exist
        if User.query.count() == 0:
            print("Seeding database with default users...")
            default_users = [
                {'username': 'admin', 'email': 'admin@portal.gr', 'password': 'admin123', 'role': 'admin'},
                {'username': 'staff', 'email': 'staff@portal.gr', 'password': 'staff123', 'role': 'staff'},
                {'username': 'guest', 'email': 'guest@portal.gr', 'password': 'guest123', 'role': 'guest'}
            ]
            for user_data in default_users:
                new_user = User(
                    username=user_data['username'],
                    email=user_data['email'],
                    role=user_data['role']
                )
                new_user.set_password(user_data['password'])
                db.session.add(new_user)
            db.session.commit()
            print("Default users created.")
        
        # Seed database with default categories if they don't exist
        if Category.query.count() == 0:
            print("Seeding database with default forum categories...")
            default_categories = [
                {'title': 'Γενικά Θέματα', 'description': 'Συζητήσεις για οτιδήποτε δεν ταιριάζει στις άλλες κατηγορίες.'},
                {'title': 'Νομικά Θέματα', 'description': 'Ερωτήσεις και συζητήσεις νομικού περιεχομένου.'},
                {'title': 'Δύσκολα Θέματα', 'description': 'Για πιο σύνθετα και απαιτητικά ζητήματα.'},
                {'title': 'Νέα-Ανακοινώσεις', 'description': 'Ενημερώσεις και ανακοινώσεις από τη διαχείριση.'},
                {'title': 'Προτάσεις', 'description': 'Προτάσεις για τη βελτίωση του portal.'}
            ]
            for cat_data in default_categories:
                new_cat = Category(title=cat_data['title'], description=cat_data['description'])
                db.session.add(new_cat)
            db.session.commit()
            print("Default categories created.")
    
    # Ensure content directory exists
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    
    # Log startup information
    print("SW Portal Backend Starting...")
    print(f"Content directory: {app.config['UPLOAD_FOLDER']}")
    print(f"Database: {app.config['SQLALCHEMY_DATABASE_URI']}")
    print(f"AI Assistant: {'Configured' if app.client and app.assistant_id else 'Not configured'}")
    
    return app