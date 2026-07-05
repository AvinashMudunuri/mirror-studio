#!/bin/bash

# Claude API Key Setup Script
# Run this script to set up your environment for episode creation

echo "🔑 CLAUDE API KEY SETUP"
echo "════════════════════════════════════════════════════════"
echo ""

# Check if API key is already set
if [ -n "$ANTHROPIC_API_KEY" ]; then
    echo "✅ ANTHROPIC_API_KEY is already set!"
    echo "   Key: ${ANTHROPIC_API_KEY:0:10}...${ANTHROPIC_API_KEY: -4}"
    echo ""
else
    echo "📝 Please paste your Claude API key below:"
    echo "   (It should start with 'sk-ant-')"
    echo ""
    read -p "API Key: " api_key
    
    if [[ $api_key == sk-ant-* ]]; then
        export ANTHROPIC_API_KEY="$api_key"
        echo ""
        echo "✅ API key set successfully!"
        echo "   Key: ${api_key:0:10}...${api_key: -4}"
        echo ""
    else
        echo ""
        echo "❌ Invalid API key format. Claude API keys start with 'sk-ant-'"
        exit 1
    fi
fi

echo "════════════════════════════════════════════════════════"
echo ""
echo "🐳 CHECKING DOCKER INFRASTRUCTURE"
echo "════════════════════════════════════════════════════════"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running!"
    echo ""
    echo "   Please start Docker:"
    echo "   - On Mac: Open Docker Desktop"
    echo "   - On Linux: sudo systemctl start docker"
    echo ""
    exit 1
fi

echo "✅ Docker is running"
echo ""

# Check if containers are running
if docker ps | grep -q "mirror-postgres"; then
    echo "✅ PostgreSQL container is running"
else
    echo "⚠️  PostgreSQL container not running"
    echo "   Starting infrastructure..."
    echo ""
    cd /workspace
    docker-compose up -d
    echo ""
    echo "⏳ Waiting for services to be ready..."
    sleep 5
fi

if docker ps | grep -q "mirror-redis"; then
    echo "✅ Redis container is running"
else
    echo "⚠️  Redis container not running"
fi

echo ""
echo "════════════════════════════════════════════════════════"
echo ""
echo "🎬 READY TO CREATE EPISODES!"
echo ""
echo "Run the following commands:"
echo ""
echo "  # Export API key for current session"
echo "  export ANTHROPIC_API_KEY=\"\$ANTHROPIC_API_KEY\""
echo ""
echo "  # Create a real episode with Claude"
echo "  npm run sample:episode"
echo ""
echo "════════════════════════════════════════════════════════"
