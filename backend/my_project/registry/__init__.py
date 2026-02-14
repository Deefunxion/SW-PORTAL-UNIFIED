from flask import Blueprint

registry_bp = Blueprint('registry', __name__)

from . import routes  # noqa: E402, F401
