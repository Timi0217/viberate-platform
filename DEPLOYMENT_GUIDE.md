# Viberate Platform - Deployment Guide

## 🚀 Live Deployments

### Frontend (Vercel)
- **URL**: https://frontend-kwjhu80k4-timidayokayode-gmailcoms-projects.vercel.app
- **Status**: ✅ Deployed
- **Framework**: React + TypeScript + Vite

### Backend (Railway)
- **URL**: https://django-production-3340.up.railway.app
- **Status**: ✅ Deployed
- **Framework**: Django 5.0 + Django REST Framework
- **Database**: PostgreSQL (Railway)

---

## 📋 What's Been Built

### 1. User Authentication & Roles
- ✅ Custom user model with roles (Researcher/Annotator)
- ✅ Registration with password confirmation
- ✅ Token-based authentication
- ✅ Login/logout functionality

### 2. Label Studio Integration
- ✅ Connection model to store Label Studio credentials
- ✅ Project import from Label Studio
- ✅ Task syncing (pulls annotation tasks to database)
- ✅ Label Studio SDK integration

### 3. Task Management System
- ✅ Task model for annotation jobs
- ✅ TaskAssignment model for distributing work to annotators
- ✅ Status tracking (assigned, in_progress, submitted, completed)
- ✅ Quality scoring system

### 4. API Endpoints

#### Authentication
- `POST /api/auth/register/` - Register new user
- `POST /api/auth/login/` - Login
- `POST /api/auth/logout/` - Logout
- `GET /api/auth/profile/` - Get current user

#### Label Studio Integration
- `GET /api/labelstudio/connections/` - List connections
- `POST /api/labelstudio/connections/` - Create connection
- `POST /api/labelstudio/connections/{id}/verify/` - Verify connection

- `GET /api/labelstudio/projects/` - List imported projects
- `GET /api/labelstudio/projects/available_projects/` - List available projects to import
- `POST /api/labelstudio/projects/import_project/` - Import a project
- `POST /api/labelstudio/projects/{id}/sync/` - Sync tasks from Label Studio

#### Tasks
- `GET /api/tasks/` - List tasks
- `GET /api/tasks/{id}/` - Get task details
- `POST /api/tasks/claim/` - Claim a task (annotators)

#### Assignments
- `GET /api/assignments/` - List assignments
- `GET /api/assignments/my_assignments/` - Get current user's assignments
- `POST /api/assignments/{id}/accept/` - Accept assignment
- `POST /api/assignments/{id}/start/` - Start working
- `POST /api/assignments/{id}/submit/` - Submit annotation
- `POST /api/assignments/{id}/review/` - Review submission (researchers)

---

## 🧪 Testing the System

### Step 1: Register as a Researcher
1. Go to https://frontend-kwjhu80k4-timidayokayode-gmailcoms-projects.vercel.app
2. Click "Register"
3. Fill in:
   - Username: `your_username`
   - Email: `your_email@example.com`
   - Password: `your_password` (min 6 chars)
   - Confirm Password: `your_password`
   - Account Type: **Researcher (Customer)**
4. Click "Register"

### Step 2: Connect Label Studio
1. Get your Label Studio API token:
   - Go to https://app.heartex.com (or your Label Studio instance)
   - Click on your profile → Account & Settings
   - Copy your "Access Token"

2. In Viberate Platform:
   - Enter Label Studio URL: `https://app.heartex.com`
   - Paste your API Token
   - Click "Connect"

### Step 3: Import a Project
1. Click "Import New Project"
2. You'll see a list of your Label Studio projects
3. Click "Import" on a project you want to use
4. The system will import the project and sync all tasks to the database

### Step 4: Sync Tasks
1. Once imported, you'll see your project in the dashboard
2. Click "Sync Tasks" to pull the latest tasks from Label Studio
3. Tasks are now stored in PostgreSQL and ready for distribution

### Step 5: Verify Tasks in Database
Tasks are now in the database! In the next sprint, you'll be able to:
- Assign tasks to annotators
- Track annotation progress
- Review submitted annotations
- Sync completed work back to Label Studio

---

## 🏗️ Architecture

### Database Models

#### User
```python
- username, email, password (built-in Django fields)
- user_type: 'researcher' or 'annotator'
- labelstudio_user_id: Link to Label Studio user
- labelstudio_api_token: User's LS token
- skills: JSON array (for annotators)
- rating: Float (annotator quality score)
- tasks_completed: Integer
```

