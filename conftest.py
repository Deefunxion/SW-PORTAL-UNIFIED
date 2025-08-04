"""
Test configuration for SW Portal project
Pytest fixtures for backend testing
"""
import pytest
import sys
import os
from datetime import datetime

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from my_project import create_app
from my_project.extensions import db


@pytest.fixture(scope='session')
def app():
    """Create application for testing."""
    # Create app with testing config
    app = create_app()
    app.config.update({
        'TESTING': True,
        'SQLALCHEMY_DATABASE_URI': 'sqlite:///:memory:',
        'WTF_CSRF_ENABLED': False,
        'SECRET_KEY': 'test-secret-key',
        'JWT_SECRET_KEY': 'test-jwt-secret'
    })
    
    with app.app_context():
        db.create_all()
        
        # Add test data if needed
        yield app
        
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    """Flask test client."""
    return app.test_client()


@pytest.fixture
def runner(app):
    """Flask test CLI runner.""" 
    return app.test_cli_runner()


@pytest.fixture
def auth_headers(client):
    """Create test user and return JWT headers."""
    # Register test user
    response = client.post('/api/auth/register', json={
        'username': 'testuser',
        'email': 'test@example.com', 
        'password': 'testpass123'
    })
    
    # Login to get token
    response = client.post('/api/auth/login', json={
        'username': 'testuser',
        'password': 'testpass123'
    })
    
    if response.status_code == 200:
        token = response.get_json()['access_token']
        return {'Authorization': f'Bearer {token}'}
    
    return {}


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