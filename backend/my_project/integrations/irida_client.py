"""
ΙΡΙΔΑ API Client — Level 3 Direct Integration.

Authentication: OAuth 2.0 password grant
Base URL: https://iridacloud.gov.gr
Token endpoint: /auth/connect/token
API base: /iris/api/v2/external

Environment variables:
  IRIDA_BASE_URL, IRIDA_CLIENT_ID, IRIDA_CLIENT_SECRET,
  IRIDA_USERNAME, IRIDA_PASSWORD, IRIDA_X_PROFILE
"""
import os
import time
import logging
import requests
from threading import Lock

logger = logging.getLogger(__name__)

_token_cache = {'token': None, 'expires_at': 0}
_token_lock = Lock()


def _get_config():
    return {
        'base_url': os.environ.get(
            'IRIDA_BASE_URL', 'https://iridacloud.gov.gr'),
        'client_id': os.environ.get(
            'IRIDA_CLIENT_ID', 'iris.client'),
        'client_secret': os.environ.get(
            'IRIDA_CLIENT_SECRET', ''),
        'username': os.environ.get('IRIDA_USERNAME', ''),
        'password': os.environ.get('IRIDA_PASSWORD', ''),
        'x_profile': os.environ.get('IRIDA_X_PROFILE', ''),
        'scope': 'iris_api ddr_api auth_api',
    }


def _authenticate():
    """Get or refresh OAuth2 access token."""
    with _token_lock:
        now = time.time()
        if (_token_cache['token']
                and _token_cache['expires_at'] > now + 60):
            return _token_cache['token']

        cfg = _get_config()
        if not cfg['username'] or not cfg['password']:
            raise RuntimeError(
                'IRIDA_USERNAME and IRIDA_PASSWORD must be set')

        resp = requests.post(
            f"{cfg['base_url']}/auth/connect/token",
            data={
                'client_id': cfg['client_id'],
                'client_secret': cfg['client_secret'],
                'grant_type': 'password',
                'username': cfg['username'],
                'password': cfg['password'],
                'scope': cfg['scope'],
            },
            headers={'Content-Type': 'application/x-www-form-urlencoded'},
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()

        _token_cache['token'] = data['access_token']
        _token_cache['expires_at'] = now + data.get('expires_in', 3600)
        logger.info('ΙΡΙΔΑ: Authenticated successfully')
        return _token_cache['token']


def _headers():
    cfg = _get_config()
    token = _authenticate()
    h = {
        'Authorization': f'Bearer {token}',
        'Accept': 'application/json',
    }
    if cfg['x_profile']:
        h['x-profile'] = cfg['x_profile']
    return h


def send_document(subject, pdf_bytes, filename,
                   recipients=None, folder=None):
    """
    Send a document to ΙΡΙΔΑ for protocol assignment.

    Args:
        subject: Document subject line
        pdf_bytes: PDF file content as bytes
        filename: Filename for the attachment
        recipients: list of ΙΡΙΔΑ recipient IDs (optional)
        folder: ΙΡΙΔΑ folder name (optional)

    Returns:
        dict with protocol_number and irida_id
    """
    cfg = _get_config()
    url = f"{cfg['base_url']}/iris/api/v2/external"

    files = {'file': (filename, pdf_bytes, 'application/pdf')}
    data = {'Subject': subject}
    if recipients:
        data['Recipients'] = ','.join(recipients)
    if folder:
        data['Folder'] = folder

    resp = requests.post(url, headers=_headers(),
                         files=files, data=data, timeout=60)
    resp.raise_for_status()

    result = resp.json()
    logger.info(f'ΙΡΙΔΑ: Document sent — {result}')
    return result


def get_inbox(received=False, page=1, size=20):
    """
    Fetch inbox items from ΙΡΙΔΑ.

    Args:
        received: if False, get pending (not yet received) items
        page: page number
        size: items per page

    Returns:
        list of inbox items
    """
    cfg = _get_config()
    url = (f"{cfg['base_url']}/iris/api/v2/external"
           f"/inbox/{str(received).lower()}")

    resp = requests.post(url, headers=_headers(), json={
        'pagination': {'page': page, 'size': size},
    }, timeout=30)
    resp.raise_for_status()
    return resp.json()


def is_configured():
    """Check if ΙΡΙΔΑ credentials are configured."""
    cfg = _get_config()
    return bool(cfg['username'] and cfg['password']
                and cfg['client_secret'])
