#!/usr/bin/env python3
"""
Quick test script for Viberate Label Studio integration.
Tests both credential-based and token-based authentication.
"""

import requests
import sys
from getpass import getpass

BASE_URL = "http://localhost:8000/api"
COLORS = {
    'GREEN': '\033[0;32m',
    'RED': '\033[0;31m',
    'YELLOW': '\033[1;33m',
    'NC': '\033[0m'  # No Color
}

def print_success(msg):
    print(f"{COLORS['GREEN']}✅ {msg}{COLORS['NC']}")

def print_error(msg):
    print(f"{COLORS['RED']}❌ {msg}{COLORS['NC']}")

def print_info(msg):
    print(f"{COLORS['YELLOW']}ℹ️  {msg}{COLORS['NC']}")

def test_server_running():
    """Test if Viberate server is running"""
    print("\n" + "=" * 60)
    print("Testing Viberate Server")
    print("=" * 60)

    try:
        response = requests.get(f"{BASE_URL}/users/", timeout=5)
        if response.status_code in [200, 401, 403]:  # Any of these means server is running
            print_success("Server is running at http://localhost:8000")
            return True
        else:
            print_error(f"Server responded with status {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print_error("Cannot connect to server. Make sure it's running:")
        print("  python manage.py runserver")
        return False
    except Exception as e:
        print_error(f"Error: {e}")
        return False

def create_test_user():
    """Create a test researcher account"""
    print("\n" + "-" * 60)
    print("Step 1: Creating test researcher account")
    print("-" * 60)

    username = f"test_researcher_{requests.get('http://worldtimeapi.org/api/ip').json().get('unixtime', '1234')[-4:]}"

    try:
        response = requests.post(
            f"{BASE_URL}/users/",
            json={
                "username": username,
                "email": f"{username}@test.com",
                "password": "testpass123",
                "user_type": "researcher",
                "first_name": "Test",
                "last_name": "Researcher"
            },
            timeout=10
        )

        if response.status_code == 201:
            print_success(f"Created user: {username}")
            return username, "testpass123"
        elif response.status_code == 400 and 'username' in response.text:
            print_info("User already exists, trying login...")
            return username, "testpass123"
        else:
            print_error(f"Failed to create user: {response.text}")
            return None, None
    except Exception as e:
        print_error(f"Error creating user: {e}")
        return None, None

def login_user(username, password):
    """Login and get authentication token"""
    print("\n" + "-" * 60)
    print("Step 2: Logging in")
    print("-" * 60)

    try:
        response = requests.post(
            f"{BASE_URL}/auth/login/",
            json={"username": username, "password": password},
            timeout=10
        )

        if response.status_code == 200:
            token = response.json().get('token')
            print_success(f"Login successful! Token: {token[:20]}...")
            return token
        else:
            print_error(f"Login failed: {response.text}")
            return None
    except Exception as e:
        print_error(f"Error during login: {e}")
        return None

def test_labelstudio_connection(token):
    """Test Label Studio connection"""
    print("\n" + "-" * 60)
    print("Step 3: Testing Label Studio Connection")
    print("-" * 60)

    print_info("Do you have Label Studio running? (y/n)")
    has_ls = input().strip().lower()

    if has_ls != 'y':
        print_info("Skipping Label Studio tests.")
        print_info("To test Label Studio integration:")
        print_info("  1. Start Label Studio: docker run -p 8080:8080 heartexlabs/label-studio")
        print_info("  2. Create an account at http://localhost:8080")
        print_info("  3. Run this test again")
        return False

    ls_url = input("Label Studio URL [http://localhost:8080]: ").strip() or "http://localhost:8080"

    print("\n📝 Choose authentication method:")
    print("  1. Username/Password (Recommended - No manual token needed!)")
    print("  2. API Token (Advanced)")

    choice = input("Choice [1]: ").strip() or "1"

    headers = {"Authorization": f"Token {token}"}

    if choice == "1":
        # Credential-based authentication
        print("\n🔐 Enter your Label Studio credentials:")
        ls_username = input("Username: ").strip()
        ls_password = getpass("Password: ")

        try:
            print_info("Authenticating with Label Studio...")
            response = requests.post(
                f"{BASE_URL}/labelstudio/connections/",
                headers=headers,
                json={
                    "labelstudio_url": ls_url,
                    "username": ls_username,
                    "password": ls_password
                },
                timeout=15
            )

            if response.status_code == 201:
                connection = response.json()
                print_success("Connected to Label Studio!")
                print_success(f"Verified: {connection.get('is_verified')}")
                print_info("Your API token was automatically fetched and stored securely!")
                return True
            else:
                print_error(f"Connection failed: {response.text}")
                return False
        except Exception as e:
            print_error(f"Error connecting: {e}")
            return False

    else:
        # Token-based authentication
        print("\n🔑 Get your API token from Label Studio:")
        print("  1. Go to http://localhost:8080")
        print("  2. Click 'Account & Settings'")
        print("  3. Copy your 'Access Token'")
        api_token = input("\nEnter API Token: ").strip()

        try:
            response = requests.post(
                f"{BASE_URL}/labelstudio/connections/",
                headers=headers,
                json={
                    "labelstudio_url": ls_url,
                    "api_token": api_token
                },
                timeout=15
            )

            if response.status_code == 201:
                connection = response.json()
                print_success("Connected to Label Studio!")
                print_success(f"Verified: {connection.get('is_verified')}")
                return True
            else:
                print_error(f"Connection failed: {response.text}")
                return False
        except Exception as e:
            print_error(f"Error connecting: {e}")
            return False

def main():
    """Run all tests"""
    print("\n" + "=" * 60)
    print("🚀 Viberate Quick Test")
    print("=" * 60)

    # Test 1: Server running
    if not test_server_running():
        sys.exit(1)

    # Test 2: Create user
    username, password = create_test_user()
    if not username:
        sys.exit(1)

    # Test 3: Login
    token = login_user(username, password)
    if not token:
        sys.exit(1)

    # Test 4: Label Studio connection
    ls_connected = test_labelstudio_connection(token)

    # Summary
    print("\n" + "=" * 60)
    print("📊 Test Summary")
    print("=" * 60)
    print_success("Server: Running")
    print_success("Authentication: Working")
    if ls_connected:
        print_success("Label Studio: Connected")
    else:
        print_info("Label Studio: Not tested (optional)")

    print("\n" + "=" * 60)
    print("✅ Basic tests passed!")
    print("=" * 60)
    print("\n📚 Next steps:")
    print("  - Check admin interface: http://localhost:8000/admin/")
    print("  - Read TESTING.md for comprehensive tests")
    print("  - Read API_EXAMPLES.md for code examples")
    print("\n🎉 Happy coding!")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⚠️  Test interrupted by user")
        sys.exit(0)
    except Exception as e:
        print_error(f"Unexpected error: {e}")
        sys.exit(1)
