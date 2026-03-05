"""
Test suite for Hireabble API after backend refactoring
Tests: Auth, Jobs, Applications, Notifications, Stats, Video Upload, Push Subscription
"""
import pytest
import requests
import os
import uuid
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# ==================== FIXTURES ====================

@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session

@pytest.fixture(scope="module")
def test_seeker_credentials():
    """Test seeker credentials - existing onboarded user"""
    return {
        "email": "onboarded_test@example.com",
        "password": "password123"
    }

@pytest.fixture(scope="module")
def seeker_token(api_client, test_seeker_credentials):
    """Get seeker authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json=test_seeker_credentials)
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Seeker login failed: {response.status_code}")

@pytest.fixture(scope="module")
def test_recruiter():
    """Create a test recruiter for testing"""
    unique_id = str(uuid.uuid4())[:8]
    return {
        "email": f"TEST_recruiter_{unique_id}@example.com",
        "password": "testpass123",
        "name": f"Test Recruiter {unique_id}",
        "role": "recruiter",
        "company": "Test Corp"
    }

@pytest.fixture(scope="module")
def recruiter_token(api_client, test_recruiter):
    """Get or create recruiter and return token"""
    # Try to register
    response = api_client.post(f"{BASE_URL}/api/auth/register", json=test_recruiter)
    if response.status_code == 200:
        return response.json().get("token")
    # Try to login if already exists
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": test_recruiter["email"],
        "password": test_recruiter["password"]
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Recruiter auth failed: {response.status_code}")

# ==================== HEALTH CHECK ====================

class TestHealthCheck:
    """Test API health and availability"""
    
    def test_health_endpoint(self, api_client):
        """Health endpoint returns healthy status"""
        response = api_client.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["service"] == "Hireabble API"
        print("✓ Health check passed")

    def test_api_version(self, api_client):
        """API health returns version info"""
        response = api_client.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert "service" in data
        print("✓ API version info available")

# ==================== AUTH ENDPOINTS ====================

class TestAuthEndpoints:
    """Test authentication after refactoring to routers/auth.py"""
    
    def test_login_success(self, api_client, test_seeker_credentials):
        """Login returns token and user data"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json=test_seeker_credentials)
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == test_seeker_credentials["email"]
        assert data["user"]["role"] == "seeker"
        print("✓ Login success verified")

    def test_login_invalid_credentials(self, api_client):
        """Login with invalid credentials returns 401"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": "nonexistent@example.com",
            "password": "wrongpass"
        })
        assert response.status_code == 401
        print("✓ Invalid login rejected")

    def test_get_me_authenticated(self, api_client, seeker_token):
        """GET /api/auth/me returns current user"""
        response = api_client.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {seeker_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert "email" in data
        assert "role" in data
        print("✓ Get me endpoint works")

    def test_get_me_unauthorized(self, api_client):
        """GET /api/auth/me without token returns 403"""
        response = api_client.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 403
        print("✓ Unauthorized access properly rejected")

    def test_forgot_password_endpoint(self, api_client):
        """Forgot password returns success message"""
        response = api_client.post(f"{BASE_URL}/api/auth/forgot-password", json={
            "email": "any@example.com"
        })
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print("✓ Forgot password endpoint works")

    def test_change_password_endpoint(self, api_client, seeker_token):
        """Change password validates current password"""
        response = api_client.post(
            f"{BASE_URL}/api/auth/change-password",
            json={"current_password": "wrongpassword", "new_password": "newpass123"},
            headers={"Authorization": f"Bearer {seeker_token}"}
        )
        # Should fail because current password is wrong
        assert response.status_code == 400
        print("✓ Change password validates current password")

    def test_update_profile_endpoint(self, api_client, seeker_token):
        """Update profile returns updated user"""
        response = api_client.put(
            f"{BASE_URL}/api/auth/profile",
            json={"location": "Test City"},
            headers={"Authorization": f"Bearer {seeker_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        print("✓ Update profile endpoint works")

# ==================== JOBS ENDPOINTS ====================

class TestJobsEndpoints:
    """Test jobs after refactoring to routers/jobs.py"""
    
    def test_get_jobs_seeker(self, api_client, seeker_token):
        """Seeker can get job listings"""
        response = api_client.get(
            f"{BASE_URL}/api/jobs",
            headers={"Authorization": f"Bearer {seeker_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Seeker can view {len(data)} jobs")

    def test_get_jobs_recruiter(self, api_client, recruiter_token):
        """Recruiter can get their job postings"""
        response = api_client.get(
            f"{BASE_URL}/api/jobs",
            headers={"Authorization": f"Bearer {recruiter_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Recruiter can view their {len(data)} jobs")

    def test_create_job_recruiter(self, api_client, recruiter_token):
        """Recruiter can create a job posting"""
        job_data = {
            "title": f"TEST_Software Engineer {uuid.uuid4().hex[:6]}",
            "company": "Test Corp",
            "description": "Test job description",
            "requirements": ["Python", "FastAPI"],
            "salary_min": 80000,
            "salary_max": 120000,
            "location": "Remote",
            "job_type": "remote",
            "experience_level": "mid"
        }
        response = api_client.post(
            f"{BASE_URL}/api/jobs",
            json=job_data,
            headers={"Authorization": f"Bearer {recruiter_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == job_data["title"]
        assert "id" in data
        print(f"✓ Job created with ID: {data['id']}")

    def test_create_job_seeker_forbidden(self, api_client, seeker_token):
        """Seeker cannot create job postings"""
        job_data = {
            "title": "Test Job",
            "company": "Test",
            "description": "Test",
            "location": "Test",
            "job_type": "remote",
            "experience_level": "entry"
        }
        response = api_client.post(
            f"{BASE_URL}/api/jobs",
            json=job_data,
            headers={"Authorization": f"Bearer {seeker_token}"}
        )
        assert response.status_code == 403
        print("✓ Seeker correctly forbidden from creating jobs")

# ==================== APPLICATIONS ENDPOINTS ====================

class TestApplicationsEndpoints:
    """Test applications after refactoring to routers/applications.py"""
    
    def test_get_superlikes_remaining(self, api_client, seeker_token):
        """Seeker can check super likes remaining"""
        response = api_client.get(
            f"{BASE_URL}/api/superlikes/remaining",
            headers={"Authorization": f"Bearer {seeker_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "remaining" in data
        assert "daily_limit" in data
        assert data["daily_limit"] == 3
        print(f"✓ Super likes remaining: {data['remaining']}")

    def test_superlikes_recruiter_forbidden(self, api_client, recruiter_token):
        """Recruiter cannot access super likes endpoint"""
        response = api_client.get(
            f"{BASE_URL}/api/superlikes/remaining",
            headers={"Authorization": f"Bearer {recruiter_token}"}
        )
        assert response.status_code == 403
        print("✓ Recruiter correctly forbidden from super likes")

    def test_get_applications_recruiter(self, api_client, recruiter_token):
        """Recruiter can get applications"""
        response = api_client.get(
            f"{BASE_URL}/api/applications",
            headers={"Authorization": f"Bearer {recruiter_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Recruiter can view {len(data)} applications")

    def test_get_applications_seeker_forbidden(self, api_client, seeker_token):
        """Seeker cannot access applications endpoint"""
        response = api_client.get(
            f"{BASE_URL}/api/applications",
            headers={"Authorization": f"Bearer {seeker_token}"}
        )
        assert response.status_code == 403
        print("✓ Seeker correctly forbidden from applications list")

# ==================== NOTIFICATIONS ENDPOINTS ====================

class TestNotificationsEndpoints:
    """Test notifications after refactoring to routers/notifications.py"""
    
    def test_get_notifications(self, api_client, seeker_token):
        """Get notifications list"""
        response = api_client.get(
            f"{BASE_URL}/api/notifications",
            headers={"Authorization": f"Bearer {seeker_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Got {len(data)} notifications")

    def test_get_unread_count(self, api_client, seeker_token):
        """Get unread notifications count"""
        response = api_client.get(
            f"{BASE_URL}/api/notifications/unread/count",
            headers={"Authorization": f"Bearer {seeker_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "unread_count" in data
        assert isinstance(data["unread_count"], int)
        print(f"✓ Unread count: {data['unread_count']}")

    def test_mark_all_read(self, api_client, seeker_token):
        """Mark all notifications as read"""
        response = api_client.put(
            f"{BASE_URL}/api/notifications/read-all",
            headers={"Authorization": f"Bearer {seeker_token}"}
        )
        assert response.status_code == 200
        print("✓ Mark all read works")

    def test_mark_single_notification_not_found(self, api_client, seeker_token):
        """Mark non-existent notification returns 404"""
        response = api_client.put(
            f"{BASE_URL}/api/notifications/nonexistent-id/read",
            headers={"Authorization": f"Bearer {seeker_token}"}
        )
        assert response.status_code == 404
        print("✓ Non-existent notification returns 404")

# ==================== STATS ENDPOINTS ====================

class TestStatsEndpoints:
    """Test stats after refactoring to routers/stats.py"""
    
    def test_get_stats_seeker(self, api_client, seeker_token):
        """Seeker can get their stats"""
        response = api_client.get(
            f"{BASE_URL}/api/stats",
            headers={"Authorization": f"Bearer {seeker_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "applications_sent" in data or "jobs_posted" in data
        print(f"✓ Seeker stats retrieved")

    def test_get_stats_recruiter(self, api_client, recruiter_token):
        """Recruiter can get their stats"""
        response = api_client.get(
            f"{BASE_URL}/api/stats",
            headers={"Authorization": f"Bearer {recruiter_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "jobs_posted" in data
        print(f"✓ Recruiter stats retrieved")

    def test_profile_completeness(self, api_client, seeker_token):
        """Get profile completeness"""
        response = api_client.get(
            f"{BASE_URL}/api/profile/completeness",
            headers={"Authorization": f"Bearer {seeker_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "percentage" in data
        assert "missing_fields" in data
        assert "is_complete" in data
        print(f"✓ Profile completeness: {data['percentage']}%")

# ==================== VIDEO UPLOAD ENDPOINTS ====================

class TestVideoUploadEndpoints:
    """Test video upload feature from routers/uploads.py"""
    
    def test_video_upload_seeker_only(self, api_client, recruiter_token):
        """Video upload restricted to seekers only"""
        # Create a small test video file
        test_content = b"fake video content"
        files = {"file": ("test.mp4", test_content, "video/mp4")}
        response = requests.post(
            f"{BASE_URL}/api/upload/video",
            files=files,
            headers={"Authorization": f"Bearer {recruiter_token}"}
        )
        assert response.status_code == 403
        assert "seekers" in response.json().get("detail", "").lower() or "seeker" in response.json().get("detail", "").lower()
        print("✓ Recruiter correctly forbidden from video upload")

    def test_video_delete_seeker_only(self, api_client, recruiter_token):
        """Video delete restricted to seekers only"""
        response = api_client.delete(
            f"{BASE_URL}/api/upload/video",
            headers={"Authorization": f"Bearer {recruiter_token}"}
        )
        assert response.status_code == 403
        print("✓ Recruiter correctly forbidden from video delete")

    def test_video_get_nonexistent(self, api_client):
        """Get non-existent video returns 404"""
        response = api_client.get(f"{BASE_URL}/api/videos/nonexistent.mp4")
        assert response.status_code == 404
        print("✓ Non-existent video returns 404")

    def test_photo_get_nonexistent(self, api_client):
        """Get non-existent photo returns 404"""
        response = api_client.get(f"{BASE_URL}/api/photos/nonexistent.png")
        assert response.status_code == 404
        print("✓ Non-existent photo returns 404")

# ==================== PUSH SUBSCRIPTION ENDPOINTS ====================

class TestPushSubscriptionEndpoints:
    """Test push notification subscription from routers/stats.py"""
    
    def test_push_subscribe(self, api_client, seeker_token):
        """User can subscribe to push notifications"""
        subscription_data = {
            "endpoint": "https://test.push.endpoint",
            "keys": {
                "p256dh": "test_key",
                "auth": "test_auth"
            }
        }
        response = api_client.post(
            f"{BASE_URL}/api/push/subscribe",
            json=subscription_data,
            headers={"Authorization": f"Bearer {seeker_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print("✓ Push subscription works")

    def test_push_unsubscribe(self, api_client, seeker_token):
        """User can unsubscribe from push notifications"""
        response = api_client.delete(
            f"{BASE_URL}/api/push/unsubscribe",
            headers={"Authorization": f"Bearer {seeker_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print("✓ Push unsubscription works")

# ==================== MATCHES ENDPOINTS ====================

class TestMatchesEndpoints:
    """Test matches from routers/matches.py"""
    
    def test_get_matches_seeker(self, api_client, seeker_token):
        """Seeker can get matches"""
        response = api_client.get(
            f"{BASE_URL}/api/matches",
            headers={"Authorization": f"Bearer {seeker_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Seeker has {len(data)} matches")

    def test_get_matches_recruiter(self, api_client, recruiter_token):
        """Recruiter can get matches"""
        response = api_client.get(
            f"{BASE_URL}/api/matches",
            headers={"Authorization": f"Bearer {recruiter_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Recruiter has {len(data)} matches")

    def test_get_match_not_found(self, api_client, seeker_token):
        """Get non-existent match returns 404"""
        response = api_client.get(
            f"{BASE_URL}/api/matches/nonexistent-id",
            headers={"Authorization": f"Bearer {seeker_token}"}
        )
        assert response.status_code == 404
        print("✓ Non-existent match returns 404")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
