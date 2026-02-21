"""Tests for IRIDA credential encryption."""
import os
import pytest

# Set a valid Fernet test key before importing
os.environ['IRIDA_ENCRYPTION_KEY'] = '9i7RJOaT-0eIX4hCJQtDv-aPBH04vPv77JjFkU2cf0k='


class TestIridaCrypto:
    def test_encrypt_decrypt_roundtrip(self):
        from my_project.integrations.irida_crypto import encrypt_credential, decrypt_credential
        plaintext = 'my-secret-password'
        encrypted = encrypt_credential(plaintext)
        assert encrypted != plaintext
        assert decrypt_credential(encrypted) == plaintext

    def test_encrypt_produces_different_ciphertexts(self):
        from my_project.integrations.irida_crypto import encrypt_credential
        a = encrypt_credential('same')
        b = encrypt_credential('same')
        # Fernet uses random IV, so ciphertexts differ
        assert a != b

    def test_decrypt_bad_data_raises(self):
        from my_project.integrations.irida_crypto import decrypt_credential
        with pytest.raises(Exception):
            decrypt_credential('not-valid-fernet-token')

    def test_missing_key_raises(self):
        """If IRIDA_ENCRYPTION_KEY is unset, operations should raise."""
        from my_project.integrations import irida_crypto
        original = os.environ.get('IRIDA_ENCRYPTION_KEY')
        try:
            os.environ.pop('IRIDA_ENCRYPTION_KEY', None)
            # Force re-read of key
            irida_crypto._fernet = None
            with pytest.raises(RuntimeError, match='IRIDA_ENCRYPTION_KEY'):
                irida_crypto.encrypt_credential('test')
        finally:
            if original:
                os.environ['IRIDA_ENCRYPTION_KEY'] = original
                irida_crypto._fernet = None
