"""Audit logging helpers for security-relevant actions."""
from flask import request
from .extensions import db
from .models import AuditLog


def log_action(action, resource=None, resource_id=None, user_id=None, details=None):
    """Record an audit log entry."""
    entry = AuditLog(
        user_id=user_id,
        action=action,
        resource=resource,
        resource_id=str(resource_id) if resource_id else None,
        details=details,
        ip_address=request.remote_addr if request else None,
    )
    db.session.add(entry)
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
