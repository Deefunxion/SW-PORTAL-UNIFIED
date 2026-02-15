from flask import Blueprint

sanctions_bp = Blueprint('sanctions', __name__)

from . import routes  # noqa: E402, F401
