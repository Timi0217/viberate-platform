# Testing Viberate

This guide covers how to test the Viberate platform, especially the Label Studio integration with credential-based authentication.

## Quick Test (Without Label Studio)

If you don't have Label Studio running yet, you can still test the basic functionality:

### 1. Setup and Run Migrations

```bash
cd /Users/Timi/Desktop/viberate
source venv/bin/activate

# Create database if needed
createdb viberate_db 2>/dev/null || echo "Database already exists"

# Run migrations
python manage.py migrate

# Create a superuser for testing
python manage.py createsuperuser --username admin --email admin@example.com
```

### 2. Start the Development Server

```bash
python manage.py runserver
```

Keep this running in one terminal.

### 3. Test Basic API Endpoints

Open a new terminal and test:

```bash
# Test 1: Health check - Register a user
curl -X POST http://localhost:8000/api/users/ \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testresearcher",
    "email": "test@example.com",
    "password": "testpass123",
    "user_type": "researcher",
    "first_name": "Test",
    "last_name": "User"
  }'

# Test 2: Login
curl -X POST http://localhost:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testresearcher",
    "password": "testpass123"
  }'

# Save the token from the response!
# For example: export TOKEN="your_token_here"

# Test 3: Get current user
curl -X GET http://localhost:8000/api/users/me/ \
  -H "Authorization: Token $TOKEN"

# Test 4: List connections (should be empty)
curl -X GET http://localhost:8000/api/labelstudio/connections/ \
  -H "Authorization: Token $TOKEN"
```

## Full Test (With Label Studio)

### Option A: Use Docker for Label Studio (Recommended)

```bash
# Start Label Studio with Docker
docker run -it -p 8080:8080 \
  -v $(pwd)/label-studio-data:/label-studio/data \
  heartexlabs/label-studio:latest

# Open http://localhost:8080 in your browser
# Create an account (username: test, password: test123)
# Create a project with some tasks
```

### Option B: Install Label Studio Locally

```bash
# In a new terminal
pip install label-studio
label-studio start

# Open http://localhost:8080
# Create account and project
```

### Test the Full Integration

Once Label Studio is running:

```bash
# 1. Get your Viberate token (from previous test)
export TOKEN="your_viberate_token"

# 2. Connect to Label Studio using credentials
curl -X POST http://localhost:8000/api/labelstudio/connections/ \
  -H "Authorization: Token $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "labelstudio_url": "http://localhost:8080",
    "username": "test",
    "password": "test123"
  }'

# Expected response:
# {
#   "id": 1,
#   "labelstudio_url": "http://localhost:8080",
#   "is_verified": true,
#   "last_verified_at": "2024-...",
#   "created_at": "2024-..."
# }

# 3. List available projects from Label Studio
curl -X GET http://localhost:8000/api/labelstudio/projects/available_projects/ \
  -H "Authorization: Token $TOKEN"

# 4. Import a project (use ID from above response)
curl -X POST http://localhost:8000/api/labelstudio/projects/import_project/ \
  -H "Authorization: Token $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"labelstudio_project_id": 1}'

# 5. Check tasks were imported
curl -X GET http://localhost:8000/api/tasks/ \
  -H "Authorization: Token $TOKEN"
```

## Interactive Testing with Python

Create a test script for easier testing:

```bash
# Create test_integration.py
cat > test_integration.py << 'EOF'
import requests
import json

BASE_URL = "http://localhost:8000/api"
LS_URL = "http://localhost:8080"

def test_integration():
    print("=" * 60)
    print("Viberate Integration Test")
    print("=" * 60)

    # Step 1: Create researcher account
    print("\n1. Creating researcher account...")
    response = requests.post(
        f"{BASE_URL}/users/",
        json={
            "username": "researcher_test",
            "email": "researcher@test.com",
            "password": "testpass123",
            "user_type": "researcher"
        }
    )
    if response.status_code == 201:
        print("✅ Account created")
    else:
        print(f"❌ Failed: {response.text}")
        return

    # Step 2: Login
    print("\n2. Logging in...")
    response = requests.post(
        f"{BASE_URL}/auth/login/",
        json={"username": "researcher_test", "password": "testpass123"}
    )
    token = response.json()["token"]
    headers = {"Authorization": f"Token {token}"}
    print(f"✅ Got token: {token[:20]}...")

    # Step 3: Connect to Label Studio
    print("\n3. Connecting to Label Studio...")
    ls_username = input("Enter Label Studio username: ")
    ls_password = input("Enter Label Studio password: ")

    response = requests.post(
        f"{BASE_URL}/labelstudio/connections/",
        headers=headers,
        json={
            "labelstudio_url": LS_URL,
            "username": ls_username,
            "password": ls_password
        }
    )

    if response.status_code == 201:
        connection = response.json()
        print(f"✅ Connected! Verified: {connection['is_verified']}")
    else:
        print(f"❌ Connection failed: {response.text}")
        return

    # Step 4: Get available projects
    print("\n4. Fetching available projects...")
    response = requests.get(
        f"{BASE_URL}/labelstudio/projects/available_projects/",
        headers=headers
    )
    projects = response.json()

    if not projects:
        print("⚠️  No projects found. Create a project in Label Studio first!")
        return

    print(f"✅ Found {len(projects)} project(s):")
    for p in projects:
        print(f"   - {p['title']} (ID: {p['id']})")

    # Step 5: Import first project
    print(f"\n5. Importing project '{projects[0]['title']}'...")
    response = requests.post(
        f"{BASE_URL}/labelstudio/projects/import_project/",
        headers=headers,
        json={"labelstudio_project_id": projects[0]["id"]}
    )

    if response.status_code == 201:
        project = response.json()
        print(f"✅ Imported! Tasks: {project['total_tasks']}")
    else:
        print(f"❌ Import failed: {response.text}")
        return

    # Step 6: List tasks
    print("\n6. Listing tasks...")
    response = requests.get(f"{BASE_URL}/tasks/", headers=headers)
    tasks = response.json()
    print(f"✅ Found {tasks['count']} task(s)")

    print("\n" + "=" * 60)
    print("✅ All tests passed!")
    print("=" * 60)

if __name__ == "__main__":
    test_integration()
EOF

# Run the test
python test_integration.py
```

