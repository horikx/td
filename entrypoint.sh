#!/bin/sh

# Default repo URL if not set
REPO_URL="${REPO_URL:-https://github.com/horikx/unicorn-tower-defence.git}"

echo "Starting Unicorn Tower Defence Container..."
echo "Repo: $REPO_URL"

# Check if we are in a git repo
if [ -d ".git" ]; then
    echo "Pulling latest changes..."
    git pull
else
    echo "Cloning repository..."
    # Clone into current directory (must be empty or contain only non-conflicting files)
    # Since WORKDIR is /app, and we might have mounted volumes, we need to be careful.
    # If /app is empty, git clone . works.
    git clone "$REPO_URL" .
fi

echo "Installing dependencies..."
npm install

echo "Building application..."
npm run build

echo "Starting server..."
node server.js
