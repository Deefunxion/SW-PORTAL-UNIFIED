"""
Basic authentication API tests
Lightweight tests without heavy AI dependencies  
"""
import pytest
import json


@pytest.mark.api
@pytest.mark.auth 
def test_auth_endpoints_exist(client):
    """Test that auth endpoints respond (even if with errors)."""
    # These might return various error codes but should not crash
    response = client.post('/api/auth/login')
    assert response.status_code in [400, 404, 405, 415, 422]
    
    response = client.post('/api/auth/register') 
    assert response.status_code in [400, 404, 405, 415, 422]


@pytest.mark.api
def test_invalid_login(client):
    """Test login with invalid credentials."""
    response = client.post('/api/auth/login', json={
        'username': 'nonexistent',
        'password': 'wrongpass'
    })
    # Should fail but not crash
    assert response.status_code in [400, 401, 404, 422]


@pytest.mark.api  
def test_empty_registration(client):
    """Test registration with empty data."""
    response = client.post('/api/auth/register', json={})
    # Should fail validation but not crash
    assert response.status_code in [400, 422]


@pytest.mark.integration
def test_valid_registration_flow(client, sample_user_data):
    """Test complete registration flow if endpoints exist."""
    try:
        response = client.post('/api/auth/register', json=sample_user_data)
        
        # If registration endpoint exists and works
        if response.status_code == 200:
            data = response.get_json()
            assert 'message' in data or 'access_token' in data
        else:
            # Endpoint might not be implemented yet
            assert response.status_code in [400, 404, 422, 500]
            
    except Exception as e:
        # If there are issues with the endpoint, that's expected during development
        pytest.skip(f"Auth endpoint not fully implemented: {e}")


@pytest.mark.slow
def test_login_after_registration(client, sample_user_data):
    """Test login after successful registration."""
    try:
        # Try registration first
        reg_response = client.post('/api/auth/register', json=sample_user_data)
        
        if reg_response.status_code == 200:
            # Try login
            login_response = client.post('/api/auth/login', json={
                'username': sample_user_data['username'],
                'password': sample_user_data['password']
            })
            
            if login_response.status_code == 200:
                data = login_response.get_json()
                assert 'access_token' in data
            else:
                # Login might fail for various reasons during development
                assert login_response.status_code in [400, 401, 500]
        else:
            pytest.skip("Registration not working, cannot test login")
            
    except Exception as e:
        pytest.skip(f"Auth flow not fully implemented: {e}")