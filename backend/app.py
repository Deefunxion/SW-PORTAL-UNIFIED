"""
SW Portal - Main Application Entry Point
Clean Flask application using the Application Factory pattern
"""

from my_project import create_app
from my_project.extensions import celery

# Create the Flask application
app = create_app()

if __name__ == '__main__':
    app.run(
        host='0.0.0.0',
        port=5000,
        debug=True
    )
