# Viberate Quick Start Guide

Get up and running with Viberate in 5 minutes!

## What is Viberate?

Viberate connects your Label Studio annotation projects to a network of crowdsourced annotators. Instead of manually assigning tasks, researchers can import their Label Studio projects and let annotators claim and complete tasks independently.

## Prerequisites

- Python 3.12+
- PostgreSQL 14+ installed and running
- A Label Studio instance (local or cloud) with at least one project

## Installation

### 1. Quick Setup (Recommended)

```bash
cd /Users/Timi/Desktop/viberate
./setup.sh
```

The setup script will:
- Create a virtual environment
- Install all dependencies
- Guide you through database setup
- Create a superuser account

### 2. Start the Server

```bash
source venv/bin/activate
python manage.py runserver
```

Your API is now running at `http://localhost:8000/api/`

## Using Viberate

### For Researchers

**Step 1: Create an account**
```bash
curl -X POST http://localhost:8000/api/users/ \
  -H "Content-Type: application/json" \
  -d '{
    "username": "researcher1",
    "email": "researcher@example.com",
    "password": "yourpassword",
    "user_type": "researcher"
  }'
```

**Step 2: Get your auth token**
```bash
curl -X POST http://localhost:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{
    "username": "researcher1",
    "password": "yourpassword"
  }'
```

Save the token returned!

**Step 3: Connect to Label Studio**

No need to copy API tokens manually! Just provide your Label Studio login:

```bash
curl -X POST http://localhost:8000/api/labelstudio/connections/ \
  -H "Authorization: Token YOUR_VIBERATE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "labelstudio_url": "http://localhost:8080",
    "username": "your_labelstudio_username",
    "password": "your_labelstudio_password"
  }'
```

Viberate will:
✅ Authenticate with Label Studio
✅ Fetch your API token automatically
✅ Store it securely
✅ Use it for all future requests

**Step 4: Import a project**
```bash
# List available projects
curl -X GET http://localhost:8000/api/labelstudio/projects/available_projects/ \
  -H "Authorization: Token YOUR_TOKEN"

# Import a project
curl -X POST http://localhost:8000/api/labelstudio/projects/import_project/ \
  -H "Authorization: Token YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"labelstudio_project_id": 1}'
```

Done! Your tasks are now available to annotators.

### For Annotators

**Step 1: Create an account**
```bash
curl -X POST http://localhost:8000/api/users/ \
  -H "Content-Type: application/json" \
  -d '{
    "username": "annotator1",
    "email": "annotator@example.com",
    "password": "yourpassword",
    "user_type": "annotator",
    "skills": ["image_classification"]
  }'
```

**Step 2: Login and get token**
```bash
curl -X POST http://localhost:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{
    "username": "annotator1",
    "password": "yourpassword"
  }'
```

**Step 3: Browse and claim tasks**
```bash
# See available tasks
curl -X GET http://localhost:8000/api/tasks/ \
  -H "Authorization: Token YOUR_TOKEN"

# Claim a task
curl -X POST http://localhost:8000/api/tasks/claim/ \
  -H "Authorization: Token YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"task_id": 1}'
```

**Step 4: Complete and submit**
```bash
# Start working (get assignment ID from claim response)
curl -X POST http://localhost:8000/api/assignments/1/start/ \
  -H "Authorization: Token YOUR_TOKEN"

# Submit your annotation
curl -X POST http://localhost:8000/api/assignments/1/submit/ \
  -H "Authorization: Token YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "annotation_result": {
      "value": {"choices": ["cat"]},
      "from_name": "choice",
      "to_name": "image",
      "type": "choices"
    }
  }'
```

## Admin Interface

Access the Django admin for database management:

```
URL: http://localhost:8000/admin/
Login with the superuser you created during setup
```

## Common Issues

### PostgreSQL Connection Error

If you see "role 'postgres' does not exist":
```bash
createuser -s postgres
createdb viberate_db
```

### Label Studio Connection Failed

- Make sure Label Studio is running
- Verify the URL is correct (including http://)
- Check your username/password

### Import Error

Make sure you've run migrations:
```bash
python manage.py migrate
```

## Next Steps

- Read the full [README.md](README.md) for detailed documentation
- Check [API_EXAMPLES.md](API_EXAMPLES.md) for code examples
- Explore the API at `http://localhost:8000/api/`

## Key Features

✨ **No Manual Token Management** - Just use your Label Studio username/password
🔄 **Automatic Sync** - Tasks stay in sync with Label Studio
⭐ **Quality Control** - Rate and review annotations
📊 **Track Progress** - Monitor completion rates and annotator performance
🔐 **Secure** - Passwords are never stored, only API tokens

## Support

Having issues? Check:
1. README.md - Full documentation
2. API_EXAMPLES.md - Code examples
3. GitHub Issues - Report bugs

Happy annotating! 🎉