#### LabelStudioConnection
```python
- researcher: ForeignKey to User
- labelstudio_url: URL of LS instance
- api_token: API token
- is_verified: Boolean
- last_verified_at: DateTime
```

#### LabelStudioProject
```python
- researcher: ForeignKey to User
- labelstudio_project_id: Integer
- title, description: Text
- label_config: JSON (annotation interface config)
- is_active: Boolean
- total_tasks, completed_tasks: Integer
- last_synced_at: DateTime
```

#### Task
```python
- project: ForeignKey to LabelStudioProject
- labelstudio_task_id: Integer
- data: JSON (task content)
- status: Choice (available, assigned, in_progress, etc.)
- difficulty: Choice (easy, medium, hard)
- reward_points: Integer
```

#### TaskAssignment
```python
- task: ForeignKey to Task
- annotator: ForeignKey to User
- status: Choice (assigned, accepted, in_progress, submitted, approved, rejected)
- annotation_result: JSON
- quality_score: Float (0-10)
- feedback: Text
- Timestamps: assigned_at, started_at, submitted_at, completed_at
```

### Data Flow

```
Label Studio Cloud
        ↓
   [API Token]
        ↓
LabelStudioConnection (stored in DB)
        ↓
[Import Project]
        ↓
LabelStudioProject (metadata in DB)
        ↓
   [Sync Tasks]
        ↓
Task objects (stored in PostgreSQL)
        ↓
[Next Sprint: Distribute to Annotators]
        ↓
TaskAssignment (track progress)
        ↓
[Complete & Review]
        ↓
[Sync back to Label Studio]
```

---

## 🔐 Environment Variables

### Railway (Backend)
Required:
- `DATABASE_URL` - Auto-set by Railway PostgreSQL
- `SECRET_KEY` - Django secret key
- `DEBUG` - Set to `False` in production
- `ALLOWED_HOSTS` - Railway domains (auto-configured)
- `CORS_ALLOWED_ORIGINS` - Frontend URL

### Vercel (Frontend)
Required:
- `VITE_API_URL` - Backend URL: `https://django-production-3340.up.railway.app`

---

## 📦 Dependencies

### Backend (requirements.txt)
```
Django>=5.0,<6.0
djangorestframework>=3.14.0
psycopg2-binary>=2.9.9
django-cors-headers>=4.3.0
requests>=2.31.0
python-dotenv>=1.0.0
label-studio-sdk>=0.0.34
dj-database-url>=2.2.0
whitenoise>=6.8.2
gunicorn>=23.0.0
```

### Frontend (package.json)
```json
{
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "axios": "^1.7.7"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.1",
    "typescript": "^5.5.3",
    "vite": "^5.4.2"
  }
}
```

---

## 🚦 Next Sprint: Annotator Distribution

### Planned Features
1. **Annotator Dashboard**
   - View available tasks
   - Claim tasks to work on
   - Submit annotations

2. **Label Studio UI Integration**
   - Embed Label Studio annotation interface
   - Use project's label_config
   - Real-time annotation

3. **Quality Control**
   - Researcher review interface
   - Approve/reject annotations
   - Quality scoring

4. **Sync Back to Label Studio**
   - Push approved annotations
   - Update task status
   - Track completion

---

## 🐛 Troubleshooting

### Frontend shows "Login failed"
- Check that backend is running: https://django-production-3340.up.railway.app/api/auth/login/
- Verify CORS settings in Railway
- Check browser console for errors

### "Failed to connect to Label Studio"
- Verify your API token is correct
- Ensure Label Studio URL is correct
- Check that Label Studio account is active

### "No projects to import"
- Create a project in Label Studio first
- Verify API token has access to projects
- Check Label Studio account permissions

### Blank screen after login
- Clear browser cache and localStorage
- Check browser console for errors
- Try registering a new account

---

## 📞 Support

For issues:
1. Check browser console (F12)
2. Check Railway logs: `railway logs`
3. Check database: Railway dashboard → PostgreSQL → Data

---

## ✅ Deployment Checklist

- [x] Backend deployed to Railway
- [x] PostgreSQL database connected
- [x] Frontend deployed to Vercel
- [x] CORS configured
- [x] Authentication working
- [x] Label Studio connection working
- [x] Project import working
- [x] Task sync working
- [x] Password confirmation added
- [x] UI improvements done

**Status: Ready for Testing! 🎉**

---

Generated with [Claude Code](https://claude.com/claude-code)
