#!/bin/bash

# ================================================================
# Download Adoptium Temurin JRE 17 (Windows x64) for bundling
# with the Electron desktop application installer.
#
# This script downloads a pre-built JRE from Eclipse Adoptium
# and extracts it into ./jre/ for electron-builder to bundle
# as an extraResource.
#
# Run this ONCE before the first desktop build:
#   bash setup-jre.sh
# ================================================================

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
TEAL='\033[0;36m'
NC='\033[0m'

# JRE version config
JRE_MAJOR_VERSION="17"
JRE_FULL_VERSION="17.0.13+11"
JRE_ARCHIVE_NAME="OpenJDK17U-jre_x64_windows_hotspot_17.0.13_11"
JRE_URL="https://github.com/adoptium/temurin17-binaries/releases/download/jdk-${JRE_FULL_VERSION}/${JRE_ARCHIVE_NAME}.zip"
JRE_DIR="./jre-win"

echo -e "${TEAL}================================================================${NC}"
echo -e "${TEAL}     ☕ Adoptium JRE ${JRE_MAJOR_VERSION} Download (Windows x64)       ${NC}"
echo -e "${TEAL}================================================================${NC}"

# Check if JRE is already present
if [ -d "$JRE_DIR/bin" ]; then
    echo -e "${GREEN}✓ JRE already exists at ${JRE_DIR}/. Skipping download.${NC}"
    echo -e "  To re-download, delete the ${JRE_DIR}/ directory first."
    exit 0
fi

# Create temp dir for download
TEMP_DIR=$(mktemp -d)
TEMP_ZIP="${TEMP_DIR}/jre.zip"

echo -e "\n${YELLOW}⬇ Downloading JRE from Adoptium...${NC}"
echo -e "  URL: ${JRE_URL}"

if curl -L --progress-bar -o "$TEMP_ZIP" "$JRE_URL"; then
    echo -e "${GREEN}✓ Download complete!${NC}"
else
    echo -e "${RED}[ERROR] Failed to download JRE. Check internet connection.${NC}"
    rm -rf "$TEMP_DIR"
    exit 1
fi

echo -e "\n${YELLOW}📦 Extracting JRE...${NC}"
if unzip -q "$TEMP_ZIP" -d "$TEMP_DIR"; then
    echo -e "${GREEN}✓ Extraction complete!${NC}"
else
    echo -e "${RED}[ERROR] Failed to extract JRE archive.${NC}"
    rm -rf "$TEMP_DIR"
    exit 1
fi

# Move extracted JRE into project (strip top-level folder)
JRE_EXTRACTED=$(find "$TEMP_DIR" -maxdepth 1 -type d -name "jdk*" | head -1)

if [ -z "$JRE_EXTRACTED" ]; then
    echo -e "${RED}[ERROR] Could not find extracted JRE directory.${NC}"
    rm -rf "$TEMP_DIR"
    exit 1
fi

# Clean existing JRE directory and move new one
rm -rf "$JRE_DIR"
mv "$JRE_EXTRACTED" "$JRE_DIR"

# Cleanup temp files
rm -rf "$TEMP_DIR"

# Verify
if [ -f "$JRE_DIR/bin/java.exe" ]; then
    JRE_SIZE=$(du -sh "$JRE_DIR" | cut -f1)
    echo -e "\n${GREEN}================================================================${NC}"
    echo -e "  ${GREEN}✓ JRE ${JRE_MAJOR_VERSION} ready for bundling!${NC}"
    echo -e "  📁 Location: ${JRE_DIR}/"
    echo -e "  📏 Size: ${JRE_SIZE}"
    echo -e "${GREEN}================================================================${NC}"
else
    echo -e "${RED}[ERROR] java.exe not found in extracted JRE. Archive may be corrupt.${NC}"
    exit 1
fi
