#!/usr/bin/env python3
"""
SW Portal Advanced ACL (Access Control List) System
Provides granular file and folder permissions management
"""

import os
import json
from datetime import datetime
from flask import request, jsonify, current_app
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text
from auth import jwt_required, admin_required, staff_required, get_current_user_info

class ACLManager:
    """Advanced Access Control List Manager"""
    
    def __init__(self, db):
        self.db = db
    
    def create_acl_tables(self):
        """Create ACL-related tables if they don't exist"""
        try:
            with self.db.engine.connect() as conn:
                # Check if tables exist
                result = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table'"))
                tables = [row[0] for row in result]
                
                if 'file_permission' not in tables:
                    conn.execute(text("""
                        CREATE TABLE file_permission (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            file_path VARCHAR(500) NOT NULL,
                            role VARCHAR(20) NOT NULL,
                            can_read BOOLEAN DEFAULT 1,
                            can_write BOOLEAN DEFAULT 0,
                            can_delete BOOLEAN DEFAULT 0,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                        )
                    """))
                    print("Created file_permission table")
                
                if 'folder_permission' not in tables:
                    conn.execute(text("""
                        CREATE TABLE folder_permission (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            folder_path VARCHAR(500) NOT NULL,
                            role VARCHAR(20) NOT NULL,
                            can_read BOOLEAN DEFAULT 1,
                            can_write BOOLEAN DEFAULT 0,
                            can_delete BOOLEAN DEFAULT 0,
                            can_create_files BOOLEAN DEFAULT 0,
                            can_create_folders BOOLEAN DEFAULT 0,
                            inherit_permissions BOOLEAN DEFAULT 1,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                        )
                    """))
                    print("Created folder_permission table")
                
                if 'user_permission' not in tables:
                    conn.execute(text("""
                        CREATE TABLE user_permission (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            user_id INTEGER NOT NULL,
                            resource_path VARCHAR(500) NOT NULL,
                            resource_type VARCHAR(20) NOT NULL,
                            can_read BOOLEAN DEFAULT 1,
                            can_write BOOLEAN DEFAULT 0,
                            can_delete BOOLEAN DEFAULT 0,
                            granted_by INTEGER,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            FOREIGN KEY (user_id) REFERENCES user (id),
                            FOREIGN KEY (granted_by) REFERENCES user (id)
                        )
                    """))
                    print("Created user_permission table")
                
                conn.commit()
                
        except Exception as e:
            print(f"Could not create ACL tables: {e}")
    
    def set_default_permissions(self):
        """Set default permissions for roles"""
        try:
            with self.db.engine.connect() as conn:
                # Default folder permissions for root directory
                default_permissions = [
                    # Admin permissions
                    ("", "admin", True, True, True, True, True, True),
                    # Staff permissions  
                    ("", "staff", True, True, False, True, True, True),
                    # Guest permissions
                    ("", "guest", True, False, False, False, False, True),
                    # Specific folder permissions
                    ("ΕΜΠΙΣΤΕΥΤΙΚΑ_ΘΕΜΑΤΑ", "guest", False, False, False, False, False, False),
                    ("ΕΜΠΙΣΤΕΥΤΙΚΑ_ΘΕΜΑΤΑ", "staff", True, False, False, False, False, True),
                    ("ΝΟΜΙΚΑ_ΘΕΜΑΤΑ", "guest", True, False, False, False, False, True),
                ]
                
                for folder_path, role, can_read, can_write, can_delete, can_create_files, can_create_folders, inherit in default_permissions:
                    # Check if permission already exists
                    result = conn.execute(text(
                        "SELECT id FROM folder_permission WHERE folder_path = :folder_path AND role = :role"),
                        {"folder_path": folder_path, "role": role}
                    )
                    
                    if not result.fetchone():
                        conn.execute(text("""
                            INSERT INTO folder_permission 
                            (folder_path, role, can_read, can_write, can_delete, can_create_files, can_create_folders, inherit_permissions)
                            VALUES (:folder_path, :role, :can_read, :can_write, :can_delete, :can_create_files, :can_create_folders, :inherit_permissions)
                        """), {
                            'folder_path': folder_path,
                            'role': role,
                            'can_read': can_read,
                            'can_write': can_write,
                            'can_delete': can_delete,
                            'can_create_files': can_create_files,
                            'can_create_folders': can_create_folders,
                            'inherit_permissions': inherit
                        })
                
                conn.commit()
                print("Default ACL permissions set")
                
        except Exception as e:
            print(f"Could not set default permissions: {e}")
    
    def check_permission(self, resource_path, permission_type, user_info=None, resource_type='file'):
        """
        Check if user has permission for a resource
        
        Args:
            resource_path: Path to file or folder
            permission_type: 'read', 'write', 'delete', 'create_files', 'create_folders'
            user_info: User information dict
            resource_type: 'file' or 'folder'
        """
        if not user_info:
            user_info = get_current_user_info()
        
        user_role = user_info.get('role', 'guest')
        user_id = user_info.get('id')
        
        # Admin has all permissions
        if user_role == 'admin':
            return True
        
        try:
            with self.db.engine.connect() as conn:
                # Check user-specific permissions first
                if user_id:
                    result = conn.execute(text("""
                        SELECT can_read, can_write, can_delete 
                        FROM user_permission 
                        WHERE user_id = ? AND resource_path = ? AND resource_type = ?
                    """, (user_id, resource_path, resource_type)))
                    
                    user_perm = result.fetchone()
                    if user_perm:
                        can_read, can_write, can_delete = user_perm
                        if permission_type == 'read':
                            return bool(can_read)
                        elif permission_type == 'write':
                            return bool(can_write)
                        elif permission_type == 'delete':
                            return bool(can_delete)
                
                # Check role-based permissions
                if resource_type == 'file':
                    # Check file-specific permissions
                    result = conn.execute(text("""
                        SELECT can_read, can_write, can_delete 
                        FROM file_permission 
                        WHERE file_path = ? AND role = ?
                    """, (resource_path, user_role)))
                    
                    file_perm = result.fetchone()
                    if file_perm:
                        can_read, can_write, can_delete = file_perm
                        if permission_type == 'read':
                            return bool(can_read)
                        elif permission_type == 'write':
                            return bool(can_write)
                        elif permission_type == 'delete':
                            return bool(can_delete)
                    
                    # Check parent folder permissions with inheritance
                    folder_path = os.path.dirname(resource_path)
                    return self._check_inherited_permission(conn, folder_path, permission_type, user_role)
                
                elif resource_type == 'folder':
                    # Check folder-specific permissions
                    result = conn.execute(text("""
                        SELECT can_read, can_write, can_delete, can_create_files, can_create_folders 
                        FROM folder_permission 
                        WHERE folder_path = ? AND role = ?
                    """, (resource_path, user_role)))
                    
                    folder_perm = result.fetchone()
                    if folder_perm:
                        can_read, can_write, can_delete, can_create_files, can_create_folders = folder_perm
                        if permission_type == 'read':
                            return bool(can_read)
                        elif permission_type == 'write':
                            return bool(can_write)
                        elif permission_type == 'delete':
                            return bool(can_delete)
                        elif permission_type == 'create_files':
                            return bool(can_create_files)
                        elif permission_type == 'create_folders':
                            return bool(can_create_folders)
                    
                    # Check parent folder permissions with inheritance
                    parent_path = os.path.dirname(resource_path)
                    if parent_path != resource_path:  # Avoid infinite recursion
                        return self._check_inherited_permission(conn, parent_path, permission_type, user_role)
                
                # Default permissions by role
                default_permissions = {
                    'admin': {'read': True, 'write': True, 'delete': True, 'create_files': True, 'create_folders': True},
                    'staff': {'read': True, 'write': True, 'delete': False, 'create_files': True, 'create_folders': True},
                    'guest': {'read': True, 'write': False, 'delete': False, 'create_files': False, 'create_folders': False}
                }
                
                return default_permissions.get(user_role, {}).get(permission_type, False)
                
        except Exception as e:
            print(f"Permission check error: {e}")
            return False
    
    def _check_inherited_permission(self, conn, folder_path, permission_type, user_role):
        """Check inherited permissions from parent folders"""
        try:
            result = conn.execute(text("""
                SELECT can_read, can_write, can_delete, can_create_files, can_create_folders, inherit_permissions
                FROM folder_permission 
                WHERE folder_path = ? AND role = ?
            """, (folder_path, user_role)))
            
            folder_perm = result.fetchone()
            if folder_perm:
                can_read, can_write, can_delete, can_create_files, can_create_folders, inherit = folder_perm
                
                if not inherit:
                    return False
                
                if permission_type == 'read':
                    return bool(can_read)
                elif permission_type == 'write':
                    return bool(can_write)
                elif permission_type == 'delete':
                    return bool(can_delete)
                elif permission_type == 'create_files':
                    return bool(can_create_files)
                elif permission_type == 'create_folders':
                    return bool(can_create_folders)
            
            # Continue up the directory tree
            parent_path = os.path.dirname(folder_path)
            if parent_path != folder_path and parent_path:
                return self._check_inherited_permission(conn, parent_path, permission_type, user_role)
            
            return False
            
        except Exception as e:
            print(f"Inherited permission check error: {e}")
            return False
    
    def set_file_permission(self, file_path, role, can_read=True, can_write=False, can_delete=False):
        """Set permission for a specific file and role"""
        try:
            with self.db.engine.connect() as conn:
                # Check if permission exists
                result = conn.execute(text(
                    "SELECT id FROM file_permission WHERE file_path = ? AND role = ?"),
                    (file_path, role)
                )
                
                if result.fetchone():
                    # Update existing permission
                    conn.execute(text("""
                        UPDATE file_permission 
                        SET can_read = ?, can_write = ?, can_delete = ?
                        WHERE file_path = ? AND role = ?
                    """, (can_read, can_write, can_delete, file_path, role)))
                else:
                    # Create new permission
                    conn.execute(text("""
                        INSERT INTO file_permission (file_path, role, can_read, can_write, can_delete)
                        VALUES (?, ?, ?, ?, ?)
                    """, (file_path, role, can_read, can_write, can_delete)))
                
                conn.commit()
                return True
                
        except Exception as e:
            print(f"Set file permission error: {e}")
            return False
    
    def set_folder_permission(self, folder_path, role, can_read=True, can_write=False, can_delete=False, 
                            can_create_files=False, can_create_folders=False, inherit_permissions=True):
        """Set permission for a specific folder and role"""
        try:
            with self.db.engine.connect() as conn:
                # Check if permission exists
                result = conn.execute(text(
                    "SELECT id FROM folder_permission WHERE folder_path = ? AND role = ?"),
                    (folder_path, role)
                )
                
                if result.fetchone():
                    # Update existing permission
                    conn.execute(text("""
                        UPDATE folder_permission 
                        SET can_read = ?, can_write = ?, can_delete = ?, 
                            can_create_files = ?, can_create_folders = ?, inherit_permissions = ?
                        WHERE folder_path = ? AND role = ?
                    """, (can_read, can_write, can_delete, can_create_files, can_create_folders, 
                         inherit_permissions, folder_path, role)))
                else:
                    # Create new permission
                    conn.execute(text("""
                        INSERT INTO folder_permission 
                        (folder_path, role, can_read, can_write, can_delete, can_create_files, can_create_folders, inherit_permissions)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """, (folder_path, role, can_read, can_write, can_delete, can_create_files, can_create_folders, inherit_permissions)))
                
                conn.commit()
                return True
                
        except Exception as e:
            print(f"Set folder permission error: {e}")
            return False
    
    def set_user_permission(self, user_id, resource_path, resource_type, can_read=True, can_write=False, can_delete=False, granted_by=None):
        """Set permission for a specific user and resource"""
        try:
            with self.db.engine.connect() as conn:
                # Check if permission exists
                result = conn.execute(text(
                    "SELECT id FROM user_permission WHERE user_id = ? AND resource_path = ? AND resource_type = ?"),
                    (user_id, resource_path, resource_type)
                )
                
                if result.fetchone():
                    # Update existing permission
                    conn.execute(text("""
                        UPDATE user_permission 
                        SET can_read = ?, can_write = ?, can_delete = ?, granted_by = ?
                        WHERE user_id = ? AND resource_path = ? AND resource_type = ?
                    """, (can_read, can_write, can_delete, granted_by, user_id, resource_path, resource_type)))
                else:
                    # Create new permission
                    conn.execute(text("""
                        INSERT INTO user_permission 
                        (user_id, resource_path, resource_type, can_read, can_write, can_delete, granted_by)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    """, (user_id, resource_path, resource_type, can_read, can_write, can_delete, granted_by)))
                
                conn.commit()
                return True
                
        except Exception as e:
            print(f"Set user permission error: {e}")
            return False
    
    def get_resource_permissions(self, resource_path, resource_type='file'):
        """Get all permissions for a resource"""
        try:
            with self.db.engine.connect() as conn:
                permissions = {
                    'role_permissions': [],
                    'user_permissions': []
                }
                
                if resource_type == 'file':
                    # Get role-based file permissions
                    result = conn.execute(text("""
                        SELECT role, can_read, can_write, can_delete, created_at
                        FROM file_permission 
                        WHERE file_path = ?
                    """, (resource_path,)))
                    
                    for row in result:
                        permissions['role_permissions'].append({
                            'role': row[0],
                            'can_read': bool(row[1]),
                            'can_write': bool(row[2]),
                            'can_delete': bool(row[3]),
                            'created_at': row[4]
                        })
                
                elif resource_type == 'folder':
                    # Get role-based folder permissions
                    result = conn.execute(text("""
                        SELECT role, can_read, can_write, can_delete, can_create_files, can_create_folders, inherit_permissions, created_at
                        FROM folder_permission 
                        WHERE folder_path = ?
                    """, (resource_path,)))
                    
                    for row in result:
                        permissions['role_permissions'].append({
                            'role': row[0],
                            'can_read': bool(row[1]),
                            'can_write': bool(row[2]),
                            'can_delete': bool(row[3]),
                            'can_create_files': bool(row[4]),
                            'can_create_folders': bool(row[5]),
                            'inherit_permissions': bool(row[6]),
                            'created_at': row[7]
                        })
                
                # Get user-specific permissions
                result = conn.execute(text("""
                    SELECT up.user_id, u.username, up.can_read, up.can_write, up.can_delete, up.created_at
                    FROM user_permission up
                    JOIN user u ON up.user_id = u.id
                    WHERE up.resource_path = ? AND up.resource_type = ?
                """, (resource_path, resource_type)))
                
                for row in result:
                    permissions['user_permissions'].append({
                        'user_id': row[0],
                        'username': row[1],
                        'can_read': bool(row[2]),
                        'can_write': bool(row[3]),
                        'can_delete': bool(row[4]),
                        'created_at': row[5]
                    })
                
                return permissions
                
        except Exception as e:
            print(f"Get resource permissions error: {e}")
            return {'role_permissions': [], 'user_permissions': []}

