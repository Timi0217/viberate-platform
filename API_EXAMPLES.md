# Viberate API - Usage Examples

This document provides practical examples of using the Viberate API.

## Authentication

### Register a New User

```bash
curl -X POST http://localhost:8000/api/users/ \
  -H "Content-Type: application/json" \
  -d '{
    "username": "researcher1",
    "email": "researcher@example.com",
    "password": "securepass123",
    "user_type": "researcher",
    "first_name": "John",
    "last_name": "Doe"
  }'
```

### Login and Get Token

```bash
curl -X POST http://localhost:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{
    "username": "researcher1",
    "password": "securepass123"
  }'
```

Response:
```json
{
  "token": "9944b09199c62bcf9418ad846dd0e4bbdfc6ee4b"
}
```

Use this token in subsequent requests:
```bash
-H "Authorization: Token 9944b09199c62bcf9418ad846dd0e4bbdfc6ee4b"
```

## Researcher Workflow

### 1. Connect to Label Studio

**Method 1: Using Username/Password (Recommended - No manual token needed!)**

```bash
curl -X POST http://localhost:8000/api/labelstudio/connections/ \
  -H "Authorization: Token YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "labelstudio_url": "http://localhost:8080",
    "username": "your_labelstudio_username",
    "password": "your_labelstudio_password"
  }'
```

Viberate will automatically:
- Authenticate with Label Studio
- Fetch your API token
- Store it securely
- Use it for all future requests

**Method 2: Using API Token Directly (Advanced)**

If you prefer to manage tokens manually:

```bash
curl -X POST http://localhost:8000/api/labelstudio/connections/ \
  -H "Authorization: Token YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "labelstudio_url": "http://localhost:8080",
    "api_token": "YOUR_LABELSTUDIO_API_TOKEN"
  }'
```

Response (both methods):
```json
{
  "id": 1,
  "labelstudio_url": "http://localhost:8080",
  "is_verified": true,
  "last_verified_at": "2024-01-01T12:00:00Z",
  "created_at": "2024-01-01T12:00:00Z"
}
```

### 2. List Available Projects from Label Studio

```bash
curl -X GET http://localhost:8000/api/labelstudio/projects/available_projects/ \
  -H "Authorization: Token YOUR_TOKEN"
```

Response:
```json
[
  {
    "id": 1,
    "title": "Image Classification Project",
    "description": "Classify images into categories",
    "created_at": "2024-01-01T00:00:00Z"
  }
]
```

### 3. Import a Project

```bash
curl -X POST http://localhost:8000/api/labelstudio/projects/import_project/ \
  -H "Authorization: Token YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "labelstudio_project_id": 1
  }'
```

### 4. View Imported Projects

```bash
curl -X GET http://localhost:8000/api/labelstudio/projects/ \
  -H "Authorization: Token YOUR_TOKEN"
```

### 5. Sync Tasks from Label Studio

```bash
curl -X POST http://localhost:8000/api/labelstudio/projects/1/sync/ \
  -H "Authorization: Token YOUR_TOKEN"
```

Response:
```json
{
  "status": "synced",
  "tasks_imported": 50,
  "tasks_updated": 0
}
```

### 6. View Tasks

```bash
curl -X GET "http://localhost:8000/api/tasks/?project=1" \
  -H "Authorization: Token YOUR_TOKEN"
```

### 7. View Submitted Assignments

```bash
curl -X GET "http://localhost:8000/api/assignments/?status=submitted" \
  -H "Authorization: Token YOUR_TOKEN"
```

### 8. Review an Assignment

Approve:
```bash
curl -X POST http://localhost:8000/api/assignments/1/review/ \
  -H "Authorization: Token YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "approve",
    "quality_score": 9.5,
    "feedback": "Excellent work! Very accurate annotations."
  }'
```

Reject:
```bash
curl -X POST http://localhost:8000/api/assignments/1/review/ \
  -H "Authorization: Token YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "reject",
    "feedback": "Please review the annotation guidelines. The labels are inconsistent."
  }'
```

## Annotator Workflow

### 1. Register as Annotator

```bash
curl -X POST http://localhost:8000/api/users/ \
  -H "Content-Type: application/json" \
  -d '{
    "username": "annotator1",
    "email": "annotator@example.com",
    "password": "securepass123",
    "user_type": "annotator",
    "first_name": "Jane",
    "last_name": "Smith",
    "skills": ["image_classification", "text_annotation"]
  }'
```

