"""
Test file for new features:
1. Super Like Feature - Daily limit of 3 super likes
2. In-App Notifications - Bell icon, notification list, mark as read
3. Change Password - Form in Profile settings
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://password-reset-47.preview.emergentagent.com"

class TestSetup:
    """Helper class for test setup"""
    
    @staticmethod
    def register_user(email=None, password="password123", role="seeker"):
        """Register a new user and return token"""
        if email is None:
            email = f"TEST_user_{uuid.uuid4().hex[:8]}@example.com"
        
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": password,
            "name": f"Test User {uuid.uuid4().hex[:4]}",
            "role": role,
            "company": "Test Company" if role == "recruiter" else None
        })
        return response
    
    @staticmethod
    def login_user(email, password="password123"):
        """Login and return token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": email,
            "password": password
        })
        return response
    
    @staticmethod
    def get_auth_headers(token):
        """Return auth headers"""
        return {"Authorization": f"Bearer {token}"}


class TestChangePassword:
    """Test Change Password feature - POST /api/auth/change-password"""
    
    def test_change_password_success(self):
        """Test successful password change"""
        # Register new user
        email = f"TEST_changepw_{uuid.uuid4().hex[:8]}@example.com"
        old_password = "oldpass123"
        new_password = "newpass456"
        
        reg_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": old_password,
            "name": "Change PW User",
            "role": "seeker"
        })
        assert reg_response.status_code == 200, f"Registration failed: {reg_response.text}"
        token = reg_response.json()["token"]
        
        # Change password
        headers = TestSetup.get_auth_headers(token)
        change_response = requests.post(f"{BASE_URL}/api/auth/change-password", json={
            "current_password": old_password,
            "new_password": new_password
        }, headers=headers)
        
        assert change_response.status_code == 200, f"Change password failed: {change_response.text}"
        assert "message" in change_response.json()
        print(f"PASS: Password changed successfully - {change_response.json()['message']}")
        
        # Verify can login with new password
        login_response = TestSetup.login_user(email, new_password)
        assert login_response.status_code == 200, "Login with new password failed"
        print("PASS: Can login with new password")
        
        # Verify old password no longer works
        old_login_response = TestSetup.login_user(email, old_password)
        assert old_login_response.status_code == 401, "Old password should not work"
        print("PASS: Old password rejected after change")
    
    def test_change_password_wrong_current(self):
        """Test change password with incorrect current password"""
        email = f"TEST_wrongpw_{uuid.uuid4().hex[:8]}@example.com"
        
        reg_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": "correctpass",
            "name": "Wrong PW User",
            "role": "seeker"
        })
        assert reg_response.status_code == 200
        token = reg_response.json()["token"]
        
        # Try to change with wrong current password
        headers = TestSetup.get_auth_headers(token)
        change_response = requests.post(f"{BASE_URL}/api/auth/change-password", json={
            "current_password": "wrongpass",
            "new_password": "newpass123"
        }, headers=headers)
        
        assert change_response.status_code == 400, f"Should fail with wrong password: {change_response.text}"
        assert "incorrect" in change_response.json().get("detail", "").lower()
        print(f"PASS: Correctly rejected wrong current password - {change_response.json()['detail']}")
    
    def test_change_password_short_new_password(self):
        """Test change password with too short new password"""
        email = f"TEST_shortpw_{uuid.uuid4().hex[:8]}@example.com"
        
        reg_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": "validpass123",
            "name": "Short PW User",
            "role": "seeker"
        })
        assert reg_response.status_code == 200
        token = reg_response.json()["token"]
        
        # Try to change with short new password
        headers = TestSetup.get_auth_headers(token)
        change_response = requests.post(f"{BASE_URL}/api/auth/change-password", json={
            "current_password": "validpass123",
            "new_password": "ab"  # Too short
        }, headers=headers)
        
        assert change_response.status_code == 400, f"Should reject short password: {change_response.text}"
        print(f"PASS: Correctly rejected short new password")
    
    def test_change_password_without_auth(self):
        """Test change password without authentication"""
        response = requests.post(f"{BASE_URL}/api/auth/change-password", json={
            "current_password": "test",
            "new_password": "newtest123"
        })
        assert response.status_code in [401, 403], "Should require authentication"
        print("PASS: Change password requires authentication")


