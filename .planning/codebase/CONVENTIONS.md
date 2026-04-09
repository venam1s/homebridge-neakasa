# Coding Conventions

**Analysis Date:** 2026-04-09

## Naming Patterns

**Files:**
- TypeScript source files use lowercase with dash-separated segments (e.g., `index.ts`, `platform.ts`, `api.ts`, `client.ts`, `encryption.ts`, `settings.ts`, `types.ts`, `accessory.ts`)
- Test files follow pattern: `[module-name].test.ts` (e.g., `accessory-helpers.test.ts`, `encryption.test.ts`, `platform-config.test.ts`)

**Functions:**
- camelCase convention (e.g., `sanitizeConfig()`, `registerPlatform()`, `updateCharacteristic()`)
- Async functions return Promises (explicit async/await or Promise-returning)

**Variables:**
- camelCase for local variables and constants
- Boolean variables and getters typically prefixed with `is`, `has`, `show`, `enable` (e.g., `showChildLock`, `showCatSensors`, `showWifiSensor`)
- Enum values use camelCase (e.g., `bucketStatus`, `room_of_bin`)

**Types:**
- PascalCase for interfaces and type names (e.g., `NeakasaPlatform`, `NeakasaAccessory`, `NeakasaAPI`, `IoTClient`, `DeviceData`, `PlatformAccessory`)
- Exported types and interfaces centralized in `src/types.ts`

**Classes:**
- PascalCase (e.g., `NeakasaPlatform`, `NeakasaAccessory`, `NeakasaAPI`, `IoTClient`)

## Code Style

**Formatting:**
- Single quotes for strings
- 2-space indentation
- Semicolons required at end of statements
- 140-character line length maximum
- TypeScript strict mode enforced

**Linting:**
- ESLint with custom `.eslintrc` configuration (file not yet present but planned)
- Strict warnings policy: `--max-warnings=0` means any warning fails the build
- Allows `no-non-null-assertion` and `no-explicit-any` (architectural exceptions)

**Build/Compilation:**
- TypeScript compilation via `npm run build`
- Source in `src/`, compiled output in `dist/`
- Builds executed via clean compile (not incremental)

## Import Organization

**Order:**
1. External dependencies (e.g., `homebridge` package)
2. Relative imports from project modules
3. Type imports use `import type` syntax when importing types only

**Path Aliases:**
- Not observed in current codebase; direct relative paths used

**Example from index.ts:**
```typescript
import { API } from 'homebridge';
import { PLATFORM_NAME } from './settings';
import { NeakasaPlatform } from './platform';
```

## Error Handling

**Patterns:**
- Try-catch blocks for async operations and API calls
- Multi-stage auth flow in API module (`account hash → login → region → VID → SID → IoT token`)
- Device-level error recovery with per-device reconnection logic in platform
- Smart polling intervals with backoff on failure

## Logging

**Framework:** console (native Node.js)

**Patterns:**
- Homebridge logger instance passed to all modules
- Platform-level logging for discovery and polling lifecycle
- API authentication flow logging for debugging token acquisition
- Device state change logging when characteristics update

## Comments

**When to Comment:**
- Complex auth flow stages in API module
- Config merge precedence rules (5-level hierarchy in platform)
- Feature flag logic when enabling/disabling services
- Device-specific enum values (bucketStatus 0-7, room_of_bin 0-2)

**JSDoc/TSDoc:**
- Not yet observed in minimal codebase
- Should be added for public APIs once module structure expands

## Function Design

**Size:** Small, focused functions preferred. Platform has orchestration logic for device discovery and polling; accessory handles service lifecycle; API handles auth and device communication.

**Parameters:** 
- Constructor injection for dependencies (e.g., platform passes logger, config, API instance)
- Config objects over multiple parameters for complex configuration

**Return Values:**
- Explicit Promise types for async operations
- Void for fire-and-forget side effects
- Typed return values for data-returning functions

## Module Design

**Exports:**
- Default export for platform plugin entry (`index.ts` exports CommonJS default)
- Named exports from utility modules
- All types exported from centralized `src/types.ts`

**Barrel Files:**
- Not yet established; consider `src/index.ts` as future export barrel if module count grows beyond 10

**Service/Module Organization:**
- `NeakasaPlatform`: Main plugin entry, handles device discovery, polling orchestration, config validation
- `NeakasaAccessory`: Per-device HomeKit integration, service lifecycle, characteristic updates
- `NeakasaAPI`: Auth flow, device property reads/writes, service invocation, history fetching
- `IoTClient`: Low-level HTTP client with HMAC-SHA256 request signing
- `encryption.ts`: AES-128-CBC encryption utility for tokens
- `types.ts`: Shared type definitions (DeviceData, enum ranges)
- `settings.ts`: Platform name constant and config type definitions

## Config Handling

**Validation & Sanitization:**
- `sanitizeConfig()` function in `platform.ts` handles all validation, type coercion, merge logic
- 5-level config precedence hierarchy:
  1. `deviceOverrides[].fields` (per-device by `iotId`)
  2. `profiles[name]` (named groups, assigned per-device)
  3. `defaults` (global defaults layer)
  4. Top-level config fields
  5. Built-in hard-coded defaults
- Boolean feature flags control service visibility (17+ flags like `showChildLock`, `showCatSensors`)

## Async Patterns

**Pattern:**
- async/await syntax preferred for readability
- Promise chains used when appropriate
- Proper error propagation through async call stacks

---

*Convention analysis: 2026-04-09*
