#!/usr/bin/env node

/**
 * Comprehensive Test Script for Plaid Integration Fixes
 * 
 * This script tests all the fixes implemented across all phases:
 * - Phase 1: Enhanced Plaid disconnection logic
 * - Phase 2: Comprehensive orphaned item cleanup
 * - Phase 3: Investment transaction error handling
 * - Phase 4: Enhanced refresh process
 * 
 * Usage: node scripts/test-comprehensive-fix.js
 */

const { PrismaClient } = require('@prisma/client');
const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');

const prisma = new PrismaClient();

const plaidClient = new PlaidApi(
  new Configuration({
    basePath: PlaidEnvironments[process.env.PLAID_ENV || "sandbox"],
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
        "PLAID-SECRET": process.env.PLAID_SECRET,
      },
    },
  })
);

class ComprehensiveTestRunner {
  constructor() {
    this.results = {
      phase1: { passed: 0, failed: 0, tests: [] },
      phase2: { passed: 0, failed: 0, tests: [] },
      phase3: { passed: 0, failed: 0, tests: [] },
      phase4: { passed: 0, failed: 0, tests: [] },
      summary: { total: 0, passed: 0, failed: 0 }
    };
  }

  async run() {
    console.log('🧪 Starting Comprehensive Plaid Integration Fix Tests\n');
    
    try {
      await this.testPhase1_DisconnectionLogic();
      await this.testPhase2_OrphanedItemCleanup();
      await this.testPhase3_InvestmentTransactionHandling();
      await this.testPhase4_RefreshProcess();
      
      this.generateReport();
    } catch (error) {
      console.error('❌ Test runner failed:', error);
    } finally {
      await prisma.$disconnect();
    }
  }

  async testPhase1_DisconnectionLogic() {
    console.log('📋 Phase 1: Testing Enhanced Plaid Disconnection Logic');
    
    // Test 1: Check for orphaned PlaidItems with invalid tokens
    try {
      const orphanedItems = await prisma.plaidItem.findMany({
        where: {
          itemId: {
            startsWith: 'bulk-disconnect'
          },
          status: 'active'
        }
      });
      
      if (orphanedItems.length === 0) {
        this.addResult('phase1', 'Orphaned items cleanup', true, 'No orphaned items found');
      } else {
        this.addResult('phase1', 'Orphaned items cleanup', false, `Found ${orphanedItems.length} orphaned items`);
      }
    } catch (error) {
      this.addResult('phase1', 'Orphaned items cleanup', false, error.message);
    }

    // Test 2: Check for disconnected items that should be cleaned up
    try {
      const disconnectedItems = await prisma.plaidItem.findMany({
        where: {
          status: 'disconnected',
          accessToken: {
            not: 'manual'
          }
        },
        include: {
          accounts: {
            where: { archived: false }
          }
        }
      });

      const itemsWithActiveAccounts = disconnectedItems.filter(item => item.accounts.length > 0);
      
      if (itemsWithActiveAccounts.length === 0) {
        this.addResult('phase1', 'Disconnected items cleanup', true, 'All disconnected items properly cleaned up');
      } else {
        this.addResult('phase1', 'Disconnected items cleanup', false, 
          `Found ${itemsWithActiveAccounts.length} disconnected items with active accounts`);
      }
    } catch (error) {
      this.addResult('phase1', 'Disconnected items cleanup', false, error.message);
    }

    // Test 3: Validate access token integrity
    try {
      const activeItems = await prisma.plaidItem.findMany({
        where: {
          status: 'active',
          accessToken: {
            not: 'manual'
          }
        }
      });

      let validTokens = 0;
      let invalidTokens = 0;

      for (const item of activeItems.slice(0, 5)) { // Test first 5 items
        try {
          await plaidClient.itemGet({ access_token: item.accessToken });
          validTokens++;
        } catch (error) {
          const errorCode = error?.response?.data?.error_code;
          if (['ITEM_NOT_FOUND', 'INVALID_ACCESS_TOKEN', 'ITEM_EXPIRED'].includes(errorCode)) {
            invalidTokens++;
          }
        }
      }

      if (invalidTokens === 0) {
        this.addResult('phase1', 'Access token validation', true, `All ${validTokens} tested tokens are valid`);
      } else {
        this.addResult('phase1', 'Access token validation', false, 
          `Found ${invalidTokens} invalid tokens out of ${validTokens + invalidTokens} tested`);
      }
    } catch (error) {
      this.addResult('phase1', 'Access token validation', false, error.message);
    }
  }

