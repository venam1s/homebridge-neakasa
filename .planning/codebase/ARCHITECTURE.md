# Architecture

**Analysis Date:** 2026-04-09

## Pattern Overview

**Overall:** Homebridge Dynamic Platform Plugin with multi-layer request/response architecture.

**Key Characteristics:**
- Homebridge integration via `DynamicPlatformPlugin` API
- Multi-stage authentication with token refresh handling
- Polling-based device state synchronization
- Dynamic HomeKit service creation based on feature flags
- HMAC-SHA256 signed API requests with AES encryption for sensitive tokens

## Layers

**Entry Point (Homebridge Integration):**
- Purpose: Register the plugin with Homebridge and expose the platform class
- Location: `src/index.ts`
- Contains: Plugin initialization via Homebridge API registration
- Depends on: `src/settings.ts` (PLATFORM_NAME), `src/platform.ts` (NeakasaPlatform)
- Used by: Homebridge runtime during plugin discovery

**Platform Layer:**
- Purpose: Handle Homebridge platform lifecycle, device discovery, polling orchestration, and configuration management
- Location: `src/platform.ts`
- Contains: `NeakasaPlatform` class (implements DynamicPlatformPlugin), configuration validation/sanitization via `sanitizeConfig()`, device discovery logic, polling scheduler with smart per-device intervals, reconnection handling
- Depends on: `src/api.ts` (NeakasaAPI), `src/accessory.ts` (NeakasaAccessory), `src/types.ts`, `src/settings.ts`
- Used by: Homebridge runtime; orchestrates all accessory creation/removal

**Accessory Layer:**
- Purpose: Represent individual devices as HomeKit accessories with dynamic service composition
- Location: `src/accessory.ts`
- Contains: `NeakasaAccessory` class wrapping `PlatformAccessory`, dynamic service creation/removal based on 17+ feature flags, characteristic handlers for device actions (clean, level, empty bin), sensor updates
- Depends on: `src/types.ts`, `src/api.ts` (for device actions), Homebridge API (Service, Characteristic, PlatformAccessory)
- Used by: `src/platform.ts` creates and manages instances

**API Communication Layer:**
- Purpose: Implement multi-stage authentication and device property/action management
- Location: `src/api.ts`
- Contains: `NeakasaAPI` class with auth flow (account hash → login → region → VID → SID → IoT token), device property read/write, service invocation (clean, etc.), cat history fetching
- Depends on: `src/client.ts` (IoTClient for signed requests), `src/encryption.ts` (token encryption), `src/types.ts`
- Used by: `src/platform.ts` and `src/accessory.ts`

**IoT Client Layer:**
- Purpose: Implement low-level HMAC request signing and nonce/timestamp management
- Location: `src/client.ts`
- Contains: `IoTClient` class with HMAC-SHA256 request signing, nonce generation, timestamp handling
- Depends on: `src/types.ts`
- Used by: `src/api.ts` for all outgoing API requests

**Encryption Layer:**
- Purpose: Handle AES-128-CBC encryption for sensitive API tokens
- Location: `src/encryption.ts`
- Contains: Encryption/decryption utilities for API token handling
- Depends on: Node.js crypto module
- Used by: `src/api.ts` during token management

**Type Definitions:**
- Purpose: Define all TypeScript interfaces and enums
- Location: `src/types.ts`
- Contains: `DeviceData` interface with device state fields, enums for `bucketStatus` (0-7), `room_of_bin` (0-2), all request/response types
- Depends on: None
- Used by: All other modules

**Settings/Constants:**
- Purpose: Define configuration constants and Homebridge platform metadata
- Location: `src/settings.ts`
- Contains: `PLATFORM_NAME` constant and other settings
- Depends on: None
- Used by: `src/index.ts`, `src/platform.ts`

## Data Flow

**Initialization Flow:**

1. Homebridge loads plugin via `src/index.ts`
2. `index.ts` imports and registers `NeakasaPlatform` with Homebridge API
3. Homebridge calls `NeakasaPlatform.didFinishLaunching()` after loading all plugins
4. Platform initializes with user config and discovers devices via `src/api.ts`
5. For each device, platform creates `NeakasaAccessory` instance and adds to Homebridge cache

**Polling Flow:**

1. `NeakasaPlatform` maintains per-device polling intervals (intelligent scheduling)
2. On interval: `api.getDeviceData()` fetches current state via HMAC-signed request
3. API authenticates if token expired (refreshes via auth flow)
4. Response parsed and merged into `DeviceData`
5. `NeakasaAccessory.updateCharacteristics()` updates HomeKit characteristics
6. HomeKit notifies iOS clients of state changes

