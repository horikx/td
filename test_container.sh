#!/bin/bash

echo "Building Docker image..."
docker build -t unicorn-td:latest .

echo "Running container..."
# Use a local directory for the volume to test persistence
mkdir -p ./test_levels
docker run -it --rm \
  -p 3005:3005 \
  -v $(pwd)/test_levels:/app/public/assets/levels \
  -e REPO_URL=https://github.com/horikx/td.git \
  unicorn-td:latest
