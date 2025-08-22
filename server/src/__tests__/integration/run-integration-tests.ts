#!/usr/bin/env ts-node

/**
 * Integration Test Runner
 * 
 * This script runs all integration tests and provides a comprehensive report
 * covering all requirements from the SUT Court Queue system.
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';

interface TestResult {
  testFile: string;
  passed: boolean;
  duration: number;
  error?: string;
  coverage?: {
    statements: number;
    branches: number;
    functions: number;
    lines: number;
  };
}

interface TestSuite {
  name: string;
  description: string;
  testFiles: string[];
  requirements: string[];
}

const testSuites: TestSuite[] = [
  {
    name: 'End-to-End Workflows',
    description: 'Complete user workflows from queue join to match completion',
    testFiles: ['end-to-end-workflows.test.ts'],
    requirements: [
      '1.1 - Team queue joining and position management',
      '1.2 - Queue form validation and submission',
      '1.3 - Team information storage and display',
      '2.1 - Live match score display',
      '2.2 - Real-time match updates',
      '3.1 - Match result confirmation',
      '3.2 - Confirmation timeout handling',
      '4.1 - Admin dashboard functionality',
      '4.2 - Admin match management',
      '5.1 - Court status display',
      '6.1 - Navigation between views'
    ]
  },
  {
    name: 'Complete User Journey',
    description: 'Comprehensive user scenarios covering all system interactions',
    testFiles: ['complete-user-journey.test.ts'],
    requirements: [
      '1.1 - Queue management throughout the day',
      '2.1 - Match viewing and spectating',
      '3.1 - Result confirmation workflows',
      '4.1 - Admin operations and management',
      '5.1 - Court status and timing',
      '6.1 - Cross-component navigation'
    ]
  },
  {
    name: 'Multi-Client Real-time',
    description: 'Real-time functionality across multiple connected clients',
    testFiles: ['multi-client-realtime.test.ts'],
    requirements: [
      '2.2 - Real-time updates within 5 seconds',
      '5.4 - WebSocket connectivity and broadcasting',
      '1.5 - Queue position updates across clients',
      '2.4 - Match status synchronization',
      '3.4 - Confirmation status broadcasting'
    ]
  },
  {
    name: 'Real-time Stress Testing',
    description: 'Performance and scalability under high load',
    testFiles: ['realtime-stress-test.test.ts'],
    requirements: [
      '2.2 - System performance under load',
      '5.4 - WebSocket connection management',
      '6.5 - Error handling and recovery',
      '1.4 - System reliability',
      'Performance - High concurrent user support'
    ]
  }
];

class IntegrationTestRunner {
  private results: TestResult[] = [];
  private startTime: number = 0;
  private endTime: number = 0;

  async runAllTests(): Promise<void> {
    console.log('🚀 Starting SUT Court Queue Integration Tests\n');
    console.log('=' .repeat(60));
    
    this.startTime = Date.now();

    for (const suite of testSuites) {
      await this.runTestSuite(suite);
    }

    this.endTime = Date.now();
    this.generateReport();
  }

  private async runTestSuite(suite: TestSuite): Promise<void> {
    console.log(`\n📋 Running Test Suite: ${suite.name}`);
    console.log(`📝 Description: ${suite.description}`);
    console.log(`🎯 Requirements Covered:`);
    suite.requirements.forEach(req => console.log(`   • ${req}`));
    console.log('-'.repeat(50));

    for (const testFile of suite.testFiles) {
      await this.runTestFile(testFile);
    }
  }

  private async runTestFile(testFile: string): Promise<void> {
    const testPath = path.join(__dirname, testFile);
    
    if (!existsSync(testPath)) {
      console.log(`❌ Test file not found: ${testFile}`);
      this.results.push({
        testFile,
        passed: false,
        duration: 0,
        error: 'Test file not found'
      });
      return;
    }

    console.log(`🧪 Running: ${testFile}`);
    
    const startTime = Date.now();
    
    try {
      // Run Jest for specific test file
      const command = `npx jest ${testPath} --verbose --detectOpenHandles --forceExit`;
      const output = execSync(command, { 
        encoding: 'utf8',
        timeout: 120000, // 2 minutes timeout
        cwd: path.join(__dirname, '../../../..')
      });
      
      const duration = Date.now() - startTime;
      
      console.log(`✅ Passed: ${testFile} (${duration}ms)`);
      
      this.results.push({
        testFile,
        passed: true,
        duration
      });
      
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      console.log(`❌ Failed: ${testFile} (${duration}ms)`);
      console.log(`   Error: ${error.message}`);
      
      this.results.push({
        testFile,
        passed: false,
        duration,
        error: error.message
      });
    }
  }

  private generateReport(): void {
    const totalDuration = this.endTime - this.startTime;
    const passedTests = this.results.filter(r => r.passed);
    const failedTests = this.results.filter(r => !r.passed);
    const successRate = (passedTests.length / this.results.length) * 100;

    console.log('\n' + '='.repeat(60));
    console.log('📊 INTEGRATION TEST REPORT');
    console.log('='.repeat(60));
    
    console.log(`\n⏱️  Total Duration: ${totalDuration}ms (${(totalDuration / 1000).toFixed(2)}s)`);
    console.log(`📈 Success Rate: ${successRate.toFixed(1)}% (${passedTests.length}/${this.results.length})`);
    
    if (passedTests.length > 0) {
      console.log(`\n✅ PASSED TESTS (${passedTests.length}):`);
      passedTests.forEach(result => {
        console.log(`   • ${result.testFile} - ${result.duration}ms`);
      });
    }
    
    if (failedTests.length > 0) {
      console.log(`\n❌ FAILED TESTS (${failedTests.length}):`);
      failedTests.forEach(result => {
        console.log(`   • ${result.testFile} - ${result.error}`);
      });
    }

    console.log('\n📋 REQUIREMENTS COVERAGE:');
    this.generateRequirementsCoverage();

    console.log('\n🎯 TEST CATEGORIES SUMMARY:');
    this.generateCategorySummary();

    console.log('\n💡 RECOMMENDATIONS:');
    this.generateRecommendations();

    console.log('\n' + '='.repeat(60));
    
    if (failedTests.length === 0) {
      console.log('🎉 ALL INTEGRATION TESTS PASSED!');
      console.log('✨ The SUT Court Queue system is ready for deployment.');
    } else {
      console.log('⚠️  Some integration tests failed.');
      console.log('🔧 Please review and fix the failing tests before deployment.');
    }
    
    console.log('='.repeat(60));
  }

  private generateRequirementsCoverage(): void {
    const allRequirements = new Set<string>();
    const coveredRequirements = new Set<string>();

    testSuites.forEach(suite => {
      suite.requirements.forEach(req => {
        allRequirements.add(req);
        
        // Check if any test in this suite passed
        const suiteHasPassed = suite.testFiles.some(testFile => 
          this.results.find(r => r.testFile === testFile)?.passed
        );
        
        if (suiteHasPassed) {
          coveredRequirements.add(req);
        }
      });
    });

    const coveragePercentage = (coveredRequirements.size / allRequirements.size) * 100;
    
    console.log(`   Coverage: ${coveragePercentage.toFixed(1)}% (${coveredRequirements.size}/${allRequirements.size})`);
    
    const uncoveredRequirements = Array.from(allRequirements).filter(req => 
      !coveredRequirements.has(req)
    );
    
    if (uncoveredRequirements.length > 0) {
      console.log(`   ⚠️  Uncovered Requirements:`);
      uncoveredRequirements.forEach(req => {
        console.log(`      • ${req}`);
      });
    }
  }

  private generateCategorySummary(): void {
    const categories = [
      { name: 'Queue Management', tests: ['end-to-end-workflows.test.ts', 'complete-user-journey.test.ts'] },
      { name: 'Match Operations', tests: ['end-to-end-workflows.test.ts', 'multi-client-realtime.test.ts'] },
      { name: 'Real-time Updates', tests: ['multi-client-realtime.test.ts', 'realtime-stress-test.test.ts'] },
      { name: 'Admin Functions', tests: ['complete-user-journey.test.ts', 'end-to-end-workflows.test.ts'] },
      { name: 'Error Handling', tests: ['realtime-stress-test.test.ts', 'complete-user-journey.test.ts'] },
      { name: 'Performance', tests: ['realtime-stress-test.test.ts'] }
    ];

    categories.forEach(category => {
      const categoryResults = this.results.filter(r => 
        category.tests.includes(r.testFile)
      );
      
      const passed = categoryResults.filter(r => r.passed).length;
      const total = categoryResults.length;
      const status = passed === total ? '✅' : passed > 0 ? '⚠️' : '❌';
      
      console.log(`   ${status} ${category.name}: ${passed}/${total} tests passed`);
    });
  }

  private generateRecommendations(): void {
    const failedTests = this.results.filter(r => !r.passed);
    const slowTests = this.results.filter(r => r.duration > 30000); // > 30 seconds
    
    if (failedTests.length === 0) {
      console.log('   ✨ All tests are passing! Consider adding more edge case tests.');
    } else {
      console.log('   🔧 Fix failing tests to ensure system reliability.');
    }
    
    if (slowTests.length > 0) {
      console.log('   ⚡ Consider optimizing slow tests for faster CI/CD:');
      slowTests.forEach(test => {
        console.log(`      • ${test.testFile} (${test.duration}ms)`);
      });
    }
    
    const avgDuration = this.results.reduce((sum, r) => sum + r.duration, 0) / this.results.length;
    if (avgDuration > 15000) {
      console.log('   🚀 Consider parallelizing tests to reduce overall execution time.');
    }
    
    console.log('   📚 Regularly update tests as new features are added.');
    console.log('   🔄 Run integration tests in CI/CD pipeline before deployment.');
  }
}

// Run the tests if this script is executed directly
if (require.main === module) {
  const runner = new IntegrationTestRunner();
  runner.runAllTests().catch(error => {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
  });
}

export { IntegrationTestRunner, TestResult, TestSuite };