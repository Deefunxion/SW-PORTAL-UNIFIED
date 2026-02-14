from flask import jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from . import oversight_bp
from ..extensions import db
from .models import UserRole, SocialAdvisorReport
