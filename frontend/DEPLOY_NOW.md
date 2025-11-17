# 🚀 Deploy Your Viberate Platform NOW

Quick deployment guide for Railway Pro + Vercel Free.

## Prerequisites Check

```bash
# Install CLIs
npm i -g @railway/cli vercel
```

## Step 1: Deploy Backend (5 min)

```bash
# Login and deploy
railway login
railway init
railway add --database postgresql

# Set environment variables
railway variables set DEBUG=False
railway variables set SECRET_KEY=$(python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())")
railway variables set ALLOWED_HOSTS=".railway.app"

# Deploy
railway up

# Setup database
railway run python manage.py migrate
railway run python manage.py createsuperuser

# Get your URL
railway domain
```

**Save your Railway URL!** You'll need it for Step 2.

## Step 2: Deploy Frontend (3 min)

```bash
# Navigate to frontend
cd frontend

# Login and deploy
vercel login
vercel --prod

# Set backend URL (use Railway URL from Step 1)
vercel env add VITE_API_URL production
# Enter: https://your-backend.railway.app

# Redeploy to apply env var
vercel --prod
```

**Save your Vercel URL!** You'll need it for Step 3.

## Step 3: Connect Them (1 min)

```bash
# Update Railway CORS (use Vercel URL from Step 2)
railway variables set CORS_ALLOWED_ORIGINS="https://your-frontend.vercel.app"

# Redeploy
railway up
```

## Step 4: Test! ✅

1. Visit your Vercel URL
2. Register a new user
3. Login
4. Create a task
5. Done! 🎉

---

## Or Use Scripts

We've created scripts to automate this:

### Deploy Backend
```bash
./deploy-railway.sh
```

### Deploy Frontend
```bash
./deploy-vercel.sh
```

---

## Need More Details?

See **DEPLOYMENT.md** for complete documentation including:
- Custom domains
- Environment variables reference
- Troubleshooting
- Monitoring & logs
- Security checklist
- And more!

---

## Quick Commands

```bash
# Backend logs
railway logs

# Frontend logs
vercel logs

# Update backend
railway up

# Update frontend
cd frontend && vercel --prod

# Database shell
railway run python manage.py dbshell

# Django shell
railway run python manage.py shell
```

---

**Questions?** Check DEPLOYMENT.md or the main README.md
