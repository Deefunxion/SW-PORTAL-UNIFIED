"""
Test configuration for SW Portal project
Pytest fixtures for backend testing
"""
import pytest
import sys
import os
from datetime import datetime

# Force testing config BEFORE importing the app
os.environ['DATABASE_URL'] = 'sqlite:///:memory:'
os.environ['FLASK_ENV'] = 'testing'
os.environ['SECRET_KEY'] = 'test-secret-key-long-enough-for-hmac'
os.environ['JWT_SECRET_KEY'] = 'test-jwt-secret-key-long-enough-for-hmac'

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from my_project import create_app
from my_project.extensions import db


@pytest.fixture(scope='session')
def app():
    """Create application for testing."""
    app = create_app()
    app.config.update({
        'TESTING': True,
        'SQLALCHEMY_DATABASE_URI': 'sqlite:///:memory:',
        'WTF_CSRF_ENABLED': False,
        'SECRET_KEY': 'test-secret-key-long-enough-for-hmac',
        'JWT_SECRET_KEY': 'test-jwt-secret-key-long-enough-for-hmac'
    })

    with app.app_context():
        db.create_all()

        # Add test data if needed
        yield app

        db.session.remove()
        db.drop_all()


@pytest.fixture(autouse=True)
def reset_rate_limiter(app):
    """Reset rate limiter storage between tests to prevent cross-test interference."""
    from my_project.extensions import limiter
    limiter.reset()
    yield


@pytest.fixture
def client(app):
    """Flask test client."""
    return app.test_client()


@pytest.fixture
def runner(app):
    """Flask test CLI runner."""
    return app.test_cli_runner()


@pytest.fixture
def auth_headers(app, client):
    """Create test user via ORM and return JWT headers."""
    from my_project.models import User
    from my_project.extensions import db as _db

    with app.app_context():
        user = User.query.filter_by(username='testuser').first()
        if not user:
            user = User(username='testuser', email='test@example.com', role='guest')
            user.set_password('testpass123')
            _db.session.add(user)
            _db.session.commit()

    response = client.post('/api/auth/login', json={
        'username': 'testuser',
        'password': 'testpass123'
    })
    token = response.get_json()['access_token']
    return {'Authorization': f'Bearer {token}'}


@pytest.fixture
def admin_headers(app, client):
    """Create admin user via ORM and return JWT headers."""
    from my_project.models import User
    from my_project.extensions import db as _db

    with app.app_context():
        user = User.query.filter_by(username='testadmin').first()
        if not user:
            user = User(username='testadmin', email='admin@test.com', role='admin')
            user.set_password('adminpass123')
            _db.session.add(user)
            _db.session.commit()

    response = client.post('/api/auth/login', json={
        'username': 'testadmin',
        'password': 'adminpass123'
    })
    token = response.get_json()['access_token']
    return {'Authorization': f'Bearer {token}'}


@pytest.fixture
def sample_user_data():
    """Sample user data for testing."""
    return {
        'username': 'sampleuser',
        'email': 'sample@example.com',
        'password': 'samplepass123',
        'first_name': 'Sample',
        'last_name': 'User'
    }


@pytest.fixture
def sample_post_data():
    """Sample forum post data for testing."""
    return {
        'title': 'Test Post Title',
        'content': 'This is test post content for testing purposes.',
        'category': 'general'
    }
