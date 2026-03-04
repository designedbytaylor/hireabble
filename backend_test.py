#!/usr/bin/env python3

import requests
import sys
from datetime import datetime
import uuid
import json

class JobSwipeAPITester:
    def __init__(self, base_url="https://hire-swipe-5.preview.emergentagent.com/api"):
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
            "role": "seeker",
            "title": "Software Engineer",
            "location": "San Francisco, CA",
            "skills": ["Python", "React", "Node.js"],
            "experience_years": 3
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

def main():
    print("🚀 Starting JobSwipe API Test Suite")
    print("=" * 50)
    
    tester = JobSwipeAPITester()
    
    # Test sequence
    test_sequence = [
        ("API Health", tester.test_api_health),
        ("Seeker Registration", tester.test_seeker_registration),
        ("Recruiter Registration", tester.test_recruiter_registration), 
        ("Login Flow", tester.test_login),
        ("Auth Me", tester.test_auth_me),
        ("Job Creation", tester.test_job_creation),
        ("Get Jobs (Seeker)", tester.test_get_jobs_for_seeker),
        ("Get Jobs (Recruiter)", tester.test_get_recruiter_jobs),
        ("Swipe Functionality", tester.test_swipe_functionality),
        ("Applications", tester.test_applications_endpoint),
        ("Stats", tester.test_stats_endpoints),
        ("Matches", tester.test_matches_endpoint),
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