# Homebridge Neakasa Plugin

[![verified-by-homebridge](https://img.shields.io/badge/_-verified-blueviolet?color=%23491F59&style=flat&logoColor=%23FFFFFF&logo=homebridge)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins) [![npm version](https://badge.fury.io/js/homebridge-neakasa.svg)](https://badge.fury.io/js/homebridge-neakasa)

Homebridge plugin for the **Neakasa M1 Cat Litter Box**. Monitor and control your smart litter box through Apple HomeKit.

Ported from the [Home Assistant Neakasa Integration](https://github.com/timniklas/hass-neakasa) by [@timniklas](https://github.com/timniklas).

For the fastest install + setup flow, use the [Quickstart Guide](./QUICKSTART.md).

## Features

### Core Services (always shown)

| Service | HomeKit Type | Description |
|---------|-------------|-------------|
| **Cat Present** | Occupancy Sensor | Detects when a cat is in the litter box |
| **Waste Bin Full** | Occupancy Sensor | Alerts when the waste bin needs emptying |
| **Status** | Contact Sensor | Shows device state (Idle, Cleaning, Cat Present, etc.) |
| **Litter Level** | Filter Maintenance | Sand level percentage with low-level alert |
| **Auto Clean** | Switch | Toggle automatic cleaning on/off |
| **Auto Level + Clean** | Switch | Toggle auto clean and auto level together |
| **Clean Now** | Switch (button) | Trigger an immediate cleaning cycle |
| **Level Now** | Switch (button) | Trigger an immediate sand leveling cycle |

### Optional Switches (off by default)

| Switch | Description |
|--------|-------------|
| **Child Lock** | Prevents manual operation (shows as a Lock in HomeKit) |
| **Empty Bin** | Marks the waste bin as emptied (requires 2 taps within 10s to confirm) |
| **Auto Bury** | Automatically covers waste after cat use |
| **Auto Level** | Automatically levels litter after cleaning |
| **Silent Mode** | Reduces motor noise during operation |
| **Unstoppable Cycle** | Cleaning cycle won't pause if interrupted |
| **Auto Recovery** | Automatically resumes after an interruption |
| **Young Cat Mode** | Adjusts timing for kittens and young cats |

### Optional Sensors (off by default)

| Sensor | HomeKit Type | Description |
|--------|-------------|-------------|
| **Bin State** | Leak Sensor | Detailed bin status (Normal, Full, Missing) |
| **WiFi Signal** | Humidity Sensor | Device WiFi signal strength as percentage |
| **Cat Weight** | Humidity Sensor | Per-cat weight tracking (one sensor per cat) |
| **Sand Level State** | Contact Sensor | Detailed level (Insufficient, Moderate, Sufficient, Overfilled) |
| **Fault Alert** | Motion Sensor | Alerts when the device is stuck or faulted (Panels Missing, Interrupted) |

> **Note:** WiFi Signal and Cat Weight sensors appear as Humidity Sensors in HomeKit because HomeKit has no generic number sensor type. This is a common Homebridge workaround.

> **Note:** The Fault Alert sensor uses Motion Sensor — "motion detected" means a fault is active. Use it to trigger HomeKit notifications or automations when the device jams or loses its panels.

#### Cat Weight Sensors

Cat weight is displayed as a percentage (%) value in HomeKit due to the humidity sensor workaround. By default, weights are shown in **kilograms** (e.g., 5% = 5 kg ≈ 11 lbs).

You can enable **Imperial Units** to display weights in **pounds** instead (e.g., 11% = 11 lbs ≈ 5 kg):

```json
{
  "showCatSensors": true,
  "useImperialUnits": true
}
```

## Supported Devices

- Neakasa M1 Cat Litter Box

## Installation

For guided setup (install, configure, verify), see the [Quickstart Guide](./QUICKSTART.md).

### Homebridge UI

1. Search for **"Neakasa"** in the Homebridge Config UI X plugin search
2. Click Install
3. Configure your Neakasa account credentials in the plugin settings
4. Restart Homebridge

### Command Line

```bash
npm install -g homebridge-neakasa
```

## Configuration

Add the following to your Homebridge `config.json`, or use the Config UI settings page:

```json
{
  "platforms": [
    {
      "platform": "Neakasa",
      "name": "Neakasa",
      "username": "your@email.com",
      "password": "your_password",
      "pollInterval": 60,
      "startupBehavior": "immediate",
      "startupDelaySeconds": 0,
      "deviceOverrides": [],
      "debug": false
    }
  ]
}
```

### Configuration Options

| Option | Required | Default | Description |
|--------|----------|---------|-------------|
| `platform` | Yes | `"Neakasa"` | Must be "Neakasa" |
| `name` | Yes | `"Neakasa"` | Name for the platform |
| `username` | Yes | — | Your Neakasa account email |
| `password` | Yes | — | Your Neakasa account password |
| `deviceName` | No | `"Neakasa M1"` | Display name in HomeKit |
| `pollInterval` | No | `60` | Update interval in seconds (min: 30) |
| `startupBehavior` | No | `"immediate"` | Startup refresh mode: `immediate` or `skipInitialUpdate` |
| `startupDelaySeconds` | No | `0` | Delay initial refresh at startup (seconds) |
| `deviceOverrides` | No | `[]` | Per-device overrides by `iotId` for name, hidden status, polling, and feature flags |
| `debug` | No | `false` | Enable debug logging |
| `showChildLock` | No | `false` | Show Child Lock (Lock) |
| `showEmptyBin` | No | `false` | Show Empty Bin action switch (2-tap confirm within 10s) |
| `showAutoBury` | No | `false` | Show Auto Bury switch |
| `showAutoLevel` | No | `false` | Show Auto Level switch |
| `showSilentMode` | No | `false` | Show Silent Mode switch |
| `showUnstoppableCycle` | No | `false` | Show Unstoppable Cycle switch |
| `showAutoRecovery` | No | `false` | Show Auto Recovery switch |
| `showYoungCatMode` | No | `false` | Show Young Cat Mode switch |
| `showBinStateSensor` | No | `false` | Show Bin State sensor |
| `showWifiSensor` | No | `false` | Show WiFi Signal sensor |
| `showCatSensors` | No | `false` | Show per-cat weight sensors |
| `showSandLevelSensor` | No | `false` | Show Sand Level State sensor |
| `showFaultSensor` | No | `false` | Show Fault Alert sensor (Motion Sensor) |
| `useImperialUnits` | No | `false` | Display cat weight in lbs instead of kg |

### Per-Device Overrides Example

```json
{
  "platform": "Neakasa",
  "name": "Neakasa",
  "username": "your@email.com",
  "password": "your_password",
  "pollInterval": 60,
  "startupBehavior": "immediate",
  "startupDelaySeconds": 5,
  "deviceOverrides": [
    {
      "iotId": "abcdef123456",
      "name": "Upstairs Litter Box",
      "hidden": false,
      "pollInterval": 30,
      "showFaultSensor": true,
      "showWifiSensor": true,
      "showCatSensors": false
    }
  ]
}
```

## HomeKit Automation Ideas

| Trigger | Sensor | Use Case |
|---------|--------|----------|
| Cat enters the box | Cat Present (Occupancy) | Turn on a light, log activity |
| Waste bin is full | Waste Bin Full (Occupancy) | Send notification |
| Litter is low | Litter Level (Filter Maintenance) | Send notification |
| Cleaning complete | Status returns to Closed (Idle) | Send notification |
| Nighttime | Schedule | Enable Silent Mode switch |
| Device is stuck/jammed | Fault Alert (Motion) | Send notification |

## Troubleshooting

### "Failed to connect" errors

1. Verify your username and password are correct
2. Make sure you can log into the Neakasa mobile app with the same credentials
3. Check your internet connection
4. If running in Docker, ensure DNS is configured (e.g. `dns: [8.8.8.8, 1.1.1.1]` in docker-compose)
5. Enable debug logging to see detailed error messages

### Devices not appearing

1. Make sure your litter box is online in the Neakasa app
2. Restart Homebridge after adding credentials
3. Check the Homebridge logs for any errors

### State not updating

1. Check the `pollInterval` setting — default is 60 seconds
2. Verify the device is online in the Neakasa mobile app
3. Restart Homebridge

## Development

```bash
# Clone the repository
git clone https://github.com/havuq/homebridge-neakasa.git
cd homebridge-neakasa

# Install dependencies
npm install

# Build the plugin
npm run build

# Link for local testing
npm link

# Watch for changes
npm run watch
```

## Credits

- Original Home Assistant integration by [@timniklas](https://github.com/timniklas) — [hass-neakasa](https://github.com/timniklas/hass-neakasa)

## Disclaimer

This plugin is not officially endorsed or supported by Neakasa. Use at your own risk.

## License

MIT

## Support

If you find this plugin helpful, please consider:
- Starring the repository on GitHub
- Reporting issues and bugs
- Contributing improvements

For issues and feature requests, please use the [GitHub Issues](https://github.com/havuq/homebridge-neakasa/issues) page.
