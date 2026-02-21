"""Tests for per-user IRIDA authentication functions."""
import os
os.environ.setdefault('IRIDA_ENCRYPTION_KEY', '9i7RJOaT-0eIX4hCJQtDv-aPBH04vPv77JjFkU2cf0k=')
import pytest
from unittest.mock import patch, MagicMock


class TestPerUserAuth:
    def test_authenticate_user_success(self):
        from my_project.integrations.irida_client import authenticate_user

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = 'SomeTokenValue'
        mock_resp.raise_for_status = MagicMock()

        # Mock json to raise ValueError (plain text response)
        mock_resp.json.side_effect = ValueError

        with patch('my_project.integrations.irida_client.httpx.post',
                   return_value=mock_resp):
            token = authenticate_user(
                'user@gov.gr', 'pass123',
                base_url='https://dev.iridacloud.gov.gr/iris'
            )
            assert token == 'SomeTokenValue'

    def test_authenticate_user_bad_credentials(self):
        from my_project.integrations.irida_client import authenticate_user

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = 'invalid_username_or_password'
        mock_resp.raise_for_status = MagicMock()

        with patch('my_project.integrations.irida_client.httpx.post',
                   return_value=mock_resp):
            with pytest.raises(RuntimeError, match='Λάθος username'):
                authenticate_user(
                    'bad@gov.gr', 'wrong',
                    base_url='https://dev.iridacloud.gov.gr/iris'
                )

    def test_send_document_as_user_calls_httpx(self):
        from my_project.integrations.irida_client import send_document_as_user

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {'data': [{'rootId': '123', 'regNo': '10/2026'}]}
        mock_resp.raise_for_status = MagicMock()

        with patch('my_project.integrations.irida_client.httpx.post',
                   return_value=mock_resp):
            result = send_document_as_user(
                token='mytoken',
                x_profile='31712-12',
                base_url='https://dev.iridacloud.gov.gr/iris',
                subject='Test',
                registration_number='ΑΝΕΥ',
                sender='Portal',
                recipients=['org123'],
                files=[('test.pdf', b'%PDF-1.4', 'application/pdf')],
                demo=True,
            )
            assert result['data'][0]['regNo'] == '10/2026'