### 2. Browse Available Tasks

```bash
curl -X GET http://localhost:8000/api/tasks/ \
  -H "Authorization: Token YOUR_TOKEN"
```

Response:
```json
{
  "count": 50,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": 1,
      "labelstudio_task_id": 101,
      "project": 1,
      "project_title": "Image Classification Project",
      "data": {
        "image": "https://example.com/image1.jpg"
      },
      "status": "available",
      "difficulty": "medium",
      "reward_points": 10,
      "has_active_assignment": false
    }
  ]
}
```

### 3. Claim a Task

```bash
curl -X POST http://localhost:8000/api/tasks/claim/ \
  -H "Authorization: Token YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "task_id": 1
  }'
```

### 4. Accept Assignment

```bash
curl -X POST http://localhost:8000/api/assignments/1/accept/ \
  -H "Authorization: Token YOUR_TOKEN"
```

### 5. Start Working

```bash
curl -X POST http://localhost:8000/api/assignments/1/start/ \
  -H "Authorization: Token YOUR_TOKEN"
```

### 6. Submit Annotation

```bash
curl -X POST http://localhost:8000/api/assignments/1/submit/ \
  -H "Authorization: Token YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "annotation_result": {
      "value": {
        "choices": ["cat"]
      },
      "from_name": "choice",
      "to_name": "image",
      "type": "choices"
    }
  }'
```

### 7. View My Assignments

```bash
curl -X GET http://localhost:8000/api/assignments/my_assignments/ \
  -H "Authorization: Token YOUR_TOKEN"
```

### 8. Get My Profile

```bash
curl -X GET http://localhost:8000/api/users/me/ \
  -H "Authorization: Token YOUR_TOKEN"
```

Response:
```json
{
  "id": 2,
  "username": "annotator1",
  "email": "annotator@example.com",
  "first_name": "Jane",
  "last_name": "Smith",
  "user_type": "annotator",
  "bio": "",
  "avatar_url": "",
  "skills": ["image_classification", "text_annotation"],
  "rating": 9.2,
  "tasks_completed": 15,
  "created_at": "2024-01-01T00:00:00Z"
}
```

## Advanced Queries

### Filter Tasks by Status

```bash
curl -X GET "http://localhost:8000/api/tasks/?status=available&project=1" \
  -H "Authorization: Token YOUR_TOKEN"
```

### Filter Assignments by Status

```bash
curl -X GET "http://localhost:8000/api/assignments/?status=in_progress" \
  -H "Authorization: Token YOUR_TOKEN"
```

### List All Annotators (Public Profiles)

```bash
curl -X GET http://localhost:8000/api/users/annotators/ \
  -H "Authorization: Token YOUR_TOKEN"
```

## Error Handling

### 400 Bad Request
```json
{
  "error": "Task is not available for assignment."
}
```

### 401 Unauthorized
```json
{
  "detail": "Authentication credentials were not provided."
}
```

### 403 Forbidden
```json
{
  "error": "Only annotators can claim tasks."
}
```

### 404 Not Found
```json
{
  "detail": "Not found."
}
```

## Using Python Requests

### Complete Example: Researcher Workflow

```python
import requests

BASE_URL = "http://localhost:8000/api"

# 1. Login to Viberate
response = requests.post(
    f"{BASE_URL}/auth/login/",
    json={"username": "researcher1", "password": "securepass123"}
)
token = response.json()["token"]
headers = {"Authorization": f"Token {token}"}

# 2. Connect to Label Studio (using username/password - recommended)
connection_response = requests.post(
    f"{BASE_URL}/labelstudio/connections/",
    headers=headers,
    json={
        "labelstudio_url": "http://localhost:8080",
        "username": "labelstudio_user",
        "password": "labelstudio_pass"
    }
)
connection = connection_response.json()
print(f"Connected! Verified: {connection['is_verified']}")

# 3. Get available Label Studio projects
available_projects = requests.get(
    f"{BASE_URL}/labelstudio/projects/available_projects/",
    headers=headers
).json()
print(f"Found {len(available_projects)} projects")

# 4. Import a project
import_response = requests.post(
    f"{BASE_URL}/labelstudio/projects/import_project/",
    headers=headers,
    json={"labelstudio_project_id": available_projects[0]["id"]}
)
project = import_response.json()
print(f"Imported project: {project['title']}")

# 5. View submitted assignments
assignments = requests.get(
    f"{BASE_URL}/assignments/?status=submitted",
    headers=headers
).json()

# 6. Review an assignment
if assignments['results']:
    assignment_id = assignments['results'][0]['id']
    review_response = requests.post(
        f"{BASE_URL}/assignments/{assignment_id}/review/",
        headers=headers,
        json={
            "action": "approve",
            "quality_score": 9.5,
            "feedback": "Excellent work!"
        }
    )
    print("Assignment reviewed!")
```

