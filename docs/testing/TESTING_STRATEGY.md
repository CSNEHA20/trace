# TRACE Testing Strategy & Suite Architecture

## 1. Test Levels
- **Unit Tests:** Jest + `jest-expo` verifying stores, services, utils, database initialization, and cryptographic hashing.
- **Integration Tests:** Pipeline verification tests checking end-to-end evidence capture and verification flow.
- **E2E Tests:** Detox test suite for full UI user flow validation.

## 2. Execution Commands
```bash
# Run unit and architecture tests
npm test

# Run TypeScript type safety checks
npm run validate
```
