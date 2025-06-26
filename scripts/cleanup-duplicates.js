const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function cleanupDuplicates() {
  try {
    console.log('🔍 Checking for duplicate accounts...\n');

    // Get all accounts with their Plaid items
    const accounts = await prisma.account.findMany({
      include: {
        plaidItem: {
          select: {
            institutionId: true,
            institutionName: true,
            itemId: true,
          },
        },
        balances: {
          orderBy: {
            date: 'desc',
          },
          take: 1,
        },
      },
    });

    // Group accounts by institution and find duplicates
    const accountsByInstitution = {};
    
    accounts.forEach(account => {
      if (account.plaidItem && account.plaidItem.institutionId) {
        const key = account.plaidItem.institutionId;
        if (!accountsByInstitution[key]) {
          accountsByInstitution[key] = [];
        }
        accountsByInstitution[key].push(account);
      }
    });

    // Find institutions with multiple accounts
    const duplicates = [];
    
    Object.entries(accountsByInstitution).forEach(([institutionId, institutionAccounts]) => {
      if (institutionAccounts.length > 1) {
        console.log(`🏦 ${institutionAccounts[0].plaidItem.institutionName} (${institutionId}):`);
        console.log(`   Found ${institutionAccounts.length} accounts:`);
        
        institutionAccounts.forEach((account, index) => {
          const balance = account.balances[0];
          const balanceStr = balance ? `$${balance.current.toFixed(2)}` : 'No balance';
          console.log(`   ${index + 1}. ${account.name} (${account.type}/${account.subtype}) - ${balanceStr} - ID: ${account.id}`);
        });
        
        duplicates.push({
          institutionId,
          institutionName: institutionAccounts[0].plaidItem.institutionName,
          accounts: institutionAccounts,
        });
        
        console.log('');
      }
    });

    if (duplicates.length === 0) {
      console.log('✅ No duplicate accounts found!');
      return;
    }

    console.log(`📊 Found ${duplicates.length} institutions with potential duplicates.\n`);
    
    // For Chase specifically, we can help clean up
    const chaseDuplicates = duplicates.find(d => 
      d.institutionName.toLowerCase().includes('chase') || 
      d.institutionId.toLowerCase().includes('chase')
    );

    if (chaseDuplicates) {
      console.log('🎯 Chase duplicates detected! Here\'s what you should do:');
      console.log('1. Disconnect all Chase connections from the dashboard');
      console.log('2. Reconnect using "All Account Types" option');
      console.log('3. This will pull all accounts (checking, savings, credit) in one connection\n');
      
      console.log('To disconnect Chase accounts, you can:');
      chaseDuplicates.accounts.forEach(account => {
        console.log(`   - Go to account ${account.name} and click disconnect`);
      });
    }

    // Show all duplicates for manual review
    console.log('📋 All potential duplicates for manual review:');
    duplicates.forEach(duplicate => {
      console.log(`\n🏦 ${duplicate.institutionName}:`);
      duplicate.accounts.forEach(account => {
        const balance = account.balances[0];
        const balanceStr = balance ? `$${balance.current.toFixed(2)}` : 'No balance';
        console.log(`   - ${account.name} (${account.type}/${account.subtype}) - ${balanceStr} - ID: ${account.id}`);
      });
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the cleanup
cleanupDuplicates(); 