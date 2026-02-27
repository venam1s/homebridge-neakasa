# Switch and Sensor Details

This page explains what each HomeKit switch/sensor does in `homebridge-neakasa`, what config options control it, and an automation idea for each.

## Settings That Affect Multiple Items

| Setting | Default | Applies To | Meaning |
|---|---:|---|---|
| `pollInterval` | `60` | All switches/sensors | How often Homebridge refreshes state from Neakasa cloud |
| `catPresentLatchSeconds` | `240` | Cat Present | Keeps `Cat Present` active after a visit; `0` disables latch |
| `catVisitLatchSeconds` | `90` | Cat Visit | How long `Cat Visit` stays active after a visit; `0` disables |
| `recentlyUsedMinutes` | `15` | Recently Used | Time window for `Recently Used`; `0` disables |
| `recordDays` | `7` | Cat Weight sensors | Days of cat history fetched for latest weight records |
| `useImperialUnits` | `false` | Cat Weight sensors | Shows pounds instead of kilograms |
| `deviceOverrides[]` | `[]` | All optional features | Override names, polling, windows, and show/hide flags by `iotId` |

## Switch Details

## Core Switches (always shown)

### Auto Clean
- Description: Turns scheduled automatic cleaning on or off.

- HomeKit type: `Switch`
- Visibility option: always shown
- Behavior:
- `On`: enables scheduled automatic cleaning (`cleanCfg.active = 1`)
- `Off`: disables automatic cleaning (`cleanCfg.active = 0`)
- Automation example:
- Trigger: `Cat Present` turns off
- Condition: Time between 10:00 PM and 7:00 AM
- Action: Turn `Auto Clean` off (quiet overnight), then schedule another automation to turn it on in the morning

### Run Clean Cycle
- Description: Starts an immediate one-time cleaning cycle, then resets to off.

- HomeKit type: `Switch` (momentary action)
- Visibility option: always shown
- Behavior:
- Turning on sends a one-time "clean now" command, then switch resets to off
- If `Cat Present` is active, action is blocked for safety and no clean starts
- Automation example:
- Trigger: `Recently Used` turns on
- Condition: Delay 10 minutes and confirm `Cat Present` is off
- Action: Turn on `Run Clean Cycle`

### Run Leveling
- Description: Starts an immediate one-time sand leveling action, then resets to off.

- HomeKit type: `Switch` (momentary action)
- Visibility option: always shown
- Behavior:
- Turning on sends a one-time "sand leveling" command, then switch resets to off
- If `Cat Present` is active, action is blocked for safety
- Automation example:
- Trigger: `Litter Level` reports low/maintenance needed
- Action: Turn on `Run Leveling` to rebalance litter before manual top-up

## Optional Switches (all default `false`)

### Child Lock
- Description: Locks manual controls on the device to prevent accidental interaction.

- HomeKit type: `Lock Mechanism`
- Show option: `showChildLock`
- Behavior:
- `Secured`: child lock enabled (`childLockOnOff = 1`)
- `Unsecured`: child lock disabled (`childLockOnOff = 0`)
- Automation example:
- Trigger: Everyone leaves home
- Action: Set `Child Lock` to `Secured`

### Sync Auto Level With Auto Clean
- Description: Toggles Auto Clean and Auto Level together with a single switch.

- HomeKit type: `Switch`
- Show option: `showAutoLevelClean`
- Behavior:
- `On`: enables both `Auto Clean` and `Auto Level`
- `Off`: disables both together
- Automation example:
- Trigger: "Good Night" scene
- Action: Turn this switch off to disable both automations overnight

### Empty Bin
- Description: Marks the bin as emptied using a required double-tap confirmation.

- HomeKit type: `Switch` (two-step action)
- Show option: `showEmptyBin`
- Behavior:
- First tap arms confirmation for 10 seconds
- Second tap within 10 seconds confirms "bin emptied" action
- Automation example:
- Trigger: `Waste Bin Full` turns on
- Action: Send notification "Empty Neakasa bin and double-tap Empty Bin switch"

### Auto Bury
- Description: Automatically covers waste after cat use.

