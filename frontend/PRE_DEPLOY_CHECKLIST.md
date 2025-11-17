# Pre-Deployment Checklist ✅

Run through this checklist before deploying to ensure everything is configured correctly.

## Backend Files ✓

- [x] `requirements.txt` - Contains all production dependencies
- [x] `Procfile` - Railway deployment commands configured
- [x] `railway.json` - Railway build settings
- [x] `runtime.txt` - Python version specified
- [x] `viberate_platform/settings.py` - Production settings configured
  - WhiteNoise for static files
  - DATABASE_URL support (dj-database-url)
  - CORS settings
  - Security headers for production
  - ALLOWED_HOSTS with Railway support

## Frontend Files ✓

- [x] `frontend/package.json` - Dependencies including axios and react-router
- [x] `frontend/vite.config.ts` - Vite configuration with proxy
- [x] `frontend/src/main.tsx` - Entry point
- [x] `frontend/src/App.tsx` - Main application component
- [x] `frontend/src/api.ts` - API service layer
- [x] `frontend/src/index.css` - Styling
- [x] `frontend/vercel.json` - Vercel configuration
- [x] `frontend/.env.example` - Environment variable template

## Deployment Scripts ✓

- [x] `deploy-railway.sh` - Automated Railway deployment
- [x] `deploy-vercel.sh` - Automated Vercel deployment

## Documentation ✓

- [x] `DEPLOYMENT.md` - Complete deployment guide
- [x] `DEPLOY_NOW.md` - Quick start guide
- [x] `PRE_DEPLOY_CHECKLIST.md` - This file
- [x] `.env.example` - Environment variables template

## Before You Deploy

### 1. Test Locally

```bash
# Backend
python manage.py runserver

# Frontend (in another terminal)
cd frontend
npm install
npm run dev
```

Visit http://localhost:5173 and test:
- User registration
- Login
- Create task
- Create annotation task

### 2. Check Git

```bash
# Ensure .env is in .gitignore
cat .gitignore | grep .env

# Check what will be deployed
git status

# Commit everything
git add .
git commit -m "Ready for deployment"
git push
```

### 3. Install CLI Tools

```bash
# Railway CLI
npm i -g @railway/cli

# Vercel CLI
npm i -g vercel

# Verify installations
railway --version
vercel --version
```

### 4. Login to Services

```bash
# Railway
railway login

# Vercel
vercel login
```

## Deployment Order

**Always deploy in this order:**

1. **Backend first** (Railway)
   - Database will be created
   - Get backend URL
   
2. **Frontend second** (Vercel)
   - Use backend URL in environment variable
   - Get frontend URL
   
3. **Connect them**
   - Update CORS on backend with frontend URL
   - Redeploy backend

## Post-Deployment Checks

After deploying, verify:

### Backend Health

```bash
# Get your Railway URL
railway domain

# Test API endpoint
curl https://your-backend.railway.app/api/

# Check admin panel
# Visit: https://your-backend.railway.app/admin/
```

### Frontend Health

```bash
# Get your Vercel URL
vercel inspect

# Visit in browser
# Should see login/register page
```

### Integration Test

1. Open frontend in browser
2. Open browser console (F12)
3. Try to register a user
4. Check for CORS errors
   - ✅ No errors = properly configured
   - ❌ CORS error = check CORS_ALLOWED_ORIGINS on Railway

## Environment Variables to Set

### Railway (Backend)

Required:
```bash
railway variables set DEBUG=False
railway variables set SECRET_KEY=<generated-key>
railway variables set ALLOWED_HOSTS=".railway.app"
railway variables set CORS_ALLOWED_ORIGINS="https://your-frontend.vercel.app"
```

Optional:
```bash
railway variables set LABEL_STUDIO_URL=<your-label-studio-url>
railway variables set LABEL_STUDIO_API_KEY=<your-api-key>
```

### Vercel (Frontend)

Required:
```bash
vercel env add VITE_API_URL production
# Enter: https://your-backend.railway.app
```

## Common Pre-Deployment Issues

### Issue: Frontend node_modules too large

**Solution:** Don't commit node_modules! It's in .gitignore. Vercel installs dependencies automatically.

### Issue: Missing dependencies

**Solution:** 
```bash
# Backend: Add to requirements.txt
# Frontend: Add to package.json

# Verify all imports are in dependencies
```

### Issue: Database not configured

**Solution:** Railway automatically provides DATABASE_URL when you add PostgreSQL. Settings.py is configured to use it via dj-database-url.

### Issue: Static files not serving

**Solution:** WhiteNoise is configured. Run collectstatic if needed:
```bash
railway run python manage.py collectstatic --noinput
```

## Ready to Deploy?

If all checks pass, proceed with deployment:

### Option 1: Use Scripts (Easiest)

```bash
# Deploy backend
./deploy-railway.sh

# Deploy frontend
./deploy-vercel.sh
```

### Option 2: Manual (See DEPLOY_NOW.md)

Follow the quick start guide in DEPLOY_NOW.md

### Option 3: Complete Guide (See DEPLOYMENT.md)

For detailed explanations, see DEPLOYMENT.md

---

## After Deployment

1. **Create superuser** for Django admin:
   ```bash
   railway run python manage.py createsuperuser
   ```

2. **Save your URLs** somewhere safe:
   - Backend: `https://your-app.railway.app`
   - Frontend: `https://your-app.vercel.app`

3. **Test the full flow**:
   - Register → Login → Create Task → Create Annotation

4. **Monitor logs**:
   ```bash
   railway logs
   vercel logs
   ```

5. **Set up custom domain** (optional):
   - See DEPLOYMENT.md Part 9

---

**All set?** 🚀 Let's deploy! Start with `./deploy-railway.sh`