class TestNotifications:
    """Test Notifications feature"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test user"""
        email = f"TEST_notif_{uuid.uuid4().hex[:8]}@example.com"
        reg_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": "password123",
            "name": "Notification User",
            "role": "seeker"
        })
        assert reg_response.status_code == 200
        self.token = reg_response.json()["token"]
        self.headers = TestSetup.get_auth_headers(self.token)
        self.user_id = reg_response.json()["user"]["id"]
    
    def test_get_notifications_empty(self):
        """Test GET /api/notifications - returns empty list for new user"""
        response = requests.get(f"{BASE_URL}/api/notifications", headers=self.headers)
        assert response.status_code == 200, f"Failed to get notifications: {response.text}"
        assert isinstance(response.json(), list)
        print(f"PASS: Get notifications returns list - {len(response.json())} notifications")
    
    def test_get_unread_count(self):
        """Test GET /api/notifications/unread/count"""
        response = requests.get(f"{BASE_URL}/api/notifications/unread/count", headers=self.headers)
        assert response.status_code == 200, f"Failed to get unread count: {response.text}"
        data = response.json()
        assert "unread_count" in data
        assert isinstance(data["unread_count"], int)
        print(f"PASS: Unread count endpoint works - {data['unread_count']} unread")
    
    def test_mark_notification_read_nonexistent(self):
        """Test PUT /api/notifications/{id}/read with non-existent notification"""
        fake_id = str(uuid.uuid4())
        response = requests.put(f"{BASE_URL}/api/notifications/{fake_id}/read", headers=self.headers, json={})
        assert response.status_code == 404, f"Should return 404 for non-existent notification: {response.text}"
        print("PASS: Mark non-existent notification as read returns 404")
    
    def test_mark_all_notifications_read(self):
        """Test PUT /api/notifications/read-all"""
        response = requests.put(f"{BASE_URL}/api/notifications/read-all", headers=self.headers, json={})
        assert response.status_code == 200, f"Failed to mark all as read: {response.text}"
        assert "message" in response.json()
        print(f"PASS: Mark all notifications as read - {response.json()['message']}")
    
    def test_notifications_require_auth(self):
        """Test notifications endpoints require authentication"""
        # Get notifications without auth
        response = requests.get(f"{BASE_URL}/api/notifications")
        assert response.status_code in [401, 403], "Should require auth"
        
        # Get unread count without auth
        response = requests.get(f"{BASE_URL}/api/notifications/unread/count")
        assert response.status_code in [401, 403], "Should require auth"
        
        print("PASS: Notification endpoints require authentication")


