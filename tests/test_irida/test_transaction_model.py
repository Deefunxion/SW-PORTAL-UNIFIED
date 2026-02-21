"""Tests for IridaTransaction model."""
import os
os.environ.setdefault('IRIDA_ENCRYPTION_KEY', '9i7RJOaT-0eIX4hCJQtDv-aPBH04vPv77JjFkU2cf0k=')
import json


class TestIridaTransaction:
    def test_create_outbound_transaction(self, app):
        with app.app_context():
            from my_project.integrations.models import IridaTransaction
            from my_project.extensions import db

            tx = IridaTransaction(
                direction='outbound',
                status='sent',
                source_type='advisor_report',
                source_id=1,
                irida_reg_no='52/2026',
                subject='Αναφορά ελέγχου δομής',
                sender='Κ. Σύμβουλος',
                recipients_json=json.dumps(['org123']),
                sent_by_id=None,  # No FK constraint in SQLite test
            )
            db.session.add(tx)
            db.session.commit()

            assert tx.id is not None
            assert tx.direction == 'outbound'
            assert tx.irida_reg_no == '52/2026'

    def test_to_dict(self, app):
        with app.app_context():
            from my_project.integrations.models import IridaTransaction
            from my_project.extensions import db

            tx = IridaTransaction(
                direction='outbound',
                status='sent',
                source_type='advisor_report',
                source_id=42,
                irida_reg_no='99/2026',
                subject='Test',
                sender='Sender',
                recipients_json=json.dumps(['r1']),
            )
            db.session.add(tx)
            db.session.commit()

            d = tx.to_dict()
            assert d['direction'] == 'outbound'
            assert d['status'] == 'sent'
            assert d['source_type'] == 'advisor_report'
            assert d['source_id'] == 42
            assert d['irida_reg_no'] == '99/2026'
            assert d['recipients'] == ['r1']

    def test_failed_transaction_stores_error(self, app):
        with app.app_context():
            from my_project.integrations.models import IridaTransaction
            from my_project.extensions import db

            tx = IridaTransaction(
                direction='outbound',
                status='failed',
                source_type='advisor_report',
                source_id=1,
                error_message='ΙΡΙΔΑ: Timeout',
            )
            db.session.add(tx)
            db.session.commit()

            assert tx.status == 'failed'
            assert tx.error_message == 'ΙΡΙΔΑ: Timeout'
