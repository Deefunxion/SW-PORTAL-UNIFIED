#!/usr/bin/env python3
"""
SW Portal Authentication Module
Provides JWT-based authentication with role-based access control
"""

import os
import bcrypt
from datetime import datetime, timedelta
from functools import wraps
from flask import request, jsonify, current_app
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity, get_jwt
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text

# Initialize JWT manager
jwt = JWTManager()

class AuthUser:
    """Enhanced User model with roles and authentication features"""
    
    def __init__(self, db_model):
        self.db = db_model
        
    def add_role_column(self):
        """Add role column to existing User model if it doesn't exist"""
        try:
            # Check if role column exists
            with self.db.engine.connect() as conn:
                result = conn.execute(text("PRAGMA table_info(user)"))
                columns = [row[1] for row in result]
                
                if 'role' not in columns:
                    # Add role column with default value
                    conn.execute(text("ALTER TABLE user ADD COLUMN role VARCHAR(20) DEFAULT 'guest'"))
                    conn.commit()
                    print("Added role column to User table")
                
                if 'is_active' not in columns:
                    # Add is_active column
                    conn.execute(text("ALTER TABLE user ADD COLUMN is_active BOOLEAN DEFAULT 1"))
                    conn.commit()
                    print("Added is_active column to User table")
                    
                if 'last_login' not in columns:
                    # Add last_login column
                    conn.execute(text("ALTER TABLE user ADD COLUMN last_login TIMESTAMP"))
                    conn.commit()
                    print("Added last_login column to User table")
                    
        except Exception as e:
            print(f"Could not add columns to User table: {e}")

def hash_password(password):
    """Hash password using bcrypt"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def check_password(password, hashed):
    """Check password against bcrypt hash"""
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_user_token(user_id, username, role):
    """Create JWT token with user information"""
    additional_claims = {
        "username": username,
        "role": role,
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(hours=24)
    }
    
    return create_access_token(
        identity=user_id,
        additional_claims=additional_claims,
        expires_delta=timedelta(hours=24)
    )

def role_required(required_roles):
    """Decorator to require specific roles for access"""
    def decorator(f):
        @wraps(f)
        @jwt_required()
        def decorated_function(*args, **kwargs):
            claims = get_jwt()
            user_role = claims.get('role', 'guest')
            
            if isinstance(required_roles, str):
                allowed_roles = [required_roles]
            else:
                allowed_roles = required_roles
                
            if user_role not in allowed_roles:
                return jsonify({
                    'error': 'Insufficient permissions',
                    'required_roles': allowed_roles,
                    'user_role': user_role
                }), 403
                
            return f(*args, **kwargs)
        return decorated_function
    return decorator

def admin_required(f):
    """Decorator to require admin role"""
    return role_required('admin')(f)

def staff_required(f):
    """Decorator to require staff or admin role"""
    return role_required(['admin', 'staff'])(f)

def auth_optional(f):
    """Decorator for optional authentication"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            # Try to get JWT token
            jwt_required()(lambda: None)()
            return f(*args, **kwargs)
        except:
            # If no valid token, continue without authentication
            return f(*args, **kwargs)
    return decorated_function

def get_current_user_info():
    """Get current user information from JWT token"""
    try:
        user_id = get_jwt_identity()
        claims = get_jwt()
        return {
            'id': user_id,
            'username': claims.get('username'),
            'role': claims.get('role', 'guest'),
            'authenticated': True
        }
    except:
        return {
            'id': None,
            'username': 'anonymous',
            'role': 'guest',
            'authenticated': False
        }

def init_auth(app, db, User):
    """Initialize authentication system"""
    
    # Configure JWT
    app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', app.config['SECRET_KEY'])
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=24)
    app.config['JWT_ALGORITHM'] = 'HS256'
    
    jwt.init_app(app)
    
    # Initialize enhanced user model
    auth_user = AuthUser(db)
    auth_user.add_role_column()
    
    # Update existing admin user with admin role
    try:
        admin_user = User.query.filter_by(username='admin').first()
        if admin_user:
            # Update admin user with new fields using raw SQL
            with db.engine.connect() as conn:
                conn.execute(
                    text("UPDATE user SET role = 'admin', is_active = 1 WHERE username = 'admin'")
                )
                conn.commit()
                print("Updated admin user with admin role")
    except Exception as e:
        print(f"Could not update admin user: {e}")
    
    # JWT error handlers
    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        return jsonify({'error': 'Token has expired'}), 401
    
    @jwt.invalid_token_loader
    def invalid_token_callback(error):
        return jsonify({'error': 'Invalid token'}), 401
    
    @jwt.unauthorized_loader
    def missing_token_callback(error):
        return jsonify({'error': 'Authorization token is required'}), 401
    
    print("Authentication system initialized")
    
    return jwt

