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
- HomeKit type: `Lock Mechanism`
- Show option: `showChildLock`
- Behavior:
- `Secured`: child lock enabled (`childLockOnOff = 1`)
- `Unsecured`: child lock disabled (`childLockOnOff = 0`)
- Automation example:
- Trigger: Everyone leaves home
- Action: Set `Child Lock` to `Secured`

### Sync Auto Level With Auto Clean
- HomeKit type: `Switch`
- Show option: `showAutoLevelClean`
- Behavior:
- `On`: enables both `Auto Clean` and `Auto Level`
- `Off`: disables both together
- Automation example:
- Trigger: "Good Night" scene
- Action: Turn this switch off to disable both automations overnight

### Empty Bin
- HomeKit type: `Switch` (two-step action)
- Show option: `showEmptyBin`
- Behavior:
- First tap arms confirmation for 10 seconds
- Second tap within 10 seconds confirms "bin emptied" action
- Automation example:
- Trigger: `Waste Bin Full` turns on
- Action: Send notification "Empty Neakasa bin and double-tap Empty Bin switch"

### Auto Bury
- HomeKit type: `Switch`
- Show option: `showAutoBury`
- Behavior:
- `On`: enables waste-covering behavior after use
- `Off`: disables it
- Automation example:
- Trigger: Bedtime scene
- Action: Turn `Auto Bury` on for cleaner overnight operation

### Auto Level
- HomeKit type: `Switch`
- Show option: `showAutoLevel`
- Behavior:
- `On`: enables automatic litter leveling after cycles
- `Off`: disables automatic leveling
- Automation example:
- Trigger: Morning scene
- Action: Turn `Auto Level` on

### Silent Mode
- HomeKit type: `Switch`
- Show option: `showSilentMode`
- Behavior:
- `On`: quieter operation mode
- `Off`: normal operation mode
- Automation example:
- Trigger: 10:00 PM every day
- Action: Turn `Silent Mode` on

### Unstoppable Cycle
- HomeKit type: `Switch`
- Show option: `showUnstoppableCycle`
- Behavior:
- `On`: cycle is less likely to pause on interruptions (`bIntrptRangeDet = 1`)
- `Off`: normal interruption behavior
- Automation example:
- Trigger: Vacation mode scene
- Action: Turn `Unstoppable Cycle` on while away

### Auto Recovery
- HomeKit type: `Switch`
- Show option: `showAutoRecovery`
- Behavior:
- `On`: auto-resume after interruption (`autoForceInit = 1`)
- `Off`: no auto-recovery
- Automation example:
- Trigger: `Fault Alert` turns off (fault cleared)
- Action: Turn `Auto Recovery` on to keep future cycles resilient

### Young Cat Mode
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
- HomeKit type: `Occupancy Sensor`
- Visibility option: always shown
- State meaning:
- Occupancy detected: bin is full / needs reset
- No occupancy: bin status normal
- Automation example:
- Trigger: `Waste Bin Full` turns on
- Action: Send critical notification

### Status
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
- HomeKit type: `Humidity Sensor` (workaround type)
- Show option: `showWifiSensor`
- State meaning:
- `CurrentRelativeHumidity` is used to display WiFi quality percent (mapped from RSSI)
- Automation example:
- Trigger: Value drops below 30%
- Action: Send "Weak WiFi at litter box" notification

### Cat Weight (per cat)
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
