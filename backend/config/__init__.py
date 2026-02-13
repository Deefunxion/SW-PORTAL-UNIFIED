"""
Configuration module for SW Portal
Provides different configurations for different environments
"""
import os
from datetime import timedelta


class Config:
    """Base configuration."""
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-change-in-production')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_RECORD_QUERIES = True
    
    # JWT Configuration
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', SECRET_KEY)
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=24)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)
    
    # Upload Configuration
    MAX_CONTENT_LENGTH = 50 * 1024 * 1024  # 50MB max file size
    UPLOAD_FOLDER = os.getenv('UPLOAD_FOLDER', 'uploads')
    
    # Celery Configuration (basic)
    CELERY_BROKER_URL = os.getenv('CELERY_BROKER_URL', 'redis://localhost:6379/0')
    CELERY_RESULT_BACKEND = os.getenv('CELERY_RESULT_BACKEND', 'redis://localhost:6379/0')
    
    # CORS
    CORS_ORIGINS = ["http://localhost:3000", "http://localhost:5173"]


class DevelopmentConfig(Config):
    """Development configuration."""
    DEBUG = True
    SQLALCHEMY_DATABASE_URI = os.getenv(
        'DATABASE_URL',
        'postgresql://sw_portal:sw_portal_dev@localhost:5432/sw_portal'
    )
    SQLALCHEMY_ECHO = False  # Set True for SQL debugging


class TestingConfig(Config):
    """Testing configuration."""
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    WTF_CSRF_ENABLED = False
    CORS_ORIGINS = ['http://localhost', 'http://localhost:5173']

    # Disable email sending during tests
    MAIL_SUPPRESS_SEND = True

    # Fast JWT for testing
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=15)


class ProductionConfig(Config):
    """Production configuration (Render)."""
    DEBUG = False
    SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL')

    # Security settings
    SESSION_COOKIE_SECURE = True
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'

    # In production on Render, CORS isn't needed (same origin)
    # but keep configurable for future split deployments
    CORS_ORIGINS = [o.strip() for o in os.getenv('ALLOWED_ORIGINS', '').split(',') if o.strip()]

    # Logging to stdout (Render captures stdout)
    LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')


class StagingConfig(ProductionConfig):
    """Staging configuration."""
    DEBUG = True
    LOG_LEVEL = 'DEBUG'


# Configuration mapping
config = {
    'development': DevelopmentConfig,
    'testing': TestingConfig,
    'production': ProductionConfig,
    'staging': StagingConfig,
    'default': DevelopmentConfig
}