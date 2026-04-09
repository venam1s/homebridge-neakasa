# Codebase Concerns

**Analysis Date:** 2026-04-09 (verified against full source)

## Security

**Hardcoded App Credentials:**
- `src/api.ts:25-26` — `appKey` and `appSecret` are hardcoded. Comment correctly notes these are reverse-engineered from the Android APK and shared across all installations. Not user secrets, but a single point of failure if Neakasa rotates them — every installed version breaks with no user-side fix until a plugin release.

**Hardcoded AES Key and IV:**
- `src/encryption.ts:3-4` — Default AES key and IV are hardcoded constants used only for the initial `decodeLoginToken()` call. After login, the server-provided key/IV replace them (`encryption.ts:79-84`). This is a protocol requirement — the initial decode must use a shared secret.

**Static IV in AES-CBC Encryption:**
- `src/encryption.ts:42` — `encrypt()` reuses `this.aesIv` for every call. Best practice is a random IV per encryption. Mitigated by the timestamp suffix in `getToken()` (`token@timestamp`) which ensures plaintext varies. This is a Neakasa protocol constraint, not a plugin defect.

**Custom Zero-Byte Padding:**
- `src/encryption.ts:23-39` — Manual zero-byte padding instead of PKCS7. The `unpad()` strips trailing null bytes, which is ambiguous if plaintext ends in nulls. Safe for this use case (token strings) but non-standard. Matches Neakasa server expectations.

**MD5 Double-Hashing for Passwords:**
- `src/api.ts:154` — `md5(md5(password))`. MD5 is cryptographically broken, but this matches the Neakasa API protocol. The plugin can't change it.

**Hardcoded Android Emulator Fingerprint:**
- `src/api.ts:159-163` — Login sends hardcoded device identifiers: `system_version: 'Android14,SDK:34'`, `system_number: 'GOOGLE_sdk_gphone64_x86_64...'`, `app_version: '2.0.9'`. If Neakasa flags emulator fingerprints or checks app version, auth could fail. Also becomes stale as the real app updates past 2.0.9.

**Debug Logging is Clean:**
- Verified all `log.debug` calls in `src/api.ts`. None log tokens, passwords, SIDs, or secrets. Only status messages and domain URLs are logged.

## Architecture

**5-Tier Config Merge:**
- `src/platform.ts:382-436` — Config resolves: built-in defaults → top-level config → `defaults` layer → `profiles[name]` → `deviceOverrides[iotId]`. Implementation in `sanitizeConfig()` is thorough with validation at each layer (`validatePollInterval`, `validateRecordDays`, `validateNonNegativeInt`, etc.). Duplicate iotIds are caught. Invalid profiles warn and fall back.
- This is well-implemented but inherently complex for users to reason about. Debug logging at startup (`logConfigStartupChecks` at line 817, `logDetectedDeviceSummary` at line 834) shows resolved config per device, which helps.

**17 Feature Flags:**
- `src/platform.ts:27-45` — Exactly 17 flags in `FEATURE_KEYS`. Service creation in `src/accessory.ts:49-224` is linear: each flag maps to one `addOptionalSwitch` or conditional block. The `addOptionalSwitch`/`removeServiceIfExists` pattern (line 242-262) cleanly handles toggle on/off. Not fragile — adding a new flag requires one new entry in `FEATURE_KEYS`, one `addOptionalSwitch` call, and one update handler.

**6-Stage Auth Flow:**
- `src/api.ts:91-121` — `connect()` runs: `loadBaseUrlByAccount` → `loadAuthTokens` → `loadRegionData` → `getVid` → `getSidByVid` → `getIotTokenBySid`. Has a single retry: if IoT token fails, full re-auth is attempted once. Error types are well-separated: `NeakasaAuthError` for credential issues, `NeakasaAPIError` for everything else. Solid implementation.

**Polling System:**
- `src/platform.ts:216-327` — Per-device intervals, consecutive failure tracking with backoff after 5 failures (`MAX_CONSECUTIVE_FAILURES`), queue coalescing via `enqueuePollRun`/`flushQueuedPollRuns` to prevent concurrent poll cycles, and auto-reconnect on auth errors (once per poll run). Well-designed. No maximum backoff cap — after 5 failures, the interval doubles indefinitely.

