#!/bin/bash
# ──────────────────────────────────────────────
#  Recipe Box — one-time setup for Mac + iPhone
# ──────────────────────────────────────────────

set -e

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RESET='\033[0m'

clear
echo ""
echo -e "${BOLD}🍳  Recipe Box — Setup${RESET}"
echo "──────────────────────────────────"
echo ""

# ── Step 1: Install JS packages ───────────────

echo -e "${CYAN}Step 1 of 2 — Installing packages${RESET}"
echo "This takes about a minute..."
echo ""
npm install
echo ""
echo -e "${GREEN}✓ Packages ready${RESET}"
echo ""

# ── Step 2: Check Xcode CLI tools ────────────

echo -e "${CYAN}Checking Xcode command-line tools...${RESET}"
if ! xcode-select -p &>/dev/null; then
  echo ""
  echo "Installing Xcode command-line tools (one-time, may take a few minutes)..."
  xcode-select --install
  echo "Once the installer finishes, run this script again."
  exit 0
fi
echo -e "${GREEN}✓ Xcode tools ready${RESET}"
echo ""

# ── Step 3: Connect iPhone ────────────────────

echo -e "${BOLD}Step 2 of 2 — Build and install on your iPhone${RESET}"
echo ""
echo "Please do the following before pressing Enter:"
echo ""
echo -e "  ${YELLOW}1.${RESET} Plug your iPhone into your Mac with a USB cable"
echo -e "  ${YELLOW}2.${RESET} Unlock your iPhone"
echo -e "  ${YELLOW}3.${RESET} If a pop-up appears saying ${BOLD}\"Trust This Computer?\"${RESET} — tap ${BOLD}Trust${RESET}"
echo ""
read -rp "Press Enter when your iPhone is plugged in and unlocked → "
echo ""

echo -e "${CYAN}Building now — this takes 5–10 minutes the first time.${RESET}"
echo "Xcode will run in the background. Your app installs automatically when done."
echo ""

# ── Step 4: Build + install ───────────────────

npx expo run:ios --device

# ── Done ──────────────────────────────────────

echo ""
echo -e "${GREEN}${BOLD}✓ Recipe Box is installed on your iPhone!${RESET}"
echo ""
echo "Next time you want to run it, just type:"
echo ""
echo -e "  ${CYAN}npx expo start${RESET}"
echo ""
echo "Then open the Recipe Box app on your phone — it connects automatically."
echo ""