- HomeKit type: `Switch`
- Show option: `showAutoBury`
- Behavior:
- `On`: enables waste-covering behavior after use
- `Off`: disables it
- Automation example:
- Trigger: Bedtime scene
- Action: Turn `Auto Bury` on for cleaner overnight operation

### Auto Level
- Description: Automatically levels litter after clean cycles.

- HomeKit type: `Switch`
- Show option: `showAutoLevel`
- Behavior:
- `On`: enables automatic litter leveling after cycles
- `Off`: disables automatic leveling
- Automation example:
- Trigger: Morning scene
- Action: Turn `Auto Level` on

### Silent Mode
- Description: Reduces operating noise during clean and level cycles.

- HomeKit type: `Switch`
- Show option: `showSilentMode`
- Behavior:
- `On`: quieter operation mode
- `Off`: normal operation mode
- Automation example:
- Trigger: 10:00 PM every day
- Action: Turn `Silent Mode` on

### Unstoppable Cycle
- Description: Makes cycles less likely to pause when interrupted.

- HomeKit type: `Switch`
- Show option: `showUnstoppableCycle`
- Behavior:
- `On`: cycle is less likely to pause on interruptions (`bIntrptRangeDet = 1`)
- `Off`: normal interruption behavior
- Automation example:
- Trigger: Vacation mode scene
- Action: Turn `Unstoppable Cycle` on while away

### Auto Recovery
- Description: Automatically resumes after an interruption when possible.

- HomeKit type: `Switch`
- Show option: `showAutoRecovery`
- Behavior:
- `On`: auto-resume after interruption (`autoForceInit = 1`)
- `Off`: no auto-recovery
- Automation example:
- Trigger: `Fault Alert` turns off (fault cleared)
- Action: Turn `Auto Recovery` on to keep future cycles resilient

### Young Cat Mode
- Description: Uses timing behavior tuned for kittens and younger cats.

- HomeKit type: `Switch`
- Show option: `showYoungCatMode`
- Behavior:
- `On`: kitten/young-cat timing behavior
- `Off`: normal adult-cat behavior
- Automation example:
- Trigger: Manual scene "Kitten Mode"
- Action: Turn `Young Cat Mode` on

## Sensor Details

## Core Sensors (always shown)

### Cat Present
- Description: Shows whether a cat is currently detected, including optional latch time.

- HomeKit type: `Occupancy Sensor`
- Visibility option: always shown
- Related settings: `catPresentLatchSeconds`
- State meaning:
- Occupancy detected: cat currently detected, or within latch window after recent `catLeft`
- No occupancy: no active/latched cat presence
- Automation example:
- Trigger: `Cat Present` turns on
- Action: Turn on laundry room light for 5 minutes

### Waste Bin Full
- Description: Shows when the waste bin needs to be emptied or reset.

- HomeKit type: `Occupancy Sensor`
- Visibility option: always shown
- State meaning:
- Occupancy detected: bin is full / needs reset
- No occupancy: bin status normal
- Automation example:
- Trigger: `Waste Bin Full` turns on
- Action: Send critical notification

### Status
- Description: Maps current device state (idle/active/fault) into a HomeKit sensor.

- HomeKit type: `Contact Sensor` (status mapper)
- Visibility option: always shown
- State meaning:
- Contact detected: device `Idle`
- Contact not detected: any active/non-idle state (Cleaning, Leveling, Cat Present, Paused, Fault)
- Sensor `Name` shows text status (`Idle`, `Cleaning`, `Panels Missing`, etc.)
- Automation example:
- Trigger: `Status` changes to contact detected (idle)
- Action: Send "Cycle finished" notification

### Last Action
- Description: Shows the latest action result with timestamp.

- HomeKit type: `Contact Sensor` (result/event mapper)
- Visibility option: always shown
- State meaning:
- Contact detected: last action succeeded
- Contact not detected: last action failed/blocked
- Sensor `Name` includes action text and UTC timestamp
- Automation example:
- Trigger: `Last Action` becomes contact not detected
- Action: Send "Neakasa action failed/blocked" alert

### Litter Level
- Description: Reports litter percentage and low-litter maintenance state.

