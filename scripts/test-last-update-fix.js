const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testLastUpdateFix() {
  try {
    console.log('🧪 Testing Last Update Field Fix...\n');

    // Test 1: Check database lastSyncTime field
    console.log('📋 Test 1: Checking database lastSyncTime field');
    const accounts = await prisma.account.findMany({
      select: {
        id: true,
        name: true,
        lastSyncTime: true,
        updatedAt: true,
        balances: {
          orderBy: { date: 'desc' },
          take: 1,
          select: { date: true }
        }
      },
      take: 5
    });

    console.log('Database lastSyncTime values:');
    accounts.forEach(account => {
      console.log(`  ${account.name}:`);
      console.log(`    lastSyncTime: ${account.lastSyncTime}`);
      console.log(`    updatedAt: ${account.updatedAt}`);
      console.log(`    Latest balance date: ${account.balances[0]?.date || 'No balance'}`);
    });

    // Test 2: Check API response
    console.log('\n📋 Test 2: Checking API response');
    const response = await fetch('http://localhost:3000/api/accounts');
    if (response.ok) {
      const apiAccounts = await response.json();
      console.log('API response lastSyncTime values:');
      apiAccounts.slice(0, 3).forEach(account => {
        console.log(`  ${account.name}:`);
        console.log(`    lastSyncTime: ${account.lastSyncTime}`);
        console.log(`    has lastSyncTime field: ${account.hasOwnProperty('lastSyncTime')}`);
      });
    } else {
      console.log('❌ Failed to fetch API response');
    }

    // Test 3: Check if lastSyncTime is being updated during refresh
    console.log('\n📋 Test 3: Checking if lastSyncTime updates during refresh');
    const testAccount = accounts[0];
    if (testAccount) {
      console.log(`Testing with account: ${testAccount.name}`);
      console.log(`Current lastSyncTime: ${testAccount.lastSyncTime}`);
      
      // Try to refresh the account
      const refreshResponse = await fetch(`http://localhost:3000/api/accounts/${testAccount.id}/refresh`, {
        method: 'POST'
      });
      
      if (refreshResponse.ok) {
        console.log('✅ Account refresh successful');
        
        // Check updated lastSyncTime
        const updatedAccount = await prisma.account.findUnique({
          where: { id: testAccount.id },
          select: { lastSyncTime: true }
        });
        
        console.log(`Updated lastSyncTime: ${updatedAccount?.lastSyncTime}`);
        
        if (updatedAccount?.lastSyncTime !== testAccount.lastSyncTime) {
          console.log('✅ SUCCESS: lastSyncTime was updated during refresh');
        } else {
          console.log('⚠️  lastSyncTime was not updated (may be normal if no new data)');
        }
      } else {
        console.log('❌ Account refresh failed');
      }
    }

    console.log('\n✅ Last Update Field Fix Test Complete!');
    console.log('\nKey Changes Made:');
    console.log('- AccountCard now uses account.lastSyncTime instead of account.lastUpdated');
    console.log('- Removed unused lastUpdated field from Account interface');
    console.log('- lastSyncTime is the actual field being updated in the database');
    console.log('- The "Last Update" field should now display correctly on the accounts page');

  } catch (error) {
    console.error('❌ Error testing last update fix:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testLastUpdateFix(); 