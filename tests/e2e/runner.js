#!/usr/bin/env node
/**
 * Standalone E2E Test Runner for Totem Kiosk ↔ FisioFlow CRM Integration.
 * Executes multi-tiered tests covering Tiers 1-4.
 *
 * Usage:
 *   node tests/e2e/runner.js
 *   node tests/e2e/runner.js --tier=1
 *   node tests/e2e/runner.js --filter=idempotency
 *   node tests/e2e/runner.js --verbose
 *   node tests/e2e/runner.js --live-db
 */

import { TestHarness, AssertionError } from './harness.js';
import { tier1Tests } from './tier1-features.test.js';
import { tier2Tests } from './tier2-boundaries.test.js';
import { tier3Tests } from './tier3-combinations.test.js';
import { tier4Tests } from './tier4-scenarios.test.js';
import { tier5Tests } from './tier5-adversarial.test.js';

// --- CLI ARGUMENT PARSING ---
const args = process.argv.slice(2);
const options = {
  tier: null,
  filter: null,
  verbose: false,
  liveDb: false,
  json: false,
};

for (const arg of args) {
  if (arg.startsWith('--tier=')) {
    options.tier = parseInt(arg.split('=')[1], 10);
  } else if (arg.startsWith('--filter=')) {
    options.filter = arg.split('=')[1].toLowerCase();
  } else if (arg === '--verbose' || arg === '-v') {
    options.verbose = true;
  } else if (arg === '--live-db') {
    options.liveDb = true;
  } else if (arg === '--json') {
    options.json = true;
  }
}

// --- COLOR FORMATTING ---
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

function formatPass(text) {
  return `${colors.bold}${colors.green}✓ PASS${colors.reset} ${text}`;
}

function formatFail(text) {
  return `${colors.bold}${colors.red}✗ FAIL${colors.reset} ${text}`;
}

function formatBanner(title) {
  const line = '═'.repeat(70);
  return `\n${colors.bold}${colors.cyan}${line}\n  ${title}\n${line}${colors.reset}\n`;
}

// --- MAIN RUNNER EXECUTION ---
async function runTestSuite() {
  const startTime = performance.now();
  const harness = new TestHarness({ liveDb: options.liveDb });
  harness.setup();

  const allTiers = [
    { num: 1, suite: tier1Tests },
    { num: 2, suite: tier2Tests },
    { num: 3, suite: tier3Tests },
    { num: 4, suite: tier4Tests },
    { num: 5, suite: tier5Tests },
  ];

  const tiersToRun = options.tier
    ? allTiers.filter(t => t.num === options.tier)
    : allTiers;

  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    failures: [],
    details: [],
  };

  if (!options.json) {
    console.log(`${colors.bold}======================================================================${colors.reset}`);
    console.log(`${colors.bold}  Totem Kiosk ↔ FisioFlow CRM End-to-End Test Suite Runner${colors.reset}`);
    console.log(`  Target: Cloudflare Pages Functions (/api/sync) & Totem Client`);
    console.log(`  Mode:   ${options.liveDb ? 'Live Neon Database' : 'Hermetic In-Memory Mock Database'}`);
    if (options.tier) console.log(`  Tier:   Tier ${options.tier} only`);
    if (options.filter) console.log(`  Filter: "${options.filter}"`);
    console.log(`${colors.bold}======================================================================${colors.reset}`);
  }

  for (const { num, suite } of tiersToRun) {
    if (!options.json) {
      console.log(formatBanner(`${suite.name}`));
    }

    const testEntries = Object.entries(suite).filter(([key, val]) => typeof val === 'function');

    for (const [testName, testFn] of testEntries) {
      if (options.filter && !testName.toLowerCase().includes(options.filter)) {
        results.skipped++;
        continue;
      }

      results.total++;
      // Reset harness state (mock DB and DOM shims) before each test for complete isolation
      harness.reset();

      const testStart = performance.now();
      try {
        await testFn(harness);
        const duration = Math.round(performance.now() - testStart);
        results.passed++;
        results.details.push({ tier: num, name: testName, status: 'pass', duration });
        if (!options.json) {
          console.log(`  ${formatPass(testName)} ${colors.gray}(${duration}ms)${colors.reset}`);
        }
      } catch (err) {
        const duration = Math.round(performance.now() - testStart);
        results.failed++;
        const failureInfo = {
          tier: num,
          name: testName,
          status: 'fail',
          duration,
          error: err.message,
          contract: err.contract || '',
          expected: err.expected,
          actual: err.actual,
          stack: err.stack,
        };
        results.failures.push(failureInfo);
        results.details.push(failureInfo);

        if (!options.json) {
          console.log(`  ${formatFail(testName)} ${colors.gray}(${duration}ms)${colors.reset}`);
          if (err.contract) {
            console.log(`    ${colors.yellow}Contract:${colors.reset} ${err.contract}`);
          }
          console.log(`    ${colors.red}${err.message}${colors.reset}`);
          if (options.verbose && err.stack) {
            console.log(`    ${colors.gray}${err.stack}${colors.reset}`);
          }
        }
      }
    }
  }

  harness.teardown();
  const totalDuration = Math.round(performance.now() - startTime);

  if (options.json) {
    console.log(JSON.stringify({ ...results, durationMs: totalDuration }, null, 2));
    process.exit(results.failed === 0 ? 0 : 1);
  }

  // Summary Report
  console.log(`\n${colors.bold}----------------------------------------------------------------------${colors.reset}`);
  console.log(`${colors.bold}TEST SUITE EXECUTION SUMMARY${colors.reset}`);
  console.log(`----------------------------------------------------------------------`);
  console.log(`  Total Tests:    ${results.total}`);
  console.log(`  Passed:         ${colors.green}${results.passed}${colors.reset}`);
  console.log(`  Failed:         ${results.failed > 0 ? colors.red : colors.gray}${results.failed}${colors.reset}`);
  console.log(`  Skipped:        ${results.skipped}`);
  console.log(`  Duration:       ${totalDuration}ms`);
  console.log(`----------------------------------------------------------------------`);

  if (results.failed > 0) {
    console.log(`\n${colors.bold}${colors.red}FAILURES BREAKDOWN FOR MILESTONE WORKERS:${colors.reset}`);
    for (const f of results.failures) {
      console.log(`\n  [Tier ${f.tier}] ${colors.bold}${f.name}${colors.reset}`);
      if (f.contract) console.log(`    ${colors.yellow}Contract Citation:${colors.reset} ${f.contract}`);
      console.log(`    ${colors.red}Error:${colors.reset} ${f.error}`);
    }
    console.log('\n');
    process.exit(1);
  } else {
    console.log(`\n${colors.bold}${colors.green}ALL TESTS PASSED CLEANLY!${colors.reset}\n`);
    process.exit(0);
  }
}

runTestSuite().catch(err => {
  console.error('Fatal error running test suite:', err);
  process.exit(1);
});
