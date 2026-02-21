"""Tests for User model IRIDA fields."""
import os
os.environ.setdefault('IRIDA_ENCRYPTION_KEY', '9i7RJOaT-0eIX4hCJQtDv-aPBH04vPv77JjFkU2cf0k=')


class TestUserIridaFields:
    def test_user_has_irida_fields(self, app):
        with app.app_context():
            from my_project.models import User
            user = User(username='irida_test', email='irida@test.com', role='staff')
            user.set_password('pass123')
            assert user.irida_username is None
            assert user.irida_password is None
            assert user.irida_x_profile is None
            assert user.irida_base_url is None

    def test_user_to_dict_excludes_irida_password(self, app):
        with app.app_context():
            from my_project.models import User
            user = User(username='irida_test2', email='irida2@test.com', role='staff')
            user.set_password('pass123')
            user.irida_username = 'encrypted_username'
            user.irida_password = 'encrypted_password'
            d = user.to_dict()
            assert 'irida_password' not in d
            assert 'irida_username' not in d
            # But irida_configured flag should be present
            assert 'irida_configured' in d

    def test_to_dict_irida_configured_flag(self, app):
        with app.app_context():
            from my_project.models import User
            user = User(username='irida_test3', email='irida3@test.com', role='staff')
            user.set_password('pass123')
            d = user.to_dict()
            assert d['irida_configured'] is False

            user.irida_username = 'enc_user'
            user.irida_password = 'enc_pass'
            d = user.to_dict()
            assert d['irida_configured'] is True
