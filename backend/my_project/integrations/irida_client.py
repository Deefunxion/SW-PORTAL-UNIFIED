"""
ΙΡΙΔΑ External API v2.2 Client — Level 3 Direct Integration.

Ref: IRIS External API v2.2 Documentation + OpenAPI spec from Swagger UI

Authentication:
  POST /api/v2/common/token  (username + password, form-urlencoded)
  Token validity: 8 hours
  All subsequent calls require:
    - Authorization: Bearer <token>
    - x-profile: <profile>  (from GET /api/v2/external/profiles)

Environments:
  Dev:  https://dev.iridacloud.gov.gr/iris
  Prod: https://iridacloud.gov.gr/iris
  Demo: https://dev.iridacloud.gov.gr/iris  (with IRIDA_DEMO=true)

Environment variables:
  IRIDA_BASE_URL   — e.g. https://dev.iridacloud.gov.gr/iris
  IRIDA_USERNAME   — system user credentials
  IRIDA_PASSWORD
  IRIDA_X_PROFILE  — optional, auto-fetched if not set
  IRIDA_DEMO       — set to 'true' to use demo endpoints (no real auth)
"""
import os
import time
import logging
import base64
import httpx
from threading import Lock

logger = logging.getLogger(__name__)

_token_cache = {'token': None, 'expires_at': 0}
_token_lock = Lock()
_profile_cache = {'x_profile': None}

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

def _get_config():
    demo = os.environ.get('IRIDA_DEMO', '').lower() == 'true'
    return {
        'base_url': os.environ.get(
            'IRIDA_BASE_URL', 'https://dev.iridacloud.gov.gr/iris'),
        'username': os.environ.get(
            'IRIDA_USERNAME', 'demo@demo.gr' if demo else ''),
        'password': os.environ.get(
            'IRIDA_PASSWORD', 'Demo κωδικός' if demo else ''),
        'x_profile': os.environ.get('IRIDA_X_PROFILE', ''),
        'demo': demo,
    }


def _api_prefix():
    """Return 'external-demo' or 'external' based on mode."""
    cfg = _get_config()
    return 'external-demo' if cfg['demo'] else 'external'


def _common_prefix():
    """Return 'common-demo' or 'common' based on mode."""
    cfg = _get_config()
    return 'common-demo' if cfg['demo'] else 'common'


# ---------------------------------------------------------------------------
# Authentication  (§4.1)
# ---------------------------------------------------------------------------