def init_acl(app, db):
    """Initialize ACL system"""
    acl_manager = ACLManager(db)
    acl_manager.create_acl_tables()
    acl_manager.set_default_permissions()
    
    print("ACL system initialized")
    return acl_manager

def create_acl_routes(app, db, acl_manager):
    """Create ACL management routes"""
    
    @app.route('/api/acl/permissions/<path:resource_path>', methods=['GET'])
    @staff_required
    def get_permissions(resource_path):
        """Get permissions for a resource"""
        resource_type = request.args.get('type', 'file')
        permissions = acl_manager.get_resource_permissions(resource_path, resource_type)
        return jsonify(permissions)
    
    @app.route('/api/acl/permissions/file', methods=['POST'])
    @admin_required
    def set_file_permissions():
        """Set file permissions (admin only)"""
        data = request.get_json()
        
        success = acl_manager.set_file_permission(
            data['file_path'],
            data['role'],
            data.get('can_read', True),
            data.get('can_write', False),
            data.get('can_delete', False)
        )
        
        if success:
            return jsonify({'message': 'File permissions updated successfully'})
        else:
            return jsonify({'error': 'Failed to update file permissions'}), 500
    
    @app.route('/api/acl/permissions/folder', methods=['POST'])
    @admin_required
    def set_folder_permissions():
        """Set folder permissions (admin only)"""
        data = request.get_json()
        
        success = acl_manager.set_folder_permission(
            data['folder_path'],
            data['role'],
            data.get('can_read', True),
            data.get('can_write', False),
            data.get('can_delete', False),
            data.get('can_create_files', False),
            data.get('can_create_folders', False),
            data.get('inherit_permissions', True)
        )
        
        if success:
            return jsonify({'message': 'Folder permissions updated successfully'})
        else:
            return jsonify({'error': 'Failed to update folder permissions'}), 500
    
    @app.route('/api/acl/permissions/user', methods=['POST'])
    @admin_required
    def set_user_permissions():
        """Set user-specific permissions (admin only)"""
        data = request.get_json()
        current_user = get_current_user_info()
        
        success = acl_manager.set_user_permission(
            data['user_id'],
            data['resource_path'],
            data['resource_type'],
            data.get('can_read', True),
            data.get('can_write', False),
            data.get('can_delete', False),
            current_user['id']
        )
        
        if success:
            return jsonify({'message': 'User permissions updated successfully'})
        else:
            return jsonify({'error': 'Failed to update user permissions'}), 500
    
    @app.route('/api/acl/check', methods=['POST'])
    @jwt_required()
    def check_permission():
        """Check if current user has permission for a resource"""
        data = request.get_json()
        
        has_permission = acl_manager.check_permission(
            data['resource_path'],
            data['permission_type'],
            resource_type=data.get('resource_type', 'file')
        )
        
        return jsonify({
            'has_permission': has_permission,
            'resource_path': data['resource_path'],
            'permission_type': data['permission_type']
        })
    
    print("ACL routes created")