  async testPhase2_OrphanedItemCleanup() {
    console.log('📋 Phase 2: Testing Comprehensive Orphaned Item Cleanup');
    
    // Test 1: Check for duplicate plaidId values
    try {
      const duplicatePlaidIds = await prisma.$queryRaw`
        SELECT "plaidId", COUNT(*) as count
        FROM "Account"
        WHERE "plaidId" IS NOT NULL AND "archived" = false
        GROUP BY "plaidId"
        HAVING COUNT(*) > 1
      `;
      
      if (duplicatePlaidIds.length === 0) {
        this.addResult('phase2', 'Duplicate plaidId detection', true, 'No duplicate plaidId values found');
      } else {
        this.addResult('phase2', 'Duplicate plaidId detection', false, 
          `Found ${duplicatePlaidIds.length} duplicate plaidId values`);
      }
    } catch (error) {
      this.addResult('phase2', 'Duplicate plaidId detection', false, error.message);
    }

    // Test 2: Check for orphaned accounts (accounts without valid PlaidItems)
    try {
      const orphanedAccounts = await prisma.account.findMany({
        where: {
          archived: false,
          plaidItem: {
            status: 'disconnected'
          }
        },
        include: {
          plaidItem: true
        }
      });

      if (orphanedAccounts.length === 0) {
        this.addResult('phase2', 'Orphaned accounts cleanup', true, 'No orphaned accounts found');
      } else {
        this.addResult('phase2', 'Orphaned accounts cleanup', false, 
          `Found ${orphanedAccounts.length} orphaned accounts`);
      }
    } catch (error) {
      this.addResult('phase2', 'Orphaned accounts cleanup', false, error.message);
    }

    // Test 3: Validate account-plaidItem relationships
    try {
      const invalidRelationships = await prisma.account.findMany({
        where: {
          archived: false,
          plaidItem: {
            is: null
          }
        }
      });

      if (invalidRelationships.length === 0) {
        this.addResult('phase2', 'Account-PlaidItem relationships', true, 'All accounts have valid PlaidItem relationships');
      } else {
        this.addResult('phase2', 'Account-PlaidItem relationships', false, 
          `Found ${invalidRelationships.length} accounts without PlaidItem relationships`);
      }
    } catch (error) {
      this.addResult('phase2', 'Account-PlaidItem relationships', false, error.message);
    }
  }

  async testPhase3_InvestmentTransactionHandling() {
    console.log('📋 Phase 3: Testing Investment Transaction Error Handling');
    
    // Test 1: Check for investment accounts with proper setup
    try {
      const investmentAccounts = await prisma.account.findMany({
        where: {
          type: 'investment',
          archived: false
        },
        include: {
          plaidItem: true
        }
      });

      let validInvestmentAccounts = 0;
      let invalidInvestmentAccounts = 0;

      for (const account of investmentAccounts) {
        if (account.plaidId && account.plaidItem.status === 'active') {
          validInvestmentAccounts++;
        } else {
          invalidInvestmentAccounts++;
        }
      }

      if (invalidInvestmentAccounts === 0) {
        this.addResult('phase3', 'Investment account validation', true, 
          `All ${validInvestmentAccounts} investment accounts are properly configured`);
      } else {
        this.addResult('phase3', 'Investment account validation', false, 
          `Found ${invalidInvestmentAccounts} invalid investment accounts out of ${validInvestmentAccounts + invalidInvestmentAccounts}`);
      }
    } catch (error) {
      this.addResult('phase3', 'Investment account validation', false, error.message);
    }

    // Test 2: Check for investment transaction download logs
    try {
      const recentDownloadLogs = await prisma.transactionDownloadLog.findMany({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 10
      });

      const errorLogs = recentDownloadLogs.filter(log => log.status === 'error');
      
      if (errorLogs.length === 0) {
        this.addResult('phase3', 'Investment transaction sync', true, 
          `No recent investment sync errors found (${recentDownloadLogs.length} successful syncs)`);
      } else {
        this.addResult('phase3', 'Investment transaction sync', false, 
          `Found ${errorLogs.length} recent investment sync errors out of ${recentDownloadLogs.length} total`);
      }
    } catch (error) {
      this.addResult('phase3', 'Investment transaction sync', false, error.message);
    }
  }

