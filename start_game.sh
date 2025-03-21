#!/bin/bash

echo "Starting Minecraft Clone game server..."
echo "Opening game in default browser..."

# Start HTTP server in background
if command -v python3 &> /dev/null; then
    python3 -m http.server 8000 &
elif command -v python &> /dev/null; then
    python -m SimpleHTTPServer 8000 &
else
    echo "Error: Python not found. Please install Python or run your own HTTP server."
    exit 1
fi

SERVER_PID=$!

# Open in browser
if command -v open &> /dev/null; then
    # macOS
    open http://localhost:8000
elif command -v xdg-open &> /dev/null; then
    # Linux
    xdg-open http://localhost:8000
elif command -v start &> /dev/null; then
    # Windows
    start http://localhost:8000
else
    echo "Please open your browser and navigate to: http://localhost:8000"
fi

echo "Server running at http://localhost:8000"
echo "Press Ctrl+C to stop the server when done playing"

# Wait for Ctrl+C
trap "kill $SERVER_PID; echo 'Server stopped'; exit 0" INT
wait 