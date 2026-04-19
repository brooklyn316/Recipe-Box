#!/bin/bash
set -e

GREEN='\033[0;32m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

clear
echo ""
echo -e "${BOLD}🍳  Recipe Box — Build${RESET}"
echo "──────────────────────────────────"
echo ""

# Step 1: Install / update npm packages
echo -e "${CYAN}Step 1/5 — Installing npm packages...${RESET}"
npm install
echo -e "${GREEN}✓ Packages installed${RESET}"
echo ""

# Step 2: Generate the iOS project
echo -e "${CYAN}Step 2/5 — Generating iOS project...${RESET}"
npx expo prebuild --platform ios --clean
echo -e "${GREEN}✓ iOS project generated${RESET}"
echo ""

# Step 3: Install CocoaPods
echo -e "${CYAN}Step 3/5 — Installing CocoaPods (this takes a few minutes)...${RESET}"
cd ios && pod install && cd ..
echo -e "${GREEN}✓ CocoaPods installed${RESET}"
echo ""

# Step 4: Patch expo-dev-menu for Xcode 26
# TARGET_IPHONE_SIMULATOR was removed in Xcode 26
echo -e "${CYAN}Step 4/5 — Patching for Xcode 26 compatibility...${RESET}"
SWIFT_FILE="ios/Pods/expo-dev-menu/ios/DevMenuViewController.swift"
if [ -f "$SWIFT_FILE" ]; then
  sed -i '' \
    's/let isSimulator = TARGET_IPHONE_SIMULATOR > 0/let isSimulator = ProcessInfo.processInfo.environment["SIMULATOR_DEVICE_NAME"] != nil/g' \
    "$SWIFT_FILE"
  echo -e "${GREEN}✓ Patched expo-dev-menu${RESET}"
else
  echo "  (no patch needed)"
fi
echo ""

# Step 5: Clear Xcode build cache so it compiles fresh
echo -e "${CYAN}Step 5/5 — Clearing Xcode build cache...${RESET}"
rm -rf ~/Library/Developer/Xcode/DerivedData/RecipeBox*
echo -e "${GREEN}✓ Build cache cleared${RESET}"
echo ""

# Step 5: Build and install on device
echo -e "${CYAN}Step 5/5 — Building and installing on your iPhone...${RESET}"
echo ""
echo "Make sure your iPhone is plugged in and unlocked."
echo ""
npx expo run:ios --device

echo ""
echo -e "${GREEN}${BOLD}✓ Done! Recipe Box is installed on your iPhone.${RESET}"
echo ""
echo "Next time just run:  npx expo start"
echo ""
