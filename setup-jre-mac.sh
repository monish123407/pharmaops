#!/bin/bash

# ================================================================
# Download Adoptium Temurin JRE 17 (macOS arm64) for bundling
# with the Electron macOS DMG installer.
# ================================================================

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
TEAL='\033[0;36m'
NC='\033[0m'

JRE_MAJOR_VERSION="17"
JRE_FULL_VERSION="17.0.13+11"
JRE_ARCHIVE_NAME="OpenJDK17U-jre_aarch64_mac_hotspot_17.0.13_11"
JRE_URL="https://github.com/adoptium/temurin17-binaries/releases/download/jdk-${JRE_FULL_VERSION}/${JRE_ARCHIVE_NAME}.tar.gz"
JRE_DIR="./jre-mac"

echo -e "${TEAL}================================================================${NC}"
echo -e "${TEAL}     ☕ Adoptium JRE ${JRE_MAJOR_VERSION} Download (macOS arm64)        ${NC}"
echo -e "${TEAL}================================================================${NC}"

if [ -d "$JRE_DIR/bin" ]; then
    echo -e "${GREEN}✓ JRE already exists at ${JRE_DIR}/. Skipping download.${NC}"
    exit 0
fi

TEMP_DIR=$(mktemp -d)
TEMP_TAR="${TEMP_DIR}/jre.tar.gz"

echo -e "\n${YELLOW}⬇ Downloading macOS JRE from Adoptium...${NC}"
if curl -L --progress-bar -o "$TEMP_TAR" "$JRE_URL"; then
    echo -e "${GREEN}✓ Download complete!${NC}"
else
    echo -e "${RED}[ERROR] Failed to download JRE.${NC}"
    rm -rf "$TEMP_DIR"
    exit 1
fi

echo -e "\n${YELLOW}📦 Extracting JRE...${NC}"
if tar -xzf "$TEMP_TAR" -C "$TEMP_DIR"; then
    echo -e "${GREEN}✓ Extraction complete!${NC}"
else
    echo -e "${RED}[ERROR] Failed to extract JRE archive.${NC}"
    rm -rf "$TEMP_DIR"
    exit 1
fi

# Find the Home directory inside the extracted JRE bundle
JRE_HOME=$(find "$TEMP_DIR" -type d -path "*/Contents/Home" | head -1)

if [ -z "$JRE_HOME" ]; then
    echo -e "${RED}[ERROR] Could not find Contents/Home inside extracted folder.${NC}"
    rm -rf "$TEMP_DIR"
    exit 1
fi

rm -rf "$JRE_DIR"
mkdir -p "$JRE_DIR"

# Move JRE Contents/Home files into the root of jre-mac
mv "$JRE_HOME"/* "$JRE_DIR/"

rm -rf "$TEMP_DIR"

if [ -f "$JRE_DIR/bin/java" ]; then
    chmod +x "$JRE_DIR/bin/java"
    echo -e "\n${GREEN}✓ JRE ${JRE_MAJOR_VERSION} successfully set up for macOS bundling!${NC}"
else
    echo -e "${RED}[ERROR] java binary not found in $JRE_DIR/bin/${NC}"
    exit 1
fi
