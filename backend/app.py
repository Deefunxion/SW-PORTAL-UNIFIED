# backend/app.py

from flask import Flask
from celery import Celery
import os
from flask_cors import CORS
from dotenv import load_dotenv
import httpx
from openai import OpenAI

# Import Config from my_project
from .my_project.config import Config

# Import db from extensions
from .my_project.extensions import db


def make_celery(app):
    celery = Celery(
        app.import_name,
        backend=app.config['CELERY_RESULT_BACKEND'],
        broker=app.config['CELERY_BROKER_URL']
    )
    celery.conf.update(app.config)

    class ContextTask(celery.Task):
        def __call__(self, *args, **kwargs):
            with app.app_context():
                return self.run(*args, **kwargs)

    celery.Task = ContextTask
    return celery


def create_app():
    app = Flask(__name__)
    CORS(app, origins="*")  # Allow all origins for local development

    # Load configuration from Config class
    app.config.from_object(Config)

    # --- Initialize Extensions ---
    db.init_app(app)

    # Initialize OpenAI client and attach to app object
    load_dotenv()
    app.http_client = httpx.Client()
    openai_api_key = os.getenv("OPENAI_API_KEY")
    if openai_api_key:
        app.client = OpenAI(
            api_key=openai_api_key,
            default_headers={"OpenAI-Beta": "assistants=v2"}
        )
        app.assistant_id = os.getenv("OPENAI_ASSISTANT_ID")
    else:
        app.client = None
        app.assistant_id = None

    # Initialize ChromaDB and attach to app object
    import chromadb
    app.chroma_client = chromadb.Client()
    app.document_collection = app.chroma_client.get_or_create_collection(name="sw_portal_documents")

    # --- Import Models and Blueprints ---
    with app.app_context():
        # Import models here to ensure db is initialized
        from .my_project.models.main import User, Category, Discussion, Post, FileItem

        # Import custom modules and utility functions
        from .my_project.auth_and_permissions.auth import init_auth, create_auth_routes, jwt_required, admin_required, get_current_user_info
        from .my_project.auth_and_permissions.acl import init_acl, create_acl_routes
        from .my_project.auth_and_permissions.analytics import init_analytics, create_analytics_routes
        from .my_project.auth_and_permissions.roles import role_required, admin_only, staff_and_admin, user_can, get_role_permissions
        from .my_project.auth_and_permissions.user_management import create_user_management_routes
        from .my_project.auth_and_permissions.notifications import create_notification_model, create_notification_routes, create_notification, notify_new_forum_post, notify_new_file_upload
        from .my_project.models.forum_models import create_enhanced_forum_models, enhance_post_model
        from .my_project.models.messaging_models import create_messaging_models
        from .my_project.api.user_profiles import create_user_profile_routes
        from .my_project.api.forum_api import create_enhanced_forum_routes
        from .my_project.api.messaging_api import create_messaging_routes
        from .my_project.routes.main import main_bp  # Import the main blueprint
        from .my_project.services.tasks import process_document_pipeline  # Import tasks here to avoid circular dependency

        # ============================================================================
        # INITIALIZE CUSTOM MODULES
        # ============================================================================

        def initialize_modules(app, db, User, Post, Discussion, enhanced_forum_models, Notification_model):
            jwt = init_auth(app, db, User)
            acl_manager = init_acl(app, db)
            analytics_manager = init_analytics(app, db)
            # init_api_docs(app) # This needs to be handled carefully with blueprints

            # Initialize Notification model
            Notification = Notification_model  # Assign the passed Notification model

            # Attach to app object
            app.jwt = jwt
            app.acl_manager = acl_manager
            app.analytics_manager = analytics_manager
            app.Notification = Notification

            # Register module blueprints
            create_auth_routes(app, db, User)
            create_acl_routes(app, db, acl_manager)
            create_analytics_routes(app, db, analytics_manager)
            create_user_management_routes(app, db, User)
            create_notification_routes(app, db, User, Notification)

            # Register new enhanced module blueprints
            create_enhanced_forum_routes(app, db, User, Post, Discussion, enhanced_forum_models)
            create_messaging_routes(app, db, User)
            create_user_profile_routes(app, db, User)

            # Register the main blueprint
            app.register_blueprint(main_bp)

            # Return necessary objects for seeding or other uses
            return {
                'User': User,
                'Category': Category,
                'Discussion': Discussion,
                'Post': Post,
                'FileItem': FileItem,
                'enhanced_forum_models': enhanced_forum_models
            }

        # Call initialize_modules here
        initialized_modules = initialize_modules(app, db, User, Post, Discussion, create_enhanced_forum_models(db), create_notification_model(db))
        # Access initialized objects if needed, e.g., User for seeding
        User = initialized_modules['User']
        Category = initialized_modules['Category']  # Assuming Category is also returned or globally accessible

        # Seed database with default users if they don't exist
        if User.query.count() == 0:
            print("Seeding database with default users...")
            default_users = [
                {'username': 'admin', 'email': 'admin@portal.gr', 'password': 'admin123', 'role': 'admin'},
                {'username': 'staff', 'email': 'staff@portal.gr', 'password': 'staff123', 'role': 'staff'},
                {'username': 'guest', 'email': 'guest@portal.gr', 'password': 'guest123', 'role': 'guest'}
            ]
            for user_data in default_users:
                # Έλεγχος για το αν το μοντέλο User έχει το πεδίο 'role'
                if 'role' in User.__table__.columns:
                    new_user = User(
                        username=user_data['username'],
                        email=user_data['email'],
                        role=user_data['role']  # Προσθήκη του ρόλου
                    )
                else:
                    new_user = User(
                        username=user_data['username'],
                        email=user_data['email']
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

    print("SW Portal Backend Starting...")
    print(f"Content directory: {app.config['UPLOAD_FOLDER']}")
    print(f"Database: {app.config['SQLALCHEMY_DATABASE_URI']}")
    print(f"AI Assistant: {'Configured' if app.client and app.client.api_key and app.assistant_id else 'Not configured'}")
    print("Server running on http://localhost:5000")

    # Run the Flask development server
    app.run(
        host='0.0.0.0',
        port=5000,
        debug=True
    )

    return app


# --- Δημιουργία των instances ---
app = create_app()
celery = make_celery(app)

if __name__ == '__main__':
    with app.app_context():
        # Initialize database
        db.create_all()
        # Initialize custom modules (now called inside create_app)
        pass
