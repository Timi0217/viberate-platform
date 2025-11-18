#!/bin/bash

# Sync project stats via API
API_URL="https://django-production-3340.up.railway.app/api"

echo "Syncing project stats via API..."
echo ""

# You'll need to get your auth token from the extension
# Run this and paste your token when prompted
read -sp "Enter your auth token: " TOKEN
echo ""

# Sync the project
echo "Calling sync endpoint..."
curl -X POST "${API_URL}/labelstudio/projects/1/sync/" \
  -H "Authorization: Token ${TOKEN}" \
  -H "Content-Type: application/json" \
  -w "\nHTTP Status: %{http_code}\n"

echo ""
echo "Done!"
