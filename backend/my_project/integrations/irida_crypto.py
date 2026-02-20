"""Fernet encryption for IRIDA credentials stored in user profiles.

Uses IRIDA_ENCRYPTION_KEY env var (base64-encoded 32-byte key).
If the key is missing, auto-generates one and prints a warning.
"""
import os
import logging
from cryptography.fernet import Fernet

logger = logging.getLogger(__name__)

_fernet = None


def _get_fernet():
    global _fernet
    if _fernet is not None:
        return _fernet

    key = os.environ.get('IRIDA_ENCRYPTION_KEY')
    if not key:
        raise RuntimeError(
            'IRIDA_ENCRYPTION_KEY is not set. '
            'Generate one with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"'
        )

    _fernet = Fernet(key.encode() if isinstance(key, str) else key)
    return _fernet


def encrypt_credential(plaintext: str) -> str:
    """Encrypt a credential string. Returns base64-encoded ciphertext."""
    f = _get_fernet()
    return f.encrypt(plaintext.encode('utf-8')).decode('utf-8')


def decrypt_credential(ciphertext: str) -> str:
    """Decrypt a credential string. Returns plaintext."""
    f = _get_fernet()
    return f.decrypt(ciphertext.encode('utf-8')).decode('utf-8')


def generate_key() -> str:
    """Generate a new Fernet key. Utility for .env setup."""
    return Fernet.generate_key().decode('utf-8')
