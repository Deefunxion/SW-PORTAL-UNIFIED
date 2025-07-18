from flask import Blueprint, render_template, jsonify
import os

main = Blueprint('main', __name__)

@main.route('/apothecary')
def get_apothecary_content():
    """Get apothecary content structure"""
    try:
        # Path to content directory
        content_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'content')
        
        if not os.path.exists(content_path):
            return jsonify({'folders': [], 'message': 'Content directory not found'}), 200
        
        def scan_directory(path):
            """Recursively scan directory structure"""
            items = []
            try:
                for item in os.listdir(path):
                    item_path = os.path.join(path, item)
                    if os.path.isdir(item_path):
                        items.append({
                            'name': item,
                            'type': 'folder',
                            'children': scan_directory(item_path)
                        })
                    else:
                        items.append({
                            'name': item,
                            'type': 'file',
                            'size': os.path.getsize(item_path)
                        })
            except PermissionError:
                pass
            return items
        
        content_structure = scan_directory(content_path)
        
        return jsonify({
            'folders': content_structure,
            'status': 'success'
        })
        
    except Exception as e:
        return jsonify({
            'folders': [],
            'error': str(e),
            'status': 'error'
        }), 500