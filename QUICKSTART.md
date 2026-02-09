# Homebridge Neakasa - Quick Start Guide

This guide will help you get the Neakasa plugin up and running quickly.

## Prerequisites

- Node.js v18 or higher
- Homebridge v1.6.0 or higher
- A Neakasa account with at least one M1 litter box registered
- Access to the Neakasa mobile app (for verification)

## Installation Steps

### 1. Install the Plugin

**Via Homebridge UI:**
1. Open Homebridge Config UI X
2. Navigate to the "Plugins" tab
3. Search for "homebridge-neakasa"
4. Click "Install"

**Via Command Line:**
```bash
npm install -g homebridge-neakasa
```

### 2. Configure the Plugin

**Via Homebridge UI:**
1. After installation, click "Settings" on the plugin card
2. Enter your Neakasa email and password
3. (Optional) Adjust the poll interval (default: 60 seconds)
4. (Optional) Enable debug logging if troubleshooting
5. Click "Save"

**Via config.json:**
Add this to your Homebridge config:
```json
{
  "platforms": [
    {
      "platform": "Neakasa",
      "name": "Neakasa",
      "username": "your@email.com",
      "password": "your_password",
      "pollInterval": 60,
      "debug": false
    }
  ]
}
```

### 3. Restart Homebridge

**Via Homebridge UI:**
- Click the "Restart" button in the top right corner

**Via Command Line:**
```bash
sudo systemctl restart homebridge
# or
sudo service homebridge restart
```

### 4. Add to Home App

After Homebridge restarts:
1. Open the Home app on your iOS device
2. Your Neakasa litter box should automatically appear
3. If not, tap "Add Accessory" and scan the Homebridge QR code
4. Accept any warnings about uncertified accessories

## Verifying Everything Works

1. **Check Homebridge Logs:**
   - Look for "Successfully connected to Neakasa API"
   - Look for "Found X device(s)"
   - Look for successful device updates

2. **In the Home App:**
   - You should see your litter box accessory
   - The litter level should display correctly
   - Try toggling a switch (like Silent Mode)
   - Verify the change appears in both Home app and Neakasa mobile app

## Common Issues

### "Failed to connect" Error
- Double-check your email and password
- Verify you can log into the Neakasa mobile app
- Make sure your Homebridge server has internet access

### Device Not Appearing
- Wait 1-2 minutes after restart
- Check Homebridge logs for errors
- Verify the device is online in the Neakasa app
- Try restarting Homebridge again

### States Not Updating
- Increase the poll interval if you see rate limit errors
- Verify your internet connection is stable
- Check that the device is responding in the Neakasa app

## What You'll See in HomeKit

Your litter box will appear with these controls:

**Sensors:**
- 🧼 Litter Level (shows percentage and low warning)
- 🗑️ Bin Full (alerts when waste bin needs emptying)

**Switches:**
- ♻️ Auto Clean
- 🔒 Child Lock
- 🏠 Auto Cover
- 📏 Auto Leveling
- 🔇 Silent Mode
- ⚙️ Unstoppable Cycle

**Action Buttons:**
- 🧹 Clean Now
- 📐 Level Now

## Next Steps

- Set up automations (e.g., notifications when bin is full)
- Add to scenes
- Create shortcuts for common tasks
- Adjust poll interval based on your needs (30-300 seconds recommended)

## Need Help?

- Enable debug logging in the plugin settings
- Check the full README.md for detailed troubleshooting
- Report issues at: https://github.com/YOUR_USERNAME/homebridge-neakasa/issues

## Tips

1. **Optimal Poll Interval:** 60 seconds balances responsiveness with API limits
2. **Notifications:** Set up Home app automations for bin full alerts
3. **Silent Mode Automation:** Create a time-based automation for night mode
4. **Multiple Accounts:** If sharing with family, create a separate Neakasa account for Homebridge

Enjoy your smart litter box! 🐱
