# Codebase Concerns

**Analysis Date:** 2026-04-09

## Critical Issues

**Git Repository Corruption:**
- Issue: Repository has staged files in git index that do not exist on disk. Core source files (`src/platform.ts`, `src/api.ts`, `src/client.ts`, `src/encryption.ts`, `src/settings.ts`, `src/types.ts`, `src/accessory.ts`) and test files are missing from filesystem but appear as staged deletions in git status.
- Files affected: `src/platform.ts`, `src/api.ts`, `src/client.ts`, `src/encryption.ts`, `src/settings.ts`, `src/types.ts`, `src/accessory.ts`, `test/accessory-helpers.test.ts`, `test/encryption.test.ts`, `test/platform-config.test.ts`
- Impact: Cannot build or test project. npm build/lint/test will fail immediately. Git objects appear corrupted (cannot be read from index). Repository is non-functional.
- Fix approach: This appears to be a result of the GitHub migration from havuq to venam1s account (documented in memory/2026-03-28.md). The GitLab repo at gitlab.com/havuq/homebridge-neakasa is documented as the source of truth. Current state: Either (1) recover files from GitLab and re-stage, or (2) reset git index and re-clone cleanly from GitHub source.

**Sole Author Dependency:**
- Issue: Project has a single author (havuq) per CLAUDE.md. The original GitHub account was suspended by GitHub Actions ToS violation (heavy Docker builds). Now migrated to venam1s account.
- Files affected: All commits, package.json metadata, git history
- Impact: Ongoing maintenance depends on single person. If venam1s account is compromised or suspended, plugin maintenance halts.
- Fix approach: Document transition plan. Consider adding secondary maintainer with GitHub/npm publish access.

**Missing Node Version Management:**
- Issue: No `.nvmrc` or `.node-version` file found. CLAUDE.md specifies CI runs on Node 18 + 20, but development environment has no version lock.
- Files affected: Root directory (missing file)
- Impact: Developers may use wrong Node version locally, causing build failures or incompatibilities not caught in local testing.
- Fix approach: Add `.nvmrc` file pinning to Node 18 LTS or create `.node-version` file.

## Architecture Concerns

**Complex Configuration Merge System:**
- Issue: Config resolution has 5-tier precedence system: deviceOverrides[].fields > profiles[name] > defaults > top-level fields > built-in defaults (documented in CLAUDE.md). Single `sanitizeConfig()` function in `src/platform.ts` handles all merge logic.
- Files affected: `src/platform.ts`, `src/settings.ts`
- Impact: Configuration is hard to debug. Unclear which config value takes precedence without tracing all 5 layers. No clear error messages if config conflicts exist. Difficult to extend with new config options.
- Fix approach: Refactor config resolution into smaller, testable functions. Add debug logging showing which tier provided final value. Add config validation tests covering edge cases.

**17+ Feature Flags with Dynamic Service Creation:**
- Issue: Per CLAUDE.md, `NeakasaAccessory` creates/removes HomeKit services based on 17+ boolean feature flags (e.g. `showChildLock`, `showCatSensors`, `showWifiSensor`) plus dynamic cat weight sensors based on `cat_list` from device.
- Files affected: `src/accessory.ts`
- Impact: Service creation logic is likely complex and error-prone. Untested combinations of flags could cause crashes or missing HomeKit features. Hard to trace which flags control which services. Adding new sensors requires modifying multiple flag checks.
- Fix approach: Create a service configuration registry mapping flags to services. Add comprehensive tests for flag combinations. Consider feature-gate library or service factory pattern.

**Multi-Stage Authentication Flow:**
- Issue: Per CLAUDE.md, `NeakasaAPI` implements complex 6-stage auth: account hash → login → region → VID → SID → IoT token. Each stage can fail. No clear documentation of failure modes or recovery.
- Files affected: `src/api.ts`, `src/client.ts`
- Impact: Auth failures are hard to debug. No retry logic documented. If one stage times out or returns unexpected response, entire device discovery fails. Reconnection logic exists but unclear how it interacts with multi-stage auth.
- Fix approach: Add explicit error types for each auth stage. Implement structured retry with exponential backoff. Log which auth stage failed. Add unit tests for each stage in isolation.

**Polling with Per-Device Intervals:**
- Issue: Per CLAUDE.md, `NeakasaPlatform` orchestrates polling with "smart per-device intervals" and "reconnection logic". Implementation details not visible.
- Files affected: `src/platform.ts`
- Impact: Polling behavior is a black box. No visibility into interval selection algorithm, reconnection triggers, or rate limiting. Could cause DoS of Neakasa API or excessive CPU if intervals are misconfigured. Could miss device state changes if intervals are too long.
- Fix approach: Document polling strategy explicitly. Add configurable min/max poll intervals. Add metrics/logging for poll frequency per device. Test with various network conditions.

