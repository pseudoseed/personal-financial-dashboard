const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testDisconnectedAccounts() {
  try {
    console.log('🧪 Testing Disconnected Accounts Filtering...\n');

    // Get all accounts with their PlaidItem status
    const allAccounts = await prisma.account.findMany({
      where: {
        archived: false
      },
      include: {
        plaidItem: {
          select: {
            institutionId: true,
            institutionName: true,
            accessToken: true,
            status: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    console.log('📊 All Non-Archived Accounts:');
    console.log('============================');

    let totalAccounts = 0;
    let manualAccounts = 0;
    let activePlaidAccounts = 0;
    let disconnectedPlaidAccounts = 0;
    let accountsWithoutPlaidItem = 0;

    for (const account of allAccounts) {
      totalAccounts++;
      const institutionName = account.plaidItem?.institutionName || 'Manual Account';
      const status = account.plaidItem?.status || 'no_plaid_item';
      const accessToken = account.plaidItem?.accessToken;
      
      console.log(`\n🏦 ${account.name}:`);
      console.log(`   Institution: ${institutionName}`);
      console.log(`   Type: ${account.type} • ${account.subtype}`);
      console.log(`   Status: ${status}`);
      console.log(`   Access Token: ${accessToken ? accessToken.substring(0, 20) + '...' : 'N/A'}`);
      
      if (accessToken === 'manual') {
        manualAccounts++;
      } else if (status === 'active') {
        activePlaidAccounts++;
      } else if (status === 'disconnected') {
        disconnectedPlaidAccounts++;
      } else if (!account.plaidItem) {
        accountsWithoutPlaidItem++;
      }
    }

    console.log('\n📈 Summary:');
    console.log('===========');
    console.log(`Total Accounts: ${totalAccounts}`);
    console.log(`Manual Accounts: ${manualAccounts}`);
    console.log(`Active Plaid Accounts: ${activePlaidAccounts}`);
    console.log(`Disconnected Plaid Accounts: ${disconnectedPlaidAccounts}`);
    console.log(`Accounts without PlaidItem: ${accountsWithoutPlaidItem}`);

    // Test the filtering logic
    console.log('\n🔍 Testing Filtering Logic:');
    console.log('===========================');
    
    const filteredAccounts = allAccounts.filter(account => {
      // Include manual accounts
      if (account.plaidItem?.accessToken === "manual") return true;
      // Include accounts with active or null status
      if (!account.plaidItem?.status || account.plaidItem.status !== "disconnected") return true;
      // Exclude disconnected accounts
      return false;
    });

    console.log(`Accounts after filtering: ${filteredAccounts.length}`);
    console.log(`Disconnected accounts filtered out: ${disconnectedPlaidAccounts}`);

    // Show what would be in the disconnected accounts section
    const disconnectedAccounts = allAccounts.filter(account => 
      account.plaidItem?.status === "disconnected"
    );

    if (disconnectedAccounts.length > 0) {
      console.log('\n🚫 Disconnected Accounts (would be shown in separate section):');
      console.log('============================================================');
      
      for (const account of disconnectedAccounts) {
        console.log(`  - ${account.name} (${account.plaidItem?.institutionName})`);
      }
    } else {
      console.log('\n✅ No disconnected accounts found');
    }

    console.log('\n✅ Disconnected accounts filtering test completed');
    console.log('\n📝 Expected Behavior:');
    console.log('====================');
    console.log('1. Disconnected accounts should not appear in the main accounts list');
    console.log('2. Disconnected accounts should appear in a separate "Disconnected Accounts" section');
    console.log('3. Manual accounts should always be included regardless of status');
    console.log('4. The filtering should work with the ?includeDisconnected=true parameter');

  } catch (error) {
    console.error('❌ Error testing disconnected accounts:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testDisconnectedAccounts(); 