**Two Signing Code Paths in IoTClient:**
- `src/client.ts:55-83` (`buildSignatureHeaders` in `doRequest`) vs `src/client.ts:115-159` (manual signing in `doRequestRaw`). Different API endpoints require different signing schemes (JSON body vs form-encoded). Both work correctly but are maintained independently — a signing change would need updating in two places.

## Code Quality

**Inconsistent Error Wrapping:**
- `src/api.ts:334` — `getDevices()` doesn't wrap errors. Raw axios errors propagate to the caller, unlike other methods that wrap in `NeakasaAPIError`.
- `src/client.ts:110-112, 164-166` — Both `doRequest` and `doRequestRaw` catch errors and wrap them in plain `Error` instead of a typed error class. Upstream code in `api.ts` can't distinguish client transport failures from other errors.

**Request-Id Header Reuses Signature:**
- `src/api.ts:133` — `'Request-Id': signature` uses the HMAC signature as the request ID. A request ID should be a unique identifier (UUID/nonce). If the API ever validates Request-Id uniqueness, requests with identical timestamps would collide. Same pattern at `api.ts:166`.

**Cat Weight Display Capped at 100:**
- `src/accessory.ts:612` — Cat weight is displayed via `HumiditySensor` (0-100% range). `Math.min(100, ...)` caps display at 100. A 10kg cat shows as 10 (or 22 in imperial). But this means a 50kg value would show as 50% humidity — potentially confusing. The HumiditySensor hack is a HomeKit limitation (no generic numeric sensor type).

## Test Coverage

**5 test files, 81 tests passing:**
- `test/accessory-helpers.test.ts` — Accessory helper utilities
- `test/api.test.ts` — API auth flow and device operations
- `test/client.test.ts` — IoT client request signing
- `test/encryption.test.ts` — AES encryption/decryption
- `test/platform-config.test.ts` — Config validation and merge logic

**Gaps:**
- No tests for `src/accessory.ts` service creation or `updateData()` logic
- No integration tests (full polling loop, device discovery lifecycle)
- No E2E tests against a real Homebridge instance

## Configuration

**Config UI Exists and is Complete:**
- `config.schema.json` (751 lines) provides a full Homebridge UI X form with layout sections for credentials, timing, optional switches, optional sensors, per-device overrides, profiles, and defaults. All 17 feature flags are exposed at every config tier. This is comprehensive — users do NOT need to edit JSON manually.

## Dependencies

**Homebridge Version:**
- `package.json` — `"homebridge": ">=1.6.0"`. Minimum version pinned. No upper bound, so major Homebridge API changes could break the plugin without warning.

**Node Version Mismatch:**
- `package.json:22` — `"node": ">=20.0.0"` but CLAUDE.md states CI runs on Node 18 + 20. Either the engines field should be `>=18.0.0` to match CI, or CI shouldn't test Node 18 if it's not supported.

**Axios:**
- Only runtime dependency (`axios: ^1.6.0`). Both `src/api.ts:28` and `src/client.ts:38` create separate axios instances with 30s timeout. Functional but could share a factory.

**Node.js Crypto:**
- Uses stable APIs: `createCipheriv`, `createDecipheriv`, `createHmac`, `createHash`. No deprecated usage. Safe through Node 22+.

## Scaling

**Device Pagination:**
- `src/api.ts:323` — `getDevices()` requests `pageSize: 100, pageNo: 1`. No pagination loop. If a user has 100+ devices (unlikely for cat litter boxes), extras would be silently missed.

**Polling Overhead:**
- Each device polled individually via `getDeviceProperties()`. With `showCatSensors` enabled, each poll also calls `getRecords()` — doubling HTTP requests per device. Queue coalescing prevents stampedes.

## Sole Author Risk

- Single author (havuq/venam1s). Original GitHub account suspended for Actions ToS violation. Now on venam1s account.
- If account is compromised or suspended again, plugin maintenance halts and npm publish access is lost.

---

*Verified against source: 2026-04-09*