## Test Coverage Gaps

**Missing Unit Tests for Core Modules:**
- Issue: Only 3 test files exist: `test/accessory-helpers.test.ts`, `test/encryption.test.ts`, `test/platform-config.test.ts`. Core logic in `api.ts` and `client.ts` (auth flow, request signing, nonce generation) has no visible tests.
- Files affected: `src/api.ts`, `src/client.ts`
- Impact: Multi-stage auth flow and HMAC-SHA256 signing are untested. Regression in encryption or auth could go undetected. Changes to API client are risky.
- Fix approach: Add unit tests for `NeakasaAPI` covering each auth stage, error cases, and token refresh. Add unit tests for `IoTClient` request signing with known test vectors. Aim for 80%+ coverage on api.ts and client.ts.

**No Integration Tests:**
- Issue: Jest config targets only `test/*.test.ts`. No integration tests that verify full polling loop, device discovery, or HomeKit accessory lifecycle.
- Files affected: `test/` directory
- Impact: Changes to platform initialization, device discovery sequence, or service creation could break in production without test detection. Homebridge integration is not tested.
- Fix approach: Add integration test suite running against mock Homebridge API and mock Neakasa API. Test device discovery → accessory creation → polling → characteristic updates.

**No E2E Tests:**
- Issue: No E2E tests mentioned in CLAUDE.md or test directory.
- Files affected: None (feature absent)
- Impact: Real-world plugin behavior in actual Homebridge not tested. HomeKit UI interaction not tested. Multi-device scenarios not tested.
- Fix approach: Consider E2E tests against real Homebridge instance post-verification. For now, ensure robust mocking in integration tests.

## Security Considerations

**API Token Encryption:**
- Issue: Per CLAUDE.md, `encryption.ts` handles "AES-128-CBC encryption for API token handling". No details on key management, IV generation, or rotation.
- Files affected: `src/encryption.ts`
- Current mitigation: Encryption present
- Risk: If IV is reused or key is leaked, tokens could be decrypted. Weak key derivation from credentials could make tokens vulnerable.
- Recommendations: Document IV generation (must be random per encryption). Use strong key derivation (PBKDF2 or Argon2) if key derived from credentials. Add entropy validation in tests. Consider rotating tokens periodically.

**HMAC Request Signing:**
- Issue: Per CLAUDE.md, `IoTClient` uses "HMAC-SHA256 request signing" with "nonce/timestamp management". No details on nonce collision prevention, timestamp window, or replay attack mitigation.
- Files affected: `src/client.ts`
- Current mitigation: HMAC + nonce + timestamp present
- Risk: If timestamp window is too large (e.g., 1 hour), replay attacks are possible. If nonce generation is weak or reused, same signature can be replayed. No mention of SID/token rotation.
- Recommendations: Add unit tests verifying nonce never repeats within a session. Set conservative timestamp window (e.g., 30 seconds). Document nonce/timestamp requirements. Consider adding request sequence counter as additional protection.

**Configuration Secrets:**
- Issue: No mention of how API credentials, device tokens, or secrets are stored. `.env` file structure not documented.
- Files affected: `src/settings.ts`
- Current mitigation: Unknown
- Risk: If credentials are logged, hardcoded, or stored plaintext in Homebridge config, they could leak. No mention of credential rotation.
- Recommendations: Document credential storage. Recommend `~/.homebridge/config.json` is not world-readable (already best practice for Homebridge). Avoid logging credentials even in debug mode. Consider env var override for each secret.

## Dependencies at Risk

**Homebridge API Dependency:**
- Package: `homebridge` (version not visible)
- Risk: Plugin is tightly coupled to Homebridge `DynamicPlatformPlugin` API. If Homebridge changes plugin API significantly (major version bump), entire plugin may break.
- Impact: New Homebridge versions could be incompatible without plugin updates.
- Mitigation: Package.json should pin Homebridge major version (e.g., `^4.3.0`). Monitor Homebridge release notes.

**Node.js HMAC/AES Libraries:**
- Risk: Using Node.js built-in `crypto` module is safe, but if code directly uses deprecated APIs (e.g., `crypto.Cipher` without `createCipheriv`), Node.js version bumps could break plugin.
- Impact: Node 22+ may deprecate unsafe crypto APIs.
- Mitigation: Ensure code uses `createCipheriv` / `createHmac` (safe APIs). Add Node 22 to CI test matrix eventually.

## Scaling Limits

