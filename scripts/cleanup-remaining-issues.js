#!/usr/bin/env node

/**
 * Cleanup Script for Remaining Plaid Integration Issues
 * 
 * This script addresses the remaining issues found by the comprehensive test:
 * - Disconnected items with active accounts
 * - Orphaned accounts
 * - Accounts that should be skipped during refresh
 * 
 * Usage: node scripts/cleanup-remaining-issues.js
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

class CleanupRunner {
  constructor() {
    this.results = {
      cleaned: 0,
      errors: 0,
      details: []
    };
  }

  async run() {
    console.log('🧹 Starting Cleanup of Remaining Plaid Integration Issues\n');
    
    try {
      await this.cleanupDisconnectedItemsWithActiveAccounts();
      await this.cleanupOrphanedAccounts();
      await this.cleanupAccountsToSkipDuringRefresh();
      
      this.generateReport();
    } catch (error) {
      console.error('❌ Cleanup runner failed:', error);
    } finally {
      await prisma.$disconnect();
    }
  }

  async cleanupDisconnectedItemsWithActiveAccounts() {
    console.log('📋 Cleaning up disconnected items with active accounts...');
    
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
      
      console.log(`Found ${itemsWithActiveAccounts.length} disconnected items with active accounts`);
      
      for (const item of itemsWithActiveAccounts) {
        try {
          console.log(`  Cleaning up item ${item.id} (${item.institutionName}) with ${item.accounts.length} active accounts`);
          
          // Archive all active accounts for this item
          const archivedCount = await prisma.account.updateMany({
            where: { 
              itemId: item.id,
              archived: false
            },
            data: { 
              archived: true,
              updatedAt: new Date()
            }
          });
          
          console.log(`    Archived ${archivedCount.count} accounts`);
          this.results.cleaned += archivedCount.count;
          this.results.details.push(`Archived ${archivedCount.count} accounts for disconnected item ${item.id}`);
          
        } catch (error) {
          console.error(`    Error cleaning up item ${item.id}:`, error.message);
          this.results.errors++;
          this.results.details.push(`Error cleaning up item ${item.id}: ${error.message}`);
        }
      }
      
      console.log(`✅ Cleaned up ${itemsWithActiveAccounts.length} disconnected items\n`);
      
    } catch (error) {
      console.error('❌ Error during disconnected items cleanup:', error);
      this.results.errors++;
    }
  }

  async cleanupOrphanedAccounts() {
    console.log('📋 Cleaning up orphaned accounts...');
    
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

      console.log(`Found ${orphanedAccounts.length} orphaned accounts`);
      
      for (const account of orphanedAccounts) {
        try {
          console.log(`  Archiving orphaned account ${account.id} (${account.name})`);
          
          await prisma.account.update({
            where: { id: account.id },
            data: { 
              archived: true,
              updatedAt: new Date()
            }
          });
          
          this.results.cleaned++;
          this.results.details.push(`Archived orphaned account ${account.id} (${account.name})`);
          
        } catch (error) {
          console.error(`    Error archiving account ${account.id}:`, error.message);
          this.results.errors++;
          this.results.details.push(`Error archiving account ${account.id}: ${error.message}`);
        }
      }
      
      console.log(`✅ Cleaned up ${orphanedAccounts.length} orphaned accounts\n`);
      
    } catch (error) {
      console.error('❌ Error during orphaned accounts cleanup:', error);
      this.results.errors++;
    }
  }

  async cleanupAccountsToSkipDuringRefresh() {
    console.log('📋 Cleaning up accounts that should be skipped during refresh...');
    
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

      console.log(`Found ${accountsToSkip.length} accounts that should be skipped during refresh`);
      
      for (const account of accountsToSkip) {
        try {
          console.log(`  Archiving account ${account.id} (${account.name}) - ${account.plaidItem.status} status`);
          
          await prisma.account.update({
            where: { id: account.id },
            data: { 
              archived: true,
              updatedAt: new Date()
            }
          });
          
          this.results.cleaned++;
          this.results.details.push(`Archived account ${account.id} (${account.name}) - ${account.plaidItem.status} status`);
          
        } catch (error) {
          console.error(`    Error archiving account ${account.id}:`, error.message);
          this.results.errors++;
          this.results.details.push(`Error archiving account ${account.id}: ${error.message}`);
        }
      }
      
      console.log(`✅ Cleaned up ${accountsToSkip.length} accounts that should be skipped\n`);
      
    } catch (error) {
      console.error('❌ Error during accounts to skip cleanup:', error);
      this.results.errors++;
    }
  }

  generateReport() {
    console.log('📊 Cleanup Results Summary');
    console.log('==========================');
    console.log(`  Total Items Cleaned: ${this.results.cleaned}`);
    console.log(`  Errors: ${this.results.errors}`);
    
    if (this.results.details.length > 0) {
      console.log('\n📋 Cleanup Details:');
      this.results.details.forEach(detail => {
        console.log(`  - ${detail}`);
      });
    }
    
    if (this.results.errors === 0) {
      console.log('\n🎉 Cleanup completed successfully!');
    } else {
      console.log('\n⚠️  Cleanup completed with some errors. Please review the details above.');
    }

    // Save detailed results to file
    const fs = require('fs');
    const reportPath = `reports/cleanup-results-${Date.now()}.json`;
    
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

// Run the cleanup
async function main() {
  const runner = new CleanupRunner();
  await runner.run();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { CleanupRunner }; 