#!/bin/bash

# Canvas Sharing Functionality Test Runner
# This script runs the comprehensive sharing tests

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Canvas Sharing Functionality Test Runner${NC}"
echo -e "${BLUE}===========================================${NC}"

# Check if node_modules exists
if [ ! -d "../node_modules" ]; then
    echo -e "${YELLOW}⚠️  node_modules not found, running npm install...${NC}"
    cd ..
    npm install
    cd tests
fi

# Set default token if not provided
if [ -z "$TOKEN" ]; then
    export TOKEN="canvas-59e7b70b39d452005c42764d9bb608d899a047246627615e"
    echo -e "${YELLOW}ℹ️  Using default token: ${TOKEN:0:20}...${NC}"
fi

# Check if server is running
echo -e "${BLUE}🔍 Checking if Canvas server is running...${NC}"
if ! curl -s -f http://127.0.0.1:8001/rest/v2/ping > /dev/null 2>&1; then
    echo -e "${RED}❌ Canvas server is not running on http://127.0.0.1:8001${NC}"
    echo -e "${YELLOW}💡 Please start the server first:${NC}"
    echo -e "   cd /home/idnc_sk/Code/Canvas/canvas-server"
    echo -e "   npm start"
    exit 1
fi

echo -e "${GREEN}✅ Server is running${NC}"

# Run the tests
echo -e "${BLUE}🧪 Running sharing functionality tests...${NC}"
echo ""

cd "$(dirname "$0")"
node test-sharing-functionality.js

echo ""
echo -e "${GREEN}🎉 Test run completed!${NC}"
