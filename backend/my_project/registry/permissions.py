from ..extensions import db


def has_registry_access(user_id):
    """Check if user has any registry role."""
    from ..oversight.models import UserRole
    return UserRole.query.filter_by(user_id=user_id).first() is not None


def has_role(user_id, role_name, structure_id=None):
    """Check if user has a specific role, optionally for a specific structure."""
    from ..oversight.models import UserRole
    query = UserRole.query.filter_by(user_id=user_id, role=role_name)
    if structure_id:
        query = query.filter_by(structure_id=structure_id)
    return query.first() is not None


def is_director(user_id):
    """Check if user is director (full access)."""
    return has_role(user_id, 'director')


def is_administrative(user_id):
    """Check if user is administrative staff."""
    return has_role(user_id, 'administrative')


def can_view_structure(user_id, structure_id):
    """Check if user can view a specific structure."""
    from ..oversight.models import UserRole
    from ..models import User
    user = User.query.get(user_id)
    if user and user.role == 'admin':
        return True
    if is_director(user_id) or is_administrative(user_id):
        return True
    return UserRole.query.filter_by(
        user_id=user_id, structure_id=structure_id
    ).first() is not None


def can_edit_structure(user_id):
    """Check if user can create/edit structures."""
    from ..models import User
    user = User.query.get(user_id)
    if user and user.role == 'admin':
        return True
    return is_director(user_id) or is_administrative(user_id)
