#!/bin/bash

echo "🚀 Deploying Viberate Platform Frontend to Vercel..."
echo ""

# Navigate to frontend directory
cd frontend || exit 1

# Check if vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Installing..."
    npm i -g vercel
fi

echo ""
echo "📦 Deploying to production..."
vercel --prod

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Deployment successful!"
    echo ""
    echo "🌐 Your frontend is live!"
    echo ""
    echo "⚙️  Don't forget to set VITE_API_URL environment variable:"
    echo "   vercel env add VITE_API_URL production"
    echo "   (Enter your Railway backend URL)"
    echo ""
    echo "📊 View deployment:"
    echo "   vercel inspect"
else
    echo ""
    echo "❌ Deployment failed. Check the logs above."
    exit 1
fi
