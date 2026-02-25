# Homebridge Neakasa - Quickstart

Use this guide to install and configure `homebridge-neakasa` in a few minutes.

## Requirements

- Node.js 18+
- Homebridge 1.6.0+
- A Neakasa account with an M1 device already set up in the Neakasa app

## Install

### Option 1: Homebridge UI (recommended)

1. Open Homebridge Config UI X.
2. Go to `Plugins`.
3. Search for `Neakasa` or `homebridge-neakasa`.
4. Click `Install`.

### Option 2: Command line

```bash
npm install -g homebridge-neakasa
```

## Configure

### Homebridge UI

1. Open the plugin `Settings`.
2. Enter your Neakasa `username` (email) and `password`.
3. Save.
4. Restart Homebridge.

### `config.json`

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

## Verify

After restart, check Homebridge logs for:

- `Successfully connected to Neakasa API`
- `Found ... device(s)`

Then open Apple Home and confirm the accessory appears and updates.

## If Something Fails

- Confirm app login works with the same credentials.
- Verify the device is online in the Neakasa app.
- Enable `debug` in plugin config and restart Homebridge.
- If running in Docker, set DNS servers (for example `8.8.8.8` and `1.1.1.1`).

## More Details

For full options and troubleshooting, see [README.md](./README.md).
