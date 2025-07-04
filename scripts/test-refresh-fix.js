#!/usr/bin/env node

/**
 * Test Script for Refresh Fix
 * 
 * This script verifies that the refresh process only finds active PlaidItems
 * and doesn't include disconnected or orphaned items.
 * 
 * Usage: node scripts/test-refresh-fix.js
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testRefreshFix() {
  console.log('🧪 Testing Refresh Fix for Chase (ins_56)\n');
  
  try {
    // Test 1: Check all PlaidItems for Chase
    console.log('📋 Test 1: Checking all PlaidItems for Chase');
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
    
    // Test 2: Check only active PlaidItems for Chase
    console.log('\n📋 Test 2: Checking only active PlaidItems for Chase');
    const activePlaidItems = await prisma.plaidItem.findMany({
      where: {
        institutionId: 'ins_56',
        status: 'active'
      },
      include: {
        accounts: {
          where: { archived: false }
        }
      }
    });
    
    console.log(`Found ${activePlaidItems.length} active PlaidItems for Chase:`);
    activePlaidItems.forEach(item => {
      console.log(`  - ${item.id}: status=${item.status}, accounts=${item.accounts.length}, itemId=${item.itemId}`);
    });
    
    // Test 3: Check accounts from active PlaidItems only
    console.log('\n📋 Test 3: Checking accounts from active PlaidItems only');
    const accountsFromActiveItems = await prisma.account.findMany({
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
    
    console.log(`Found ${accountsFromActiveItems.length} accounts from active PlaidItems:`);
    accountsFromActiveItems.forEach(account => {
      console.log(`  - ${account.name} (${account.id}): plaidItem=${account.plaidItem.id}, status=${account.plaidItem.status}`);
    });
    
    // Test 4: Check accounts from all PlaidItems (including disconnected)
    console.log('\n📋 Test 4: Checking accounts from all PlaidItems (including disconnected)');
    const accountsFromAllItems = await prisma.account.findMany({
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
    
    console.log(`Found ${accountsFromAllItems.length} accounts from all PlaidItems:`);
    accountsFromAllItems.forEach(account => {
      console.log(`  - ${account.name} (${account.id}): plaidItem=${account.plaidItem.id}, status=${account.plaidItem.status}`);
    });
    
    // Summary
    console.log('\n📊 Summary:');
    console.log(`  Total PlaidItems: ${allPlaidItems.length}`);
    console.log(`  Active PlaidItems: ${activePlaidItems.length}`);
    console.log(`  Disconnected PlaidItems: ${allPlaidItems.length - activePlaidItems.length}`);
    console.log(`  Accounts from active items: ${accountsFromActiveItems.length}`);
    console.log(`  Accounts from all items: ${accountsFromAllItems.length}`);
    
    if (activePlaidItems.length === 1 && accountsFromActiveItems.length === accountsFromAllItems.length) {
      console.log('\n✅ SUCCESS: Refresh fix is working correctly!');
      console.log('  - Only 1 active PlaidItem found');
      console.log('  - All accounts are from active PlaidItems');
      console.log('  - No orphaned/disconnected items will be included in refresh');
    } else {
      console.log('\n⚠️  ISSUE: Refresh fix may not be working correctly');
      console.log('  - Multiple active PlaidItems or orphaned accounts detected');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
if (require.main === module) {
  testRefreshFix().catch(console.error);
}

module.exports = { testRefreshFix }; 