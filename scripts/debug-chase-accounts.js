#!/usr/bin/env node

/**
 * Debug Script for Chase Accounts
 * 
 * This script helps debug why Chase accounts are not being found or refreshed.
 * 
 * Usage: node scripts/debug-chase-accounts.js
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function debugChaseAccounts() {
  console.log('🔍 Debugging Chase Accounts (ins_56)\n');
  
  try {
    // Test 1: Check all PlaidItems for Chase
    console.log('📋 Test 1: All PlaidItems for Chase');
    const allPlaidItems = await prisma.plaidItem.findMany({
      where: {
        institutionId: 'ins_56'
      },
      include: {
        accounts: {
          where: { archived: false }
        }
      }
    });
    
    console.log(`Found ${allPlaidItems.length} total PlaidItems for Chase:`);
    allPlaidItems.forEach(item => {
      console.log(`  - ${item.id}: status=${item.status}, accounts=${item.accounts.length}, itemId=${item.itemId}`);
    });
    
    // Test 2: Check all accounts for Chase (any PlaidItem)
    console.log('\n📋 Test 2: All accounts for Chase (any PlaidItem)');
    const allAccounts = await prisma.account.findMany({
      where: {
        archived: false,
        plaidItem: {
          institutionId: 'ins_56'
        }
      },
      include: {
        plaidItem: true
      }
    });
    
    console.log(`Found ${allAccounts.length} total accounts for Chase:`);
    allAccounts.forEach(account => {
      console.log(`  - ${account.name} (${account.id}): plaidItem=${account.plaidItem.id}, status=${account.plaidItem.status}, archived=${account.archived}`);
    });
    
    // Test 3: Check accounts from active PlaidItems only
    console.log('\n📋 Test 3: Accounts from active PlaidItems only');
    const activeAccounts = await prisma.account.findMany({
      where: {
        archived: false,
        plaidItem: {
          institutionId: 'ins_56',
          status: 'active'
        }
      },
      include: {
        plaidItem: true
      }
    });
    
    console.log(`Found ${activeAccounts.length} accounts from active PlaidItems:`);
    activeAccounts.forEach(account => {
      console.log(`  - ${account.name} (${account.id}): plaidItem=${account.plaidItem.id}, status=${account.plaidItem.status}`);
    });
    
    // Test 4: Check archived accounts
    console.log('\n📋 Test 4: Archived accounts for Chase');
    const archivedAccounts = await prisma.account.findMany({
      where: {
        archived: true,
        plaidItem: {
          institutionId: 'ins_56'
        }
      },
      include: {
        plaidItem: true
      }
    });
    
    console.log(`Found ${archivedAccounts.length} archived accounts for Chase:`);
    archivedAccounts.forEach(account => {
      console.log(`  - ${account.name} (${account.id}): plaidItem=${account.plaidItem.id}, status=${account.plaidItem.status}`);
    });
    
    // Test 5: Check accounts with disconnected PlaidItems
    console.log('\n📋 Test 5: Accounts with disconnected PlaidItems');
    const disconnectedAccounts = await prisma.account.findMany({
      where: {
        archived: false,
        plaidItem: {
          institutionId: 'ins_56',
          status: 'disconnected'
        }
      },
      include: {
        plaidItem: true
      }
    });
    
    console.log(`Found ${disconnectedAccounts.length} accounts with disconnected PlaidItems:`);
    disconnectedAccounts.forEach(account => {
      console.log(`  - ${account.name} (${account.id}): plaidItem=${account.plaidItem.id}, status=${account.plaidItem.status}`);
    });
    
    // Summary
    console.log('\n📊 Summary:');
    console.log(`  Total PlaidItems: ${allPlaidItems.length}`);
    console.log(`  Active PlaidItems: ${allPlaidItems.filter(item => item.status === 'active').length}`);
    console.log(`  Disconnected PlaidItems: ${allPlaidItems.filter(item => item.status === 'disconnected').length}`);
    console.log(`  Total accounts: ${allAccounts.length}`);
    console.log(`  Active accounts: ${activeAccounts.length}`);
    console.log(`  Archived accounts: ${archivedAccounts.length}`);
    console.log(`  Disconnected accounts: ${disconnectedAccounts.length}`);
    
    // Analysis
    console.log('\n🔍 Analysis:');
    if (activeAccounts.length === 0) {
      if (allAccounts.length === 0) {
        console.log('  ❌ No accounts found for Chase at all');
        console.log('  - This suggests Chase was never connected or all accounts were deleted');
      } else if (archivedAccounts.length > 0) {
        console.log('  ⚠️  All Chase accounts are archived');
        console.log('  - This explains why refresh finds 0 accounts');
        console.log('  - Accounts need to be unarchived to be refreshed');
      } else if (disconnectedAccounts.length > 0) {
        console.log('  ⚠️  All Chase accounts have disconnected PlaidItems');
        console.log('  - This explains why refresh finds 0 accounts');
        console.log('  - The PlaidItems need to be reconnected or accounts need to be moved to active PlaidItems');
      }
    } else {
      console.log('  ✅ Active accounts found - refresh should work');
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the debug
if (require.main === module) {
  debugChaseAccounts().catch(console.error);
}

module.exports = { debugChaseAccounts }; 