## Testing Credential vs Token Authentication

Test both authentication methods:

```bash
export TOKEN="your_viberate_token"

# Method 1: Credential-based (NEW - recommended)
echo "Testing credential-based auth..."
curl -X POST http://localhost:8000/api/labelstudio/connections/ \
  -H "Authorization: Token $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "labelstudio_url": "http://localhost:8080",
    "username": "test",
    "password": "test123"
  }'

# Method 2: Token-based (OLD - still works)
# First, get your Label Studio API token:
# 1. Go to http://localhost:8080
# 2. Click Account & Settings
# 3. Copy your Access Token

echo "Testing token-based auth..."
curl -X POST http://localhost:8000/api/labelstudio/connections/ \
  -H "Authorization: Token $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "labelstudio_url": "http://localhost:8080",
    "api_token": "YOUR_LABELSTUDIO_API_TOKEN"
  }'
```

## Testing Error Cases

```bash
export TOKEN="your_viberate_token"

# Test 1: Invalid credentials
curl -X POST http://localhost:8000/api/labelstudio/connections/ \
  -H "Authorization: Token $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "labelstudio_url": "http://localhost:8080",
    "username": "wrong",
    "password": "wrong"
  }'
# Expected: 400 error with "Authentication failed" message

# Test 2: Wrong URL
curl -X POST http://localhost:8000/api/labelstudio/connections/ \
  -H "Authorization: Token $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "labelstudio_url": "http://localhost:9999",
    "username": "test",
    "password": "test123"
  }'
# Expected: 400 error with "Could not connect" message

# Test 3: Missing both token and credentials
curl -X POST http://localhost:8000/api/labelstudio/connections/ \
  -H "Authorization: Token $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "labelstudio_url": "http://localhost:8080"
  }'
# Expected: 400 error asking for credentials or token
```

## Browser Testing (Admin Interface)

```bash
# Start server
python manage.py runserver

# Open in browser:
# 1. Admin: http://localhost:8000/admin/
# 2. Login with superuser credentials
# 3. Check:
#    - Users
#    - Label Studio Connections
#    - Label Studio Projects
#    - Tasks
#    - Task Assignments
```

## Complete End-to-End Test

