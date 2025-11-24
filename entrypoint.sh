#!/bin/sh

# Default repo URL if not set
REPO_URL="${REPO_URL:-https://github.com/horikx/unicorn-tower-defence.git}"

echo "Starting Unicorn Tower Defence Container..."
echo "Repo: $REPO_URL"

# Clone to a temporary directory to avoid "directory not empty" errors with volumes
echo "Cloning repository to /tmp/repo..."
rm -rf /tmp/repo
git clone "$REPO_URL" /tmp/repo

echo "Updating application files..."
# Copy files to /app (overwriting existing)
cp -rf /tmp/repo/* /app/
# Attempt to copy hidden files (like .gitignore), ignore error if none match
cp -rf /tmp/repo/.[!.]* /app/ 2>/dev/null || true

# Clean up
rm -rf /tmp/repo

echo "Installing dependencies..."
npm install

echo "Building application..."
npm run build

echo "Starting server..."
node server.js
