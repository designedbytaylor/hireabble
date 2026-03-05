#!/usr/bin/env python3

import requests
import sys
from datetime import datetime
import uuid
import json

class HireabbleAPITester:
    def __init__(self, base_url="https://password-reset-47.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.seeker_token = None
        self.recruiter_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_user_ids = []
        self.job_ids = []
        
        # Generate unique test data
        self.timestamp = datetime.now().strftime('%H%M%S')
        self.seeker_email = f"seeker_{self.timestamp}@test.com"
        self.recruiter_email = f"recruiter_{self.timestamp}@test.com"
        self.test_password = "TestPass123!"

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        default_headers = {'Content-Type': 'application/json'}
        if headers:
            default_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=default_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=default_headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=default_headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=default_headers, timeout=10)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json() if response.text else {}
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Error: {response.text}")
                return False, {}

        except requests.exceptions.RequestException as e:
            print(f"❌ Failed - Network Error: {str(e)}")
            return False, {}
        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_api_health(self):
        """Test API health endpoint"""
        success, response = self.run_test("API Health Check", "GET", "", 200)
        return success

    def test_seeker_registration(self):
        """Test job seeker registration"""
        data = {
            "name": f"Test Seeker {self.timestamp}",
            "email": self.seeker_email,
            "password": self.test_password,
            "role": "seeker"
        }
        
        success, response = self.run_test(
            "Seeker Registration",
            "POST", 
            "auth/register",
            200,
            data
        )
        
        if success and 'token' in response:
            self.seeker_token = response['token']
            print(f"   Seeker token acquired: {self.seeker_token[:20]}...")
            return True
        return False
    
    def test_complete_seeker_onboarding(self):
        """Complete seeker onboarding after status check"""
        if not self.seeker_token:
            return False
            
        headers = {"Authorization": f"Bearer {self.seeker_token}"}
        onboarding_data = {
            "title": "Software Engineer",
            "experience_years": 3,
            "current_employer": "Tech Corp",
            "school": "MIT",
            "degree": "bachelors",
            "skills": ["Python", "React", "Node.js"],
            "location": "San Francisco, CA",
            "onboarding_complete": True
        }
        
        success, response = self.run_test(
            "Complete Seeker Onboarding",
            "PUT",
            "auth/profile",
            200,
            onboarding_data,
            headers
        )
        return success

    def test_recruiter_registration(self):
        """Test recruiter registration"""
        data = {
            "name": f"Test Recruiter {self.timestamp}",
            "email": self.recruiter_email,
            "password": self.test_password,
            "role": "recruiter",
            "company": "Tech Corp Inc",
            "location": "New York, NY"
        }
        
        success, response = self.run_test(
            "Recruiter Registration",
            "POST",
            "auth/register", 
            200,
            data
        )
        
        if success and 'token' in response:
            self.recruiter_token = response['token']
            print(f"   Recruiter token acquired: {self.recruiter_token[:20]}...")
            return True
        return False

    def test_login(self):
        """Test login functionality"""
        # Test seeker login
        success, response = self.run_test(
            "Seeker Login",
            "POST",
            "auth/login",
            200,
            {"email": self.seeker_email, "password": self.test_password}
        )
        
        if not success:
            return False
            
        # Test recruiter login
        success, response = self.run_test(
            "Recruiter Login", 
            "POST",
            "auth/login",
            200,
            {"email": self.recruiter_email, "password": self.test_password}
        )
        
        return success

    def test_auth_me(self):
        """Test get current user endpoint"""
        headers = {"Authorization": f"Bearer {self.seeker_token}"}
        success, response = self.run_test(
            "Get Current User (Seeker)",
            "GET",
            "auth/me",
            200,
            headers=headers
        )
        return success

    def test_job_creation(self):
        """Test job posting by recruiter"""
        if not self.recruiter_token:
            print("❌ No recruiter token available for job creation")
            return False
            
        headers = {"Authorization": f"Bearer {self.recruiter_token}"}
        data = {
            "title": "Senior Python Developer",
            "company": "Tech Corp Inc", 
            "description": "We are looking for an experienced Python developer to join our team...",
            "requirements": ["Python", "FastAPI", "MongoDB", "5+ years experience"],
            "salary_min": 120000,
            "salary_max": 160000,
            "location": "San Francisco, CA",
            "job_type": "remote",
            "experience_level": "senior"
        }
        
        success, response = self.run_test(
            "Job Creation",
            "POST",
            "jobs",
            200,
            data,
            headers
        )
        
        if success and 'id' in response:
            self.job_ids.append(response['id'])
            print(f"   Job ID: {response['id']}")
            return True
        return False

    def test_get_jobs_for_seeker(self):
        """Test getting jobs list for job seeker"""
        if not self.seeker_token:
            print("❌ No seeker token available")
            return False
            
        headers = {"Authorization": f"Bearer {self.seeker_token}"}
        success, response = self.run_test(
            "Get Jobs (Seeker)",
            "GET", 
            "jobs",
            200,
            headers=headers
        )
        
        if success:
            print(f"   Found {len(response)} jobs")
        return success

    def test_get_recruiter_jobs(self):
        """Test getting recruiter's own jobs"""
        if not self.recruiter_token:
            print("❌ No recruiter token available")
            return False
            
        headers = {"Authorization": f"Bearer {self.recruiter_token}"}
        success, response = self.run_test(
            "Get Recruiter Jobs",
            "GET",
            "jobs/recruiter", 
            200,
            headers=headers
        )
        
        if success:
            print(f"   Recruiter has {len(response)} jobs")
        return success

    def test_swipe_functionality(self):
        """Test job swiping by seeker"""
        if not self.seeker_token or not self.job_ids:
            print("❌ No seeker token or job IDs available for swiping")
            return False
            
        headers = {"Authorization": f"Bearer {self.seeker_token}"}
        job_id = self.job_ids[0]
        
        # Test like swipe
        success, response = self.run_test(
            "Swipe Like",
            "POST",
            "swipe",
            200,
            {"job_id": job_id, "action": "like"},
            headers
        )
        
        if not success:
            return False
            
        # Test superlike swipe (create second job first)
        if len(self.job_ids) > 1:
            success, response = self.run_test(
                "Swipe SuperLike", 
                "POST",
                "swipe",
                200,
                {"job_id": self.job_ids[1] if len(self.job_ids) > 1 else job_id, "action": "superlike"},
                headers
            )
        
        return success

    def test_applications_endpoint(self):
        """Test getting applications"""
        if not self.seeker_token:
            return False
            
        headers = {"Authorization": f"Bearer {self.seeker_token}"}
        success, response = self.run_test(
            "Get Seeker Applications",
            "GET",
            "applications",
            200,
            headers=headers
        )
        
        if success:
            print(f"   Seeker has {len(response)} applications")
        
        # Test recruiter applications
        if self.recruiter_token:
            headers = {"Authorization": f"Bearer {self.recruiter_token}"}
            success, response = self.run_test(
                "Get Recruiter Applications",
                "GET", 
                "applications",
                200,
                headers=headers
            )
            if success:
                print(f"   Recruiter received {len(response)} applications")
        
        return success

    def test_stats_endpoints(self):
        """Test stats endpoints"""
        success = True
        
        if self.seeker_token:
            headers = {"Authorization": f"Bearer {self.seeker_token}"}
            test_success, response = self.run_test(
                "Seeker Stats",
                "GET",
                "stats/seeker",
                200,
                headers=headers
            )
            success = success and test_success
        
        if self.recruiter_token:
            headers = {"Authorization": f"Bearer {self.recruiter_token}"}
            test_success, response = self.run_test(
                "Recruiter Stats", 
                "GET",
                "stats/recruiter",
                200,
                headers=headers
            )
            success = success and test_success
            
        return success

    def test_matches_endpoint(self):
        """Test matches endpoint"""
        if not self.seeker_token:
            return False
            
        headers = {"Authorization": f"Bearer {self.seeker_token}"}
        success, response = self.run_test(
            "Get Matches",
            "GET",
            "matches",
            200, 
            headers=headers
        )
        
        if success:
            print(f"   Found {len(response)} matches")
        return success

    def test_profile_update(self):
        """Test profile update"""
        if not self.seeker_token:
            return False
            
        headers = {"Authorization": f"Bearer {self.seeker_token}"}
        update_data = {
            "bio": "Updated bio for testing",
            "skills": ["Python", "React", "Node.js", "Testing"]
        }
        
        success, response = self.run_test(
            "Update Profile",
            "PUT",
            "auth/profile",
            200,
            update_data,
            headers
        )
        return success

    def test_onboarding_status(self):
        """Test onboarding completion status for different roles"""
        # Test seeker should NOT have onboarding complete initially
        if self.seeker_token:
            headers = {"Authorization": f"Bearer {self.seeker_token}"}
            success, response = self.run_test(
                "Check Seeker Onboarding Status",
                "GET",
                "auth/me",
                200,
                headers=headers
            )
            if success:
                if response.get('onboarding_complete') == False:
                    print("   ✅ Seeker onboarding_complete correctly set to False")
                else:
                    print("   ❌ Seeker onboarding_complete should be False initially")
                    return False
        
        # Test recruiter should have onboarding complete by default
        if self.recruiter_token:
            headers = {"Authorization": f"Bearer {self.recruiter_token}"}
            success, response = self.run_test(
                "Check Recruiter Onboarding Status",
                "GET", 
                "auth/me",
                200,
                headers=headers
            )
            if success:
                if response.get('onboarding_complete') == True:
                    print("   ✅ Recruiter onboarding_complete correctly set to True")
                else:
                    print("   ❌ Recruiter onboarding_complete should be True by default")
                    return False
        
        return success

    def test_job_editing(self):
        """Test job editing functionality"""
        if not self.recruiter_token or not self.job_ids:
            print("❌ No recruiter token or job IDs available for editing")
            return False
            
        headers = {"Authorization": f"Bearer {self.recruiter_token}"}
        job_id = self.job_ids[0]
        
        # Test updating job details
        update_data = {
            "title": "Updated Senior Python Developer",
            "description": "Updated description for the role...",
            "salary_min": 130000,
            "salary_max": 170000,
            "location": "Remote Worldwide",
            "requirements": ["Python", "FastAPI", "MongoDB", "AWS", "6+ years experience"]
        }
        
        success, response = self.run_test(
            "Job Edit/Update",
            "PUT",
            f"jobs/{job_id}",
            200,
            update_data,
            headers
        )
        
        if success:
            # Verify the update took effect
            success, updated_job = self.run_test(
                "Verify Job Update",
                "GET",
                f"jobs/{job_id}",
                200,
                headers=headers
            )
            
            if success and updated_job.get('title') == "Updated Senior Python Developer":
                print("   ✅ Job update verified successfully")
            else:
                print("   ❌ Job update verification failed")
                return False
        
        return success

    def test_job_deletion(self):
        """Test job deletion functionality"""
        if not self.recruiter_token:
            print("❌ No recruiter token available for job deletion")
            return False
            
        headers = {"Authorization": f"Bearer {self.recruiter_token}"}
        
        # Create a new job specifically for deletion testing
        data = {
            "title": "Test Job for Deletion",
            "company": "Test Corp",
            "description": "This job will be deleted",
            "location": "Test City",
            "job_type": "remote",
            "experience_level": "mid"
        }
        
        success, response = self.run_test(
            "Create Job for Deletion",
            "POST",
            "jobs",
            200,
            data,
            headers
        )
        
        if not success or 'id' not in response:
            return False
            
        job_to_delete = response['id']
        
        # Now test deletion
        success, response = self.run_test(
            "Job Deletion",
            "DELETE",
            f"jobs/{job_to_delete}",
            200,
            headers=headers
        )
        
        if success:
            # Verify job is marked as inactive
            success, deleted_job = self.run_test(
                "Verify Job Deletion",
                "GET",
                f"jobs/{job_to_delete}",
                200,
                headers=headers
            )
            
            if success and deleted_job.get('is_active') == False:
                print("   ✅ Job deletion verified - marked as inactive")
            else:
                print("   ❌ Job deletion verification failed")
                return False
        
        return success

    def test_candidate_profile_fields(self):
        """Test that candidate profiles contain required fields for recruiter view"""
        if not self.recruiter_token:
            print("❌ No recruiter token available")
            return False
            
        headers = {"Authorization": f"Bearer {self.recruiter_token}"}
        
        # Get applications to check candidate profile data
        success, applications = self.run_test(
            "Get Applications for Profile Check",
            "GET",
            "applications",
            200,
            headers=headers
        )
        
        if not success:
            return False
            
        if len(applications) == 0:
            print("   ⚠️  No applications available to test candidate profile fields")
            return True  # Not a failure, just no data
        
        # Check first application for required fields
        app = applications[0]
        required_fields = [
            'seeker_name', 'seeker_title', 'seeker_experience', 
            'seeker_school', 'seeker_degree', 'seeker_skills'
        ]
        
        missing_fields = []
        for field in required_fields:
            if field not in app or app[field] is None:
                missing_fields.append(field)
        
        if missing_fields:
            print(f"   ❌ Missing candidate profile fields: {missing_fields}")
            return False
        else:
            print("   ✅ All required candidate profile fields present")
            return True

    def test_photo_upload(self):
        """Test photo upload endpoint"""
        if not self.seeker_token:
            print("❌ No seeker token available for photo upload")
            return False
            
        print("⚠️  Photo upload test requires actual file - testing endpoint availability")
        
        # Test with invalid content type to check endpoint exists
        headers = {"Authorization": f"Bearer {self.seeker_token}"}
        
        # We can't easily test file upload in this simple test, but we can test the endpoint exists
        # by making a request without a file to get a 422 (validation error)
        try:
            import requests
            url = f"{self.base_url}/upload/photo"
            response = requests.post(url, headers=headers, timeout=10)
            
            # Endpoint should return 422 for missing file parameter
            if response.status_code == 422:
                print("✅ Photo upload endpoint exists and validates input")
                self.tests_run += 1
                self.tests_passed += 1
                return True
            else:
                print(f"❌ Unexpected response code: {response.status_code}")
                self.tests_run += 1
                return False
        except Exception as e:
            print(f"❌ Photo upload endpoint test failed: {str(e)}")
            self.tests_run += 1
            return False

    def test_job_filtering(self):
        """Test job filtering with query parameters"""
        if not self.seeker_token:
            print("❌ No seeker token available for job filtering")
            return False
            
        headers = {"Authorization": f"Bearer {self.seeker_token}"}
        
        # Test filtering by job type
        success1, response1 = self.run_test(
            "Job Filtering - Job Type",
            "GET",
            "jobs?job_type=remote",
            200,
            headers=headers
        )
        
        # Test filtering by experience level
        success2, response2 = self.run_test(
            "Job Filtering - Experience Level",
            "GET", 
            "jobs?experience_level=senior",
            200,
            headers=headers
        )
        
        # Test filtering by salary
        success3, response3 = self.run_test(
            "Job Filtering - Salary Min",
            "GET",
            "jobs?salary_min=100000",
            200,
            headers=headers
        )
        
        # Test filtering by location
        success4, response4 = self.run_test(
            "Job Filtering - Location", 
            "GET",
            "jobs?location=San Francisco",
            200,
            headers=headers
        )
        
        # Test multiple filters
        success5, response5 = self.run_test(
            "Job Filtering - Multiple Filters",
            "GET",
            "jobs?job_type=remote&experience_level=senior&salary_min=120000",
            200,
            headers=headers
        )
        
        return success1 and success2 and success3 and success4 and success5

    def test_messaging_endpoints(self):
        """Test messaging functionality"""
        if not self.seeker_token or not self.recruiter_token:
            print("❌ Need both seeker and recruiter tokens for messaging test")
            return False
        
        # First we need to create a match to test messaging
        # This requires accepting an application
        recruiter_headers = {"Authorization": f"Bearer {self.recruiter_token}"}
        
        # Get recruiter applications to find one to accept
        success, applications = self.run_test(
            "Get Recruiter Applications for Messaging",
            "GET",
            "applications",
            200,
            headers=recruiter_headers
        )
        
        if not success or len(applications) == 0:
            print("   ⚠️  No applications available for messaging test")
            return True  # Not a failure, just no data to test with
            
        # Accept the first application to create a match
        app_id = applications[0]['id']
        success, response = self.run_test(
            "Accept Application to Create Match",
            "POST",
            "applications/respond", 
            200,
            {"application_id": app_id, "action": "accept"},
            recruiter_headers
        )
        
        if not success:
            print("❌ Failed to create match for messaging test")
            return False
            
        # Get matches to find the match ID
        seeker_headers = {"Authorization": f"Bearer {self.seeker_token}"}
        success, matches = self.run_test(
            "Get Matches for Messaging",
            "GET",
            "matches",
            200,
            headers=seeker_headers
        )
        
        if not success or len(matches) == 0:
            print("❌ No matches found for messaging test")
            return False
            
        match_id = matches[0]['id']
        
        # Test sending a message
        success1, message_response = self.run_test(
            "Send Message",
            "POST",
            "messages",
            200,
            {"match_id": match_id, "content": "Hello! Test message from seeker."},
            seeker_headers
        )
        
        # Test getting messages for the match
        success2, messages = self.run_test(
            "Get Messages",
            "GET",
            f"messages/{match_id}",
            200,
            headers=seeker_headers
        )
        
        # Test unread message count
        success3, unread_count = self.run_test(
            "Get Unread Message Count",
            "GET",
            "messages/unread/count",
            200,
            headers=recruiter_headers  # Check from recruiter side
        )
        
        if success1 and success2 and success3:
            print(f"   ✅ Found {len(messages)} messages in conversation")
            print(f"   ✅ Recruiter has {unread_count.get('unread_count', 0)} unread messages")
            
        return success1 and success2 and success3

    def test_profile_completeness_endpoint(self):
        """Test profile completeness endpoint (new feature)"""
        if not self.seeker_token:
            print("❌ No seeker token available for profile completeness test")
            return False
            
        headers = {"Authorization": f"Bearer {self.seeker_token}"}
        success, response = self.run_test(
            "Profile Completeness Check",
            "GET",
            "profile/completeness",
            200,
            headers=headers
        )
        
        if success:
            # Verify required fields are present
            required_fields = ['percentage', 'missing_fields', 'is_complete']
            for field in required_fields:
                if field not in response:
                    print(f"   ❌ Missing field in response: {field}")
                    return False
                    
            print(f"   ✅ Profile completeness: {response['percentage']}%")
            print(f"   ✅ Missing fields: {response['missing_fields']}")
            print(f"   ✅ Is complete (80%+): {response['is_complete']}")
            
            # Test that completeness is calculated correctly
            if response['percentage'] >= 80 and not response['is_complete']:
                print("   ❌ Profile marked as incomplete despite 80%+ completion")
                return False
                
        return success

    def test_resume_download_endpoint(self):
        """Test resume PDF download endpoint (new feature)"""
        if not self.seeker_token:
            print("❌ No seeker token available for resume download test")
            return False
            
        print("🔍 Testing Resume PDF Download...")
        
        headers = {"Authorization": f"Bearer {self.seeker_token}"}
        
        try:
            url = f"{self.base_url}/resume/download"
            response = requests.get(url, headers=headers, timeout=30)
            
            self.tests_run += 1
            
            if response.status_code == 200:
                # Check content type
                content_type = response.headers.get('content-type', '')
                if 'application/pdf' in content_type:
                    content_length = len(response.content)
                    print(f"✅ Resume PDF downloaded successfully - Size: {content_length} bytes")
                    
                    # Basic PDF validation (should start with %PDF)
                    if response.content.startswith(b'%PDF'):
                        print("   ✅ Valid PDF file format detected")
                        self.tests_passed += 1
                        return True
                    else:
                        print("   ❌ Invalid PDF format")
                        return False
                else:
                    print(f"❌ Wrong content type: {content_type}")
                    return False
            else:
                print(f"❌ Failed - Status: {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Error: {response.text[:200]}")
                return False
                
        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.tests_run += 1
            return False

    def test_websocket_endpoint_accessibility(self):
        """Test WebSocket endpoint accessibility (new feature)"""
        if not self.seeker_token:
            print("❌ No seeker token available for WebSocket test")
            return False
            
        print("🔍 Testing WebSocket Endpoint Accessibility...")
        
        try:
            # Test WebSocket endpoint by attempting HTTP connection (should return upgrade required)
            ws_url = f"{self.base_url.replace('/api', '')}/ws/{self.seeker_token}"
            response = requests.get(ws_url, timeout=10)
            
            self.tests_run += 1
            
            # WebSocket endpoints return specific errors for HTTP requests
            if response.status_code in [400, 426, 404]:
                if response.status_code == 404:
                    print("❌ WebSocket endpoint not found (404)")
                    return False
                else:
                    print(f"✅ WebSocket endpoint exists (got expected error: {response.status_code})")
                    print("   ✅ Endpoint properly rejects non-WebSocket connections")
                    self.tests_passed += 1
                    return True
            else:
                print(f"❌ Unexpected response from WebSocket endpoint: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ Failed to test WebSocket endpoint: {str(e)}")
            self.tests_run += 1
            return False

