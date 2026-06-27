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

# Step 5: Run electron-builder to pack the Windows app
echo -e "\n⚙️  ${YELLOW}[5/5] Bundling Standalone Windows Setup Installer (.exe)...${NC}"
if npx electron-builder --win --x64; then
    echo -e "\n${GREEN}================================================================${NC}"
    echo -e "   🎉 ${GREEN}SUCCESS! Arpita Medical Desktop Setup Installer is generated!${NC}"
    echo -e "${TEAL}================================================================${NC}"
    echo -e "  📁 ${BLUE}Installer Output folder${NC}: dist-desktop/"
    echo -e "  🖥️  ${BLUE}Setup Installer file${NC}: dist-desktop/ArpitaMedical-Setup-1.0.0.exe"
    echo -e "  ℹ️  ${BLUE}Uninstaller${NC}: Registered in Windows Control Panel under 'Arpita Medical Pharmacy Suite'"
    echo -e "${TEAL}================================================================${NC}"
    
    # Simple post-build verification
    echo -e "\n🔍 ${YELLOW}Running post-build validation checks...${NC}"
    if [ -f "dist-desktop/ArpitaMedical-Setup-1.0.0.exe" ]; then
        echo -e "  ${GREEN}✓ Setup Installer file exists.${NC}"
    else
        echo -e "  ${RED}✗ Setup Installer file is missing!${NC}"
        exit 1
    fi
    
    if [ -f "dist-desktop/win-unpacked/resources/backend.jar" ]; then
        echo -e "  ${GREEN}✓ Backend JAR is bundled inside extraResources.${NC}"
    else
        echo -e "  ${RED}✗ Backend JAR is missing from extraResources!${NC}"
        exit 1
    fi
    
    if [ -f "dist-desktop/win-unpacked/resources/jre/bin/java.exe" ]; then
        echo -e "  ${GREEN}✓ Adoptium JRE is bundled inside extraResources.${NC}"
    else
        echo -e "  ${RED}✗ JRE is missing from extraResources!${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✓ All post-build validation checks passed!${NC}"
else
    echo -e "${RED}[ERROR] Electron packaging failed. Verify package.json build configurations.${NC}"
    exit 1
fi
