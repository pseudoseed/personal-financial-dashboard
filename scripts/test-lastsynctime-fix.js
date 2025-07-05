#!/usr/bin/env node

/**
 * Test Script for lastSyncTime Fix
 * 
 * This script verifies that lastSyncTime is being updated correctly during balance refresh.
 * 
 * Usage: node scripts/test-lastsynctime-fix.js
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testLastSyncTimeFix() {
  console.log('🧪 Testing lastSyncTime Fix for Chase Checking Account\n');
  
  try {
    // Test 1: Check current lastSyncTime for Chase checking account
    console.log('📋 Test 1: Current lastSyncTime for Chase checking account');
    const account = await prisma.account.findUnique({
      where: {
        id: 'cmcehe6vq0002mp017lzjtk7x' // Chase checking account ID
      },
      include: {
        balances: {
          orderBy: { date: 'desc' },
          take: 1
        }
      }
    });
    
    if (!account) {
      console.log('❌ Chase checking account not found');
      return;
    }
    
    console.log(`Account: ${account.name}`);
    console.log(`Current lastSyncTime: ${account.lastSyncTime}`);
    console.log(`Latest balance date: ${account.balances[0] ? account.balances[0].date : 'No balance'}`);
    console.log(`Current balance: $${account.balances[0] ? account.balances[0].current : 'No balance'}`);
    
    // Test 2: Perform a manual refresh
    console.log('\n📋 Test 2: Performing manual refresh');
    const refreshResponse = await fetch('http://localhost:3000/api/accounts/cmcehe6vq0002mp017lzjtk7x/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    const refreshResult = await refreshResponse.json();
    console.log('Refresh response:', JSON.stringify(refreshResult, null, 2));
    
    // Test 3: Check lastSyncTime after refresh
    console.log('\n📋 Test 3: lastSyncTime after refresh');
    const accountAfter = await prisma.account.findUnique({
      where: {
        id: 'cmcehe6vq0002mp017lzjtk7x'
      },
      include: {
        balances: {
          orderBy: { date: 'desc' },
          take: 1
        }
      }
    });
    
    console.log(`Account: ${accountAfter.name}`);
    console.log(`Updated lastSyncTime: ${accountAfter.lastSyncTime}`);
    console.log(`Latest balance date: ${accountAfter.balances[0] ? accountAfter.balances[0].date : 'No balance'}`);
    console.log(`Updated balance: $${accountAfter.balances[0] ? accountAfter.balances[0].current : 'No balance'}`);
    
    // Test 4: Compare before and after
    console.log('\n📋 Test 4: Comparing before and after');
    const beforeTime = account.lastSyncTime ? new Date(account.lastSyncTime).getTime() : 0;
    const afterTime = accountAfter.lastSyncTime ? new Date(accountAfter.lastSyncTime).getTime() : 0;
    
    if (afterTime > beforeTime) {
      console.log('✅ SUCCESS: lastSyncTime was updated during refresh');
      console.log(`  - Before: ${account.lastSyncTime}`);
      console.log(`  - After: ${accountAfter.lastSyncTime}`);
      console.log(`  - Time difference: ${Math.round((afterTime - beforeTime) / 1000)} seconds`);
    } else {
      console.log('❌ ISSUE: lastSyncTime was not updated during refresh');
      console.log(`  - Before: ${account.lastSyncTime}`);
      console.log(`  - After: ${accountAfter.lastSyncTime}`);
    }
    
    // Test 5: Check if balance date and lastSyncTime are now in sync
    console.log('\n📋 Test 5: Checking balance date and lastSyncTime sync');
    const balanceDate = accountAfter.balances[0] ? accountAfter.balances[0].date.getTime() : 0;
    const lastSyncTime = accountAfter.lastSyncTime ? new Date(accountAfter.lastSyncTime).getTime() : 0;
    
    const timeDiff = Math.abs(balanceDate - lastSyncTime);
    if (timeDiff < 60000) { // Within 1 minute
      console.log('✅ SUCCESS: Balance date and lastSyncTime are in sync');
      console.log(`  - Balance date: ${accountAfter.balances[0].date}`);
      console.log(`  - Last sync time: ${accountAfter.lastSyncTime}`);
      console.log(`  - Time difference: ${Math.round(timeDiff / 1000)} seconds`);
    } else {
      console.log('⚠️  WARNING: Balance date and lastSyncTime are out of sync');
      console.log(`  - Balance date: ${accountAfter.balances[0] ? accountAfter.balances[0].date : 'No balance'}`);
      console.log(`  - Last sync time: ${accountAfter.lastSyncTime}`);
      console.log(`  - Time difference: ${Math.round(timeDiff / 1000)} seconds`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
if (require.main === module) {
  testLastSyncTimeFix().catch(console.error);
}

module.exports = { testLastSyncTimeFix }; 