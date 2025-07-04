const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testAccountFiltering() {
  try {
    console.log('🧪 Testing Account Filtering for Plaid API Calls...\n');

    // Get all accounts with their PlaidItems
    const allAccounts = await prisma.account.findMany({
      include: {
        plaidItem: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    console.log('📊 Account Analysis:');
    console.log('===================');
    console.log(`Total accounts: ${allAccounts.length}\n`);

    // Categorize accounts
    const manualAccounts = allAccounts.filter(acc => acc.plaidItem.accessToken === 'manual');
    const archivedAccounts = allAccounts.filter(acc => acc.archived);
    const disconnectedAccounts = allAccounts.filter(acc => acc.plaidItem.status === 'disconnected');
    const activePlaidAccounts = allAccounts.filter(acc => 
      acc.plaidItem.accessToken !== 'manual' && 
      !acc.archived && 
      acc.plaidItem.status !== 'disconnected'
    );

    console.log('📋 Account Categories:');
    console.log('=====================');
    console.log(`Manual accounts: ${manualAccounts.length}`);
    console.log(`Archived accounts: ${archivedAccounts.length}`);
    console.log(`Disconnected accounts: ${disconnectedAccounts.length}`);
    console.log(`Active Plaid accounts: ${activePlaidAccounts.length}\n`);

    // Show manual accounts
    if (manualAccounts.length > 0) {
      console.log('🔧 Manual Accounts (should NOT make Plaid API calls):');
      console.log('===================================================');
      manualAccounts.forEach(account => {
        console.log(`  - ${account.name} (${account.id})`);
        console.log(`    Type: ${account.type} • Subtype: ${account.subtype}`);
        console.log(`    Institution: ${account.plaidItem.institutionName || account.plaidItem.institutionId}`);
        console.log(`    Status: ${account.plaidItem.status}`);
        console.log('');
      });
    }

    // Show archived accounts
    if (archivedAccounts.length > 0) {
      console.log('📦 Archived Accounts (should NOT make Plaid API calls):');
      console.log('=====================================================');
      archivedAccounts.forEach(account => {
        console.log(`  - ${account.name} (${account.id})`);
        console.log(`    Type: ${account.type} • Subtype: ${account.subtype}`);
        console.log(`    Institution: ${account.plaidItem.institutionName || account.plaidItem.institutionId}`);
        console.log(`    Access Token: ${account.plaidItem.accessToken === 'manual' ? 'manual' : 'plaid'}`);
        console.log(`    Status: ${account.plaidItem.status}`);
        console.log('');
      });
    }

    // Show disconnected accounts
    if (disconnectedAccounts.length > 0) {
      console.log('❌ Disconnected Accounts (should NOT make Plaid API calls):');
      console.log('=========================================================');
      disconnectedAccounts.forEach(account => {
        console.log(`  - ${account.name} (${account.id})`);
        console.log(`    Type: ${account.type} • Subtype: ${account.subtype}`);
        console.log(`    Institution: ${account.plaidItem.institutionName || account.plaidItem.institutionId}`);
        console.log(`    Access Token: ${account.plaidItem.accessToken === 'manual' ? 'manual' : 'plaid'}`);
        console.log(`    Status: ${account.plaidItem.status}`);
        console.log('');
      });
    }

    // Show active Plaid accounts
    if (activePlaidAccounts.length > 0) {
      console.log('✅ Active Plaid Accounts (SHOULD make Plaid API calls):');
      console.log('=====================================================');
      activePlaidAccounts.forEach(account => {
        console.log(`  - ${account.name} (${account.id})`);
        console.log(`    Type: ${account.type} • Subtype: ${account.subtype}`);
        console.log(`    Institution: ${account.plaidItem.institutionName || account.plaidItem.institutionId}`);
        console.log(`    Status: ${account.plaidItem.status}`);
        console.log('');
      });
    }

    // Test eligibility logic
    console.log('🔍 Eligibility Test Results:');
    console.log('============================');
    
    const ineligibleAccounts = allAccounts.filter(account => {
      const isManual = account.plaidItem.accessToken === 'manual';
      const isArchived = account.archived;
      const isDisconnected = account.plaidItem.status === 'disconnected';
      const hasNoToken = !account.plaidItem.accessToken || account.plaidItem.accessToken === 'manual';
      
      return isManual || isArchived || isDisconnected || hasNoToken;
    });

    const eligibleAccounts = allAccounts.filter(account => {
      const isManual = account.plaidItem.accessToken === 'manual';
      const isArchived = account.archived;
      const isDisconnected = account.plaidItem.status === 'disconnected';
      const hasNoToken = !account.plaidItem.accessToken || account.plaidItem.accessToken === 'manual';
      
      return !isManual && !isArchived && !isDisconnected && !hasNoToken;
    });

    console.log(`Ineligible accounts: ${ineligibleAccounts.length}`);
    console.log(`Eligible accounts: ${eligibleAccounts.length}`);
    console.log(`Total accounts: ${allAccounts.length}`);
    console.log(`Sum check: ${ineligibleAccounts.length + eligibleAccounts.length} (should equal ${allAccounts.length})`);

    if (ineligibleAccounts.length + eligibleAccounts.length !== allAccounts.length) {
      console.log('❌ ERROR: Account count mismatch!');
    } else {
      console.log('✅ Account count check passed');
    }

    // Show recent Plaid API calls to verify filtering
    console.log('\n📊 Recent Plaid API Calls:');
    console.log('==========================');
    
    const recentLogs = await prisma.plaidApiCallLog.findMany({
      orderBy: { timestamp: 'desc' },
      take: 10,
    });

    if (recentLogs.length === 0) {
      console.log('No recent Plaid API calls found.');
      console.log('This is expected if no eligible accounts have been refreshed recently.');
    } else {
      console.log(`Found ${recentLogs.length} recent API calls:`);
      recentLogs.forEach((log, index) => {
        const status = log.responseStatus >= 200 && log.responseStatus < 300 ? '✅' : '❌';
        console.log(`${index + 1}. ${status} ${log.endpoint}`);
        console.log(`   Institution: ${log.institutionId || 'N/A'}`);
        console.log(`   Account: ${log.accountId || 'N/A'}`);
        console.log(`   Time: ${log.timestamp.toISOString()}`);
        console.log('');
      });
    }

  } catch (error) {
    console.error('Error testing account filtering:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testAccountFiltering(); 