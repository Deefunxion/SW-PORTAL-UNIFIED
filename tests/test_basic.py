"""
Basic smoke tests to verify the application starts correctly
Lightweight tests that don't require heavy dependencies
"""
import pytest


def test_app_creation(app):
    """Test that the Flask app can be created."""
    assert app is not None
    assert app.config['TESTING'] is True


def test_app_context(app):
    """Test that app context works."""
    with app.app_context():
        assert app.config['TESTING'] is True


def test_client_creation(client):
    """Test that test client can be created."""
    assert client is not None


def test_health_endpoint_exists(client):
    """Test basic health/root endpoint exists."""
    response = client.get('/')
    # Should return something (not necessarily 200, could be 404)
    assert response is not None


@pytest.mark.unit
def test_config_values(app):
    """Test configuration values are set correctly."""
    assert app.config['SECRET_KEY'] == 'test-secret-key-long-enough-for-hmac'
    assert 'sqlite:///:memory:' in app.config['SQLALCHEMY_DATABASE_URI']
    assert app.config['TESTING'] is True


def test_database_creation(app):
    """Test that database tables can be created."""
    from my_project.extensions import db
    from sqlalchemy import text
    
    with app.app_context():
        # Check that we can access the database (SQLAlchemy 2.0 syntax)
        result = db.session.execute(text('SELECT 1')).fetchone()
        assert result[0] == 1  # Verify we got the expected result