```bash
# Save this as e2e_test.sh
cat > e2e_test.sh << 'EOF'
#!/bin/bash
set -e

BASE_URL="http://localhost:8000/api"
LS_URL="http://localhost:8080"

echo "🚀 Starting Viberate E2E Test"
echo "================================"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 1. Create researcher
echo -e "\n${GREEN}1. Creating researcher...${NC}"
RESEARCHER_RESPONSE=$(curl -s -X POST $BASE_URL/users/ \
  -H "Content-Type: application/json" \
  -d '{
    "username": "e2e_researcher",
    "email": "e2e@test.com",
    "password": "test123",
    "user_type": "researcher"
  }')
echo "Response: $RESEARCHER_RESPONSE"

# 2. Login researcher
echo -e "\n${GREEN}2. Logging in researcher...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST $BASE_URL/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username": "e2e_researcher", "password": "test123"}')
RESEARCHER_TOKEN=$(echo $LOGIN_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin)['token'])")
echo "Token: ${RESEARCHER_TOKEN:0:20}..."

# 3. Connect to Label Studio
echo -e "\n${GREEN}3. Connecting to Label Studio...${NC}"
read -p "Enter Label Studio username: " LS_USERNAME
read -sp "Enter Label Studio password: " LS_PASSWORD
echo

CONNECTION_RESPONSE=$(curl -s -X POST $BASE_URL/labelstudio/connections/ \
  -H "Authorization: Token $RESEARCHER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"labelstudio_url\": \"$LS_URL\",
    \"username\": \"$LS_USERNAME\",
    \"password\": \"$LS_PASSWORD\"
  }")
echo "Response: $CONNECTION_RESPONSE"

# 4. Get projects
echo -e "\n${GREEN}4. Fetching projects...${NC}"
PROJECTS=$(curl -s -X GET $BASE_URL/labelstudio/projects/available_projects/ \
  -H "Authorization: Token $RESEARCHER_TOKEN")
echo "Projects: $PROJECTS"

# 5. Import first project
PROJECT_ID=$(echo $PROJECTS | python3 -c "import sys, json; print(json.load(sys.stdin)[0]['id'])" 2>/dev/null || echo "")
if [ -z "$PROJECT_ID" ]; then
  echo -e "${RED}No projects found in Label Studio${NC}"
  exit 1
fi

echo -e "\n${GREEN}5. Importing project $PROJECT_ID...${NC}"
IMPORT_RESPONSE=$(curl -s -X POST $BASE_URL/labelstudio/projects/import_project/ \
  -H "Authorization: Token $RESEARCHER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"labelstudio_project_id\": $PROJECT_ID}")
echo "Response: $IMPORT_RESPONSE"

# 6. Create annotator
echo -e "\n${GREEN}6. Creating annotator...${NC}"
ANNOTATOR_RESPONSE=$(curl -s -X POST $BASE_URL/users/ \
  -H "Content-Type: application/json" \
  -d '{
    "username": "e2e_annotator",
    "email": "e2e_annotator@test.com",
    "password": "test123",
    "user_type": "annotator"
  }')
echo "Response: $ANNOTATOR_RESPONSE"

# 7. Login annotator
echo -e "\n${GREEN}7. Logging in annotator...${NC}"
ANNOTATOR_LOGIN=$(curl -s -X POST $BASE_URL/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username": "e2e_annotator", "password": "test123"}')
ANNOTATOR_TOKEN=$(echo $ANNOTATOR_LOGIN | python3 -c "import sys, json; print(json.load(sys.stdin)['token'])")
echo "Token: ${ANNOTATOR_TOKEN:0:20}..."

# 8. List tasks
echo -e "\n${GREEN}8. Listing tasks...${NC}"
TASKS=$(curl -s -X GET $BASE_URL/tasks/ \
  -H "Authorization: Token $ANNOTATOR_TOKEN")
echo "Tasks: $TASKS"

echo -e "\n${GREEN}✅ E2E Test Complete!${NC}"
echo "================================"
EOF

chmod +x e2e_test.sh
./e2e_test.sh
```

## Automated Unit Tests

Create Django tests:

```bash
# Create tests/test_labelstudio_auth.py
mkdir -p integration/tests
cat > integration/tests/test_labelstudio_auth.py << 'EOF'
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from unittest.mock import patch, MagicMock

User = get_user_model()


class LabelStudioAuthTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='testuser',
            password='testpass123',
            user_type='researcher'
        )
        self.client.force_authenticate(user=self.user)

    @patch('integration.labelstudio_client.LabelStudioClient.authenticate_user')
    @patch('integration.labelstudio_client.LabelStudioClient.verify_connection')
    def test_credential_based_auth(self, mock_verify, mock_auth):
        """Test credential-based authentication"""
        # Mock the authentication response
        mock_auth.return_value = {
            'token': 'fake_token_12345',
            'id': 1,
            'username': 'testuser',
            'email': 'test@example.com'
        }
        mock_verify.return_value = {'id': 1, 'username': 'testuser'}

        response = self.client.post('/api/labelstudio/connections/', {
            'labelstudio_url': 'http://localhost:8080',
            'username': 'testuser',
            'password': 'testpass'
        }, format='json')

        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.data['is_verified'])
        mock_auth.assert_called_once_with('testuser', 'testpass')

    def test_missing_credentials(self):
        """Test that missing credentials returns error"""
        response = self.client.post('/api/labelstudio/connections/', {
            'labelstudio_url': 'http://localhost:8080'
        }, format='json')

        self.assertEqual(response.status_code, 400)
        self.assertIn('username', str(response.data).lower() or 'token' in str(response.data).lower())

EOF

# Run tests
python manage.py test integration.tests.test_labelstudio_auth
```

## Troubleshooting

### Server won't start
```bash
# Check if port 8000 is in use
lsof -ti:8000 | xargs kill -9

# Restart server
python manage.py runserver
```

### Database errors
```bash
# Reset database (WARNING: deletes all data)
dropdb viberate_db
createdb viberate_db
python manage.py migrate
python manage.py createsuperuser
```

### Label Studio connection fails
```bash
# Check Label Studio is running
curl http://localhost:8080

# Check credentials work
curl -X POST http://localhost:8080/api/login/ \
  -H "Content-Type: application/json" \
  -d '{"username": "test", "password": "test123"}'
```

## Success Criteria

✅ Users can register and login
✅ Researchers can connect with username/password (no manual token)
✅ Connection is verified automatically
✅ Projects can be imported from Label Studio
✅ Tasks are synced correctly
✅ Annotators can claim and complete tasks
✅ Researchers can review submissions

## Next Steps

After testing:
1. Check the Admin interface: http://localhost:8000/admin/
2. Review the API documentation: README.md, API_EXAMPLES.md
3. Build a frontend or use the API directly
4. Deploy to production (remember to set DEBUG=False)
EOF
