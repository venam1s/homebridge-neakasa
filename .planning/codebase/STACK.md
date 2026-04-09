# Technology Stack

**Analysis Date:** 2026-04-09

## Languages

**Primary:**
- TypeScript 5.9.3 - All source code in `src/`
- JavaScript - Configuration and build tooling

**Secondary:**
- JSON - Configuration schemas and test fixtures

## Runtime

**Environment:**
- Node.js 18+ (CI tests on Node 18 and 20)

**Package Manager:**
- npm 10+ (implied by lockfile format v3)
- Lockfile: `package-lock.json` (present in git index, `.package-lock.json` in node_modules)

## Frameworks

**Core:**
- Homebridge 1.6.1 - Dynamic platform plugin API for HomeKit integration
- HAP-NodeJS 0.11.2 - HomeKit Accessory Protocol implementation (via Homebridge)

**Testing:**
- Jest 29.7.0 - Test framework and runner
- ts-jest 29.4.6 - TypeScript preprocessor for Jest

**Build/Dev:**
- TypeScript 5.9.3 - Compilation (configured in `tsconfig.json`)
- ESLint 8.57.1 - Linting (configuration in `.eslintrc`)
- nodemon - Watch mode for development (referenced in npm scripts)

## Key Dependencies

**Critical:**
- axios 1.13.5 - HTTP client for Neakasa API communication
- @types/node 20.19.33 - Node.js type definitions

**Built-in (Node.js standard library):**
- `crypto` - AES-128-CBC encryption for API token handling (see `src/encryption.ts`)
- `http/https` - HTTP client protocol support (via axios)

## Configuration

**Environment:**
- Configuration via Homebridge config.json schema
- Per-device overrides via `deviceOverrides[].fields`
- Profile-based settings via `profiles[name]`
- Global defaults layer
- Built-in hard-coded defaults (see `src/settings.ts`)

**Build:**
- `tsconfig.json` - TypeScript compilation configuration
- `.eslintrc` - ESLint linting rules
- `jest.config.js` - Jest testing configuration
- `.npmignore` - Package publication exclusions

## Platform Requirements

**Development:**
- Node.js 18 or 20
- npm 10+
- TypeScript 5.9.3
- ESLint 8.57.1 for linting (max warnings = 0, strict mode)

**Production:**
- Node.js 18+
- Homebridge 1.6.1+ installed and running
- Valid Neakasa account and device credentials in Homebridge config

## Code Style

- Single quotes, 2-space indentation, semicolons required
- 140-character line maximum
- `no-non-null-assertion` allowed (TypeScript strict mode override)
- `no-explicit-any` allowed for external API types

---

*Stack analysis: 2026-04-09*
