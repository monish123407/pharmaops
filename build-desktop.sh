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
echo -e "${TEAL}     ✚  Arpita Medical Desktop Packaging Pipeline (Windows)  ✚     ${NC}"
echo -e "${TEAL}================================================================${NC}"
echo -e "Starting automated desktop build...\n"

# Step 1: Compile Spring Boot Backend JAR
echo -e "☕ ${YELLOW}[1/5] Compiling Java Spring Boot Backend...${NC}"
cd backend
if ./mvnw clean package -DskipTests; then
    echo -e "${GREEN}✓ Java compilation successful!${NC}"
else
    echo -e "${RED}[ERROR] Backend compilation failed. Please verify Maven status.${NC}"
    exit 1
fi

# Ensure target directory has unified backend.jar name for electron-builder config
cp target/backend-0.0.1-SNAPSHOT.jar target/backend.jar
cd ..

# Step 2: Compile Angular Production Assets
echo -e "\n🅰️  ${YELLOW}[2/5] Compiling Angular Production Frontend SPA...${NC}"
cd frontend
if npx ng build --configuration=production; then
    echo -e "${GREEN}✓ Angular compilation successful!${NC}"
else
    echo -e "${RED}[ERROR] Frontend compilation failed. Check TypeScript typings.${NC}"
    exit 1
fi
cd ..

# Step 3: Setup Bundled JRE 17 (Windows x64)
echo -e "\n☕ ${YELLOW}[3/5] Resolving Bundled JRE for Standalone Desktop execution...${NC}"
if bash setup-jre.sh; then
    echo -e "${GREEN}✓ JRE successfully integrated!${NC}"
else
    echo -e "${RED}[ERROR] JRE setup failed. See errors above.${NC}"
    exit 1
fi

# Step 4: Install Electron Wrapper Dependencies at Root
echo -e "\n📦 ${YELLOW}[4/5] Installing Electron Packaging Dependencies...${NC}"
if npm install; then
    echo -e "${GREEN}✓ Node modules installed successfully!${NC}"
else
    echo -e "${RED}[ERROR] Npm install failed. Verify internet connection.${NC}"
    exit 1
fi

# Step 5: Run electron-builder to pack Windows & Mac apps
echo -e "\n⚙️  ${YELLOW}[5/5] Bundling Standalone Desktop Installers (.exe & .dmg)...${NC}"

# Ensure both JRE folders exist
if [ ! -d "jre-win/bin" ]; then
    echo -e "${YELLOW}Warning: jre-win/bin not found. Running setup-jre.sh...${NC}"
    bash setup-jre.sh
fi
if [ ! -d "jre-mac/bin" ]; then
    echo -e "${YELLOW}Warning: jre-mac/bin not found. Running setup-jre-mac.sh...${NC}"
    bash setup-jre-mac.sh
fi

echo -e "\n🛠️  Packaging Windows (.exe)..."
BUILD_WIN=false
if npx electron-builder --win --x64; then
    BUILD_WIN=true
    echo -e "${GREEN}✓ Windows installer generated!${NC}"
else
    echo -e "${RED}[ERROR] Windows packaging failed.${NC}"
fi

echo -e "\n🛠️  Packaging macOS (.dmg)..."
BUILD_MAC=false
if npx electron-builder --mac --arm64; then
    BUILD_MAC=true
    echo -e "${GREEN}✓ macOS DMG generated!${NC}"
else
    echo -e "${RED}[ERROR] macOS packaging failed.${NC}"
fi

echo -e "\n${TEAL}================================================================${NC}"
echo -e "   🎉 ${GREEN}Desktop Packaging Pipeline Execution Complete!${NC}"
echo -e "${TEAL}================================================================${NC}"
echo -e "  📁 ${BLUE}Output folder${NC}: dist-desktop/"
if [ "$BUILD_WIN" = true ]; then
    echo -e "  🖥️  ${GREEN}Windows Setup${NC}: dist-desktop/ArpitaMedical-1.0.0-win-x64.exe"
fi
if [ "$BUILD_MAC" = true ]; then
    echo -e "  🍎 ${GREEN}macOS DMG${NC}:    dist-desktop/ArpitaMedical-1.0.0-mac-arm64.dmg"
fi
echo -e "${TEAL}================================================================${NC}"

# Simple post-build verification
echo -e "\n🔍 ${YELLOW}Running post-build validation checks...${NC}"
if [ "$BUILD_WIN" = true ] && [ -f "dist-desktop/ArpitaMedical-1.0.0-win-x64.exe" ]; then
    echo -e "  ${GREEN}✓ Windows Setup Installer exists.${NC}"
else
    echo -e "  ${RED}✗ Windows Setup Installer is missing or failed.${NC}"
fi

if [ "$BUILD_MAC" = true ] && [ -f "dist-desktop/ArpitaMedical-1.0.0-mac-arm64.dmg" ]; then
    echo -e "  ${GREEN}✓ macOS DMG Installer exists.${NC}"
else
    echo -e "  ${RED}✗ macOS DMG Installer is missing or failed.${NC}"
fi

if [ "$BUILD_WIN" = false ] || [ "$BUILD_MAC" = false ]; then
    exit 1
fi

echo -e "${GREEN}✓ All desktop installer checks complete!${NC}"
exit 0
