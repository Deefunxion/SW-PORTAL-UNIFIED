from flask import Blueprint

interop_bp = Blueprint('interop', __name__)

from . import routes  # noqa: E402, F401
