const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testAccountLinking() {
  try {
    console.log('🧪 Testing Account Linking and Merging Fix...\n');

    // Get all PlaidItems grouped by institutionId
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

    // Group by institutionId
    const groupedByInstitution = allPlaidItems.reduce((acc, item) => {
      if (!acc[item.institutionId]) {
        acc[item.institutionId] = [];
      }
      acc[item.institutionId].push(item);
      return acc;
    }, {});

    console.log('📊 Current PlaidItem Status by Institution:');
    console.log('==========================================');

    let totalInstitutions = 0;
    let institutionsWithDuplicates = 0;
    let totalDuplicateItems = 0;

    for (const [institutionId, items] of Object.entries(groupedByInstitution)) {
      totalInstitutions++;
      const activeItems = items.filter(item => item.status === 'active');
      const disconnectedItems = items.filter(item => item.status === 'disconnected');
      
      console.log(`\n🏦 ${items[0]?.institutionName || institutionId}:`);
      console.log(`   Institution ID: ${institutionId}`);
      console.log(`   Total PlaidItems: ${items.length}`);
      console.log(`   Active Items: ${activeItems.length}`);
      console.log(`   Disconnected Items: ${disconnectedItems.length}`);
      
      if (activeItems.length > 1) {
        institutionsWithDuplicates++;
        totalDuplicateItems += activeItems.length - 1;
        console.log(`   ⚠️  DUPLICATE ACTIVE ITEMS DETECTED!`);
        
        activeItems.forEach((item, index) => {
          console.log(`     ${index + 1}. Item ID: ${item.id}`);
          console.log(`        Accounts: ${item.accounts.length}`);
          console.log(`        Status: ${item.status}`);
          console.log(`        Created: ${item.createdAt}`);
        });
      } else if (activeItems.length === 1) {
        console.log(`   ✅ Single active item (${activeItems[0].accounts.length} accounts)`);
      } else {
        console.log(`   ❌ No active items`);
      }
    }

    console.log('\n📈 Summary:');
    console.log('===========');
    console.log(`Total Institutions: ${totalInstitutions}`);
    console.log(`Institutions with Duplicate Active Items: ${institutionsWithDuplicates}`);
    console.log(`Total Duplicate Active Items: ${totalDuplicateItems}`);

    if (institutionsWithDuplicates > 0) {
      console.log('\n🔧 Recommendations:');
      console.log('==================');
      console.log('1. The account linking fix should prevent new duplicates from being created');
      console.log('2. For existing duplicates, consider using the bulk disconnect tool');
      console.log('3. Or manually reconnect the affected institutions to trigger the merge logic');
    } else {
      console.log('\n✅ No duplicate active items found! The system is clean.');
    }

    // Test the duplicate detection logic
    console.log('\n🔍 Testing Duplicate Detection Logic:');
    console.log('=====================================');
    
    for (const [institutionId, items] of Object.entries(groupedByInstitution)) {
      const activeItems = items.filter(item => item.status === 'active');
      if (activeItems.length > 1) {
        console.log(`\nTesting institution: ${items[0]?.institutionName || institutionId}`);
        
        // Simulate what the duplicate detection would find
        const accountsWithBalances = await prisma.account.findMany({
          where: {
            itemId: {
              in: activeItems.map(item => item.id)
            }
          },
          include: {
            balances: {
              orderBy: { date: 'desc' },
              take: 1
            },
            plaidItem: {
              select: {
                itemId: true,
                institutionId: true,
                institutionName: true
              }
            }
          }
        });

        console.log(`   Found ${accountsWithBalances.length} accounts across ${activeItems.length} PlaidItems`);
        
        // Group accounts by type/subtype/name/mask
        const accountGroups = new Map();
        accountsWithBalances.forEach(account => {
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
      }
    }

  } catch (error) {
    console.error('❌ Error testing account linking:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testAccountLinking(); 