const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testDuplicateDetection() {
  try {
    console.log('🧪 Testing duplicate detection...\n');

    // Test with Chase institution ID
    const chaseInstitutionId = 'ins_56';
    
    console.log(`Testing with institution ID: ${chaseInstitutionId}`);
    
    // Get all accounts for this institution
    const accounts = await prisma.account.findMany({
      where: {
        plaidItem: {
          institutionId: chaseInstitutionId,
        },
      },
      include: {
        plaidItem: {
          select: {
            itemId: true,
            institutionId: true,
            institutionName: true,
          },
        },
        balances: {
          orderBy: {
            date: "desc",
          },
          take: 1,
        },
      },
    });

    console.log(`Found ${accounts.length} total accounts for Chase\n`);

    if (accounts.length === 0) {
      console.log('No accounts found for testing');
      return;
    }

    // Group accounts by type, subtype, name, AND mask to identify true duplicates
    const accountGroups = new Map();
    
    accounts.forEach(account => {
      // Use mask (last 4 digits) as the primary identifier for duplicates
      // If no mask is available, fall back to name-based grouping
      const key = account.mask 
        ? `${account.type}_${account.subtype}_${account.name}_${account.mask}`
        : `${account.type}_${account.subtype}_${account.name}`;
        
      if (!accountGroups.has(key)) {
        accountGroups.set(key, []);
      }
      accountGroups.get(key).push({
        id: account.id,
        name: account.name,
        type: account.type,
        subtype: account.subtype,
        mask: account.mask,
        balances: account.balances,
        plaidItem: account.plaidItem,
      });
    });

    // Find groups with multiple accounts (true duplicates - same account number)
    const duplicateGroups = Array.from(accountGroups.values())
      .filter(group => group.length > 1);

    console.log('📊 Duplicate Analysis:');
    console.log(`Total account groups: ${accountGroups.size}`);
    console.log(`Groups with duplicates: ${duplicateGroups.length}\n`);

    if (duplicateGroups.length === 0) {
      console.log('✅ No duplicates found!');
      return;
    }

    console.log('🔍 Duplicate Groups Found (same account number):');
    duplicateGroups.forEach((group, index) => {
      const firstAccount = group[0];
      const maskInfo = firstAccount.mask ? ` (****${firstAccount.mask})` : ' (no mask)';
      console.log(`\nGroup ${index + 1}: ${firstAccount.type}/${firstAccount.subtype} - ${firstAccount.name}${maskInfo}`);
      group.forEach((account, accIndex) => {
        const balance = account.balances[0];
        const balanceStr = balance ? `$${balance.current.toFixed(2)}` : 'No balance';
        console.log(`  ${accIndex + 1}. ID: ${account.id} - ${balanceStr}`);
      });
    });

    // Also show all accounts for reference
    console.log('\n📋 All Accounts for Reference:');
    accounts.forEach((account, index) => {
      const balance = account.balances[0];
      const balanceStr = balance ? `$${balance.current.toFixed(2)}` : 'No balance';
      const maskInfo = account.mask ? ` (****${account.mask})` : ' (no mask)';
      console.log(`  ${index + 1}. ${account.name}${maskInfo} - ${account.type}/${account.subtype} - ${balanceStr}`);
    });

    console.log('\n💡 Recommendation:');
    console.log('Only accounts with the SAME account number (last 4 digits) will be merged.');
    console.log('Different credit cards with different account numbers will be kept separate.');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testDuplicateDetection(); 