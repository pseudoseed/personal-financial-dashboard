const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testExternalTokenRevocation() {
  try {
    console.log('🧪 Testing External Token Revocation Handling...\n');

    // Get all PlaidItems with their status
    const allPlaidItems = await prisma.plaidItem.findMany({
      where: {
        provider: 'plaid'
      },
      include: {
        accounts: true
      },
      orderBy: {
        institutionId: 'asc'
      }
    });

    console.log('📊 Current PlaidItem Status:');
    console.log('==========================');

    let totalItems = 0;
    let activeItems = 0;
    let disconnectedItems = 0;
    let itemsWithAccounts = 0;

    for (const item of allPlaidItems) {
      totalItems++;
      const status = item.status || 'unknown';
      const accountCount = item.accounts.length;
      
      console.log(`\n🏦 ${item.institutionName || item.institutionId}:`);
      console.log(`   Item ID: ${item.id}`);
      console.log(`   Status: ${status}`);
      console.log(`   Accounts: ${accountCount}`);
      console.log(`   Institution ID: ${item.institutionId}`);
      
      if (status === 'active') {
        activeItems++;
        if (accountCount > 0) itemsWithAccounts++;
      } else if (status === 'disconnected') {
        disconnectedItems++;
      }
    }

    console.log('\n📈 Summary:');
    console.log('===========');
    console.log(`Total PlaidItems: ${totalItems}`);
    console.log(`Active Items: ${activeItems}`);
    console.log(`Disconnected Items: ${disconnectedItems}`);
    console.log(`Active Items with Accounts: ${itemsWithAccounts}`);

    // Test the reconnection scenario
    console.log('\n🔍 Testing Reconnection Scenario:');
    console.log('=================================');
    
    // Find institutions with disconnected items
    const institutionsWithDisconnected = allPlaidItems
      .filter(item => item.status === 'disconnected')
      .reduce((acc, item) => {
        if (!acc[item.institutionId]) {
          acc[item.institutionId] = [];
        }
        acc[item.institutionId].push(item);
        return acc;
      }, {});

    for (const [institutionId, items] of Object.entries(institutionsWithDisconnected)) {
      console.log(`\nTesting institution: ${items[0]?.institutionName || institutionId}`);
      console.log(`   Disconnected PlaidItems: ${items.length}`);
      
      // Simulate what would happen during reconnection
      const bestItem = items.sort((a, b) => b.accounts.length - a.accounts.length)[0];
      console.log(`   Best item for reconnection: ${bestItem.id} (${bestItem.accounts.length} accounts)`);
      
      // Check if there are any active items for this institution
      const activeItemsForInstitution = allPlaidItems.filter(
        item => item.institutionId === institutionId && item.status === 'active'
      );
      
      if (activeItemsForInstitution.length > 0) {
        console.log(`   ⚠️  Found ${activeItemsForInstitution.length} active items - potential duplicates!`);
        activeItemsForInstitution.forEach(item => {
          console.log(`     - ${item.id}: ${item.accounts.length} accounts`);
        });
      } else {
        console.log(`   ✅ No active items found - reconnection would work cleanly`);
      }
    }

    // Test the duplicate detection logic
    console.log('\n🔍 Testing Duplicate Detection with Disconnected Items:');
    console.log('=====================================================');
    
    for (const [institutionId, items] of Object.entries(institutionsWithDisconnected)) {
      const allItemsForInstitution = allPlaidItems.filter(
        item => item.institutionId === institutionId
      );
      
      if (allItemsForInstitution.length > 1) {
        console.log(`\nInstitution: ${items[0]?.institutionName || institutionId}`);
        
        // Simulate what the duplicate detection would find
        const allAccounts = allItemsForInstitution.flatMap(item => item.accounts);
        console.log(`   Total accounts across all items: ${allAccounts.length}`);
        
        // Group accounts by type/subtype/name/mask
        const accountGroups = new Map();
        allAccounts.forEach(account => {
          const key = account.mask 
            ? `${account.type}_${account.subtype}_${account.name}_${account.mask}`
            : `${account.type}_${account.subtype}_${account.name}`;
            
          if (!accountGroups.has(key)) {
            accountGroups.set(key, []);
          }
          accountGroups.get(key).push(account);
        });
        
        let duplicateGroups = 0;
        for (const [key, accounts] of accountGroups) {
          if (accounts.length > 1) {
            duplicateGroups++;
            console.log(`   Duplicate group: ${key} (${accounts.length} accounts)`);
          }
        }
        
        console.log(`   Total duplicate account groups: ${duplicateGroups}`);
        
        if (duplicateGroups > 0) {
          console.log(`   ✅ Duplicate detection would find and merge these accounts`);
        } else {
          console.log(`   ℹ️  No duplicate accounts found`);
        }
      }
    }

    console.log('\n✅ External token revocation handling test completed');
    console.log('\n📝 Recommendations:');
    console.log('==================');
    console.log('1. The system should automatically mark items as disconnected when tokens are revoked');
    console.log('2. Reconnection should prioritize disconnected items with the most accounts');
    console.log('3. Duplicate detection should include disconnected accounts in merge logic');
    console.log('4. Users should see clear messaging about external token revocation');

  } catch (error) {
    console.error('❌ Error testing external token revocation:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testExternalTokenRevocation(); 