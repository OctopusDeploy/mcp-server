# Integration Tests

This directory contains integration tests for MCP server tools that test against a real Octopus Deploy instance.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` file in the project root with your Octopus Deploy credentials:
   ```bash
   cp .env.example .env
   ```

3. Edit `.env` and add your actual Octopus Deploy instance URL and API key:
   ```
   OCTOPUS_SERVER_URL=https://your-octopus-instance.octopus.app
   OCTOPUS_API_KEY=API-XXXXXXXXXXXXXXXXXXXXXXXXXX
   TEST_SPACE_NAME=Default
   ```

## Running Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode during development
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run tests with UI (optional)
npx vitest --ui
```

## Test Structure

- **Integration Tests**: Test against real Octopus Deploy API
- **Environment Validation**: Ensures required credentials are available

## Writing New Tests

1. Create a new test file following the pattern: `toolName.integration.test.ts`
2. Use the shared test utilities from `testSetup.ts`
3. Separate the tool registration with the MCP server with the API call handler
4. Follow the existing patterns for success and error scenarios
5. Register your tool with the mock server before testing