def create_auth_routes(app, db, User):
    """Create authentication routes"""
    
    @app.route('/api/auth/login', methods=['POST'])
    def enhanced_login():
        """Enhanced login with JWT token generation"""
        data = request.get_json()
        
        if not data or not data.get('username') or not data.get('password'):
            return jsonify({'error': 'Username and password are required'}), 400
        
        # Query user with raw SQL to handle new columns
        try:
            with db.engine.connect() as conn:
                result = conn.execute(
                    text("SELECT id, username, email, password_hash, role, is_active FROM user WHERE username = ?"),
                    (data['username'],)
                )
                user_data = result.fetchone()
                
                if not user_data:
                    return jsonify({'error': 'Invalid credentials'}), 401
                
                user_id, username, email, password_hash, role, is_active = user_data
                
                # Check if user is active
                if not is_active:
                    return jsonify({'error': 'Account is deactivated'}), 401
                
                # Check password (handle both old and new password formats)
                password_valid = False
                try:
                    # Try new bcrypt format first
                    password_valid = check_password(data['password'], password_hash)
                except:
                    # Fall back to old Werkzeug format
                    from werkzeug.security import check_password_hash
                    password_valid = check_password_hash(password_hash, data['password'])
                
                if not password_valid:
                    return jsonify({'error': 'Invalid credentials'}), 401
                
                # Update last login
                conn.execute(
                    text("UPDATE user SET last_login = ? WHERE id = ?"),
                    (datetime.utcnow(), user_id)
                )
                conn.commit()
                
                # Create JWT token
                token = create_user_token(user_id, username, role or 'guest')
                
                return jsonify({
                    'message': 'Login successful',
                    'access_token': token,
                    'user': {
                        'id': user_id,
                        'username': username,
                        'email': email,
                        'role': role or 'guest'
                    }
                })
                
        except Exception as e:
            print(f"Login error: {e}")
            return jsonify({'error': 'Login failed'}), 500
    
    @app.route('/api/auth/register', methods=['POST'])
    def enhanced_register():
        """Enhanced registration with role assignment"""
        data = request.get_json()
        
        if not data or not all(k in data for k in ['username', 'email', 'password']):
            return jsonify({'error': 'Username, email, and password are required'}), 400
        
        # Check if user already exists
        if User.query.filter_by(username=data['username']).first():
            return jsonify({'error': 'Username already exists'}), 400
        
        if User.query.filter_by(email=data['email']).first():
            return jsonify({'error': 'Email already exists'}), 400
        
        try:
            # Create new user with bcrypt password
            hashed_password = hash_password(data['password'])
            role = data.get('role', 'guest')  # Default to guest role
            
            # Validate role
            if role not in ['admin', 'staff', 'guest']:
                role = 'guest'
            
            # Only allow admin creation by existing admins
            if role == 'admin':
                try:
                    current_user = get_current_user_info()
                    if current_user['role'] != 'admin':
                        role = 'guest'
                except:
                    role = 'guest'
            
            # Insert user with raw SQL to handle new columns
            with db.engine.connect() as conn:
                conn.execute(
                    text("INSERT INTO user (username, email, password_hash, role, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?)"),
                    (data['username'], data['email'], hashed_password, role, True, datetime.utcnow())
                )
                conn.commit()
            
            return jsonify({
                'message': 'User created successfully',
                'user': {
                    'username': data['username'],
                    'email': data['email'],
                    'role': role
                }
            }), 201
            
        except Exception as e:
            print(f"Registration error: {e}")
            return jsonify({'error': 'Registration failed'}), 500
    
    @app.route('/api/auth/me', methods=['GET'])
    @jwt_required()
    def get_current_user():
        """Get current user information"""
        user_info = get_current_user_info()
        return jsonify(user_info)
    
    @app.route('/api/auth/logout', methods=['POST'])
    @jwt_required()
    def logout():
        """Logout user (client should discard token)"""
        return jsonify({'message': 'Logged out successfully'})
    
    @app.route('/api/auth/users', methods=['GET'])
    @admin_required
    def list_users():
        """List all users (admin only)"""
        try:
            with db.engine.connect() as conn:
                result = conn.execute(
                    text("SELECT id, username, email, role, is_active, created_at, last_login FROM user ORDER BY created_at DESC")
                )
                users = []
                for row in result:
                    users.append({
                        'id': row[0],
                        'username': row[1],
                        'email': row[2],
                        'role': row[3] or 'guest',
                        'is_active': bool(row[4]),
                        'created_at': row[5],
                        'last_login': row[6]
                    })
                
                return jsonify({'users': users})
                
        except Exception as e:
            print(f"List users error: {e}")
            return jsonify({'error': 'Failed to list users'}), 500
    
    @app.route('/api/auth/users/<int:user_id>/role', methods=['PUT'])
    @admin_required
    def update_user_role(user_id):
        """Update user role (admin only)"""
        data = request.get_json()
        new_role = data.get('role')
        
        if new_role not in ['admin', 'staff', 'guest']:
            return jsonify({'error': 'Invalid role'}), 400
        
        try:
            with db.engine.connect() as conn:
                conn.execute(
                    text("UPDATE user SET role = ? WHERE id = ?"),
                    (new_role, user_id)
                )
                conn.commit()
                
                return jsonify({'message': 'User role updated successfully'})
                
        except Exception as e:
            print(f"Update role error: {e}")
            return jsonify({'error': 'Failed to update user role'}), 500
    
    @app.route('/api/auth/users/<int:user_id>/status', methods=['PUT'])
    @admin_required
    def update_user_status(user_id):
        """Update user active status (admin only)"""
        data = request.get_json()
        is_active = data.get('is_active', True)
        
        try:
            with db.engine.connect() as conn:
                conn.execute(
                    text("UPDATE user SET is_active = ? WHERE id = ?"),
                    (is_active, user_id)
                )
                conn.commit()
                
                return jsonify({'message': 'User status updated successfully'})
                
        except Exception as e:
            print(f"Update status error: {e}")
            return jsonify({'error': 'Failed to update user status'}), 500
    
    print("Authentication routes created")

