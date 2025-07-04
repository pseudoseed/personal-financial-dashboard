#!/usr/bin/env node

/**
 * Test Script for Actual Refresh Process
 * 
 * This script tests the actual refresh process to verify that balances are being updated.
 * 
 * Usage: node scripts/test-refresh-actual.js
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testActualRefresh() {
  console.log('🧪 Testing Actual Refresh Process for Chase\n');
  
  try {
    // Test 1: Check current account balances before refresh
    console.log('📋 Test 1: Current account balances before refresh');
    const accountsBefore = await prisma.account.findMany({
      where: {
        archived: false,
        plaidItem: {
          institutionId: 'ins_56',
          status: 'active'
        }
      },
      include: {
        plaidItem: true,
        balances: {
          orderBy: { date: 'desc' },
          take: 1
        }
      }
    });
    
    console.log(`Found ${accountsBefore.length} active accounts for Chase:`);
    accountsBefore.forEach(account => {
      const balance = account.balances[0];
      console.log(`  - ${account.name}: $${balance ? balance.balance.toFixed(2) : 'No balance'} (last updated: ${balance ? balance.date.toISOString() : 'Never'})`);
    });
    
    // Test 2: Perform manual refresh
    console.log('\n📋 Test 2: Performing manual refresh');
    const refreshResponse = await fetch('http://localhost:3000/api/accounts/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        institutionId: 'ins_56',
        manual: true
      })
    });
    
    const refreshResult = await refreshResponse.json();
    console.log('Refresh response:', JSON.stringify(refreshResult, null, 2));
    
    // Test 3: Check account balances after refresh
    console.log('\n📋 Test 3: Account balances after refresh');
    const accountsAfter = await prisma.account.findMany({
      where: {
        archived: false,
        plaidItem: {
          institutionId: 'ins_56',
          status: 'active'
        }
      },
      include: {
        plaidItem: true,
        balances: {
          orderBy: { date: 'desc' },
          take: 1
        }
      }
    });
    
    console.log(`Found ${accountsAfter.length} active accounts for Chase after refresh:`);
    accountsAfter.forEach(account => {
      const balance = account.balances[0];
      console.log(`  - ${account.name}: $${balance ? balance.balance.toFixed(2) : 'No balance'} (last updated: ${balance ? balance.date.toISOString() : 'Never'})`);
    });
    
    // Test 4: Compare before and after
    console.log('\n📋 Test 4: Comparing before and after');
    let updatedCount = 0;
    for (let i = 0; i < accountsBefore.length; i++) {
      const before = accountsBefore[i];
      const after = accountsAfter[i];
      
      const beforeBalance = before.balances[0];
      const afterBalance = after.balances[0];
      
      if (beforeBalance && afterBalance) {
        const beforeTime = beforeBalance.date.getTime();
        const afterTime = afterBalance.date.getTime();
        
        if (afterTime > beforeTime) {
          console.log(`  ✅ ${before.name}: Updated from $${beforeBalance.balance.toFixed(2)} to $${afterBalance.balance.toFixed(2)}`);
          updatedCount++;
        } else {
          console.log(`  ⏸️  ${before.name}: No update (same balance: $${beforeBalance.balance.toFixed(2)})`);
        }
      } else if (!beforeBalance && afterBalance) {
        console.log(`  ✅ ${before.name}: New balance added: $${afterBalance.balance.toFixed(2)}`);
        updatedCount++;
      } else {
        console.log(`  ❌ ${before.name}: No balance data`);
      }
    }
    
    // Summary
    console.log('\n📊 Summary:');
    console.log(`  Accounts found: ${accountsBefore.length}`);
    console.log(`  Accounts updated: ${updatedCount}`);
    console.log(`  Refresh success: ${refreshResult.success}`);
    console.log(`  Refresh errors: ${refreshResult.errors}`);
    
    if (updatedCount > 0 && refreshResult.success) {
      console.log('\n✅ SUCCESS: Refresh is working correctly!');
      console.log('  - Account balances were updated');
      console.log('  - Only active PlaidItems were processed');
    } else if (refreshResult.success && updatedCount === 0) {
      console.log('\n⚠️  WARNING: Refresh completed but no balances updated');
      console.log('  - This might be normal if balances haven\'t changed');
      console.log('  - Or there might be an issue with the refresh process');
    } else {
      console.log('\n❌ ISSUE: Refresh failed or no accounts were processed');
      console.log('  - Check the refresh response for errors');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
if (require.main === module) {
  testActualRefresh().catch(console.error);
}

module.exports = { testActualRefresh }; 