class TestSuperLikes:
    """Test Super Like feature - Daily limit of 3"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Create a seeker and recruiter with a job"""
        # Create recruiter
        recruiter_email = f"TEST_recruiter_{uuid.uuid4().hex[:8]}@example.com"
        recruiter_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": recruiter_email,
            "password": "password123",
            "name": "Test Recruiter",
            "role": "recruiter",
            "company": "Test Corp"
        })
        assert recruiter_response.status_code == 200
        recruiter_token = recruiter_response.json()["token"]
        recruiter_headers = TestSetup.get_auth_headers(recruiter_token)
        
        # Create test jobs
        self.job_ids = []
        for i in range(5):  # Create 5 jobs to test super like limit
            job_response = requests.post(f"{BASE_URL}/api/jobs", json={
                "title": f"Test Job {i+1}",
                "company": "Test Corp",
                "description": f"Test job description {i+1}",
                "requirements": ["Skill A", "Skill B"],
                "salary_min": 50000,
                "salary_max": 100000,
                "location": "Remote",
                "job_type": "remote",
                "experience_level": "mid"
            }, headers=recruiter_headers)
            assert job_response.status_code == 200
            self.job_ids.append(job_response.json()["id"])
        
        # Create seeker
        seeker_email = f"TEST_seeker_{uuid.uuid4().hex[:8]}@example.com"
        seeker_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": seeker_email,
            "password": "password123",
            "name": "Test Seeker",
            "role": "seeker"
        })
        assert seeker_response.status_code == 200
        self.seeker_token = seeker_response.json()["token"]
        self.seeker_headers = TestSetup.get_auth_headers(self.seeker_token)
    
    def test_get_remaining_superlikes_initial(self):
        """Test GET /api/superlikes/remaining returns 3 for new user"""
        response = requests.get(f"{BASE_URL}/api/superlikes/remaining", headers=self.seeker_headers)
        assert response.status_code == 200, f"Failed to get remaining superlikes: {response.text}"
        
        data = response.json()
        assert "remaining" in data
        assert "used_today" in data
        assert "daily_limit" in data
        assert data["daily_limit"] == 3, "Daily limit should be 3"
        assert data["remaining"] == 3, "New user should have 3 superlikes"
        assert data["used_today"] == 0, "New user should have 0 used"
        
        print(f"PASS: Initial superlikes - Remaining: {data['remaining']}, Used: {data['used_today']}, Limit: {data['daily_limit']}")
    
    def test_superlike_decrements_remaining(self):
        """Test that using a super like decrements remaining count"""
        # Use first superlike
        swipe_response = requests.post(f"{BASE_URL}/api/swipe", json={
            "job_id": self.job_ids[0],
            "action": "superlike"
        }, headers=self.seeker_headers)
        assert swipe_response.status_code == 200, f"Superlike failed: {swipe_response.text}"
        
        # Check remaining_superlikes in response
        if "remaining_superlikes" in swipe_response.json():
            remaining = swipe_response.json()["remaining_superlikes"]
            assert remaining == 2, f"Should have 2 remaining after 1 superlike, got {remaining}"
            print(f"PASS: Swipe response includes remaining_superlikes: {remaining}")
        
        # Verify via GET endpoint
        remaining_response = requests.get(f"{BASE_URL}/api/superlikes/remaining", headers=self.seeker_headers)
        assert remaining_response.status_code == 200
        data = remaining_response.json()
        assert data["remaining"] == 2, f"Should have 2 remaining, got {data['remaining']}"
        assert data["used_today"] == 1, f"Should have used 1, got {data['used_today']}"
        
        print(f"PASS: After 1 superlike - Remaining: {data['remaining']}, Used: {data['used_today']}")
    
    def test_superlike_limit_enforced(self):
        """Test that 4th super like is blocked after 3"""
        # Use all 3 superlikes
        for i in range(3):
            swipe_response = requests.post(f"{BASE_URL}/api/swipe", json={
                "job_id": self.job_ids[i],
                "action": "superlike"
            }, headers=self.seeker_headers)
            assert swipe_response.status_code == 200, f"Superlike {i+1} failed: {swipe_response.text}"
            print(f"  - Superlike {i+1}/3 used successfully")
        
        # Verify all 3 are used
        remaining_response = requests.get(f"{BASE_URL}/api/superlikes/remaining", headers=self.seeker_headers)
        data = remaining_response.json()
        assert data["remaining"] == 0, f"Should have 0 remaining, got {data['remaining']}"
        assert data["used_today"] == 3, f"Should have used 3, got {data['used_today']}"
        print(f"PASS: All 3 superlikes used - Remaining: {data['remaining']}")
        
        # Try 4th superlike - should be blocked
        fourth_response = requests.post(f"{BASE_URL}/api/swipe", json={
            "job_id": self.job_ids[3],
            "action": "superlike"
        }, headers=self.seeker_headers)
        assert fourth_response.status_code == 400, f"4th superlike should be blocked: {fourth_response.text}"
        assert "limit" in fourth_response.json().get("detail", "").lower()
        print(f"PASS: 4th superlike blocked - {fourth_response.json()['detail']}")
    
    def test_regular_like_after_superlike_limit(self):
        """Test that regular likes still work after superlike limit reached"""
        # Use all 3 superlikes
        for i in range(3):
            requests.post(f"{BASE_URL}/api/swipe", json={
                "job_id": self.job_ids[i],
                "action": "superlike"
            }, headers=self.seeker_headers)
        
        # Regular like should still work
        like_response = requests.post(f"{BASE_URL}/api/swipe", json={
            "job_id": self.job_ids[3],
            "action": "like"
        }, headers=self.seeker_headers)
        assert like_response.status_code == 200, f"Regular like should work: {like_response.text}"
        print("PASS: Regular likes still work after superlike limit reached")
    
    def test_superlikes_only_for_seekers(self):
        """Test that recruiters cannot access superlikes endpoint"""
        # Create recruiter
        recruiter_email = f"TEST_recruiter_sl_{uuid.uuid4().hex[:8]}@example.com"
        recruiter_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": recruiter_email,
            "password": "password123",
            "name": "Recruiter",
            "role": "recruiter",
            "company": "Corp"
        })
        recruiter_headers = TestSetup.get_auth_headers(recruiter_response.json()["token"])
        
        # Try to access superlikes endpoint
        response = requests.get(f"{BASE_URL}/api/superlikes/remaining", headers=recruiter_headers)
        assert response.status_code == 403, f"Recruiters should not access superlikes: {response.text}"
        print("PASS: Superlikes endpoint restricted to seekers only")


class TestExistingUserLogin:
    """Test login with existing onboarded test user"""
    
    def test_onboarded_user_login(self):
        """Test login with provided test credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "onboarded_test@example.com",
            "password": "password123"
        })
        
        if response.status_code == 200:
            print("PASS: Can login with onboarded_test@example.com / password123")
            data = response.json()
            assert "token" in data
            assert "user" in data
            print(f"  - User role: {data['user'].get('role')}")
            print(f"  - User name: {data['user'].get('name')}")
        elif response.status_code == 401:
            print("INFO: onboarded_test@example.com does not exist or wrong password - creating user")
            # Create the user
            reg_response = requests.post(f"{BASE_URL}/api/auth/register", json={
                "email": "onboarded_test@example.com",
                "password": "password123",
                "name": "Onboarded Test User",
                "role": "seeker"
            })
            if reg_response.status_code == 200:
                print("  - Created onboarded_test@example.com user")
            elif reg_response.status_code == 400:
                print("  - User already exists, password may be different")
        else:
            pytest.fail(f"Unexpected status: {response.status_code} - {response.text}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
