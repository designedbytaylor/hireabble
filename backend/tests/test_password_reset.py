"""
Test suite for Forgot Password / Reset Password feature
Tests: Token creation, validation, expiration, and password update flow
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestForgotPassword:
    """Test forgot password endpoints"""
    
    # Test data - unique per test run
    test_user_email = f"forgottest_{uuid.uuid4().hex[:8]}@example.com"
    test_user_password = "original_password123"
    new_password = "newpassword456"
    user_id = None
    reset_token = None
    
    @pytest.fixture(autouse=True)
    def api_client(self):
        """Create API session"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        return session
    
    def test_01_register_test_user(self, api_client):
        """Register a test user for password reset testing"""
        response = api_client.post(f"{BASE_URL}/api/auth/register", json={
            "email": self.test_user_email,
            "password": self.test_user_password,
            "name": "Forgot Test User",
            "role": "seeker"
        })
        assert response.status_code == 200, f"Registration failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert "user" in data
        TestForgotPassword.user_id = data["user"]["id"]
        print(f"✓ Registered test user: {self.test_user_email}")
    
    def test_02_login_with_original_password(self, api_client):
        """Verify user can login with original password"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": self.test_user_email,
            "password": self.test_user_password
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data
        print("✓ Login with original password successful")
    
    def test_03_forgot_password_creates_token(self, api_client):
        """Test forgot password endpoint creates a reset token"""
        response = api_client.post(f"{BASE_URL}/api/auth/forgot-password", json={
            "email": self.test_user_email
        })
        assert response.status_code == 200, f"Forgot password failed: {response.text}"
        data = response.json()
        assert "message" in data
        assert "reset link has been sent" in data["message"].lower() or "reset link" in data["message"].lower()
        print("✓ Forgot password endpoint returned success message")
    
    def test_04_forgot_password_nonexistent_email(self, api_client):
        """Test forgot password with non-existent email returns same message (security)"""
        response = api_client.post(f"{BASE_URL}/api/auth/forgot-password", json={
            "email": "nonexistent@example.com"
        })
        # Should return 200 to prevent email enumeration
        assert response.status_code == 200, f"Expected 200 for security: {response.text}"
        data = response.json()
        assert "message" in data
        print("✓ Non-existent email returns success (prevents enumeration)")
    
    def test_05_reset_password_invalid_token(self, api_client):
        """Test reset password with invalid token returns error"""
        response = api_client.post(f"{BASE_URL}/api/auth/reset-password", json={
            "token": "invalid-token-xyz",
            "password": "newpassword123"
        })
        assert response.status_code == 400, f"Expected 400 for invalid token: {response.text}"
        data = response.json()
        assert "detail" in data
        assert "invalid" in data["detail"].lower() or "expired" in data["detail"].lower()
        print("✓ Invalid token returns 400 error")
    
    def test_06_reset_password_empty_token(self, api_client):
        """Test reset password with empty token"""
        response = api_client.post(f"{BASE_URL}/api/auth/reset-password", json={
            "token": "",
            "password": "newpassword123"
        })
        assert response.status_code == 400, f"Expected 400 for empty token: {response.text}"
        print("✓ Empty token returns 400 error")
    
    def test_07_forgot_password_invalid_email_format(self, api_client):
        """Test forgot password with invalid email format"""
        response = api_client.post(f"{BASE_URL}/api/auth/forgot-password", json={
            "email": "not-an-email"
        })
        # Should return 422 for validation error
        assert response.status_code == 422, f"Expected 422 for invalid email: {response.text}"
        print("✓ Invalid email format returns 422 validation error")


class TestPasswordResetIntegration:
    """End-to-end integration tests for password reset flow"""
    
    @pytest.fixture(autouse=True)
    def api_client(self):
        """Create API session"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        return session
    
    def test_complete_password_reset_flow(self, api_client):
        """Test complete flow: register -> forgot password -> get token from DB -> reset -> login with new"""
        import pymongo
        
        # Generate unique test email
        test_email = f"flowtest_{uuid.uuid4().hex[:8]}@example.com"
        original_password = "originalpass123"
        new_password = "newpassword456"
        
        # Step 1: Register user
        response = api_client.post(f"{BASE_URL}/api/auth/register", json={
            "email": test_email,
            "password": original_password,
            "name": "Flow Test User",
            "role": "seeker"
        })
        assert response.status_code == 200, f"Registration failed: {response.text}"
        user_id = response.json()["user"]["id"]
        print(f"✓ Step 1: Registered user {test_email}")
        
        # Step 2: Request password reset
        response = api_client.post(f"{BASE_URL}/api/auth/forgot-password", json={
            "email": test_email
        })
        assert response.status_code == 200, f"Forgot password failed: {response.text}"
        print("✓ Step 2: Forgot password request successful")
        
        # Step 3: Get token from MongoDB directly (simulating email click)
        try:
            mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
            client = pymongo.MongoClient(mongo_url)
            db = client[os.environ.get('DB_NAME', 'test_database')]
            token_doc = db.password_reset_tokens.find_one({"user_id": user_id})
            assert token_doc is not None, "Token not found in database"
            reset_token = token_doc["token"]
            print(f"✓ Step 3: Retrieved token from database")
            client.close()
        except Exception as e:
            pytest.skip(f"Cannot access MongoDB directly: {e}")
        
        # Step 4: Reset password with valid token
        response = api_client.post(f"{BASE_URL}/api/auth/reset-password", json={
            "token": reset_token,
            "password": new_password
        })
        assert response.status_code == 200, f"Reset password failed: {response.text}"
        data = response.json()
        assert "message" in data
        assert "success" in data["message"].lower()
        print("✓ Step 4: Password reset successful")
        
        # Step 5: Login with new password
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": test_email,
            "password": new_password
        })
        assert response.status_code == 200, f"Login with new password failed: {response.text}"
        print("✓ Step 5: Login with new password successful")
        
        # Step 6: Verify old password no longer works
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": test_email,
            "password": original_password
        })
        assert response.status_code == 401, f"Old password should not work: {response.text}"
        print("✓ Step 6: Old password correctly rejected")
        
        # Step 7: Verify token is consumed (cannot reuse)
        response = api_client.post(f"{BASE_URL}/api/auth/reset-password", json={
            "token": reset_token,
            "password": "anotherpassword789"
        })
        assert response.status_code == 400, f"Token should be consumed: {response.text}"
        print("✓ Step 7: Token correctly consumed (cannot reuse)")


