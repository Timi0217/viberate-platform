#!/bin/bash

echo "🚀 Deploying Viberate Platform Backend to Railway..."
echo ""

# Check if railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Installing..."
    npm i -g @railway/cli
fi

# Check if logged in
if ! railway whoami &> /dev/null; then
    echo "🔐 Please login to Railway:"
    railway login
fi

echo ""
echo "📦 Deploying application..."
railway up

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Deployment successful!"
    echo ""
    echo "🌐 Your backend URL:"
    railway domain
    echo ""
    echo "📊 View logs:"
    echo "   railway logs"
    echo ""
    echo "🗄️  Run migrations:"
    echo "   railway run python manage.py migrate"
    echo ""
    echo "👤 Create superuser:"
    echo "   railway run python manage.py createsuperuser"
else
    echo ""
    echo "❌ Deployment failed. Check the logs above."
    exit 1
fi
