from .base import InteropService
from .mock_data import AFM_DATABASE


class AADEService(InteropService):
    """Mock AADE/GEMI integration for AFM lookup."""

    def lookup(self, afm):
        data = AFM_DATABASE.get(afm)
        if data:
            return {'found': True, **data}
        return {'found': False, 'message': f'\u0391\u03a6\u039c {afm} \u03b4\u03b5\u03bd \u03b2\u03c1\u03ad\u03b8\u03b7\u03ba\u03b5 \u03c3\u03c4\u03bf \u03bc\u03b7\u03c4\u03c1\u03ce\u03bf \u0391\u0391\u0394\u0395'}

    def verify(self, data):
        return {'verified': data.get('afm') in AFM_DATABASE}
