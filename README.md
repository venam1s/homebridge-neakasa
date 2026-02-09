# Homebridge Neakasa Plugin

[![npm version](https://badge.fury.io/js/homebridge-neakasa.svg)](https://badge.fury.io/js/homebridge-neakasa)
[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)

Homebridge plugin for Neakasa M1 Cat Litter Box. This plugin allows you to monitor and control your Neakasa litter box through Apple HomeKit.

This is a TypeScript/Node.js conversion of the [Home Assistant Neakasa Integration](https://github.com/timniklas/hass-neakasa) by [@timniklas](https://github.com/timniklas).

## Features

### Sensors
- **Litter Level** - Shows sand/litter level percentage with low indicator
- **Bin Full** - Binary sensor indicating when the waste bin is full

### Switches
- **Auto Clean** - Enable/disable automatic cleaning
- **Child Lock** - Enable/disable child safety lock
- **Auto Cover** - Enable/disable automatic litter coverage
- **Auto Leveling** - Enable/disable automatic sand leveling
- **Silent Mode** - Enable/disable quiet operation mode
- **Unstoppable Cycle** - Enable/disable uninterruptible cleaning cycles

### Buttons (Stateless Switches)
- **Clean Now** - Trigger an immediate cleaning cycle
- **Level Now** - Trigger an immediate sand leveling cycle

## Supported Devices

- Neakasa M1 Cat Litter Box

## Installation

### Option 1: Homebridge UI (Recommended)

1. Search for "Neakasa" in the Homebridge Config UI X plugin search
2. Click Install
3. Configure your credentials in the plugin settings
4. Restart Homebridge

### Option 2: Manual Installation

```bash
npm install -g homebridge-neakasa
```

## Configuration

Add the following to your Homebridge `config.json`:

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

### Configuration Options

| Option | Required | Default | Description |
|--------|----------|---------|-------------|
| `platform` | Yes | `"Neakasa"` | Must be "Neakasa" |
| `name` | Yes | `"Neakasa"` | Name for the platform |
| `username` | Yes | - | Your Neakasa account email |
| `password` | Yes | - | Your Neakasa account password |
| `pollInterval` | No | `60` | How often to check for updates (in seconds) |
| `debug` | No | `false` | Enable debug logging |

## Usage

Once configured, your Neakasa litter box will appear in the Home app as an accessory with multiple controls:

### Monitoring
- **Litter Level**: Check the current litter level percentage
- **Bin Status**: See if the waste bin needs to be emptied

### Controls
- Turn on/off various automation features through switches
- Trigger manual cleaning or leveling cycles

### Automation Ideas
- Get notified when the bin is full
- Get notified when litter is low
- Automatically turn on silent mode at night
- Create scenes that include litter box settings

## Troubleshooting

### "Failed to connect" errors

1. Verify your username and password are correct
2. Make sure you can log into the Neakasa mobile app with the same credentials
3. Check your internet connection
4. Enable debug logging to see detailed error messages

### Devices not appearing

1. Make sure your litter box is online in the Neakasa app
2. Restart Homebridge after adding credentials
3. Check the Homebridge logs for any errors
4. Try removing and re-adding the platform configuration

### State not updating

1. Check the `pollInterval` setting - increase it if you're seeing rate limit errors
2. Verify the device is online in the Neakasa mobile app
3. Restart Homebridge

## Development

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/homebridge-neakasa.git
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

- Original Home Assistant integration by [@timniklas](https://github.com/timniklas) - [hass-neakasa](https://github.com/timniklas/hass-neakasa)
- Converted to Homebridge plugin by Claude AI

## Disclaimer

This plugin is not officially endorsed or supported by Neakasa. Use at your own risk and ensure you comply with all relevant terms of service and privacy policies.

## License

MIT

## Support

If you find this plugin helpful, please consider:
- Starring the repository on GitHub
- Reporting issues and bugs
- Contributing improvements

For issues and feature requests, please use the [GitHub Issues](https://github.com/YOUR_USERNAME/homebridge-neakasa/issues) page.