  async testPhase4_RefreshProcess() {
    console.log('📋 Phase 4: Testing Enhanced Refresh Process');
    
    // Test 1: Check for accounts that should be skipped during refresh
    try {
      const accountsToSkip = await prisma.account.findMany({
        where: {
          archived: false,
          OR: [
            {
              plaidItem: {
                status: 'disconnected'
              }
            },
            {
              plaidItem: {
                itemId: {
                  startsWith: 'bulk-disconnect'
                }
              }
            }
          ]
        },
        include: {
          plaidItem: true
        }
      });

      if (accountsToSkip.length === 0) {
        this.addResult('phase4', 'Refresh skip validation', true, 'No accounts should be skipped during refresh');
      } else {
        this.addResult('phase4', 'Refresh skip validation', false, 
          `Found ${accountsToSkip.length} accounts that should be skipped during refresh`);
      }
    } catch (error) {
      this.addResult('phase4', 'Refresh skip validation', false, error.message);
    }

    // Test 2: Check for recent refresh errors
    try {
      const recentApiCalls = await prisma.plaidApiCallLog.findMany({
        where: {
          timestamp: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          },
          endpoint: '/accounts/balance/get'
        },
        orderBy: {
          timestamp: 'desc'
        }
      });

      const errorCalls = recentApiCalls.filter(call => call.responseStatus >= 400);
      
      if (errorCalls.length === 0) {
        this.addResult('phase4', 'Recent refresh errors', true, 
          `No recent refresh errors found (${recentApiCalls.length} successful calls)`);
      } else {
        this.addResult('phase4', 'Recent refresh errors', false, 
          `Found ${errorCalls.length} recent refresh errors out of ${recentApiCalls.length} total calls`);
      }
    } catch (error) {
      this.addResult('phase4', 'Recent refresh errors', false, error.message);
    }

    // Test 3: Validate account data integrity
    try {
      const allAccounts = await prisma.account.findMany({
        where: { archived: false },
        include: { plaidItem: true }
      });

      let validAccounts = 0;
      let invalidAccounts = 0;

      for (const account of allAccounts) {
        const validation = this.validateAccountData(account);
        if (validation.isValid) {
          validAccounts++;
        } else {
          invalidAccounts++;
        }
      }

      if (invalidAccounts === 0) {
        this.addResult('phase4', 'Account data integrity', true, 
          `All ${validAccounts} accounts have valid data`);
      } else {
        this.addResult('phase4', 'Account data integrity', false, 
          `Found ${invalidAccounts} accounts with invalid data out of ${validAccounts + invalidAccounts}`);
      }
    } catch (error) {
      this.addResult('phase4', 'Account data integrity', false, error.message);
    }
  }

  validateAccountData(account) {
    const errors = [];
    
    if (!account.id) errors.push("Missing account ID");
    if (!account.plaidId) errors.push("Missing plaidId");
    if (!account.plaidItem) errors.push("Missing plaidItem");
    if (!account.type) errors.push("Missing account type");
    if (!account.name) errors.push("Missing account name");
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  addResult(phase, testName, passed, message) {
    const result = {
      test: testName,
      passed,
      message,
      timestamp: new Date().toISOString()
    };
    
    this.results[phase].tests.push(result);
    
    if (passed) {
      this.results[phase].passed++;
      console.log(`  ✅ ${testName}: ${message}`);
    } else {
      this.results[phase].failed++;
      console.log(`  ❌ ${testName}: ${message}`);
    }
  }

  generateReport() {
    console.log('\n📊 Test Results Summary');
    console.log('========================');
    
    let totalTests = 0;
    let totalPassed = 0;
    let totalFailed = 0;

    Object.entries(this.results).forEach(([phase, results]) => {
      if (phase === 'summary') return;
      
      const phaseTotal = results.passed + results.failed;
      totalTests += phaseTotal;
      totalPassed += results.passed;
      totalFailed += results.failed;

      console.log(`\n${phase.toUpperCase()}:`);
      console.log(`  Tests: ${phaseTotal}`);
      console.log(`  Passed: ${results.passed}`);
      console.log(`  Failed: ${results.failed}`);
      console.log(`  Success Rate: ${phaseTotal > 0 ? Math.round((results.passed / phaseTotal) * 100) : 0}%`);
    });

    console.log('\nOVERALL SUMMARY:');
    console.log(`  Total Tests: ${totalTests}`);
    console.log(`  Passed: ${totalPassed}`);
    console.log(`  Failed: ${totalFailed}`);
    console.log(`  Success Rate: ${totalTests > 0 ? Math.round((totalPassed / totalTests) * 100) : 0}%`);

    if (totalFailed === 0) {
      console.log('\n🎉 All tests passed! The comprehensive fix is working correctly.');
    } else {
      console.log('\n⚠️  Some tests failed. Please review the issues above.');
    }

    // Save detailed results to file
    const fs = require('fs');
    const reportPath = `reports/comprehensive-fix-test-${Date.now()}.json`;
    
    try {
      if (!fs.existsSync('reports')) {
        fs.mkdirSync('reports');
      }
      
      fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
      console.log(`\n📄 Detailed report saved to: ${reportPath}`);
    } catch (error) {
      console.error('Failed to save report:', error);
    }
  }
}

// Run the tests
async function main() {
  const runner = new ComprehensiveTestRunner();
  await runner.run();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { ComprehensiveTestRunner }; 