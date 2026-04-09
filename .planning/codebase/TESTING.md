# Testing Patterns

**Analysis Date:** 2026-04-09

## Test Framework

**Runner:**
- Jest with ts-jest preset
- Config: `jest.config.js`

**Configuration Details:**
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
};
```

**Assertion Library:**
- Jest built-in assertions

**Run Commands:**
```bash
npm test              # Run all tests
npm test -- --watch   # Watch mode for development
```

**Coverage:**
- No coverage reports currently configured in jest.config.js
- Enforcement: Not yet specified in project

## Test File Organization

**Location:**
- Test files co-located in separate `test/` directory (not alongside source)
- Source in `src/`, tests in `test/`

**Naming:**
- Pattern: `[module-or-feature-name].test.ts`
- Examples from codebase: `accessory-helpers.test.ts`, `encryption.test.ts`, `platform-config.test.ts`

**Structure:**
```
test/
├── accessory-helpers.test.ts      # Accessory service creation helpers
├── encryption.test.ts             # AES-128-CBC encryption utility
└── platform-config.test.ts        # Config validation and merging
```

## Test Scope Areas

**Current Test Coverage (Planned):**

**Unit Tests:**
- Encryption module: `encryption.test.ts`
  - AES-128-CBC encryption/decryption
  - Token handling
  - Edge cases (empty input, invalid key sizes)

- Platform config: `platform-config.test.ts`
  - Config sanitization logic
  - 5-level config precedence merging
  - Device override application
  - Profile assignment
  - Type coercion and validation

- Accessory helpers: `accessory-helpers.test.ts`
  - Service creation based on feature flags
  - Dynamic sensor creation from cat_list
  - Characteristic binding
  - Service removal when flags disabled

**Not Yet Covered (Gap Analysis):**
- API authentication flow (multi-stage token acquisition)
- Device polling and reconnection logic
- HomeKit characteristic updates and command handling
- IoT client request signing (HMAC-SHA256)

## Mocking Patterns

**Framework:** Jest built-in mocking (jest.fn(), jest.mock())

**What to Mock:**
- Homebridge APIs (`PlatformAccessory`, `Service`, `Characteristic`)
- External HTTP calls and NeakasaAPI responses
- Device state for testing accessory behavior
- Logger functions for testing logging behavior

**What NOT to Mock:**
- Encryption functions (test actual cryptographic behavior)
- Config validation logic (test actual merging rules)
- Utility functions that transform data

## Test Data and Fixtures

**Test Data Patterns:**
- Device fixtures should include: `iotId`, `bucketStatus` (0-7), `room_of_bin` (0-2), `cat_list` array
- Config fixtures for each precedence level (deviceOverrides, profiles, defaults)
- Mock API responses matching actual Neakasa API contract

**Location:**
- Fixtures should be created in test files or shared `test/fixtures/` directory (not yet established)
- Consider factory functions for common test objects (e.g., createMockDevice(), createMockConfig())

## Coverage Goals

**Requirements:** Not yet enforced (no coverage threshold set)

**Recommended Coverage Targets (Future):**
- Unit tests: 80%+ for core modules (encryption, config, accessory)
- Integration: 60%+ for platform orchestration
- Critical path (auth, polling): 90%+

**View Coverage:**
```bash
npm test -- --coverage
```

## Build and CI/CD Integration

**CI Pipeline:**
- Runs on Node.js 18 and 20
- Order: lint → build → test
- ESLint with strict warnings policy (`--max-warnings=0`)
- Tests must pass before publishing

**Test Failure Handling:**
- Any test failure blocks build in CI
- ESLint warnings treated as errors in CI

## Async Testing

**Pattern:**
```typescript
describe('asyncFunction', () => {
  it('should resolve with data', async () => {
    const result = await asyncFunction();
    expect(result).toBeDefined();
  });

  it('should reject on error', async () => {
    await expect(asyncFunction()).rejects.toThrow();
  });
});
```

**Guidelines:**
- Use async/await in test functions for readability
- Use jest.fn().mockResolvedValue() for mock promise returns
- Use jest.fn().mockRejectedValue() for mock promise rejections

## Error Testing

**Pattern:**
```typescript
describe('error handling', () => {
  it('should handle API errors', async () => {
    const mockAPI = {
      authenticate: jest.fn().mockRejectedValue(new Error('Auth failed'))
    };
    
    await expect(mockAPI.authenticate()).rejects.toThrow('Auth failed');
    expect(mockAPI.authenticate).toHaveBeenCalled();
  });
});
```

**Guidelines:**
- Test both synchronous throw() and asynchronous Promise rejection
- Verify error messages match expected format
- Test retry logic and reconnection behavior

## Testing Best Practices for This Project

**Config Testing:**
- Test each level of the 5-level precedence hierarchy separately
- Test merge interactions (higher precedence overrides lower)
- Test type coercion and validation rules

**API Testing:**
- Mock each stage of multi-stage auth flow (account hash, login, region, VID, SID, token)
- Test token expiration and renewal
- Test device discovery and property read/write

**Accessory Testing:**
- Test service creation for each feature flag
- Test dynamic sensor creation based on cat_list length
- Test characteristic value updates trigger correct device actions

**Polling Testing:**
- Mock device responses with different states
- Test per-device interval adjustment on error
- Test reconnection logic backoff

## Test Execution in Development

**Watch Mode:**
```bash
npm test -- --watch
```

**Running Specific Test File:**
```bash
npm test encryption.test.ts
```

**Running with Verbose Output:**
```bash
npm test -- --verbose
```

## Known Testing Gaps and Recommendations

**High Priority (Missing):**
- `src/platform.ts`: Device discovery, polling orchestration, reconnection logic
- `src/api.ts`: Authentication flow, device API calls, error recovery
- `src/client.ts`: HMAC request signing, request/response handling

**Medium Priority (Incomplete):**
- `src/accessory.ts`: All service and characteristic handling
- Edge cases in config merging

**Testing Strategy for New Code:**
- Write unit tests for pure functions (encryption, config merge)
- Write integration tests for API communication and device lifecycle
- Write fixture-based tests for accessory service management

---

*Testing analysis: 2026-04-09*
