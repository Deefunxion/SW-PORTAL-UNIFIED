from datetime import datetime
from ..extensions import db


class InteropLog(db.Model):
    __tablename__ = 'interop_logs'
    id = db.Column(db.Integer, primary_key=True)
    service_name = db.Column(db.String(50), nullable=False)
    request_type = db.Column(db.String(50), nullable=False)
    request_data = db.Column(db.JSON, nullable=True)
    response_data = db.Column(db.JSON, nullable=True)
    status = db.Column(db.String(20), default='success')
    response_time_ms = db.Column(db.Integer, nullable=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id, 'service_name': self.service_name,
            'request_type': self.request_type,
            'request_data': self.request_data,
            'response_data': self.response_data,
            'status': self.status,
            'response_time_ms': self.response_time_ms,
            'user_id': self.user_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