def _authenticate():
    """Get or refresh access token via POST /api/v2/common/token."""
    with _token_lock:
        now = time.time()
        if (_token_cache['token']
                and _token_cache['expires_at'] > now + 60):
            return _token_cache['token']

        cfg = _get_config()
        if not cfg['username'] or not cfg['password']:
            raise RuntimeError(
                'IRIDA_USERNAME and IRIDA_PASSWORD must be set')

        resp = httpx.post(
            f"{cfg['base_url']}/api/v2/{_common_prefix()}/token",
            data={
                'username': cfg['username'],
                'password': cfg['password'],
            },
            headers={
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            timeout=30,
        )
        resp.raise_for_status()

        # ΙΡΙΔΑ returns 200 even on bad credentials — check body
        body = resp.text.strip()
        if body == 'invalid_username_or_password':
            raise RuntimeError(
                'ΙΡΙΔΑ: Λάθος username ή password. '
                'Σημείωση: το dev environment (dev.iridacloud.gov.gr) '
                'έχει ξεχωριστούς χρήστες από το production.')

        # Response may be JSON with access_token or plain-text token
        try:
            data = resp.json()
            token = data['access_token']
            expires_in = data.get('expires_in', 28800)  # 8h default
        except (ValueError, KeyError):
            token = body
            expires_in = 28800

        if not token:
            raise RuntimeError(
                f'IRIDA: Empty token in response: {body[:100]}')

        _token_cache['token'] = token
        _token_cache['expires_at'] = now + expires_in
        logger.info('ΙΡΙΔΑ: Authenticated successfully (demo=%s)',
                     cfg['demo'])
        return token


def _get_x_profile():
    """Return x-profile, using env var or fetching from API (§4.2)."""
    cfg = _get_config()
    if cfg['x_profile']:
        return cfg['x_profile']

    if _profile_cache['x_profile']:
        return _profile_cache['x_profile']

    # In demo mode, use the known default profile
    if cfg['demo']:
        _profile_cache['x_profile'] = '31712-12'
        return _profile_cache['x_profile']

    profiles = get_profiles()
    if profiles:
        _profile_cache['x_profile'] = profiles[0]['xProfile']
        return _profile_cache['x_profile']

    raise RuntimeError(
        'No active ΙΡΙΔΑ profile found. Set IRIDA_X_PROFILE or '
        'ensure the user has an active profile.')


def _headers():
    """Build common headers for all API calls."""
    token = _authenticate()
    return {
        'Authorization': f'Bearer {token}',
        'Accept': 'application/json',
        'x-profile': _get_x_profile(),
    }


def reset_cache():
    """Clear token and profile caches (useful for testing)."""
    with _token_lock:
        _token_cache['token'] = None
        _token_cache['expires_at'] = 0
    _profile_cache['x_profile'] = None


# ---------------------------------------------------------------------------
# Profiles  (§4.2)
# ---------------------------------------------------------------------------

def get_profiles():
    """
    GET /api/v2/external/profiles

    Returns list of active profiles:
      [{"positionName": str, "dutyName": str, "xProfile": str}, ...]
    """
    cfg = _get_config()
    token = _authenticate()
    resp = httpx.get(
        f"{cfg['base_url']}/api/v2/{_api_prefix()}/profiles",
        headers={
            'Authorization': f'Bearer {token}',
            'Accept': 'application/json',
        },
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


# ---------------------------------------------------------------------------
# Send  (§5.1)
# ---------------------------------------------------------------------------

def get_roots():
    """
    GET /api/v2/external/roots  (§5.1.1)

    Returns list of all organisations in the system:
      [{"id": str, "description": str}, ...]
    """
    cfg = _get_config()
    resp = httpx.get(
        f"{cfg['base_url']}/api/v2/{_api_prefix()}/roots",
        headers=_headers(),
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def get_positions(page_number=1, page_size=50, filter_text=None):
    """
    GET /api/v2/external/positions  (§5.1.2)

    Returns internal recipients of the user's organisation:
      {"data": [...], "pagination": {...}}
    """
    cfg = _get_config()
    params = {
        'pageNumber': page_number,
        'pageSize': page_size,
    }
    if filter_text:
        params['filter'] = filter_text
        params['hasFilter'] = 'true'

    resp = httpx.get(
        f"{cfg['base_url']}/api/v2/{_api_prefix()}/positions",
        headers=_headers(),
        params=params,
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def send_document(subject, registration_number, sender,
                  recipients, files):
    """
    POST /api/v2/external  (§5.1.3)

    Send a document to one or more organisations.

    Args:
        subject:              Document subject line (required)
        registration_number:  Protocol number — use 'ΑΝΕΥ' if none (required)
        sender:               Sender name (required)
        recipients:           List of organisation IDs from get_roots()
        files:                List of (filename, bytes, content_type) tuples
                              Allowed types: pdf, doc, docx. Max 28 MB each.

    Returns:
        {"data": [{"rootId": str, "rootName": str, "regNo": str}, ...]}
    """
    cfg = _get_config()
    prefix = _api_prefix()
    url = f"{cfg['base_url']}/api/v2/{prefix}"

    # Build multipart fields — PascalCase for real API, camelCase for demo
    if cfg['demo']:
        keys = ('subject', 'registrationNumber', 'sender',
                'recipients', 'file')
    else:
        keys = ('Subject', 'RegistrationNumber', 'Sender',
                'Recipients', 'Files')

    multipart_fields = []
    multipart_fields.append((keys[0], (None, subject)))
    multipart_fields.append((keys[1], (None, registration_number)))
    multipart_fields.append((keys[2], (None, sender)))
    for r in recipients:
        multipart_fields.append((keys[3], (None, r)))
    for fname, fbytes, ftype in files:
        multipart_fields.append((keys[4], (fname, fbytes, ftype)))

    headers = _headers()
    headers.pop('Accept', None)

    resp = httpx.post(
        url,
        headers=headers,
        files=multipart_fields,
        timeout=120,
    )
    resp.raise_for_status()

    result = resp.json()
    logger.info('ΙΡΙΔΑ: Document sent to %d recipient(s) — %s',
                len(recipients), result)
    return result


def send_to_inner_positions(subject, registration_number, sender,
                            recipients, files):
    """
    POST /api/v2/external/innerPositions  (§5.1.4)

    Send a document directly to internal recipients (bypasses central
    secretariat).

    Args:
        subject, registration_number, sender: same as send_document
        recipients: List of "positionId-dutyId" strings from get_positions()
        files:      List of (filename, bytes, content_type) tuples

    Returns:
        {"data": [{"positionId": int, "dutyId": int, ...
                    "regNo": str}, ...]}
    """
    cfg = _get_config()
    prefix = _api_prefix()
    url = f"{cfg['base_url']}/api/v2/{prefix}/innerPositions"

    if cfg['demo']:
        keys = ('subject', 'registrationNumber', 'sender',
                'recipients', 'file')
    else:
        keys = ('Subject', 'RegistrationNumber', 'Sender',
                'Recipients', 'Files')

    multipart_fields = []
    multipart_fields.append((keys[0], (None, subject)))
    multipart_fields.append((keys[1], (None, registration_number)))
    multipart_fields.append((keys[2], (None, sender)))
    for r in recipients:
        multipart_fields.append((keys[3], (None, r)))
    for fname, fbytes, ftype in files:
        multipart_fields.append((keys[4], (fname, fbytes, ftype)))

    headers = _headers()
    headers.pop('Accept', None)

    resp = httpx.post(
        url,
        headers=headers,
        files=multipart_fields,
        timeout=120,
    )
    resp.raise_for_status()

    result = resp.json()
    logger.info('ΙΡΙΔΑ: Document sent to %d inner position(s) — %s',
                len(recipients), result)
    return result


# ---------------------------------------------------------------------------
# Receive  (§5.2)
# ---------------------------------------------------------------------------

def get_inbox(received=False, page_number=1, page_size=20):
    """
    GET /api/v2/external/inbox/{received}  (§5.2.1)

    Fetch reply documents for organisations that use the system fully.

    Returns:
        {"data": [{"documentId": str, "title": str, "regNo": str,
                    "received": bool, "directoryReferences": [...]}, ...],
         "pagination": {...}}
    """
    cfg = _get_config()
    prefix = _api_prefix()
    url = (f"{cfg['base_url']}/api/v2/{prefix}"
           f"/inbox/{str(received).lower()}")
    resp = httpx.get(
        url,
        headers=_headers(),
        params={'pageNumber': page_number, 'pageSize': page_size},
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def get_iris_inbox(received=False, page_number=1, page_size=20):
    """
    GET /api/v2/external/irisInbox/{received}  (§5.2.2)

    Fetch incoming documents for endpoint organisations.

    Returns:
        {"data": [{"documentId": str, "Subject": str, "regNo": str,
                    "received": bool, "date": str, "author": str}, ...],
         "pagination": {...}}
    """
    cfg = _get_config()
    prefix = _api_prefix()
    url = (f"{cfg['base_url']}/api/v2/{prefix}"
           f"/irisInbox/{str(received).lower()}")
    resp = httpx.get(
        url,
        headers=_headers(),
        params={'pageNumber': page_number, 'pageSize': page_size},
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def get_document_files(document_id):
    """
    GET /api/v2/external/document/{id}  (§5.2.3)

    Retrieve list of files attached to a document.

    Returns:
        [{"id": str, "description": str}, ...]
    """
    cfg = _get_config()
    prefix = _api_prefix()
    url = f"{cfg['base_url']}/api/v2/{prefix}/document/{document_id}"
    resp = httpx.get(url, headers=_headers(), timeout=30)
    resp.raise_for_status()
    return resp.json()


def get_file(document_id, file_id):
    """
    GET /api/v2/external/document/{docId}/file/{fileId}  (§5.2.4)

    Download a specific file from a document.

    Returns:
        dict with {"fileName": str, "base64ByteArray": str,
                    "mediaType": str}
        Use decode_file() to get raw bytes.
    """
    cfg = _get_config()
    prefix = _api_prefix()
    url = (f"{cfg['base_url']}/api/v2/{prefix}"
           f"/document/{document_id}/file/{file_id}")
    resp = httpx.get(url, headers=_headers(), timeout=60)
    resp.raise_for_status()
    return resp.json()


def decode_file(file_dto):
    """Decode a DocumentFileDto into (filename, bytes, media_type)."""
    return (
        file_dto.get('fileName', 'document'),
        base64.b64decode(file_dto['base64ByteArray']),
        file_dto.get('mediaType', 'application/octet-stream'),
    )


# ---------------------------------------------------------------------------
# Status check
# ---------------------------------------------------------------------------

def is_configured():
    """Check if ΙΡΙΔΑ credentials are configured."""
    cfg = _get_config()
    return bool(cfg['username'] and cfg['password'])


def get_mode():
    """Return current mode info for status display."""
    cfg = _get_config()
    return {
        'configured': is_configured(),
        'demo': cfg['demo'],
        'base_url': cfg['base_url'],
        'username': cfg['username'] if is_configured() else None,
    }


# ---------------------------------------------------------------------------
# Per-user authentication (Phase 1 — each advisor uses own credentials)
# ---------------------------------------------------------------------------

def authenticate_user(username, password, base_url=None):
    """Authenticate a specific user to IRIDA. Returns token string.

    Unlike _authenticate(), this does NOT cache the token — each user
    gets a fresh token per session.
    """
    cfg = _get_config()
    base = base_url or cfg['base_url']
    prefix = _common_prefix()

    resp = httpx.post(
        f'{base}/api/v2/{prefix}/token',
        data={'username': username, 'password': password},
        headers={'Content-Type': 'application/x-www-form-urlencoded'},
        timeout=30,
    )
    resp.raise_for_status()

    body = resp.text.strip()
    if body == 'invalid_username_or_password':
        raise RuntimeError(
            'ΙΡΙΔΑ: Λάθος username ή password. '
            'Ελέγξτε τα στοιχεία σύνδεσης στο προφίλ σας.')

    try:
        data = resp.json()
        token = data['access_token']
    except (ValueError, KeyError):
        token = body

    if not token:
        raise RuntimeError(f'IRIDA: Empty token in response: {body[:100]}')

    return token


def send_document_as_user(token, x_profile, base_url, subject,
                          registration_number, sender, recipients, files,
                          demo=False):
    """Send a document using a specific user's token.

    Args:
        token:                User's IRIDA token (from authenticate_user)
        x_profile:            User's x-profile string
        base_url:             IRIDA base URL
        subject:              Document subject line
        registration_number:  Protocol number or 'ΑΝΕΥ'
        sender:               Sender name
        recipients:           List of organisation IDs
        files:                List of (filename, bytes, content_type) tuples
        demo:                 If True, use demo field names (camelCase)
    """
    prefix = 'external-demo' if demo else 'external'
    url = f'{base_url}/api/v2/{prefix}'

    if demo:
        keys = ('subject', 'registrationNumber', 'sender',
                'recipients', 'file')
    else:
        keys = ('Subject', 'RegistrationNumber', 'Sender',
                'Recipients', 'Files')

    multipart_fields = []
    multipart_fields.append((keys[0], (None, subject)))
    multipart_fields.append((keys[1], (None, registration_number)))
    multipart_fields.append((keys[2], (None, sender)))
    for r in recipients:
        multipart_fields.append((keys[3], (None, r)))
    for fname, fbytes, ftype in files:
        multipart_fields.append((keys[4], (fname, fbytes, ftype)))

    headers = {
        'Authorization': f'Bearer {token}',
        'x-profile': x_profile,
    }

    resp = httpx.post(url, headers=headers, files=multipart_fields, timeout=120)
    resp.raise_for_status()

    result = resp.json()
    logger.info('ΙΡΙΔΑ (per-user): Document sent to %d recipient(s) — %s',
                len(recipients), result)
    return result