- HomeKit type: `Filter Maintenance`
- Visibility option: always shown
- State meaning:
- `FilterLifeLevel`: sand percent (0-100)
- `FilterChangeIndication`: "change needed" when sand state is insufficient
- Automation example:
- Trigger: Filter change indication turns on
- Action: Send "Add litter" reminder

## Optional Sensors (all default `false`)

### Bin State
- Description: Shows detailed bin condition: normal, full, or missing.

- HomeKit type: `Leak Sensor`
- Show option: `showBinStateSensor`
- State meaning:
- Leak detected: bin state is not normal (full or missing)
- No leak: normal bin state
- Sensor `Name` shows `Normal`, `Full`, or `Missing`
- Automation example:
- Trigger: `Bin State` detects leak
- Action: Send "Bin full or removed" alert

### WiFi Signal
- Description: Displays WiFi signal strength as a percentage-style value.

- HomeKit type: `Humidity Sensor` (workaround type)
- Show option: `showWifiSensor`
- State meaning:
- `CurrentRelativeHumidity` is used to display WiFi quality percent (mapped from RSSI)
- Automation example:
- Trigger: Value drops below 30%
- Action: Send "Weak WiFi at litter box" notification

### Cat Weight (per cat)
- Description: Shows each cat's latest recorded weight as a sensor value.

- HomeKit type: `Humidity Sensor` (workaround type)
- Show option: `showCatSensors`
- Related settings: `recordDays`, `useImperialUnits`
- State meaning:
- Each cat gets one sensor
- Sensor value shows rounded latest weight as percent-like number in HomeKit UI
- Value is kg by default; lbs when `useImperialUnits` is true
- Automation example:
- Trigger: Cat weight for "Milo" changes
- Condition: value below expected threshold
- Action: Send "Weight trend check" reminder

### Cat Visit
- Description: Triggers briefly after a completed cat visit event.

- HomeKit type: `Contact Sensor`
- Show option: `showCatVisitSensor`
- Related settings: `catVisitLatchSeconds`
- State meaning:
- Contact not detected: visit event active (recent completed visit in latch window)
- Contact detected: no recent visit event
- Automation example:
- Trigger: `Cat Visit` becomes contact not detected
- Action: Log a visit event to HomeKit/Home app notification

### Recently Used
- Description: Indicates the litter box was used within a recent time window.

- HomeKit type: `Occupancy Sensor`
- Show option: `showRecentlyUsedSensor`
- Related settings: `recentlyUsedMinutes`
- State meaning:
- Occupancy detected: last use was within configured minutes
- No occupancy: not used recently
- Automation example:
- Trigger: `Recently Used` turns on
- Action: Start bathroom fan for 10 minutes

### Sand Level State
- Description: Shows detailed sand status, including insufficient-level alerts.

- HomeKit type: `Contact Sensor`
- Show option: `showSandLevelSensor`
- State meaning:
- Contact not detected: `Insufficient` sand
- Contact detected: `Moderate`, `Sufficient`, or `Overfilled`
- Sensor `Name` shows the exact level text
- Automation example:
- Trigger: `Sand Level State` becomes contact not detected
- Action: Send "Litter is insufficient" alert

### Fault Alert
- Description: Indicates active fault states such as panels missing or interrupted.

- HomeKit type: `Motion Sensor`
- Show option: `showFaultSensor`
- State meaning:
- Motion detected: active fault (`Panels Missing` or `Interrupted`)
- No motion: no fault
- Automation example:
- Trigger: `Fault Alert` detects motion
- Action: Push urgent notification and turn on a warning light

## Recommended Enablement Example

```json
{
  "platform": "Neakasa",
  "name": "Neakasa",
  "username": "your@email.com",
  "password": "your_password",
  "showChildLock": true,
  "showSilentMode": true,
  "showEmptyBin": true,
  "showCatVisitSensor": true,
  "showRecentlyUsedSensor": true,
  "showSandLevelSensor": true,
  "showFaultSensor": true,
  "catPresentLatchSeconds": 240,
  "catVisitLatchSeconds": 90,
  "recentlyUsedMinutes": 15
}
```
