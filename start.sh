#!/bin/bash

# Clear terminal screen
clear

# Define Colors for Beautiful UI Console output
GREEN='\033[0;32m'
TEAL='\033[0;36m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${TEAL}================================================================${NC}"
echo -e "${TEAL}         ✚  PharmaOps Retail Operations Suite  ✚               ${NC}"
echo -e "${TEAL}================================================================${NC}"
echo -e "Starting core services. Please wait...\n"

# Verify ports are clear
echo -e "🔍 Checking operational ports..."
if lsof -Pi :8080 -sTCP:LISTEN -t >/dev/null ; then
    echo -e "${RED}[ERROR] Port 8080 is already in use. Please clear it to start Backend Server.${NC}"
    exit 1
fi
if lsof -Pi :4200 -sTCP:LISTEN -t >/dev/null ; then
    echo -e "${RED}[ERROR] Port 4200 is already in use. Please clear it to start Frontend SPA.${NC}"
    exit 1
fi
echo -e "${GREEN}[OK] Ports are clear!${NC}\n"

# Create log files inside data directory
mkdir -p data
touch data/backend.log
touch data/frontend.log

# Trapping Ctrl+C to stop services cleanly
function cleanup {
  echo -e "\n\n${YELLOW}🛑 Shutting down PharmaOps services...${NC}"
  
  if [ ! -z "$BACKEND_PID" ]; then
    echo "Stopping Spring Boot Backend (PID: $BACKEND_PID)..."
    kill $BACKEND_PID 2>/dev/null
  fi
  
  if [ ! -z "$FRONTEND_PID" ]; then
    echo "Stopping Angular Frontend (PID: $FRONTEND_PID)..."
    kill $FRONTEND_PID 2>/dev/null
  fi
  
  echo -e "${GREEN}✓ All services stopped cleanly. Goodbye!${NC}"
  exit 0
}
trap cleanup SIGINT SIGTERM

# 1. Starting Java Spring Boot Backend
echo -e "🚀 Starting ${TEAL}Spring Boot Backend${NC} (Port: 8080)..."
cd backend
./mvnw spring-boot:run > ../data/backend.log 2>&1 &
BACKEND_PID=$!
cd ..

# 2. Starting Angular Serve
echo -e "🚀 Starting ${TEAL}Angular Frontend SPA${NC} (Port: 4200)..."
cd frontend
npx ng serve --port 4200 --open=false > ../data/frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

echo -e "\n${GREEN}✓ Processes spawned successfully!${NC}"
echo -e "⌛ Waiting for servers to initialize (takes ~10 seconds)..."
sleep 8

echo -e "\n${TEAL}================================================================${NC}"
echo -e "        🎉 ${GREEN}PharmaOps Retail Pharmacy System is ONLINE!${NC}"
echo -e "${TEAL}================================================================${NC}"
echo -e "  🖥️  ${GREEN}Angular URL${NC}   : ${BLUE}http://localhost:4200${NC}"
echo -e "  ⚙️   ${GREEN}Backend URL${NC}   : ${BLUE}http://localhost:8080${NC}"
echo -e "  💾  ${GREEN}H2 Database${NC}   : ${BLUE}http://localhost:8080/h2-console${NC}"
echo -e "                    (JDBC URL: ${YELLOW}jdbc:h2:file:./data/pharmacy_db${NC})"
echo -e "${TEAL}================================================================${NC}"
echo -e "${YELLOW}🔑 Default Test Logins (Quick Cards available on Login Page):${NC}"
echo -e "  - ${BLUE}Admin${NC}       : admin / admin123"
echo -e "  - ${BLUE}Pharmacist${NC}  : pharmacist / pharmacist123"
echo -e "  - ${BLUE}Cashier${NC}     : cashier / cashier123"
echo -e "  - ${BLUE}Manager${NC}     : manager / manager123"
echo -e "${TEAL}================================================================${NC}"
echo -e "${YELLOW}Logs are available in:${NC}"
echo -e "  - Backend  : ./data/backend.log"
echo -e "  - Frontend : ./data/frontend.log"
echo -e "${TEAL}================================================================${NC}"
echo -e "Press ${RED}[Ctrl+C]${NC} at any time to shutdown both servers cleanly."

# Keep script active to trap SIGINT
while true; do
  sleep 1
done
