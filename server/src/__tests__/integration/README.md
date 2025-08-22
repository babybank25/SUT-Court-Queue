# Integration Tests - SUT Court Queue System

This directory contains comprehensive integration tests that verify the complete functionality of the SUT Court Queue system. These tests cover end-to-end user workflows, real-time functionality, and system performance under various conditions.

## 📋 Test Coverage

### Requirements Coverage

The integration tests cover all major requirements from the system specification:

#### Requirement 1: Queue Management
- ✅ **1.1** - Team queue joining and position display
- ✅ **1.2** - Queue form validation and submission
- ✅ **1.3** - Team information storage and retrieval
- ✅ **1.4** - Error handling and user feedback
- ✅ **1.5** - Queue capacity management

#### Requirement 2: Live Match Display
- ✅ **2.1** - Real-time score display
- ✅ **2.2** - Match status updates within 5 seconds
- ✅ **2.3** - Match type and target score display
- ✅ **2.4** - Match duration and timing
- ✅ **2.5** - Match event history

#### Requirement 3: Match Confirmation
- ✅ **3.1** - Team result confirmation
- ✅ **3.2** - Confirmation status display
- ✅ **3.3** - Bilateral confirmation requirement
- ✅ **3.4** - Timeout handling
- ✅ **3.5** - Admin force resolution

#### Requirement 4: Admin Management
- ✅ **4.1** - Admin dashboard display
- ✅ **4.2** - Match start/stop controls
- ✅ **4.3** - Team management operations
- ✅ **4.4** - Statistics and reporting
- ✅ **4.5** - Force resolution capabilities

#### Requirement 5: Court Status
- ✅ **5.1** - Court status display
- ✅ **5.2** - Champion return mode
- ✅ **5.3** - Time zone handling (Asia/Bangkok)
- ✅ **5.4** - Real-time status updates

#### Requirement 6: System Navigation
- ✅ **6.1** - Tab navigation between views
- ✅ **6.2** - Session state maintenance
- ✅ **6.3** - Admin authentication
- ✅ **6.4** - Responsive design
- ✅ **6.5** - Error handling and recovery

## 🧪 Test Suites

### 1. End-to-End Workflows (`end-to-end-workflows.test.ts`)

**Purpose**: Tests complete user workflows from queue joining to match completion.

**Key Test Scenarios**:
- Complete basketball court session workflow
- Admin force resolution workflow
- Multi-client real-time synchronization
- Error handling and recovery
- Performance and scalability
- Champion return mode workflow

**Coverage**:
- Queue management API endpoints
- Match management API endpoints
- WebSocket real-time updates
- Admin operations
- Error scenarios

### 2. Complete User Journey (`complete-user-journey.test.ts`)

**Purpose**: Comprehensive user scenarios covering all system interactions throughout a typical day.

**Key Test Scenarios**:
- Complete day at the basketball court
- Error scenarios throughout the day
- Concurrent operations during peak hours
- Data consistency across all operations
- Real-time synchronization during complex workflows

**Coverage**:
- Morning setup and team arrivals
- Multiple match sessions
- Champion return mode
- Disputed result handling
- End-of-day statistics

### 3. Multi-Client Real-time (`multi-client-realtime.test.ts`)

**Purpose**: Tests real-time functionality across multiple connected clients.

**Key Test Scenarios**:
- Queue updates across multiple clients
- Multiple simultaneous queue joins
- Client disconnection and reconnection
- Match updates to all spectators
- Match confirmation from multiple clients
- High-frequency updates without message loss
- Mixed API and WebSocket operations
- Error handling in multi-client environment

**Coverage**:
- WebSocket connection management
- Real-time event broadcasting
- Client state synchronization
- Connection resilience
- Race condition handling

### 4. Real-time Stress Testing (`realtime-stress-test.test.ts`)

**Purpose**: Performance and scalability testing under high load conditions.

**Key Test Scenarios**:
- 50 concurrent spectators during active match
- Rapid queue operations with multiple clients
- Concurrent API and WebSocket operations
- Connection drops and reconnections during operations
- Memory and resource management under sustained load
- Malformed message handling
- Database connection recovery

**Coverage**:
- Performance benchmarks
- Resource utilization
- Error recovery mechanisms
- System stability under stress
- Memory leak prevention

## 🚀 Running the Tests

### Prerequisites

1. **Node.js** (v18 or higher)
2. **npm** or **yarn**
3. **SQLite** (for test database)
4. **All dependencies installed**:
   ```bash
   cd server
   npm install
   ```

### Running Individual Test Suites

