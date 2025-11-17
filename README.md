# Viberate - Label Studio Integration Platform 🎯

Viberate is a crowdsourcing platform that integrates with Label Studio to distribute annotation tasks to a network of annotators.

## 🚀 Live Deployments

- **Frontend**: [https://frontend-58aqpnlae-timidayokayode-gmailcoms-projects.vercel.app](https://frontend-58aqpnlae-timidayokayode-gmailcoms-projects.vercel.app)
- **Backend API**: [https://django-production-3340.up.railway.app](https://django-production-3340.up.railway.app)
- **GitHub**: [https://github.com/Timi0217/viberate-platform](https://github.com/Timi0217/viberate-platform)

![Backend Status](https://img.shields.io/badge/Backend-Live-success)
![Frontend Status](https://img.shields.io/badge/Frontend-Live-success)
![API Tests](https://img.shields.io/badge/API%20Tests-7%2F7%20Passing-success)
![Database](https://img.shields.io/badge/Database-PostgreSQL-blue)

## 🎯 Quick Start

1. **Try the live app**: Visit [the frontend](https://frontend-58aqpnlae-timidayokayode-gmailcoms-projects.vercel.app)
2. **Register** as a Researcher or Annotator
3. **Connect Label Studio** using your API token from [app.heartex.com](https://app.heartex.com)
4. **Import a project** and sync tasks to the database

📚 For detailed instructions, see [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)

## Features

- **Label Studio Integration**: Researchers can connect their Label Studio account and import projects
- **Crowdsourcing**: Tasks from Label Studio are made available to a network of annotators
- **Task Management**: Complete workflow for task assignment, annotation, submission, and review
- **Quality Control**: Researchers can review and approve/reject annotations with quality scores
- **Automatic Sync**: Approved annotations are synced back to Label Studio

## Architecture

- **Backend**: Django 5.2 + Django REST Framework
- **Database**: PostgreSQL
- **Authentication**: Token-based authentication
- **Integration**: Label Studio API via label-studio-sdk

## Setup Instructions

### Prerequisites

- Python 3.12+
- PostgreSQL 14+
- Label Studio instance (local or cloud)

### 1. Clone and Setup Environment

```bash
cd /Users/Timi/Desktop/viberate
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 2. Configure PostgreSQL

Create a PostgreSQL database and user:

```bash
# Connect to PostgreSQL
psql postgres

# In PostgreSQL shell:
CREATE DATABASE viberate_db;
CREATE USER postgres WITH PASSWORD 'postgres';
ALTER ROLE postgres SET client_encoding TO 'utf8';
ALTER ROLE postgres SET default_transaction_isolation TO 'read committed';
ALTER ROLE postgres SET timezone TO 'UTC';
GRANT ALL PRIVILEGES ON DATABASE viberate_db TO postgres;
\q
```

### 3. Configure Environment Variables

Copy `.env.example` to `.env` and update the values:

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```env
# Django settings
SECRET_KEY=your-secret-key-here
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

# Database
DB_NAME=viberate_db
DB_USER=postgres
DB_PASSWORD=your-db-password
DB_HOST=localhost
DB_PORT=5432

# Label Studio
LABEL_STUDIO_URL=http://localhost:8080
LABEL_STUDIO_API_KEY=your-label-studio-api-key
```

### 4. Run Migrations

```bash
source venv/bin/activate
python manage.py migrate
```

### 5. Create Superuser

```bash
python manage.py createsuperuser
```

### 6. Run Development Server

```bash
python manage.py runserver
```

The API will be available at `http://localhost:8000/api/`

## API Endpoints

### Authentication

- `POST /api/auth/login/` - Obtain authentication token
  ```json
  {
    "username": "your_username",
    "password": "your_password"
  }
  ```

### Users

- `GET /api/users/` - List all users
- `POST /api/users/` - Create new user (registration)
- `GET /api/users/me/` - Get current user profile
- `GET /api/users/annotators/` - List all annotators

### Label Studio Integration

#### Connections

- `GET /api/labelstudio/connections/` - List your Label Studio connections
- `POST /api/labelstudio/connections/` - Create new Label Studio connection

  **Method 1: Username/Password (Recommended)**
  ```json
  {
    "labelstudio_url": "http://localhost:8080",
    "username": "your_labelstudio_username",
    "password": "your_labelstudio_password"
  }
  ```

  **Method 2: API Token (Advanced)**
  ```json
  {
    "labelstudio_url": "http://localhost:8080",
    "api_token": "your_api_token"
  }
  ```

- `POST /api/labelstudio/connections/{id}/verify/` - Verify connection

#### Projects

- `GET /api/labelstudio/projects/` - List imported projects
- `GET /api/labelstudio/projects/available_projects/` - List available projects from Label Studio (not imported)
- `POST /api/labelstudio/projects/import_project/` - Import a project from Label Studio
  ```json
  {
    "labelstudio_project_id": 1
  }
  ```
- `POST /api/labelstudio/projects/{id}/sync/` - Sync tasks from Label Studio

### Tasks

- `GET /api/tasks/` - List available tasks
  - Query params: `project={id}`, `status={status}`
- `GET /api/tasks/{id}/` - Get task details
- `POST /api/tasks/claim/` - Claim a task for annotation (annotators only)
  ```json
  {
    "task_id": 1
  }
  ```

### Task Assignments

- `GET /api/assignments/` - List your assignments
  - Query params: `status={status}`
- `GET /api/assignments/my_assignments/` - Get current user's assignments (annotators)
- `POST /api/assignments/{id}/accept/` - Accept an assignment
- `POST /api/assignments/{id}/start/` - Start working on assignment
- `POST /api/assignments/{id}/submit/` - Submit completed annotation
  ```json
  {
    "annotation_result": {
      "value": {
        "choices": ["Label A"]
      }
    }
  }
  ```
- `POST /api/assignments/{id}/review/` - Review and approve/reject (researchers only)
  ```json
  {
    "action": "approve",
    "quality_score": 9.5,
    "feedback": "Great work!"
  }
  ```

## Usage Workflow

### For Researchers

1. **Connect Label Studio**
   ```bash
   POST /api/labelstudio/connections/
   ```

2. **Import a Project**
   ```bash
   GET /api/labelstudio/projects/available_projects/
   POST /api/labelstudio/projects/import_project/
   ```

3. **Monitor Task Progress**
   ```bash
   GET /api/labelstudio/projects/
   GET /api/tasks/?project={id}
   GET /api/assignments/?status=submitted
   ```

4. **Review Submissions**
   ```bash
   POST /api/assignments/{id}/review/
   ```

### For Annotators

1. **Browse Available Tasks**
   ```bash
   GET /api/tasks/
   ```

2. **Claim a Task**
   ```bash
   POST /api/tasks/claim/
   ```

3. **Complete Annotation**
   ```bash
   POST /api/assignments/{id}/accept/
   POST /api/assignments/{id}/start/
   POST /api/assignments/{id}/submit/
   ```

4. **Track Your Assignments**
   ```bash
   GET /api/assignments/my_assignments/
   ```

## Database Models

### User
- Custom user model supporting both researchers and annotators
- Tracks annotator ratings and task completion stats

### LabelStudioConnection
- Stores Label Studio connection credentials for each researcher

### LabelStudioProject
- Represents an imported Label Studio project
- Tracks sync status and task counts

### Task
- Annotation tasks imported from Label Studio
- Tracks status (available, assigned, in_progress, completed, etc.)

### TaskAssignment
- Assignment of a task to an annotator
- Stores annotation results and quality assessments
- Syncs approved annotations back to Label Studio

## Development

### Running Tests

```bash
python manage.py test
```

### Admin Interface

Access the Django admin at `http://localhost:8000/admin/`

### Adding New Features

1. Create models in appropriate app
2. Create serializers for API representation
3. Create views/viewsets for endpoints
4. Register URLs in app's `urls.py`
5. Run `makemigrations` and `migrate`

## Configuration Options

### Task Assignment

The default task assignment is "first-come, first-served" where annotators claim available tasks. You can customize this by modifying the task claiming logic in `tasks/views.py`.

### Quality Control

Researchers can set quality scores (0-10) when reviewing annotations. Annotator ratings are automatically calculated as a moving average.

### Sync Behavior

- Projects can be synced manually via API
- Approved annotations are immediately synced to Label Studio
- Auto-sync can be enabled per project

## Troubleshooting

### PostgreSQL Connection Issues

If you get "role 'postgres' does not exist":
```bash
createuser -s postgres
```

### Label Studio Connection Failed

- Verify Label Studio is running
- Check API token is valid
- Ensure LABEL_STUDIO_URL in `.env` is correct

### Migration Errors

```bash
# Reset migrations (development only)
python manage.py migrate --fake users zero
python manage.py migrate --fake integration zero
python manage.py migrate --fake tasks zero
rm */migrations/0*.py
python manage.py makemigrations
python manage.py migrate
```

## Security Notes

- Change `SECRET_KEY` in production
- Use HTTPS in production
- Set `DEBUG=False` in production
- Use environment-specific `.env` files
- Secure API tokens (Label Studio credentials)

## Future Enhancements

- [ ] Real-time notifications for task assignments
- [ ] Payment/reward system for annotators
- [ ] Advanced task routing (skill-based matching)
- [ ] Analytics dashboard
- [ ] Batch task operations
- [ ] WebSocket support for live updates
- [ ] Multi-language support

## License

MIT License

## Support

For issues or questions, please open an issue on the repository.
