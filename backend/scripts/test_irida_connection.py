"""
Quick IRIDA connectivity test — run from backend/ directory.

Usage:
  python scripts/test_irida_connection.py          # uses .env credentials
  python scripts/test_irida_connection.py --demo    # uses demo sandbox (no credentials needed!)
"""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', '.env'))

# Force UTF-8 output on Windows
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

# Check for --demo flag — override any .env credentials
if '--demo' in sys.argv:
    os.environ['IRIDA_DEMO'] = 'true'
    os.environ['IRIDA_USERNAME'] = 'demo@demo.gr'
    os.environ['IRIDA_PASSWORD'] = 'Demo κωδικός'
    os.environ.setdefault('IRIDA_BASE_URL',
                          'https://dev.iridacloud.gov.gr/iris')

from my_project.integrations.irida_client import (
    _get_config, _authenticate, _api_prefix,
    get_profiles, get_roots, get_positions,
    get_inbox, get_document_files,
    is_configured, get_mode, reset_cache,
)


def main():
    reset_cache()
    cfg = _get_config()
    mode = get_mode()

    print(f"Mode:      {'DEMO' if cfg['demo'] else 'PRODUCTION'}")
    print(f"Base URL:  {cfg['base_url']}")
    print(f"API path:  /api/v2/{_api_prefix()}/...")
    print(f"Username:  {cfg['username']}")
    print(f"Password:  {'*' * len(cfg['password']) if cfg['password'] else '(empty)'}")
    print(f"x-profile: {cfg['x_profile'] or '(will auto-fetch)'}")
    print()

    if not is_configured():
        print("No credentials set. Use --demo flag or set IRIDA_USERNAME/IRIDA_PASSWORD in .env")
        return

    # Step 1: Token
    print("1. Authenticating...")
    try:
        token = _authenticate()
        print(f"   OK - token: {token[:30]}...")
    except Exception as e:
        print(f"   FAILED - {e}")
        return

    # Step 2: Profiles
    print("2. Fetching profiles...")
    try:
        profiles = get_profiles()
        print(f"   OK - {len(profiles)} profile(s):")
        for p in profiles:
            print(f"      {p.get('positionName', '?')} / "
                  f"{p.get('dutyName', '?')} "
                  f"[x-profile: {p.get('xProfile', '?')}]")
    except Exception as e:
        print(f"   FAILED - {e}")
        if not cfg['demo']:
            print("   (Your account may not have External API access)")
            return

    # Step 3: List organisations
    print("3. Fetching organisations (roots)...")
    try:
        roots = get_roots()
        if isinstance(roots, list):
            items = roots
        else:
            items = roots.get('data', roots) if isinstance(roots, dict) else []
        print(f"   OK - {len(items)} organisation(s)")
        for r in items[:5]:
            rid = r.get('id') or r.get('Id') or '?'
            rdesc = r.get('description') or r.get('Description') or '?'
            print(f"      {rid}: {rdesc}")
        if len(items) > 5:
            print(f"      ... and {len(items) - 5} more")
    except Exception as e:
        print(f"   FAILED - {e}")

    # Step 4: Internal positions
    print("4. Fetching internal positions...")
    try:
        positions = get_positions(page_size=5)
        if isinstance(positions, dict):
            items = positions.get('data', [])
            pagination = positions.get('pagination', {})
            total = pagination.get('totalRecords', len(items))
        else:
            items = positions
            total = len(items)
        print(f"   OK - {total} position(s) total, showing first {len(items)}:")
        for p in items:
            print(f"      [{p.get('positionId')}-{p.get('dutyId')}] "
                  f"{p.get('displayName') or p.get('positionName', '?')}")
    except Exception as e:
        print(f"   FAILED - {e}")

    # Step 5: Inbox
    print("5. Fetching inbox (pending)...")
    try:
        inbox = get_inbox(received=False)
        if isinstance(inbox, dict):
            items = inbox.get('data', [])
        else:
            items = inbox
        count = len(items) if items else 0
        print(f"   OK - {count} pending document(s)")
        for doc in (items or [])[:3]:
            print(f"      [{doc.get('regNo', '?')}] "
                  f"{doc.get('title', '?')}")
    except Exception as e:
        print(f"   FAILED - {e}")

    print()
    print("Done! Connection to ΙΡΙΔΑ is working.")


if __name__ == '__main__':
    main()
