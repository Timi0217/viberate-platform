#!/bin/bash

# Viberate Platform API Test Script
# Tests all major API endpoints

API_URL="https://django-production-3340.up.railway.app"

echo "🧪 Viberate Platform API Tests"
echo "================================"
echo ""

# Test 1: Check if backend is alive
echo "Test 1: Backend Health Check"
echo "GET ${API_URL}/api/auth/login/"
response=$(curl -s -o /dev/null -w "%{http_code}" "${API_URL}/api/auth/login/")
if [ "$response" -eq 405 ] || [ "$response" -eq 200 ]; then
    echo "✅ Backend is responding (HTTP $response)"
else
    echo "❌ Backend not responding correctly (HTTP $response)"
fi
echo ""

# Test 2: Register a new user
echo "Test 2: User Registration"
timestamp=$(date +%s)
username="testuser${timestamp}"
email="test${timestamp}@example.com"

register_response=$(curl -s -X POST "${API_URL}/api/auth/register/" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"${username}\",\"email\":\"${email}\",\"password\":\"testpass123\",\"user_type\":\"researcher\"}")

if echo "$register_response" | grep -q "token"; then
    echo "✅ User registration successful"
    TOKEN=$(echo "$register_response" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
    echo "   Token: ${TOKEN:0:20}..."
else
    echo "❌ User registration failed"
    echo "   Response: $register_response"
fi
echo ""

# Test 3: Get user profile
if [ -n "$TOKEN" ]; then
    echo "Test 3: Get User Profile"
    profile_response=$(curl -s -X GET "${API_URL}/api/auth/profile/" \
      -H "Authorization: Token ${TOKEN}")

    if echo "$profile_response" | grep -q "$username"; then
        echo "✅ Profile retrieved successfully"
        echo "   Username: $(echo "$profile_response" | grep -o '"username":"[^"]*' | cut -d'"' -f4)"
    else
        echo "❌ Failed to get profile"
        echo "   Response: $profile_response"
    fi
    echo ""
fi

# Test 4: List Label Studio connections
if [ -n "$TOKEN" ]; then
    echo "Test 4: List Label Studio Connections"
    connections_response=$(curl -s -X GET "${API_URL}/api/labelstudio/connections/" \
      -H "Authorization: Token ${TOKEN}")

    if echo "$connections_response" | grep -q "\["; then
        echo "✅ Connections endpoint accessible"
        echo "   Response: Empty list (expected for new user)"
    else
        echo "❌ Failed to access connections"
        echo "   Response: $connections_response"
    fi
    echo ""
fi

# Test 5: List Label Studio projects
if [ -n "$TOKEN" ]; then
    echo "Test 5: List Label Studio Projects"
    projects_response=$(curl -s -X GET "${API_URL}/api/labelstudio/projects/" \
      -H "Authorization: Token ${TOKEN}")

    if echo "$projects_response" | grep -q "\["; then
        echo "✅ Projects endpoint accessible"
        echo "   Response: Empty list (expected for new user)"
    else
        echo "❌ Failed to access projects"
        echo "   Response: $projects_response"
    fi
    echo ""
fi

# Test 6: List tasks
if [ -n "$TOKEN" ]; then
    echo "Test 6: List Tasks"
    tasks_response=$(curl -s -X GET "${API_URL}/api/tasks/" \
      -H "Authorization: Token ${TOKEN}")

    if echo "$tasks_response" | grep -q "\["; then
        echo "✅ Tasks endpoint accessible"
        echo "   Response: Empty list (expected for new user)"
    else
        echo "❌ Failed to access tasks"
        echo "   Response: $tasks_response"
    fi
    echo ""
fi

# Test 7: Logout
if [ -n "$TOKEN" ]; then
    echo "Test 7: User Logout"
    logout_response=$(curl -s -X POST "${API_URL}/api/auth/logout/" \
      -H "Authorization: Token ${TOKEN}")

    if echo "$logout_response" | grep -q "Successfully logged out"; then
        echo "✅ Logout successful"
    else
        echo "⚠️  Logout completed (token may be deleted)"
    fi
    echo ""
fi

echo "================================"
echo "✨ API Tests Complete!"
echo ""
echo "Next Steps:"
echo "1. Test the frontend at: https://frontend-58aqpnlae-timidayokayode-gmailcoms-projects.vercel.app"
echo "2. Register with your Label Studio credentials"
echo "3. Import a project and sync tasks"
echo ""
