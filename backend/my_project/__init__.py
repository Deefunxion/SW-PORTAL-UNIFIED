"""
Application Factory for ΠΥΛΗ ΚΟΙΝΩΝΙΚΗΣ ΜΕΡΙΜΝΑΣ
Creates and configures the Flask application instance
"""

from flask import Flask
from flask_cors import CORS
import os
import httpx
from dotenv import load_dotenv

load_dotenv()  # Load .env file


def create_app():
    """Create and configure the Flask application"""
    app = Flask(__name__)

    # Load configuration from config classes
    env = os.environ.get('FLASK_ENV', 'development')
    from config import config as config_map
    app.config.from_object(config_map.get(env, config_map['development']))

    # Override with environment variables if present
    if os.environ.get('DATABASE_URL'):
        db_url = os.environ['DATABASE_URL']
        # Render/Heroku provides postgres:// but SQLAlchemy requires postgresql://
        if db_url.startswith('postgres://'):
            db_url = db_url.replace('postgres://', 'postgresql://', 1)
        app.config['SQLALCHEMY_DATABASE_URI'] = db_url
    if os.environ.get('SECRET_KEY'):
        app.config['SECRET_KEY'] = os.environ['SECRET_KEY']
    if os.environ.get('JWT_SECRET_KEY'):
        app.config['JWT_SECRET_KEY'] = os.environ['JWT_SECRET_KEY']

    app.config['UPLOAD_FOLDER'] = os.environ.get('UPLOAD_FOLDER', '../content')
    app.config['KNOWLEDGE_FOLDER'] = os.environ.get(
        'KNOWLEDGE_FOLDER',
        os.path.join(os.path.dirname(__file__), '..', '..', 'knowledge')
    )
    app.config['MAX_CONTENT_LENGTH'] = 256 * 1024 * 1024
    app.config['FRONTEND_DIR'] = os.environ.get(
        'FRONTEND_DIR',
        os.path.join(os.path.dirname(__file__), '..', '..', 'frontend', 'dist')
    )

    # Enable CORS for configured origins
    CORS(app, origins=app.config.get('CORS_ORIGINS', ['http://localhost:5173']))

    # Initialize extensions
    from .extensions import db, migrate, celery, limiter
    from flask_jwt_extended import JWTManager
    db.init_app(app)
    migrate.init_app(app, db)
    limiter.init_app(app)
    JWTManager(app)

    # Configure Celery
    celery.conf.update(
        broker_url=app.config.get('CELERY_BROKER_URL', 'redis://localhost:6379/0'),
        result_backend=app.config.get('CELERY_RESULT_BACKEND', 'redis://localhost:6379/0'),
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

    # Initialize OpenAI client (optional — only if API key present)
    openai_key = os.environ.get('OPENAI_API_KEY')
    if openai_key and not openai_key.startswith('sk-your'):
        try:
            from openai import OpenAI
            app.client = OpenAI(api_key=openai_key)
        except Exception:
            app.client = None
    else:
        app.client = None
    app.assistant_id = None

    # Initialize HTTP client
    app.http_client = httpx.Client()

    # ChromaDB removed — using pgvector for embeddings
    app.chroma_client = None
    app.document_collection = None

    # Register blueprints
    from .routes import main_bp
    app.register_blueprint(main_bp)

    from .registry import registry_bp
    app.register_blueprint(registry_bp)

    from .inspections import inspections_bp
    app.register_blueprint(inspections_bp)

    from .oversight import oversight_bp
    app.register_blueprint(oversight_bp)

    from .sanctions import sanctions_bp
    app.register_blueprint(sanctions_bp)

    # Create database tables and seed data
    with app.app_context():
        # Import models to ensure they are registered
        from .models import User, Category, Discussion, Post, FileItem, AuditLog, ChatSession, ChatMessage
        from .registry.models import Structure, StructureType, License, Sanction
        from .inspections.models import (InspectionCommittee, CommitteeMembership,
            CommitteeStructureAssignment, Inspection, InspectionReport,
            ChecklistTemplate)
        from .oversight.models import UserRole, SocialAdvisorReport
        from .sanctions.models import SanctionRule

        # Enable pgvector extension (required for Vector columns)
        try:
            db.session.execute(db.text('CREATE EXTENSION IF NOT EXISTS vector'))
            db.session.commit()
        except Exception:
            db.session.rollback()  # Fails on SQLite (testing) — that's OK

        # Create all tables
        db.create_all()

        # Auto-migrate: add columns that create_all() can't add to existing tables
        _migrate_columns = [
            ('users', 'peripheral_unit', 'VARCHAR(100)'),
            ('structures', 'peripheral_unit', 'VARCHAR(100)'),
            ('inspection_reports', 'checklist_data', 'TEXT'),
        ]
        for table, column, col_type in _migrate_columns:
            try:
                db.session.execute(db.text(
                    f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {column} {col_type}"
                ))
                db.session.commit()
            except Exception:
                db.session.rollback()

        # Seed comprehensive demo data (users, structures, inspections, forum, etc.)
        # Runs in development OR when SEED_DEMO=true (for Render)
        # Skipped in testing (tests create their own data) and production
        should_seed = (env == 'development') or os.environ.get('SEED_DEMO', '').lower() == 'true'
        if should_seed:
            try:
                from .seed_demo import seed_demo_data
                seed_demo_data()
            except Exception as e:
                db.session.rollback()
                print(f"[seed] Warning: {e}")

        # Auto-ingest knowledge base if empty (for Render / fresh deploys)
        try:
            from .models import DocumentIndex, FileChunk
            if DocumentIndex.query.count() == 0:
                knowledge_dir = os.path.abspath(app.config['KNOWLEDGE_FOLDER'])
                if os.path.exists(knowledge_dir):
                    from .ai.knowledge import process_file
                    generate_vectors = bool(app.client)  # Only if OpenAI key present
                    docs_found = 0
                    for root, dirs, files in os.walk(knowledge_dir):
                        for fname in files:
                            if os.path.splitext(fname)[1].lower() in {'.txt', '.md'}:
                                fpath = os.path.join(root, fname)
                                try:
                                    process_file(fpath, generate_vectors=generate_vectors)
                                    docs_found += 1
                                except Exception:
                                    pass
                    print(f"[knowledge] Ingested {docs_found} documents"
                          f" ({'with' if generate_vectors else 'without'} embeddings)")
                else:
                    print(f"[knowledge] Directory not found: {knowledge_dir}")
        except Exception as e:
            print(f"[knowledge] Warning: {e}")

    # Security headers on every response
    @app.after_request
    def set_security_headers(response):
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['X-XSS-Protection'] = '1; mode=block'
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        response.headers['Permissions-Policy'] = 'camera=(), microphone=(), geolocation=()'
        if not app.debug:
            response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
            response.headers['Content-Security-Policy'] = (
                "default-src 'self'; "
                "script-src 'self'; "
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
                "font-src 'self' https://fonts.gstatic.com; "
                "img-src 'self' data: blob:; "
                "connect-src 'self'"
            )
        return response

    # Ensure content directory exists
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

    # Log startup information
    print("ΠΥΛΗ ΚΟΙΝΩΝΙΚΗΣ ΜΕΡΙΜΝΑΣ Backend Starting...")
    print(f"Content directory: {app.config['UPLOAD_FOLDER']}")
    print(f"Database: {app.config['SQLALCHEMY_DATABASE_URI']}")
    print(f"AI Client: {'Configured' if app.client else 'Not configured'}")

    return app
