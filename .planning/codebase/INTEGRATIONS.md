# External Integrations

**Analysis Date:** 2026-04-09

## APIs & External Services

**Neakasa Device API:**
- Neakasa-hosted REST API for smart litter box control
  - SDK/Client: Custom implementation in `src/api.ts` (NeakasaAPI class)
  - HTTP Client: axios 1.13.5
  - Auth: Multi-stage authentication flow (account hash → login → region → VID → SID → IoT token)

**HomeKit Accessory Protocol (HAP):**
- HAP-NodeJS 0.11.2 (bundled with Homebridge 1.6.1)
- Used for: HomeKit service/characteristic publishing and remote command handling
- Implementation: Via Homebridge `DynamicPlatformPlugin` API registered in `src/index.ts`

## Data Storage

**Databases:**
- None - Plugin is stateless relative to persistent data
- Device state cached in memory during runtime (PlatformAccessory instances)
- Homebridge handles configuration persistence via config.json

**File Storage:**
- Local filesystem only - Uses node-persist for caching credentials (referenced in dependencies)
- No external cloud storage integration

**Caching:**
- In-memory device state during polling cycles
- Optional token/credential caching via node-persist (managed by NeakasaAPI)

## Authentication & Identity

**Auth Provider:**
- Custom multi-stage Neakasa authentication (proprietary)
  - Implementation: `src/api.ts` NeakasaAPI class
  - Flow: Account email hash → login credentials → region assignment → device VID → device SID → IoT token
  - Encryption: AES-128-CBC for sensitive tokens (see `src/encryption.ts`)
  - Request signing: HMAC-SHA256 for all API requests (see `src/client.ts` IoTClient)

**Config-driven:**
- Credentials provided via Homebridge config.json
- Required fields: `email`, `password`, optionally `region` (auto-detected if omitted)
- Per-device tokens stored and managed by NeakasaAPI

## Monitoring & Observability

**Error Tracking:**
- None - Errors logged to Homebridge console via platform logger

**Logs:**
- Via Homebridge logging API (see `src/platform.ts` for logger initialization)
- No external log aggregation

**Debug:**
- Homebridge debug mode support (NODE_DEBUG environment)

## CI/CD & Deployment

**Hosting:**
- npm package registry (homebridge-neakasa)
- GitHub repository (source)

**CI Pipeline:**
- GitHub Actions (`/.github/workflows/ci.yml`)
- Runs: lint → build → test on Node 18 + 20
- Linting enforced: ESLint with --max-warnings=0 (zero tolerance)

**Publishing:**
- GitHub Actions publish workflow (`/.github/workflows/publish.yml`)
- npm package publish on release

## Environment Configuration

**Required env vars:**
- None explicitly (all config via Homebridge config.json)
- Optional: NODE_DEBUG for debug logging

**Homebridge Config Structure:**
```json
{
  "platforms": [{
    "platform": "Neakasa",
    "email": "user@example.com",
    "password": "****",
    "region": "us|eu|cn",
    "defaults": { /* feature flags and settings */ },
    "profiles": { /* named setting groups */ },
    "deviceOverrides": [ /* per-device overrides by iotId */ ]
  }]
}
```

**Secrets location:**
- Homebridge config.json (managed by Homebridge, encrypted by host system)
- No .env file used in this plugin

## API Endpoints (Neakasa Backend)

**Authentication Endpoints:**
- Account login (proprietary)
- Region lookup
- Device discovery and enumeration
- SID/VID token generation

**Device Endpoints:**
- Property reads: Device state (battery, WiFi, bucket status, etc.)
- Property writes: Control settings (start clean, set weight mode, empty bin indicator)
- Service invocation: Device actions (clean, empty bin, disable WiFi)
- History: Cat detection events and weight readings

**Request/Response:**
- Payload format: JSON
- Request signing: HMAC-SHA256 with nonce and timestamp
- Token encryption: AES-128-CBC

## Webhooks & Callbacks

**Incoming:**
- None - Plugin is pull-based only (polling interval configurable per device)

**Outgoing:**
- None - No external webhooks triggered by plugin

**Polling:**
- Smart per-device polling intervals (configurable in settings)
- Default polling strategy: Conservative interval with backoff on failures
- Reconnection logic: Automatic retry with exponential backoff

## Device Features Exposed to HomeKit

**Physical Controls:**
- Clean button (trigger cleaning cycle)
- Level control (for weight/cleanliness indicator)
- Empty bin indicator button

**Sensors:**
- WiFi signal strength
- Battery status
- Bucket fill status (0-7 levels)
- Weight sensors (per-cat, dynamically created based on `cat_list`)
- Child lock status (optional)
- Cat detection sensors (optional)

---

*Integration audit: 2026-04-09*