**Device Discovery at Startup:**
- Issue: Per CLAUDE.md, platform discovers devices "via API" at startup. If user has many Neakasa devices (e.g., 20+), discovery could time out or fail.
- Files affected: `src/platform.ts`, `src/api.ts`
- Current capacity: Unknown (not documented)
- Limit: Likely hits API rate limits or socket timeout if discovering 10+ devices sequentially.
- Scaling path: Implement parallel device fetches with concurrency limit. Add pagination if API supports it. Cache device list with TTL.

**Polling Overhead:**
- Issue: Each device is polled on a per-device interval. If 10 devices are configured, that's 10 concurrent HTTP requests per poll cycle.
- Files affected: `src/platform.ts`
- Current capacity: Unknown
- Limit: Could cause high CPU/network usage with 20+ devices or if poll interval is <30 seconds.
- Scaling path: Implement request batching (fetch multiple device states in one request if API supports). Add configurable global poll interval cap. Add per-device rate limiting.

## Known Fragile Areas

**Configuration Validation:**
- Files: `src/platform.ts` (sanitizeConfig)
- Why fragile: 5-tier merge precedence is complex. Invalid config at any tier could silently be overridden. No clear error messages for config mistakes.
- Safe modification: Add unit tests for sanitizeConfig covering all merge paths. Add explicit config schema validation (e.g., with `ajv` library). Log final resolved config at startup.
- Test coverage: Config tests exist but likely incomplete (only `test/platform-config.test.ts`).

**Feature Flag Service Creation:**
- Files: `src/accessory.ts`
- Why fragile: 17+ flags and dynamic cat sensors. Service creation happens per-accessory during initialization. If a flag check is wrong, services silently missing. If cat_list is malformed, service creation could crash.
- Safe modification: Add service creation tests for each flag combination. Add null/undefined checks for cat_list. Log which services are created for each accessory.
- Test coverage: No visible service creation tests in provided test file names.

**Authentication Token Refresh:**
- Files: `src/api.ts`
- Why fragile: 6-stage auth with no clear recovery if one stage fails. Token refresh timing not documented. If token expires between refresh checks, next API call fails silently.
- Safe modification: Add explicit error handling for each auth stage. Implement proactive token refresh before expiry (not just on error). Log token lifecycle events. Add retry logic with exponential backoff.
- Test coverage: No auth stage tests visible.

## Missing Critical Features

**No Configuration UI:**
- Problem: Users must edit `config.json` directly to configure 17+ feature flags, 3 profile layers, and device overrides. Complex merge precedence means users cannot easily reason about final config.
- Blocks: Casual users cannot use plugin without understanding CLAUDE.md config documentation. User error rate likely high (wrong flags, invalid device IDs).
- Recommendation: Add Homebridge UI plugin support (Dynamic Platform UI API) to expose config via web UI with visual form validation.

**No Credential Rotation:**
- Problem: API credentials are static. No documented way to refresh credentials without restarting plugin.
- Blocks: If credentials are compromised, user must restart Homebridge to refresh them.
- Recommendation: Implement periodic credential refresh without restart. Document credential update procedure.

**No Metrics or Observability:**
- Problem: No logging of poll frequency, auth failures, device discovery timing, or error rates. Users cannot diagnose performance issues.
- Blocks: Plugin failures are silent. No way to verify polling is active.
- Recommendation: Add debug logging (configurable level). Add metrics export (e.g., Prometheus format) for monitoring. Log at each polling cycle, auth stage, and error.

## Build and Deployment Concerns

**CI/CD Workflows:**
- Issue: GitHub Actions workflows created during migration (per memory/2026-03-28.md). Lightweight approach to avoid ToS violations from previous Docker-heavy CI.
- Impact: Workflows are new and untested. NPM publish workflow has no validation that published package is actually functional.
- Recommendation: Verify workflows run successfully on first commit. Add npm publish smoke test (e.g., install package locally and require()). Add release notes generation.

**No Pre-commit Hooks:**
- Issue: ESLint configured with `--max-warnings=0` but no pre-commit hook to enforce linting before push.
- Impact: Developers can commit linting violations, CI catches them, but code review cycle is longer.
- Recommendation: Add `husky` + `lint-staged` to enforce linting on commit.

**Missing CHANGELOG Updates:**
- Issue: CHANGELOG.md exists but may not be auto-updated. No version bump guidance.
- Impact: If npm publish workflow triggers on `release`, but CHANGELOG is outdated, version numbers mismatch.
- Recommendation: Document semantic versioning scheme. Add guidance to update CHANGELOG before releases. Consider auto-generating CHANGELOG from commit messages (conventional commits).

---

*Concerns audit: 2026-04-09*
