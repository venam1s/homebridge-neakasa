# Changelog

All notable changes to this project will be documented in this file.

## [1.6.0] - 2026-02-25

### Added
- Advanced startup controls: `startupBehavior` (`immediate` / `skipInitialUpdate`) and `startupDelaySeconds`.
- Per-device overrides (`deviceOverrides`) with support for `name`, `hidden`, per-device `pollInterval`, and per-feature visibility overrides.
- Startup diagnostics log line showing effective startup polling settings.
- Boot-time detected devices summary including mapped features, hidden state, and effective poll interval.

### Changed
- Polling scheduler now supports mixed per-device polling intervals in one platform instance.
- Config validation and sanitization now warn on invalid values and duplicate/unknown override entries.
- Config UI schema and README updated for new startup and per-device override options.

## [1.5.1] - 2026-02-20

### Fixed
- Config schema: moved `required` from individual field properties to an array at the object level, per JSON Schema spec.

## [1.5.0] - 2026-02-20

### Added
- **Fault Alert sensor** — optional Motion Sensor that triggers when the device reports a fault (`bucketStatus` 6 = Panels Missing, 7 = Interrupted). Enable via Optional Sensors in the config UI.
- Logs a warning to the Homebridge log when a fault is detected.

### Changed
- Characteristics now only update in HomeKit when the value actually changes (debounce), preventing spurious notifications on every poll cycle.

### Fixed
- Plugin icon replaced with proper 512×512px version for correct display in Homebridge UI.

## [1.4.0] - 2026-02-11

### Added
- **Imperial/Metric unit preference** — new `useImperialUnits` config option displays cat weight in pounds instead of kilograms (e.g., 11% = 11 lbs vs. 5% = 5 kg).

## [1.3.0] - 2026-02-11

### Added
- **Cat Present sensor** — core OccupancySensor that detects when a cat is in the litter box (`bucketStatus === 4`).
- **Child Lock as Lock** — converted from a Switch to a proper LockMechanism; displays as a lock icon in the Home app.
- **Sand Level State sensor** — optional ContactSensor showing detailed litter level (Insufficient, Moderate, Sufficient, Overfilled).
- Custom plugin icon displayed in Homebridge Config UI X.
- GitHub Actions workflow for automated npm publishing on release.
- `package-lock.json` for reliable CI builds.

### Changed
- Overhauled README with full feature tables, all config options, and automation ideas.

## [1.2.1] - 2026-02-10

### Added
- Descriptions added to all config options in Homebridge UI.
- HomeKit type disclaimers for sensors that appear as non-obvious types (Humidity Sensor, Leak Sensor).

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
