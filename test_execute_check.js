/**
 * Test script for Execute Check validation
 * Tests both Coding Round and System Design Round validation
 */

const TEST_JOB_ID = 'java-backend-dev';

// Test cases for coding round
const CODING_TEST_CASES = [
    {
        name: 'Empty Implementation (Boilerplate Only)',
        code: `
public class Solution {
    public int findLongestSubstring(String s) {
        // TODO: Implement this
        return 0;
    }
}`,
        expectedOutput: '❌ Implementation incomplete',
        description: 'Should detect empty implementation with TODO comment'
    },
    {
        name: 'Syntax Error (Missing Bracket)',
        code: `
public class Solution {
    public int findLongestSubstring(String s) {
        int maxLen = 0;
        for (int i = 0; i < s.length(); i++) {
            maxLen = Math.max(maxLen, i);
        // Missing closing bracket
        return maxLen;
    }
}`,
        expectedOutput: '❌ Compilation failed',
        description: 'Should detect syntax errors'
    },
    {
        name: 'Complete Implementation',
        code: `
public class Solution {
    public int findLongestSubstring(String s) {
        int maxLen = 0;
        Map<Character, Integer> map = new HashMap<>();
        int start = 0;
        
        for (int end = 0; end < s.length(); end++) {
            char c = s.charAt(end);
            if (map.containsKey(c)) {
                start = Math.max(start, map.get(c) + 1);
            }
            map.put(c, end);
            maxLen = Math.max(maxLen, end - start + 1);
        }
        return maxLen;
    }
}`,
        expectedOutput: '✅ Code compiled successfully',
        description: 'Should validate complete, correct implementation'
    },
    {
        name: 'Logic Error (Wrong Algorithm)',
        code: `
public class Solution {
    public int findLongestSubstring(String s) {
        // Wrong approach - just returns string length
        return s.length();
    }
}`,
        expectedOutput: '❌ Logic error',
        description: 'Should detect incorrect logic even if code compiles'
    }
];

// Test cases for system design round
const DESIGN_TEST_CASES = [
    {
        name: 'Empty Design',
        code: 'I will design a system...',
        expectedOutput: '⚠️ Architecture review needed',
        description: 'Should detect incomplete design'
    },
    {
        name: 'Complete System Design',
        code: `
# URL Shortener System Design

## High-Level Architecture
- Load Balancer (NGINX)
- API Gateway
- Application Servers (Node.js cluster)
- Cache Layer (Redis)
- Database (PostgreSQL with read replicas)
- Analytics Service (Kafka + Spark)

## Data Model
- URLs table: id, short_code, original_url, created_at, expires_at
- Analytics table: short_code, clicks, timestamp, user_agent, location

## API Design
POST /api/shorten - Create short URL
GET /{shortCode} - Redirect to original URL
GET /api/stats/{shortCode} - Get analytics

## Scalability Considerations
- Horizontal scaling of app servers
- Database sharding by short_code hash
- CDN for static assets
- Rate limiting per user/IP

## Failure Handling
- Circuit breakers for external services
- Database failover with read replicas
- Retry logic with exponential backoff
`,
        expectedOutput: '✅ Design validated',
        description: 'Should validate complete system design'
    }
];

async function testValidation(testCase, round) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`TEST: ${testCase.name}`);
    console.log(`ROUND: ${round}`);
    console.log(`DESCRIPTION: ${testCase.description}`);
    console.log(`${'='.repeat(80)}\n`);

    try {
        const response = await fetch('http://localhost:3000/api/interview', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Origin': 'http://localhost:3000'
            },
            body: JSON.stringify({
                type: 'validate',
                selectedJobId: TEST_JOB_ID,
                code: testCase.code,
                round: round,
                currentQuestion: round === 'CODING'
                    ? 'Find the longest substring without repeating characters'
                    : 'Design a URL shortener system',
                customInstructions: ''
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        console.log('📊 VALIDATION RESULT:');
        console.log('Terminal Output:', data.text);
        console.log('\nMetrics:', JSON.stringify(data.metrics, null, 2));

        // Check if output matches expected
        const outputMatches = data.text.includes(testCase.expectedOutput.split(':')[0]);
        const status = outputMatches ? '✅ PASS' : '❌ FAIL';

        console.log(`\n${status}: Expected "${testCase.expectedOutput}", Got "${data.text}"`);

        if (data.detailed_analysis) {
            console.log('\n📝 Detailed Analysis (first 200 chars):');
            console.log(data.detailed_analysis.substring(0, 200) + '...');
        }

        return outputMatches;

    } catch (error) {
        console.error('❌ TEST FAILED:', error.message);
        return false;
    }
}

async function runAllTests() {
    console.log('\n🧪 EXECUTE CHECK VALIDATION TEST SUITE\n');
    console.log('Testing validation for Coding and System Design rounds...\n');

    let passed = 0;
    let failed = 0;

    // Test Coding Round
    console.log('\n' + '='.repeat(80));
    console.log('CODING ROUND TESTS');
    console.log('='.repeat(80));

    for (const testCase of CODING_TEST_CASES) {
        const result = await testValidation(testCase, 'CODING');
        if (result) passed++;
        else failed++;
        await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limiting
    }

    // Test System Design Round
    console.log('\n' + '='.repeat(80));
    console.log('SYSTEM DESIGN ROUND TESTS');
    console.log('='.repeat(80));

    for (const testCase of DESIGN_TEST_CASES) {
        const result = await testValidation(testCase, 'SYSTEM_DESIGN');
        if (result) passed++;
        else failed++;
        await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limiting
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('TEST SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Tests: ${passed + failed}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
    console.log('='.repeat(80) + '\n');
}

// Run tests
runAllTests().catch(console.error);