def main():
    print("🚀 Starting Hireabble API Test Suite")
    print("=" * 50)
    
    tester = HireabbleAPITester()
    
    # Test sequence
    test_sequence = [
        ("API Health", tester.test_api_health),
        ("Seeker Registration", tester.test_seeker_registration),
        ("Recruiter Registration", tester.test_recruiter_registration), 
        ("Login Flow", tester.test_login),
        ("Auth Me", tester.test_auth_me),
        ("Onboarding Status", tester.test_onboarding_status),
        ("Complete Seeker Onboarding", tester.test_complete_seeker_onboarding),
        ("Profile Completeness", tester.test_profile_completeness_endpoint),  # NEW
        ("Resume Download", tester.test_resume_download_endpoint),  # NEW  
        ("WebSocket Endpoint", tester.test_websocket_endpoint_accessibility),  # NEW
        ("Job Creation", tester.test_job_creation),
        ("Get Jobs (Seeker)", tester.test_get_jobs_for_seeker),
        ("Get Jobs (Recruiter)", tester.test_get_recruiter_jobs),
        ("Job Filtering", tester.test_job_filtering),
        ("Job Editing", tester.test_job_editing),
        ("Job Deletion", tester.test_job_deletion),
        ("Swipe Functionality", tester.test_swipe_functionality),
        ("Applications", tester.test_applications_endpoint),
        ("Candidate Profile Fields", tester.test_candidate_profile_fields),
        ("Stats", tester.test_stats_endpoints),
        ("Matches", tester.test_matches_endpoint),
        ("Messaging", tester.test_messaging_endpoints),
        ("Photo Upload", tester.test_photo_upload),
        ("Profile Update", tester.test_profile_update)
    ]
    
    print(f"\n📝 Running {len(test_sequence)} test suites...")
    
    failed_tests = []
    for test_name, test_func in test_sequence:
        print(f"\n{'='*20} {test_name} {'='*20}")
        try:
            if not test_func():
                failed_tests.append(test_name)
        except Exception as e:
            print(f"❌ {test_name} crashed: {str(e)}")
            failed_tests.append(test_name)
    
    # Final Results
    print(f"\n{'='*60}")
    print(f"📊 TEST RESULTS")
    print(f"{'='*60}")
    print(f"✅ Tests passed: {tester.tests_passed}/{tester.tests_run}")
    print(f"📈 Success rate: {(tester.tests_passed/tester.tests_run)*100:.1f}%")
    
    if failed_tests:
        print(f"\n❌ Failed test suites: {', '.join(failed_tests)}")
        return 1
    else:
        print(f"\n🎉 All API tests passed!")
        return 0

if __name__ == "__main__":
    sys.exit(main())