**Device Action Flow (e.g., start clean):**

1. HomeKit app sends characteristic write via Homebridge
2. `NeakasaAccessory` characteristic handler receives the request
3. Handler calls `api.invokeService()` with action parameters
4. API sends HMAC-signed request to device
5. Device executes action and returns acknowledgment
6. Characteristic updated locally to reflect expected state

**Authentication Flow:**

1. First request: compute account hash from credentials
2. Send hash to obtain login token and region
3. Use region to get VID (virtual device ID)
4. Exchange credentials + VID for SID (session ID)
5. Exchange SID for IoT token (JWT-like, expires)
6. Subsequent requests: include IoT token; refresh if expired

**State Management:**

- Platform maintains `Map<uuid, PlatformAccessory>` for device cache
- Each accessory maintains its own `DeviceData` representation
- API maintains auth state: tokens, timestamps, nonces
- Polling intervals stored per device in platform
- All state accessed through platform/accessory instances

## Key Abstractions

**NeakasaPlatform:**
- Purpose: Implement Homebridge dynamic platform contract and orchestrate discovery/polling
- Files: `src/platform.ts`
- Pattern: Singleton (one per Homebridge instance); implements `DynamicPlatformPlugin`
- Responsibilities: config validation, device discovery, polling scheduling, accessory lifecycle

**NeakasaAccessory:**
- Purpose: Represent a Neakasa device as a HomeKit accessory with dynamic services
- Files: `src/accessory.ts`
- Pattern: Wraps Homebridge `PlatformAccessory`; one-to-one mapping with devices
- Responsibilities: service composition based on flags, characteristic handling, device action invocation

**NeakasaAPI:**
- Purpose: Encapsulate all Neakasa cloud API communication
- Files: `src/api.ts`
- Pattern: Singleton per platform; stateful (maintains auth tokens)
- Responsibilities: multi-stage auth, device queries, action invocation, response parsing

**IoTClient:**
- Purpose: Abstract low-level HTTP signing and request/response handling
- Files: `src/client.ts`
- Pattern: Utility class; stateless for request signing
- Responsibilities: HMAC-SHA256 signing, nonce/timestamp generation, header construction

**DeviceData (Type):**
- Purpose: Represent the full state of a Neakasa device
- Files: `src/types.ts`
- Pattern: Plain TypeScript interface
- Responsibilities: Define shape of device properties (health, power, location, sensors, etc.)

## Entry Points

**Plugin Registration:**
- Location: `src/index.ts`
- Triggers: Homebridge loads the plugin from package.json "main" field
- Responsibilities: Import `NeakasaPlatform` and call `api.registerPlatform(PLATFORM_NAME, NeakasaPlatform)` to register class with Homebridge

**Platform Lifecycle Hooks:**
- Location: `src/platform.ts` (NeakasaPlatform class)
- Key methods:
  - `constructor(log, config, api)`: Initialize platform with Homebridge context
  - `didFinishLaunching()`: Called when Homebridge is ready; triggers initial device discovery and polling start
  - `configureAccessory(accessory)`: Called when Homebridge restores cached accessory; reattach listeners

**Configuration:**
- Source: Homebridge `config.json` under "platforms" array matching `PLATFORM_NAME`
- Read by: `NeakasaPlatform.constructor()` and sanitized via `sanitizeConfig()`
- Precedence: device overrides > profiles > defaults > top-level fields > hard-coded defaults

## Error Handling

**Strategy:** Graceful degradation with logging; no hard failures on individual device errors.

**Patterns:**

- **Auth Failures:** Platform retries with exponential backoff; logs error; skips polling until recovery
- **Device API Errors:** Accessory logs but does not crash; HomeKit shows "no response" until recovery
- **Parsing Errors:** API logs unexpected response format; uses last-known state
- **Config Validation:** Platform logs warnings during `sanitizeConfig()`; applies defaults for invalid fields

## Cross-Cutting Concerns

**Logging:** Each module logs to `this.log` (provided by Homebridge) with context; includes module name and operation.

**Validation:** Configuration validated in `NeakasaPlatform.sanitizeConfig()` with type coercion for booleans/numbers; device property writes validated in accessory.

**Authentication:** Centralized in `NeakasaAPI`; tokens cached and refreshed on expiry; auth state not exposed to accessories.

**Rate Limiting:** Per-device polling intervals controlled by platform; respects device response times and backoff during errors.

---

*Architecture analysis: 2026-04-09*
