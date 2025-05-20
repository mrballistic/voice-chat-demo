#!/bin/zsh
# start.sh - Start the Voice Chat Demo Next.js app

# Exit on error
set -e

# Print each command
set -x

# Install dependencies if node_modules does not exist
test -d node_modules || npm install

# Run the development server
npm run dev
