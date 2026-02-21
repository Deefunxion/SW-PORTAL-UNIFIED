"""
Test IRIDA integration through the running Flask app.
Start the backend first: python app.py

Usage:
  python scripts/test_irida_live.py
"""
import sys
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

import httpx

BASE = 'http://localhost:5000'


def main():
    # Step 1: Login
    print("1. Logging in as admin...")
    resp = httpx.post(f'{BASE}/api/auth/login', json={
        'username': 'admin',
        'password': 'admin123',
    }, timeout=10)
    if resp.status_code != 200:
        print(f"   FAILED ({resp.status_code}): {resp.text[:200]}")
        return
    token = resp.json().get('access_token')
    print(f"   OK - token: {token[:30]}...")

    headers = {'Authorization': f'Bearer {token}'}

    # Step 2: IRIDA status
    print("\n2. IRIDA status...")
    resp = httpx.get(f'{BASE}/api/irida/status', headers=headers, timeout=10)
    print(f"   {resp.json()}")

    # Step 3: Profiles
    print("\n3. IRIDA profiles...")
    resp = httpx.get(f'{BASE}/api/irida/profiles', headers=headers, timeout=15)
    if resp.status_code == 200:
        for p in resp.json():
            print(f"   {p.get('positionName')} / {p.get('dutyName')} "
                  f"[{p.get('xProfile')}]")
    else:
        print(f"   FAILED ({resp.status_code}): {resp.text[:200]}")

    # Step 4: Organisations (roots)
    print("\n4. IRIDA organisations...")
    resp = httpx.get(f'{BASE}/api/irida/roots', headers=headers, timeout=15)
    if resp.status_code == 200:
        roots = resp.json()
        items = roots if isinstance(roots, list) else roots.get('data', [])
        for r in items:
            print(f"   {r.get('id', r.get('Id'))}: "
                  f"{r.get('description', r.get('Description'))}")
    else:
        print(f"   FAILED ({resp.status_code}): {resp.text[:200]}")

    # Step 5: Internal positions
    print("\n5. IRIDA positions...")
    resp = httpx.get(f'{BASE}/api/irida/positions', headers=headers, timeout=15)
    if resp.status_code == 200:
        data = resp.json()
        items = data.get('data', data) if isinstance(data, dict) else data
        for p in (items or [])[:5]:
            print(f"   [{p.get('positionId')}-{p.get('dutyId')}] "
                  f"{p.get('displayName') or p.get('positionName')}")
    else:
        print(f"   FAILED ({resp.status_code}): {resp.text[:200]}")

    # Step 6: Inbox
    print("\n6. IRIDA inbox...")
    resp = httpx.get(f'{BASE}/api/irida/inbox', headers=headers, timeout=15)
    if resp.status_code == 200:
        data = resp.json()
        items = data.get('data', data) if isinstance(data, dict) else data
        if not items:
            print("   (empty)")
        for doc in (items or [])[:5]:
            print(f"   [{doc.get('regNo')}] {doc.get('title')}")
    else:
        print(f"   FAILED ({resp.status_code}): {resp.text[:200]}")

    # Step 7: Save IRIDA credentials in profile
    print("\n7. Saving IRIDA credentials in profile...")
    resp = httpx.post(f'{BASE}/api/profile/irida', headers=headers,
                      json={'username': 'demo@demo.gr', 'password': 'Demo κωδικός'},
                      timeout=10)
    if resp.status_code == 200:
        print(f"   OK - {resp.json()}")
    else:
        print(f"   FAILED ({resp.status_code}): {resp.text[:200]}")

    # Step 8: Test IRIDA connection
    print("\n8. Testing IRIDA connection...")
    resp = httpx.post(f'{BASE}/api/profile/irida/test', headers=headers,
                      json={}, timeout=15)
    if resp.status_code == 200:
        data = resp.json()
        print(f"   OK - {len(data.get('profiles', []))} profile(s)")
    else:
        print(f"   FAILED ({resp.status_code}): {resp.text[:200]}")

    # Step 9: Create a test advisor report
    print("\n9. Creating test advisor report...")
    resp = httpx.get(f'{BASE}/api/structures', headers=headers, timeout=10)
    structures = resp.json() if resp.status_code == 200 else []
    if isinstance(structures, dict):
        structures = structures.get('data', structures.get('structures', []))
    if structures:
        sid = structures[0].get('id')
        import datetime
        form_data = {
            'type': 'regular',
            'drafted_date': datetime.date.today().isoformat(),
            'assessment': 'Δοκιμαστική αξιολόγηση για ΙΡΙΔΑ test',
        }
        resp = httpx.post(f'{BASE}/api/structures/{sid}/advisor-reports',
                          headers=headers, data=form_data, timeout=10)
        if resp.status_code == 201:
            report = resp.json()
            report_id = report['id']
            print(f"   OK - report #{report_id} (status: {report['status']})")

            # Step 10: Send to IRIDA
            print("\n10. Sending advisor report to ΙΡΙΔΑ...")
            resp = httpx.get(f'{BASE}/api/irida/roots', headers=headers, timeout=15)
            if resp.status_code == 200:
                roots = resp.json()
                items = roots if isinstance(roots, list) else roots.get('data', [])
                if items:
                    recipient_id = str(items[0].get('id') or items[0].get('Id'))
                    resp = httpx.post(
                        f'{BASE}/api/advisor-reports/{report_id}/send-to-irida',
                        headers=headers,
                        json={'recipients': [recipient_id]},
                        timeout=30,
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        tx = data.get('transaction', {})
                        print(f"   OK - {data.get('message')}")
                        print(f"   Transaction: {tx.get('status')} | "
                              f"Reg: {tx.get('irida_reg_no')}")
                    else:
                        print(f"   FAILED ({resp.status_code}): "
                              f"{resp.text[:300]}")
                else:
                    print("   SKIP - no organisations available")
            else:
                print(f"   SKIP - couldn't fetch roots: {resp.status_code}")
        else:
            print(f"   FAILED ({resp.status_code}): {resp.text[:200]}")
    else:
        print("   SKIP - no structures in database")

    print("\nDone!")


if __name__ == '__main__':
    main()
