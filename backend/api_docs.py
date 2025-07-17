#!/usr/bin/env python3
"""
SW Portal API Documentation Module
Provides OpenAPI 3.1 specification and Swagger UI integration
"""

import json
from flask import Blueprint, render_template_string, jsonify, current_app
from datetime import datetime

def create_openapi_spec():
    """Create OpenAPI 3.1 specification for SW Portal API"""
    
    spec = {
        "openapi": "3.1.0",
        "info": {
            "title": "SW Portal API",
            "description": """
# SW Portal API Documentation

Comprehensive API for the SW Portal system of Περιφέρεια Αττικής.

## Features

- **Authentication & Authorization**: JWT-based authentication with role-based access control
- **File Management**: Upload, download, and manage files with advanced permissions
- **Forum System**: Create discussions, posts, and manage forum content
- **AI Assistant**: Interact with AI assistant for various tasks
- **Analytics**: Comprehensive analytics and reporting
- **Notifications**: Email notifications for various events

## Authentication

Most endpoints require authentication using JWT tokens. Include the token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

## Roles

- **admin**: Full access to all features and administrative functions
- **staff**: Access to most features with some restrictions
- **guest**: Limited read-only access

## Rate Limiting

API requests are rate-limited to prevent abuse. Current limits:
- 100 requests per minute for authenticated users
- 20 requests per minute for unauthenticated users

## Error Handling

The API uses standard HTTP status codes and returns error details in JSON format:

```json
{
  "error": "Error description",
  "code": "ERROR_CODE",
  "details": {}
}
```
            """,
            "version": "2.0.0",
            "contact": {
                "name": "SW Portal Team",
                "email": "support@swportal.gr",
                "url": "https://swportal.gr"
            },
            "license": {
                "name": "MIT",
                "url": "https://opensource.org/licenses/MIT"
            }
        },
        "servers": [
            {
                "url": "http://localhost:5000/api",
                "description": "Development server"
            },
            {
                "url": "https://swportal.gr/api",
                "description": "Production server"
            }
        ],
        "paths": {},
        "components": {
            "schemas": {
                "User": {
                    "type": "object",
                    "properties": {
                        "id": {"type": "integer", "description": "Unique user identifier"},
                        "username": {"type": "string", "description": "Username"},
                        "email": {"type": "string", "format": "email", "description": "User email"},
                        "role": {"type": "string", "enum": ["admin", "staff", "guest"], "description": "User role"},
                        "created_at": {"type": "string", "format": "date-time", "description": "Account creation date"},
                        "last_login": {"type": "string", "format": "date-time", "description": "Last login date"}
                    },
                    "required": ["id", "username", "email", "role"]
                },
                "LoginRequest": {
                    "type": "object",
                    "properties": {
                        "username": {"type": "string", "description": "Username"},
                        "password": {"type": "string", "description": "Password"}
                    },
                    "required": ["username", "password"]
                },
                "LoginResponse": {
                    "type": "object",
                    "properties": {
                        "access_token": {"type": "string", "description": "JWT access token"},
                        "user": {"$ref": "#/components/schemas/User"}
                    }
                },
                "File": {
                    "type": "object",
                    "properties": {
                        "id": {"type": "integer", "description": "File ID"},
                        "filename": {"type": "string", "description": "Original filename"},
                        "path": {"type": "string", "description": "File path"},
                        "size": {"type": "integer", "description": "File size in bytes"},
                        "mime_type": {"type": "string", "description": "MIME type"},
                        "uploaded_by": {"type": "integer", "description": "User ID who uploaded the file"},
                        "uploaded_at": {"type": "string", "format": "date-time", "description": "Upload timestamp"},
                        "download_count": {"type": "integer", "description": "Number of downloads"}
                    }
                },
                "Discussion": {
                    "type": "object",
                    "properties": {
                        "id": {"type": "integer", "description": "Discussion ID"},
                        "title": {"type": "string", "description": "Discussion title"},
                        "content": {"type": "string", "description": "Discussion content"},
                        "category": {"type": "string", "description": "Discussion category"},
                        "author_id": {"type": "integer", "description": "Author user ID"},
                        "created_at": {"type": "string", "format": "date-time", "description": "Creation timestamp"},
                        "updated_at": {"type": "string", "format": "date-time", "description": "Last update timestamp"},
                        "post_count": {"type": "integer", "description": "Number of posts in discussion"}
                    }
                },
                "Post": {
                    "type": "object",
                    "properties": {
                        "id": {"type": "integer", "description": "Post ID"},
                        "content": {"type": "string", "description": "Post content"},
                        "discussion_id": {"type": "integer", "description": "Discussion ID"},
                        "author_id": {"type": "integer", "description": "Author user ID"},
                        "created_at": {"type": "string", "format": "date-time", "description": "Creation timestamp"},
                        "updated_at": {"type": "string", "format": "date-time", "description": "Last update timestamp"}
                    }
                },
                "AnalyticsData": {
                    "type": "object",
                    "properties": {
                        "daily_stats": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "date": {"type": "string", "format": "date"},
                                    "total_users": {"type": "integer"},
                                    "active_users": {"type": "integer"},
                                    "new_users": {"type": "integer"},
                                    "file_uploads": {"type": "integer"},
                                    "file_downloads": {"type": "integer"},
                                    "forum_posts": {"type": "integer"},
                                    "ai_queries": {"type": "integer"}
                                }
                            }
                        },
                        "current_totals": {
                            "type": "object",
                            "properties": {
                                "total_users": {"type": "integer"},
                                "total_discussions": {"type": "integer"},
                                "total_posts": {"type": "integer"},
                                "total_uploads": {"type": "integer"}
                            }
                        }
                    }
                },
                "Error": {
                    "type": "object",
                    "properties": {
                        "error": {"type": "string", "description": "Error message"},
                        "code": {"type": "string", "description": "Error code"},
                        "details": {"type": "object", "description": "Additional error details"}
                    },
                    "required": ["error"]
                }
            },
            "securitySchemes": {
                "BearerAuth": {
                    "type": "http",
                    "scheme": "bearer",
                    "bearerFormat": "JWT",
                    "description": "JWT token for authentication"
                }
            },
            "responses": {
                "UnauthorizedError": {
                    "description": "Authentication required",
                    "content": {
                        "application/json": {
                            "schema": {"$ref": "#/components/schemas/Error"}
                        }
                    }
                },
                "ForbiddenError": {
                    "description": "Insufficient permissions",
                    "content": {
                        "application/json": {
                            "schema": {"$ref": "#/components/schemas/Error"}
                        }
                    }
                },
                "NotFoundError": {
                    "description": "Resource not found",
                    "content": {
                        "application/json": {
                            "schema": {"$ref": "#/components/schemas/Error"}
                        }
                    }
                },
                "ValidationError": {
                    "description": "Invalid input data",
                    "content": {
                        "application/json": {
                            "schema": {"$ref": "#/components/schemas/Error"}
                        }
                    }
                }
            }
        },
        "security": [
            {"BearerAuth": []}
        ],
        "tags": [
            {
                "name": "Authentication",
                "description": "User authentication and authorization"
            },
            {
                "name": "Users",
                "description": "User management operations"
            },
            {
                "name": "Files",
                "description": "File upload, download, and management"
            },
            {
                "name": "Forum",
                "description": "Forum discussions and posts"
            },
            {
                "name": "AI Assistant",
                "description": "AI assistant interactions"
            },
            {
                "name": "Analytics",
                "description": "Analytics and reporting"
            },
            {
                "name": "Notifications",
                "description": "Email notifications and messaging"
            },
            {
                "name": "ACL",
                "description": "Access Control List management"
            }
        ]
    }
    
    # Add authentication endpoints
    spec["paths"].update({
        "/auth/login": {
            "post": {
                "tags": ["Authentication"],
                "summary": "User login",
                "description": "Authenticate user and receive JWT token",
                "security": [],
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {
                            "schema": {"$ref": "#/components/schemas/LoginRequest"}
                        }
                    }
                },
                "responses": {
                    "200": {
                        "description": "Login successful",
                        "content": {
                            "application/json": {
                                "schema": {"$ref": "#/components/schemas/LoginResponse"}
                            }
                        }
                    },
                    "401": {"$ref": "#/components/responses/UnauthorizedError"}
                }
            }
        },
        "/auth/logout": {
            "post": {
                "tags": ["Authentication"],
                "summary": "User logout",
                "description": "Logout user and invalidate token",
                "responses": {
                    "200": {
                        "description": "Logout successful",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {
                                        "message": {"type": "string"}
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        "/auth/me": {
            "get": {
                "tags": ["Authentication"],
                "summary": "Get current user info",
                "description": "Get information about the currently authenticated user",
                "responses": {
                    "200": {
                        "description": "User information",
                        "content": {
                            "application/json": {
                                "schema": {"$ref": "#/components/schemas/User"}
                            }
                        }
                    },
                    "401": {"$ref": "#/components/responses/UnauthorizedError"}
                }
            }
        }
    })
    
    # Add file management endpoints
    spec["paths"].update({
        "/files/all_files": {
            "get": {
                "tags": ["Files"],
                "summary": "Get all files",
                "description": "Retrieve list of all accessible files",
                "parameters": [
                    {
                        "name": "category",
                        "in": "query",
                        "description": "Filter by category",
                        "schema": {"type": "string"}
                    },
                    {
                        "name": "search",
                        "in": "query",
                        "description": "Search in filenames",
                        "schema": {"type": "string"}
                    }
                ],
                "responses": {
                    "200": {
                        "description": "List of files",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {
                                        "success": {"type": "boolean"},
                                        "files": {
                                            "type": "array",
                                            "items": {"$ref": "#/components/schemas/File"}
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        "/files/upload": {
            "post": {
                "tags": ["Files"],
                "summary": "Upload file",
                "description": "Upload a new file to the system",
                "requestBody": {
                    "required": True,
                    "content": {
                        "multipart/form-data": {
                            "schema": {
                                "type": "object",
                                "properties": {
                                    "file": {
                                        "type": "string",
                                        "format": "binary",
                                        "description": "File to upload"
                                    },
                                    "category": {
                                        "type": "string",
                                        "description": "File category"
                                    }
                                },
                                "required": ["file"]
                            }
                        }
                    }
                },
                "responses": {
                    "200": {
                        "description": "File uploaded successfully",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {
                                        "success": {"type": "boolean"},
                                        "file": {"$ref": "#/components/schemas/File"}
                                    }
                                }
                            }
                        }
                    },
                    "400": {"$ref": "#/components/responses/ValidationError"},
                    "401": {"$ref": "#/components/responses/UnauthorizedError"}
                }
            }
        },
        "/files/download/{file_id}": {
            "get": {
                "tags": ["Files"],
                "summary": "Download file",
                "description": "Download a file by ID",
                "parameters": [
                    {
                        "name": "file_id",
                        "in": "path",
                        "required": True,
                        "description": "File ID",
                        "schema": {"type": "integer"}
                    }
                ],
                "responses": {
                    "200": {
                        "description": "File content",
                        "content": {
                            "application/octet-stream": {
                                "schema": {
                                    "type": "string",
                                    "format": "binary"
                                }
                            }
                        }
                    },
                    "404": {"$ref": "#/components/responses/NotFoundError"},
                    "403": {"$ref": "#/components/responses/ForbiddenError"}
                }
            }
        }
    })
    
    # Add forum endpoints
    spec["paths"].update({
        "/forum/discussions": {
            "get": {
                "tags": ["Forum"],
                "summary": "Get discussions",
                "description": "Retrieve list of forum discussions",
                "parameters": [
                    {
                        "name": "category",
                        "in": "query",
                        "description": "Filter by category",
                        "schema": {"type": "string"}
                    },
                    {
                        "name": "page",
                        "in": "query",
                        "description": "Page number",
                        "schema": {"type": "integer", "default": 1}
                    },
                    {
                        "name": "per_page",
                        "in": "query",
                        "description": "Items per page",
                        "schema": {"type": "integer", "default": 20}
                    }
                ],
                "responses": {
                    "200": {
                        "description": "List of discussions",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {
                                        "discussions": {
                                            "type": "array",
                                            "items": {"$ref": "#/components/schemas/Discussion"}
                                        },
                                        "total": {"type": "integer"},
                                        "page": {"type": "integer"},
                                        "per_page": {"type": "integer"}
                                    }
                                }
                            }
                        }
                    }
                }
            },
            "post": {
                "tags": ["Forum"],
                "summary": "Create discussion",
                "description": "Create a new forum discussion",
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "properties": {
                                    "title": {"type": "string"},
                                    "content": {"type": "string"},
                                    "category": {"type": "string"}
                                },
                                "required": ["title", "content"]
                            }
                        }
                    }
                },
                "responses": {
                    "201": {
                        "description": "Discussion created",
                        "content": {
                            "application/json": {
                                "schema": {"$ref": "#/components/schemas/Discussion"}
                            }
                        }
                    },
                    "400": {"$ref": "#/components/responses/ValidationError"},
                    "401": {"$ref": "#/components/responses/UnauthorizedError"}
                }
            }
        }
    })
    
    # Add analytics endpoints
    spec["paths"].update({
        "/analytics/dashboard": {
            "get": {
                "tags": ["Analytics"],
                "summary": "Get dashboard analytics",
                "description": "Retrieve analytics data for dashboard (staff/admin only)",
                "parameters": [
                    {
                        "name": "days",
                        "in": "query",
                        "description": "Number of days to include",
                        "schema": {"type": "integer", "default": 30}
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Analytics data",
                        "content": {
                            "application/json": {
                                "schema": {"$ref": "#/components/schemas/AnalyticsData"}
                            }
                        }
                    },
                    "403": {"$ref": "#/components/responses/ForbiddenError"}
                }
            }
        }
    })
    
    return spec