```bash
# Run end-to-end workflow tests
npm test -- --testPathPattern=end-to-end-workflows

# Run complete user journey tests
npm test -- --testPathPattern=complete-user-journey

# Run multi-client real-time tests
npm test -- --testPathPattern=multi-client-realtime

# Run stress tests
npm test -- --testPathPattern=realtime-stress-test
```

### Running All Integration Tests

```bash
# Run all integration tests
npm test -- --testPathPattern=integration

# Run with coverage
npm test -- --testPathPattern=integration --coverage

# Run with verbose output
npm test -- --testPathPattern=integration --verbose
```

### Using the Test Runner

For a comprehensive test report with requirements coverage:

```bash
# Run the custom test runner
npx ts-node src/__tests__/integration/run-integration-tests.ts
```

This will provide:
- Detailed test execution report
- Requirements coverage analysis
- Performance metrics
- Recommendations for improvements

## 📊 Test Metrics and Benchmarks

### Performance Benchmarks

- **Queue Operations**: < 500ms response time
- **Match Updates**: < 5 seconds propagation time
- **Concurrent Users**: Support for 50+ simultaneous connections
- **API Throughput**: > 100 requests/second
- **WebSocket Messages**: > 1000 messages/second

### Success Criteria

- **Test Pass Rate**: > 95%
- **Requirements Coverage**: 100%
- **Performance Tests**: All benchmarks met
- **Error Recovery**: All scenarios handled gracefully
- **Memory Usage**: No memory leaks detected

## 🔧 Test Configuration

### Environment Variables

```bash
# Test database configuration
TEST_DB_PATH=":memory:"

# Test server configuration
TEST_PORT=0  # Use random available port

# Test timeouts
TEST_TIMEOUT=30000  # 30 seconds

# WebSocket configuration
WS_TIMEOUT=5000     # 5 seconds
```

### Jest Configuration

The tests use the following Jest configuration:

```javascript
{
  testEnvironment: 'node',
  testTimeout: 30000,
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/**/*.d.ts'
  ]
}
```

## 🐛 Debugging Tests

### Common Issues and Solutions

1. **Port Already in Use**
   ```bash
   # Kill processes using the port
   lsof -ti:3000 | xargs kill -9
   ```

2. **Database Lock Issues**
   ```bash
   # Clear test database
   rm -f test.db*
   ```

3. **WebSocket Connection Timeouts**
   - Increase timeout values in test configuration
   - Check firewall settings
   - Verify server is properly started

4. **Memory Issues with Large Test Suites**
   ```bash
   # Run tests with increased memory
   node --max-old-space-size=4096 node_modules/.bin/jest
   ```

### Debug Mode

Run tests with debug output:

```bash
# Enable debug logging
DEBUG=* npm test -- --testPathPattern=integration

# Enable specific debug categories
DEBUG=socket.io:* npm test -- --testPathPattern=integration
```

## 📈 Continuous Integration

### GitHub Actions Configuration

```yaml
name: Integration Tests
on: [push, pull_request]

jobs:
  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:integration
      - uses: codecov/codecov-action@v1
```

### Pre-commit Hooks

```bash
# Install husky for pre-commit hooks
npm install --save-dev husky

# Add pre-commit hook
npx husky add .husky/pre-commit "npm run test:integration"
```

## 📚 Best Practices

### Writing Integration Tests

1. **Test Real User Scenarios**: Focus on complete workflows rather than isolated functions
2. **Use Realistic Data**: Test with data that resembles production usage
3. **Test Error Conditions**: Include negative test cases and error scenarios
4. **Performance Testing**: Include performance assertions and benchmarks
5. **Clean Up Resources**: Properly close connections and clean up test data

### Test Organization

1. **Descriptive Test Names**: Use clear, descriptive test names that explain the scenario
2. **Logical Grouping**: Group related tests in describe blocks
3. **Setup and Teardown**: Use proper setup and teardown for consistent test environments
4. **Independent Tests**: Ensure tests can run independently and in any order

### Maintenance

1. **Regular Updates**: Update tests when requirements change
2. **Performance Monitoring**: Monitor test execution times and optimize slow tests
3. **Coverage Analysis**: Regularly review coverage reports and add tests for uncovered areas
4. **Documentation**: Keep test documentation up to date

## 🤝 Contributing

When adding new integration tests:

1. Follow the existing test structure and naming conventions
2. Add appropriate requirements coverage comments
3. Include both positive and negative test scenarios
4. Update this README with new test descriptions
5. Ensure tests are deterministic and can run in CI/CD

## 📞 Support

For questions about the integration tests:

1. Check the test output and error messages
2. Review the test code for examples
3. Check the main application logs
4. Consult the system requirements document
5. Contact the development team

---

**Last Updated**: January 2024  
**Test Coverage**: 100% of requirements  
**Maintained By**: SUT Court Queue Development Team