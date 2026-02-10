# Changelog

All notable changes to this project will be documented in this file.

## [1.2.0] - 2026-02-09

### Fixed
- Service naming: add `ConfiguredName` characteristic so HomeKit shows distinct tile labels instead of all "Neakasa M1"

### Changed
- Simplified default accessories to 6 core items: Waste Bin Full, Auto Clean, Clean Now, Level Now, Status, Litter Level
- All other switches and sensors are now opt-in via config (off by default)
- Config UI split into "Optional Switches" and "Optional Sensors" sections
- Status sensor and Litter Level are now always-on core services

## [1.1.0] - 2026-02-09

### Fixed
- Auth flow: use correct `/account/createSessionByAuthCode` endpoint for IoT token
- Auth flow: fix SID extraction path from login response
- Auth flow: use signed IoT client for `loginbyoauth.json` instead of unsigned axios call

### Added
- New switches: Auto Recovery, Young Cat Mode
- Status sensor (ContactSensor): shows device state (Idle, Cleaning, Leveling, Cat Present, etc.)
- Bin State sensor (LeakSensor): alerts when waste bin is full or missing
- WiFi Signal sensor (HumiditySensor): shows signal strength as percentage
- Per-cat weight sensors (HumiditySensor): shows latest weight for each registered cat
- Configurable device name (default: "Neakasa M1")
- Config UI toggles for all optional sensors
- Expanded keywords for Homebridge plugin repository discoverability

### Changed
- Renamed device display name from serial number to "Neakasa M1"
- Renamed "Auto Cover" switch to "Auto Bury"
- Renamed "Auto Leveling" switch to "Auto Level"
- Renamed "Bin Full" sensor to "Waste Bin Full"
- Refactored switch creation into reusable helper method
- Cleaned up git repo: removed dist/ tracking overhead, updated .gitignore/.npmignore

## [1.0.0] - 2026-02-08

### Added
- Initial release
- Support for Neakasa M1 Cat Litter Box
- Monitor litter level and bin status
- Control auto-clean, child lock, auto cover, auto leveling, silent mode, and unstoppable cycle
- Manual clean and level triggers
- Automatic API reconnection on authentication errors
- Configurable polling interval
- Debug logging support
