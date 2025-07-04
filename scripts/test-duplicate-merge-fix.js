const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testDuplicateMergeFix() {
  console.log('🧪 Testing Duplicate Merge Fix');
  console.log('================================');
  
  try {
    // Get all accounts to see current state
    const allAccounts = await prisma.account.findMany({
      include: {
        plaidItem: true,
        balances: {
          orderBy: { date: 'desc' },
          take: 1,
        },
      },
    });

    console.log(`\n📊 Current Account Status:`);
    console.log(`Total accounts: ${allAccounts.length}`);
    
    const activeAccounts = allAccounts.filter(acc => !acc.archived);
    const archivedAccounts = allAccounts.filter(acc => acc.archived);
    
    console.log(`Active accounts: ${activeAccounts.length}`);
    console.log(`Archived accounts: ${archivedAccounts.length}`);

    // Check for any institutions with multiple PlaidItems
    const plaidItems = await prisma.plaidItem.findMany({
      include: {
        accounts: true,
      },
    });

    const institutionsWithMultipleItems = plaidItems.reduce((acc, item) => {
      if (!acc[item.institutionId]) {
        acc[item.institutionId] = [];
      }
      acc[item.institutionId].push(item);
      return acc;
    }, {});

    console.log(`\n🏦 Institutions with multiple PlaidItems:`);
    for (const [institutionId, items] of Object.entries(institutionsWithMultipleItems)) {
      if (items.length > 1) {
        console.log(`\nInstitution: ${items[0].institutionName || institutionId}`);
        console.log(`PlaidItems: ${items.length}`);
        
        items.forEach((item, index) => {
          const activeAccounts = item.accounts.filter(acc => !acc.archived);
          const archivedAccounts = item.accounts.filter(acc => acc.archived);
          
          console.log(`  ${index + 1}. ${item.id} (${item.status})`);
          console.log(`     Active accounts: ${activeAccounts.length}`);
          console.log(`     Archived accounts: ${archivedAccounts.length}`);
          console.log(`     Access token: ${item.accessToken.substring(0, 10)}...`);
        });
      }
    }

    // Check for accounts with potentially outdated plaidId values
    console.log(`\n🔍 Checking for potential plaidId synchronization issues:`);
    
    const activeAccountsWithPlaidItems = activeAccounts.filter(acc => 
      acc.plaidItem.provider === 'plaid' && 
      acc.plaidItem.status === 'active' &&
      acc.plaidItem.accessToken !== 'manual'
    );

    console.log(`Active Plaid accounts to check: ${activeAccountsWithPlaidItems.length}`);

    // Group by institution to check for potential duplicates
    const accountsByInstitution = activeAccountsWithPlaidItems.reduce((acc, account) => {
      if (!acc[account.plaidItem.institutionId]) {
        acc[account.plaidItem.institutionId] = [];
      }
      acc[account.plaidItem.institutionId].push(account);
      return acc;
    }, {});

    for (const [institutionId, accounts] of Object.entries(accountsByInstitution)) {
      if (accounts.length > 1) {
        console.log(`\nInstitution: ${accounts[0].plaidItem.institutionName || institutionId}`);
        console.log(`Active accounts: ${accounts.length}`);
        
        // Check for potential duplicate accounts (same name, type, subtype)
        const accountGroups = new Map();
        accounts.forEach(account => {
          const key = account.mask 
            ? `${account.type}_${account.subtype}_${account.name}_${account.mask}`
            : `${account.type}_${account.subtype}_${account.name}`;
            
          if (!accountGroups.has(key)) {
            accountGroups.set(key, []);
          }
          accountGroups.get(key).push(account);
        });

        let hasDuplicates = false;
        for (const [key, groupAccounts] of accountGroups) {
          if (groupAccounts.length > 1) {
            hasDuplicates = true;
            console.log(`  ⚠️  Potential duplicates for: ${key}`);
            groupAccounts.forEach(acc => {
              console.log(`     - ${acc.id}: plaidId=${acc.plaidId}, itemId=${acc.itemId}`);
            });
          }
        }
        
        if (!hasDuplicates) {
          console.log(`  ✅ No duplicate accounts detected`);
        }
      }
    }

    // Check for any orphaned data
    console.log(`\n🔍 Checking for orphaned data:`);
    
    const orphanedAccounts = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM "Account" a
      LEFT JOIN "PlaidItem" p ON a.itemId = p.id
      WHERE p.id IS NULL
    `;
    
    const orphanedTransactions = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM "Transaction" t
      LEFT JOIN "Account" a ON t.accountId = a.id
      WHERE a.id IS NULL
    `;
    
    const orphanedBalances = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM "AccountBalance" b
      LEFT JOIN "Account" a ON b.accountId = a.id
      WHERE a.id IS NULL
    `;

    console.log(`Orphaned accounts: ${orphanedAccounts[0].count}`);
    console.log(`Orphaned transactions: ${orphanedTransactions[0].count}`);
    console.log(`Orphaned balances: ${orphanedBalances[0].count}`);

    console.log(`\n✅ Duplicate merge fix test completed`);
    console.log(`\n📝 Summary:`);
    console.log(`- Total accounts: ${allAccounts.length}`);
    console.log(`- Active accounts: ${activeAccounts.length}`);
    console.log(`- Archived accounts: ${archivedAccounts.length}`);
    console.log(`- No data should be deleted, only archived`);

  } catch (error) {
    console.error('❌ Error testing duplicate merge fix:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testDuplicateMergeFix(); 