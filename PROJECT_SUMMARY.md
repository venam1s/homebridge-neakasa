# Homebridge Neakasa — Project Summary

## Project Overview

**homebridge-neakasa** is a Homebridge plugin that brings the Neakasa M1 Cat Litter Box into Apple HomeKit. It was built as a TypeScript/Node.js port of the [Home Assistant Neakasa Integration](https://github.com/timniklas/hass-neakasa) by [@timniklas](https://github.com/timniklas).

- **Repository**: [github.com/havuq/homebridge-neakasa](https://github.com/havuq/homebridge-neakasa)
- **npm package**: `homebridge-neakasa`
- **Current version**: v1.5.0
- **License**: MIT

---

## Goal

Give Neakasa M1 owners full control and monitoring of their smart cat litter box through Apple HomeKit — including switches for cleaning modes, sensors for litter level and waste bin status, and automation triggers for events like a cat entering the box. No Home Assistant required.

---

## What Was Built

### Core Plugin Architecture
- **Dynamic platform plugin** that auto-discovers Neakasa devices on the account
- **60-second polling** (configurable) keeps HomeKit state in sync with the device
- **Auto-reconnect** on authentication failures — no manual restart needed
- **Homebridge Config UI X** support with a full settings schema for easy configuration

### Authentication System (6-Step Flow)
Ported and debugged the complex Alibaba Cloud IoT authentication chain:

1. **Region detection** — `global.genhigh.com` resolves the user's regional base URL
2. **Login** — email/password auth against the Neakasa cloud (MD5-hashed, spoofed Android app headers)
3. **Region endpoints** — Alibaba IoT API returns the correct regional API gateways
4. **VID acquisition** — OAuth-style device identifier via signed IoT request
5. **SID exchange** — session ID from VID via signed request with custom headers
6. **IoT token** — final credential for all device API calls

All requests to the Alibaba Cloud API Gateway are HMAC-SHA256 signed with proper `x-ca-*` headers, content-MD5, and nonce generation.

### Encryption Layer
- AES-128-CBC encryption/decryption for login tokens
- Dynamic key/IV extraction from login responses
- Token generation with timestamps for API authentication

### HomeKit Services

**6 Core Services (always shown):**
| Service | Type | What It Does |
|---------|------|-------------|
| Litter Level | FilterMaintenance | Sand level as 0-100% with low-level alert |
| Waste Bin Full | OccupancySensor | Alerts when waste bin needs emptying |
| Status | ContactSensor | Reports device state (Idle, Cleaning, Cat Present, etc.) |
| Auto Clean | Switch | Toggle automatic cleaning on/off |
| Clean Now | Switch (stateless) | Trigger immediate cleaning cycle |
| Level Now | Switch (stateless) | Trigger immediate sand leveling |

**7 Optional Switches (off by default, enabled in config):**
- Child Lock, Auto Bury, Auto Level, Silent Mode, Unstoppable Cycle, Auto Recovery, Young Cat Mode

**4 Optional Sensors (off by default):**
- Bin State (LeakSensor — Normal/Full/Missing)
- WiFi Signal (HumiditySensor — RSSI converted to percentage)
- Cat Weight (HumiditySensor per registered cat — one sensor per cat)
- Fault Alert (MotionSensor — motion detected = device faulted, bucketStatus 6 or 7)

---

## Bugs Found & Fixed

### 1. Wrong IoT Token Endpoint
- **Problem**: Code called `/api/prd/account/getiottoken.json` via `doRequestRaw` on the OAuth API gateway
- **Fix**: Changed to `/account/createSessionByAuthCode` via `doRequest` on the standard API gateway (matching the HA integration)

### 2. Wrong SID Extraction Path
- **Problem**: Code read `response.data.data.sid`
- **Fix**: Corrected to `response.data.data.data.loginSuccessResult.sid`

### 3. Unsigned SID Request (400 Error)
- **Problem**: `getSidByVid` used raw `axios` without Alibaba Cloud's required HMAC-SHA256 signing headers
- **Fix**: Routed through `IoTClient.doRequestRaw()` and added `extraHeaders` support to the client so the `Vid` header could be passed alongside the signing headers

### 4. Missing Signature Headers (403 Error)
- **Problem**: `doRequest` was missing `x-ca-signature-headers` from the signed request
- **Fix**: Added the required header to the signing calculation

### 5. HomeKit Tile Names All Showing "Neakasa M1"
- **Problem**: HomeKit uses `ConfiguredName` (not `Name`) for tile display — all 15 services showed the accessory name
- **Fix**: Added `setServiceName()` helper that sets both `Name` and `ConfiguredName` on every service

### 6. Too Many Tiles in Home App
- **Problem**: 15 tiles cluttered the Home app
- **Fix**: Reduced to 6 core services always shown, made the rest opt-in via config toggles

### 7. DNS Resolution in Docker
- **Problem**: `getaddrinfo EAI_AGAIN global.genhigh.com` — Homebridge running in Docker on TrueNAS Scale couldn't resolve DNS
- **Fix**: User added `dns: [8.8.8.8, 1.1.1.1]` to their docker-compose configuration

---

## Release History

### v1.5.0 — Fault Alert, Debounce & Icon Fix
- Added optional Fault Alert sensor (MotionSensor) for bucketStatus 6 (Panels Missing) and 7 (Interrupted)
- Added `updateIfChanged` debounce — HomeKit characteristics only update when values actually change, preventing spurious notifications on every poll cycle
- Fixed plugin icon (replaced 100×100px with 512×512px) so it displays correctly in Homebridge UI

### v1.4.0 — Display Preferences
- Moved imperial units to a prominent Display Preferences section in config UI

### v1.2.0 — Simplified Accessories & Fixed Naming
- Reduced default tiles from 15 to 6 core services
- Fixed HomeKit tile naming with `ConfiguredName` characteristic
- Added Status (ContactSensor) and Litter Level (FilterMaintenance) as core defaults
- Made 7 switches and 3 sensors opt-in via Homebridge UI config
- Updated config.schema.json with organized Optional Switches and Optional Sensors fieldsets

### v1.1.0 — Stable Auth & Feature Expansion
- Fixed entire authentication flow (3 separate bugs)
- Added signed IoT client support with extra headers
- Added configurable sensors: Bin State, WiFi Signal, Cat Weight
- Cleaned up git repo, set up npm publishing
- First GitHub release

### Initial Commit — Working Plugin
- Full TypeScript plugin scaffolding
- Alibaba Cloud IoT API client with HMAC-SHA256 signing
- AES-128-CBC encryption for token handling
- Basic switches and sensors

---

## Project Files

| File | Purpose |
|------|---------|
| `src/platform.ts` | Homebridge DynamicPlatformPlugin — device discovery, polling, auto-reconnect |
| `src/accessory.ts` | HomeKit accessory — all services, characteristics, and state updates |
| `src/api.ts` | Neakasa API client — 6-step auth flow, device commands |
| `src/client.ts` | IoT HTTP client — HMAC-SHA256 signed requests to Alibaba Cloud |
| `src/encryption.ts` | AES-128-CBC encryption/decryption for login tokens |
| `src/types.ts` | TypeScript interfaces, enums (BucketStatus, BinState, SandLevel) |
| `src/settings.ts` | Plugin constants (PLATFORM_NAME, PLUGIN_NAME) |
| `src/index.ts` | Plugin entry point — registers platform with Homebridge |
| `config.schema.json` | Homebridge Config UI X settings schema |

---

## Automation Ideas for Users

- **"Cat entered the litter box"** — trigger on the Status ContactSensor opening (bucketStatus changes from Idle)
- **"Bin is full"** — trigger on Waste Bin Full OccupancySensor detecting occupancy
- **"Litter is low"** — trigger on Litter Level FilterMaintenance indicating filter change needed
- **"Silent mode at night"** — enable the Silent Mode switch on a schedule
- **"Notification on cleaning complete"** — trigger when Status ContactSensor returns to Closed (Idle)

---

## Pending / Future Work

- **Last cleaned timestamp**: Expose as a characteristic or log entry for tracking maintenance schedules
- **Faster polling after cat visit**: Poll more frequently for 30s after bucketStatus transitions from Cat Present back to Idle
- **Days since litter change**: Simple counter reset via a switch, exposed as a sensor

---

## Tech Stack

- **Runtime**: Node.js ≥ 18, Homebridge ≥ 1.6.0
- **Language**: TypeScript 5.3
- **HTTP**: axios 1.6
- **Crypto**: Node.js built-in (AES-128-CBC, HMAC-SHA256, MD5)
- **Cloud API**: Alibaba Cloud IoT API Gateway
- **Deployment**: Docker on TrueNAS Scale via Portainer (user's setup)