### Quick Example: Annotator Workflow

```python
import requests

BASE_URL = "http://localhost:8000/api"

# Login
response = requests.post(
    f"{BASE_URL}/auth/login/",
    json={"username": "annotator1", "password": "securepass123"}
)
token = response.json()["token"]
headers = {"Authorization": f"Token {token}"}

# Get available tasks
tasks = requests.get(f"{BASE_URL}/tasks/", headers=headers).json()

# Claim a task
assignment = requests.post(
    f"{BASE_URL}/tasks/claim/",
    headers=headers,
    json={"task_id": tasks['results'][0]['id']}
).json()

# Start working
requests.post(
    f"{BASE_URL}/assignments/{assignment['id']}/start/",
    headers=headers
)

# Submit annotation
requests.post(
    f"{BASE_URL}/assignments/{assignment['id']}/submit/",
    headers=headers,
    json={
        "annotation_result": {
            "value": {"choices": ["cat"]},
            "from_name": "choice",
            "to_name": "image",
            "type": "choices"
        }
    }
)
print("Annotation submitted!")
```

## Using JavaScript/Fetch

### Researcher Example

```javascript
const BASE_URL = 'http://localhost:8000/api';

// 1. Login to Viberate
const loginResponse = await fetch(`${BASE_URL}/auth/login/`, {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    username: 'researcher1',
    password: 'securepass123'
  })
});
const { token } = await loginResponse.json();

const headers = {
  'Authorization': `Token ${token}`,
  'Content-Type': 'application/json'
};

// 2. Connect to Label Studio (credential-based)
const connectionResponse = await fetch(`${BASE_URL}/labelstudio/connections/`, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    labelstudio_url: 'http://localhost:8080',
    username: 'labelstudio_user',
    password: 'labelstudio_pass'
  })
});
const connection = await connectionResponse.json();
console.log('Connected:', connection.is_verified);

// 3. Get available projects
const projectsResponse = await fetch(
  `${BASE_URL}/labelstudio/projects/available_projects/`,
  { headers }
);
const projects = await projectsResponse.json();

// 4. Import a project
const importResponse = await fetch(`${BASE_URL}/labelstudio/projects/import_project/`, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    labelstudio_project_id: projects[0].id
  })
});
const project = await importResponse.json();
console.log('Imported:', project.title);
```

### Annotator Example

```javascript
const BASE_URL = 'http://localhost:8000/api';

// Login
const loginResponse = await fetch(`${BASE_URL}/auth/login/`, {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    username: 'annotator1',
    password: 'securepass123'
  })
});
const { token } = await loginResponse.json();

const headers = {
  'Authorization': `Token ${token}`,
  'Content-Type': 'application/json'
};

// Get tasks
const tasksResponse = await fetch(`${BASE_URL}/tasks/`, { headers });
const tasks = await tasksResponse.json();

// Claim task
const claimResponse = await fetch(`${BASE_URL}/tasks/claim/`, {
  method: 'POST',
  headers,
  body: JSON.stringify({task_id: tasks.results[0].id})
});
const assignment = await claimResponse.json();

// Submit annotation
await fetch(`${BASE_URL}/assignments/${assignment.id}/submit/`, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    annotation_result: {
      value: { choices: ['cat'] },
      from_name: 'choice',
      to_name: 'image',
      type: 'choices'
    }
  })
});
console.log('Annotation submitted!');
```

## Pagination

The API uses page number pagination. Use `page` and `page_size` query parameters:

```bash
curl -X GET "http://localhost:8000/api/tasks/?page=2&page_size=20" \
  -H "Authorization: Token YOUR_TOKEN"
```

Response includes pagination info:
```json
{
  "count": 100,
  "next": "http://localhost:8000/api/tasks/?page=3",
  "previous": "http://localhost:8000/api/tasks/?page=1",
  "results": [...]
}
```

## Webhook Integration (Future)

Coming soon: Webhooks for real-time notifications when tasks are completed or reviewed.
