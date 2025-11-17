# Deployment Guide - Railway Pro + Vercel Free

This guide will help you deploy the Viberate Platform to production using Railway Pro (backend) and Vercel Free (frontend).

## Prerequisites

- Railway Pro account ✓
- Vercel Free account ✓
- Git repository with your code
- [Railway CLI](https://docs.railway.app/develop/cli): `npm i -g @railway/cli`
- [Vercel CLI](https://vercel.com/docs/cli): `npm i -g vercel`

## Quick Start (5 minutes)

### Step 1: Deploy Backend to Railway

```bash
# Install Railway CLI if you haven't
npm i -g @railway/cli

# Login to Railway
railway login

# Initialize project (run from project root)
railway init

# Link to new project or select existing
railway link

# Add PostgreSQL database
railway add --database postgresql

# Set environment variables
railway variables set DEBUG=False
railway variables set SECRET_KEY=$(python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())")
railway variables set ALLOWED_HOSTS=.railway.app

# Deploy!
railway up

# Run migrations
railway run python manage.py migrate

# Create superuser
railway run python manage.py createsuperuser

# Get your backend URL
railway domain
```

### Step 2: Deploy Frontend to Vercel

```bash
# Navigate to frontend directory
cd frontend

# Install Vercel CLI if you haven't
npm i -g vercel

# Login to Vercel
vercel login

# Deploy (follow prompts)
vercel

# Set environment variable with your Railway URL
vercel env add VITE_API_URL production
# Enter: https://your-backend.railway.app (from Step 1)

# Deploy to production
vercel --prod

# Get your frontend URL
vercel inspect
```

### Step 3: Connect Frontend & Backend

```bash
# Update Railway CORS to allow Vercel frontend
railway variables set CORS_ALLOWED_ORIGINS=https://your-frontend.vercel.app

# Redeploy Railway
railway up
```

Done! Your app is live! 🚀

---

## Detailed Deployment Steps

## Part 1: Railway Backend Setup

### 1.1 Project Configuration

Files already configured for Railway:
- `railway.json` - Build and deploy settings
- `Procfile` - Commands for release and web
- `runtime.txt` - Python version
- `requirements.txt` - Dependencies including production packages

### 1.2 Deploy via Railway CLI

```bash
# From project root directory
railway login
railway init
railway link  # Select or create project

# Add PostgreSQL (Railway Pro gives you better resources)
railway add --database postgresql
```

### 1.3 Configure Environment Variables

**Required Variables:**
```bash
railway variables set DEBUG=False
railway variables set SECRET_KEY="$(python -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())')"
railway variables set ALLOWED_HOSTS=".railway.app"
```

**Optional Variables:**
```bash
# Label Studio (if using)
railway variables set LABEL_STUDIO_URL=http://your-labelstudio.com
railway variables set LABEL_STUDIO_API_KEY=your-api-key

# Custom domain (if you have one)
railway variables set ALLOWED_HOSTS=".railway.app,yourdomain.com"
```

### 1.4 Deploy

```bash
# Deploy the application
railway up

# Railway will automatically:
# 1. Install dependencies from requirements.txt
# 2. Run migrations (via Procfile release command)
# 3. Start Gunicorn server
# 4. Expose on Railway domain
```

### 1.5 Database Setup

```bash
# Create superuser for Django admin
railway run python manage.py createsuperuser

# Verify deployment
railway logs
railway status
railway domain  # Get your public URL
```

### 1.6 Railway Pro Benefits

With Railway Pro, you get:
- More CPU and RAM resources
- Automatic database backups
- Custom domains
- Priority support
- Higher usage limits

## Part 2: Vercel Frontend Setup

### 2.1 Prepare Frontend

```bash
cd frontend

# Install dependencies locally (optional, for testing)
npm install

# Test build (optional)
npm run build
```

### 2.2 Deploy via Vercel CLI

```bash
# Login to Vercel
vercel login

# First deployment (staging)
vercel

# Follow prompts:
# - Set up and deploy? Yes
# - Which scope? Select your account
# - Link to existing project? No
# - Project name? viberate-frontend (or your choice)
# - Directory? ./ (current directory)
# - Override settings? No

# This creates a preview deployment
```

### 2.3 Set Environment Variables

```bash
# Add your Railway backend URL
vercel env add VITE_API_URL

# When prompted:
# - Environment: Production
# - Value: https://your-backend.railway.app (from Railway deployment)

# You can also set it for preview/development
vercel env add VITE_API_URL preview
vercel env add VITE_API_URL development
```

### 2.4 Production Deployment

```bash
# Deploy to production
vercel --prod

# Get your production URL
vercel inspect
# Or check your Vercel dashboard
```

### 2.5 Vercel Configuration

The `vercel.json` file is already configured with:
- Build command: `npm run build`
- Output directory: `dist`
- Framework: Vite
- Environment variable reference

## Part 3: Connect & Configure

### 3.1 Update Backend CORS

After deploying frontend, update Railway to allow your Vercel domain:

```bash
# Get your Vercel URL (e.g., viberate-frontend.vercel.app)
# Then update CORS:
railway variables set CORS_ALLOWED_ORIGINS="https://your-frontend.vercel.app,https://your-frontend-git-main.vercel.app"

# Redeploy to apply changes
railway up
```

### 3.2 Test the Connection

1. Visit your Vercel frontend URL
2. Try to register a new user
3. Login with the user
4. Create a task
5. Create an annotation task

If you see CORS errors in browser console, double-check the CORS_ALLOWED_ORIGINS setting.

### 3.3 Verify Backend

```bash
# Check if backend is responding
curl https://your-backend.railway.app/api/

# Check admin panel
# Visit: https://your-backend.railway.app/admin/
# Login with superuser credentials
```

## Part 4: Environment Variables Reference

### Railway Backend Variables

| Variable | Required | Example | Notes |
|----------|----------|---------|-------|
| `DEBUG` | Yes | `False` | Always False in production |
| `SECRET_KEY` | Yes | `django-insecure-xyz...` | Generate with Django utils |
| `ALLOWED_HOSTS` | Yes | `.railway.app,yourdomain.com` | Comma-separated |
| `DATABASE_URL` | Auto | `postgresql://...` | Auto-set by Railway |
| `CORS_ALLOWED_ORIGINS` | Yes | `https://app.vercel.app` | Your frontend URL |
| `LABEL_STUDIO_URL` | No | `http://localhost:8080` | If using Label Studio |
| `LABEL_STUDIO_API_KEY` | No | `your-key` | If using Label Studio |

### Vercel Frontend Variables

| Variable | Required | Example | Notes |
|----------|----------|---------|-------|
| `VITE_API_URL` | Yes | `https://backend.railway.app` | Railway backend URL |

## Part 5: Deployment Scripts

### One-Command Backend Deploy

Create `deploy-backend.sh`:
```bash
#!/bin/bash
echo "🚀 Deploying backend to Railway..."
railway up
echo "✅ Deployment complete!"
railway domain
```

### One-Command Frontend Deploy

Create `deploy-frontend.sh`:
```bash
#!/bin/bash
echo "🚀 Deploying frontend to Vercel..."
cd frontend
vercel --prod
echo "✅ Deployment complete!"
```

Make executable:
```bash
chmod +x deploy-backend.sh deploy-frontend.sh
```

## Part 6: Continuous Deployment

### Railway Auto-Deploy

Railway automatically deploys when you push to your main branch:

1. Connect your GitHub repository in Railway dashboard
2. Select branch to deploy (usually `main`)
3. Every push triggers automatic deployment
4. Monitor deployments in Railway dashboard

### Vercel Auto-Deploy

Vercel automatically deploys when you push:

1. Connect GitHub repo in Vercel dashboard
2. Production deploys from `main` branch
3. Preview deploys for all other branches/PRs
4. Each PR gets a unique preview URL

## Part 7: Database Management (Railway Pro)

### Backups

Railway Pro automatically backs up your PostgreSQL database:
- Daily automatic backups
- Point-in-time recovery
- Downloadable backups from dashboard

### Access Database Directly

```bash
# Get database credentials
railway variables

# Connect with psql
railway connect postgres

# Or get connection string
railway variables get DATABASE_URL
```

### Run Django Commands

```bash
# Shell
railway run python manage.py shell

# Custom management command
railway run python manage.py your_command

# Database migrations
railway run python manage.py migrate

# Create superuser
railway run python manage.py createsuperuser
```

## Part 8: Monitoring & Logs

### Railway Logs

```bash
# Real-time logs
railway logs

# Filter by service
railway logs --service web

# Export logs
railway logs > deployment.log
```

### Vercel Logs

```bash
# View deployment logs
vercel logs

# Follow real-time
vercel logs --follow

# Filter by function
vercel logs --follow --output=function
```

### Dashboard Monitoring

- Railway: Monitor CPU, RAM, Network in dashboard
- Vercel: Monitor function executions, bandwidth in dashboard

## Part 9: Custom Domain Setup

### Add Custom Domain to Railway

```bash
# Via CLI
railway domain add yourdomain.com

# Then update DNS:
# Add CNAME record: yourdomain.com -> your-app.railway.app
```

### Add Custom Domain to Vercel

```bash
# Via CLI
vercel domains add yourdomain.com

# Or via dashboard (easier for DNS setup)
# Vercel will guide you through DNS configuration
```

### Update Environment Variables

After adding custom domains:

```bash
# Railway
railway variables set ALLOWED_HOSTS="yourdomain.com,.railway.app"
railway variables set CORS_ALLOWED_ORIGINS="https://yourfrontend.com"

# Vercel
vercel env add VITE_API_URL production
# Enter: https://api.yourdomain.com
```

## Part 10: Troubleshooting

### Common Issues

**1. CORS Errors**
```bash
# Ensure frontend URL is in CORS_ALLOWED_ORIGINS
railway variables get CORS_ALLOWED_ORIGINS

# Update if needed
railway variables set CORS_ALLOWED_ORIGINS="https://your-frontend.vercel.app"
railway up
```

**2. Database Connection Issues**
```bash
# Check DATABASE_URL is set
railway variables get DATABASE_URL

# Test connection
railway run python manage.py dbshell
```

**3. Build Failures**
```bash
# Check logs
railway logs

# Ensure all dependencies are in requirements.txt
cat requirements.txt

# Test build locally
python -m pip install -r requirements.txt
```

**4. Frontend Can't Reach Backend**
```bash
# Check Vercel environment variable
vercel env ls

# Ensure it matches Railway URL
railway domain
```

### Health Checks

Add to your Django urls.py:
```python
from django.http import JsonResponse

def health_check(request):
    return JsonResponse({"status": "healthy"})
```

Then test:
```bash
curl https://your-backend.railway.app/health/
```

## Part 11: Security Checklist

- [x] `DEBUG=False` in production (Railway)
- [x] Strong `SECRET_KEY` generated
- [x] `ALLOWED_HOSTS` configured
- [x] CORS restricted to frontend domain
- [x] HTTPS enabled (automatic)
- [x] Database backups enabled (Railway Pro)
- [x] Static files served via WhiteNoise
- [x] Security headers configured
- [ ] Rate limiting (add if needed)
- [ ] Error monitoring (add Sentry if needed)

## Part 12: Cost Estimate

### Railway Pro
- $20/month base
- Includes generous resource limits
- PostgreSQL database included
- Backups included

### Vercel Free
- Free for personal projects
- 100 GB bandwidth/month
- Serverless functions included
- Good for small to medium traffic

**Total: ~$20/month**

## Quick Commands Cheat Sheet

```bash
# Railway
railway login                    # Login
railway up                       # Deploy
railway logs                     # View logs
railway variables                # List env vars
railway run <command>           # Run command
railway domain                   # Get URL
railway connect postgres        # Connect to DB

# Vercel
vercel login                    # Login
vercel                          # Deploy preview
vercel --prod                   # Deploy production
vercel logs                     # View logs
vercel env ls                   # List env vars
vercel domains                  # Manage domains
```

## Need Help?

- Railway Docs: https://docs.railway.app/
- Vercel Docs: https://vercel.com/docs
- Django Deployment: https://docs.djangoproject.com/en/stable/howto/deployment/
- This project's README: See main README.md

---

**Ready to deploy? Start with the Quick Start section above!** 🚀
