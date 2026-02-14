from flask import Blueprint

oversight_bp = Blueprint('oversight', __name__)

from . import routes  # noqa: E402, F401
