from flask import Blueprint

inspections_bp = Blueprint('inspections', __name__)

from . import routes  # noqa: E402, F401