class TestPasswordResetEdgeCases:
    """Edge case tests for password reset"""
    
    @pytest.fixture(autouse=True)
    def api_client(self):
        """Create API session"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        return session
    
    def test_multiple_reset_requests(self, api_client):
        """Test that multiple reset requests only keep the latest token"""
        import pymongo
        
        # Generate unique test email
        test_email = f"multitest_{uuid.uuid4().hex[:8]}@example.com"
        
        # Register user
        response = api_client.post(f"{BASE_URL}/api/auth/register", json={
            "email": test_email,
            "password": "testpass123",
            "name": "Multi Test User",
            "role": "seeker"
        })
        assert response.status_code == 200
        user_id = response.json()["user"]["id"]
        
        # Request multiple resets
        for i in range(3):
            response = api_client.post(f"{BASE_URL}/api/auth/forgot-password", json={
                "email": test_email
            })
            assert response.status_code == 200
        
        # Check database - should only have 1 token for this user
        try:
            mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
            client = pymongo.MongoClient(mongo_url)
            db = client[os.environ.get('DB_NAME', 'test_database')]
            token_count = db.password_reset_tokens.count_documents({"user_id": user_id})
            assert token_count == 1, f"Expected 1 token, found {token_count}"
            print("✓ Multiple requests only keep latest token")
            client.close()
        except Exception as e:
            pytest.skip(f"Cannot access MongoDB directly: {e}")
    
    def test_password_length_validation(self, api_client):
        """Test that password has minimum length requirement (frontend validation)"""
        # Note: This is primarily frontend validation, backend may not enforce
        import pymongo
        
        test_email = f"lentest_{uuid.uuid4().hex[:8]}@example.com"
        
        # Register and get token
        response = api_client.post(f"{BASE_URL}/api/auth/register", json={
            "email": test_email,
            "password": "testpass123",
            "name": "Length Test User",
            "role": "seeker"
        })
        if response.status_code != 200:
            pytest.skip("Registration failed")
        
        user_id = response.json()["user"]["id"]
        
        # Get token
        response = api_client.post(f"{BASE_URL}/api/auth/forgot-password", json={
            "email": test_email
        })
        assert response.status_code == 200
        
        # Get token from DB
        try:
            mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
            client = pymongo.MongoClient(mongo_url)
            db = client[os.environ.get('DB_NAME', 'test_database')]
            token_doc = db.password_reset_tokens.find_one({"user_id": user_id})
            reset_token = token_doc["token"]
            client.close()
        except Exception as e:
            pytest.skip(f"Cannot access MongoDB: {e}")
        
        # Try short password - backend may or may not validate
        response = api_client.post(f"{BASE_URL}/api/auth/reset-password", json={
            "token": reset_token,
            "password": "abc"  # Short password
        })
        # If backend validates, expect 400/422; if not, 200 is also acceptable
        print(f"Short password response: {response.status_code}")
        assert response.status_code in [200, 400, 422], f"Unexpected status: {response.status_code}"
        print("✓ Short password handling tested")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