def create_swagger_ui_html():
    """Create Swagger UI HTML template"""
    
    html_template = """
<!DOCTYPE html>
<html lang="el">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SW Portal API Documentation</title>
    <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5.10.3/swagger-ui.css" />
    <style>
        html {
            box-sizing: border-box;
            overflow: -moz-scrollbars-vertical;
            overflow-y: scroll;
        }
        *, *:before, *:after {
            box-sizing: inherit;
        }
        body {
            margin:0;
            background: #fafafa;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        .swagger-ui .topbar {
            background-color: #0066cc;
        }
        .swagger-ui .topbar .download-url-wrapper {
            display: none;
        }
        .custom-header {
            background: linear-gradient(135deg, #0066cc 0%, #004499 100%);
            color: white;
            padding: 20px;
            text-align: center;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .custom-header h1 {
            margin: 0;
            font-size: 2.5em;
            font-weight: 300;
        }
        .custom-header p {
            margin: 10px 0 0 0;
            font-size: 1.1em;
            opacity: 0.9;
        }
        .api-info {
            background: white;
            padding: 20px;
            margin: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .api-info h2 {
            color: #0066cc;
            margin-top: 0;
        }
        .feature-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 15px;
            margin: 20px 0;
        }
        .feature-item {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 6px;
            border-left: 4px solid #0066cc;
        }
        .feature-item h3 {
            margin: 0 0 8px 0;
            color: #333;
            font-size: 1.1em;
        }
        .feature-item p {
            margin: 0;
            color: #666;
            font-size: 0.9em;
        }
        #swagger-ui {
            margin: 20px;
        }
    </style>
</head>
<body>
    <div class="custom-header">
        <h1>🏛️ SW Portal API</h1>
        <p>Comprehensive API Documentation - Περιφέρεια Αττικής</p>
    </div>
    
    <div class="api-info">
        <h2>📚 Καλώς ήρθατε στην τεκμηρίωση του SW Portal API</h2>
        <p>
            Αυτή η τεκμηρίωση παρέχει πλήρη πληροφόρηση για όλα τα διαθέσιμα endpoints του SW Portal API.
            Μπορείτε να δοκιμάσετε τα endpoints απευθείας από αυτή τη σελίδα.
        </p>
        
        <div class="feature-grid">
            <div class="feature-item">
                <h3>🔐 Authentication</h3>
                <p>JWT-based authentication με role-based access control</p>
            </div>
            <div class="feature-item">
                <h3>📁 File Management</h3>
                <p>Upload, download και διαχείριση αρχείων με advanced permissions</p>
            </div>
            <div class="feature-item">
                <h3>💬 Forum System</h3>
                <p>Δημιουργία συζητήσεων, posts και διαχείριση forum content</p>
            </div>
            <div class="feature-item">
                <h3>🤖 AI Assistant</h3>
                <p>Αλληλεπίδραση με AI assistant για διάφορες εργασίες</p>
            </div>
            <div class="feature-item">
                <h3>📊 Analytics</h3>
                <p>Comprehensive analytics και reporting</p>
            </div>
            <div class="feature-item">
                <h3>📧 Notifications</h3>
                <p>Email notifications για διάφορα events</p>
            </div>
        </div>
        
        <h3>🚀 Γρήγορη Εκκίνηση</h3>
        <ol>
            <li>Κάντε login μέσω του <code>/auth/login</code> endpoint</li>
            <li>Χρησιμοποιήστε το JWT token στο Authorization header</li>
            <li>Εξερευνήστε τα διαθέσιμα endpoints παρακάτω</li>
        </ol>
    </div>
    
    <div id="swagger-ui"></div>
    
    <script src="https://unpkg.com/swagger-ui-dist@5.10.3/swagger-ui-bundle.js"></script>
    <script src="https://unpkg.com/swagger-ui-dist@5.10.3/swagger-ui-standalone-preset.js"></script>
    <script>
        window.onload = function() {
            const ui = SwaggerUIBundle({
                url: '/api/docs/openapi.json',
                dom_id: '#swagger-ui',
                deepLinking: true,
                presets: [
                    SwaggerUIBundle.presets.apis,
                    SwaggerUIStandalonePreset
                ],
                plugins: [
                    SwaggerUIBundle.plugins.DownloadUrl
                ],
                layout: "StandaloneLayout",
                defaultModelsExpandDepth: 1,
                defaultModelExpandDepth: 1,
                docExpansion: "list",
                filter: true,
                showExtensions: true,
                showCommonExtensions: true,
                tryItOutEnabled: true,
                requestInterceptor: function(request) {
                    // Add JWT token if available
                    const token = localStorage.getItem('token');
                    if (token) {
                        request.headers['Authorization'] = 'Bearer ' + token;
                    }
                    return request;
                },
                onComplete: function() {
                    console.log('Swagger UI loaded successfully');
                }
            });
        };
    </script>
</body>
</html>
    """
    
    return html_template

def init_api_docs(app):
    """Initialize API documentation"""
    
    docs_bp = Blueprint('api_docs', __name__, url_prefix='/api/docs')
    
    @docs_bp.route('/')
    def swagger_ui():
        """Serve Swagger UI"""
        return create_swagger_ui_html()
    
    @docs_bp.route('/openapi.json')
    def openapi_spec():
        """Serve OpenAPI specification"""
        spec = create_openapi_spec()
        return jsonify(spec)
    
    @docs_bp.route('/redoc')
    def redoc_ui():
        """Serve ReDoc UI as alternative"""
        redoc_html = """
<!DOCTYPE html>
<html>
<head>
    <title>SW Portal API - ReDoc</title>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link href="https://fonts.googleapis.com/css?family=Montserrat:300,400,700|Roboto:300,400,700" rel="stylesheet">
    <style>
        body { margin: 0; padding: 0; }
    </style>
</head>
<body>
    <redoc spec-url='/api/docs/openapi.json'></redoc>
    <script src="https://cdn.jsdelivr.net/npm/redoc@2.1.3/bundles/redoc.standalone.js"></script>
</body>
</html>
        """
        return redoc_html
    
    app.register_blueprint(docs_bp)
    print("API documentation initialized")
    print("Swagger UI available at: /api/docs/")
    print("ReDoc UI available at: /api/docs/redoc")
    print("OpenAPI spec available at: /api/docs/openapi.json")
    
    return docs_bp

