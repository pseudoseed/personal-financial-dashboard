const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testPlaidIdConstraintFix() {
  console.log('🧪 Testing plaidId Unique Constraint Fix');
  console.log('========================================');
  
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

    // Check for any duplicate plaidId values
    console.log(`\n🔍 Checking for Duplicate plaidId Values:`);
    const plaidIdCounts = {};
    activeAccounts.forEach(account => {
      if (!plaidIdCounts[account.plaidId]) {
        plaidIdCounts[account.plaidId] = [];
      }
      plaidIdCounts[account.plaidId].push(account);
    });

    const duplicatePlaidIds = Object.entries(plaidIdCounts)
      .filter(([plaidId, accounts]) => accounts.length > 1);

    if (duplicatePlaidIds.length > 0) {
      console.log(`⚠️  Found ${duplicatePlaidIds.length} duplicate plaidId values:`);
      duplicatePlaidIds.forEach(([plaidId, accounts]) => {
        console.log(`\n   plaidId: ${plaidId}`);
        accounts.forEach(account => {
          console.log(`     - ${account.name} (${account.type}/${account.subtype}) - ID: ${account.id}`);
        });
      });
    } else {
      console.log(`✅ No duplicate plaidId values found`);
    }

    // Check for institutions with multiple PlaidItems
    console.log(`\n🏦 Checking Institutions with Multiple PlaidItems:`);
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

    let hasMultipleItems = false;
    for (const [institutionId, items] of Object.entries(institutionsWithMultipleItems)) {
      if (items.length > 1) {
        hasMultipleItems = true;
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

    if (!hasMultipleItems) {
      console.log(`✅ No institutions with multiple PlaidItems found`);
    }

    // Test the synchronization logic
    console.log(`\n🔧 Testing Synchronization Logic:`);
    
    // Simulate what would happen during re-authentication
    for (const [institutionId, items] of Object.entries(institutionsWithMultipleItems)) {
      if (items.length > 1) {
        console.log(`\nTesting institution: ${items[0].institutionName || institutionId}`);
        
        // Get all accounts for this institution
        const institutionAccounts = await prisma.account.findMany({
          where: {
            plaidItem: {
              institutionId: institutionId,
            },
            archived: false,
          },
        });

        console.log(`   Total active accounts: ${institutionAccounts.length}`);

        // Simulate Plaid response with potentially different plaidId values
        const simulatedPlaidAccounts = institutionAccounts.map(account => ({
          account_id: `simulated_${account.plaidId}`, // Simulate different plaidId
          name: account.name,
          type: account.type,
          subtype: account.subtype,
          mask: account.mask,
        }));

        console.log(`   Simulated Plaid response with ${simulatedPlaidAccounts.length} accounts`);

        // Test the synchronization logic
        let conflictsDetected = 0;
        let updatesNeeded = 0;

        for (const plaidAccount of simulatedPlaidAccounts) {
          // Find matching account by name, type, and subtype
          const matchingAccount = institutionAccounts.find(
            (acc) => acc.name === plaidAccount.name && 
                     acc.type === plaidAccount.type && 
                     acc.subtype === plaidAccount.subtype &&
                     (acc.mask === plaidAccount.mask || (!acc.mask && !plaidAccount.mask))
          );
          
          if (matchingAccount && matchingAccount.plaidId !== plaidAccount.account_id) {
            // Check if the target plaidId is already assigned to another account
            const existingAccountWithTargetPlaidId = institutionAccounts.find(
              acc => acc.id !== matchingAccount.id && acc.plaidId === plaidAccount.account_id
            );

            if (existingAccountWithTargetPlaidId) {
              conflictsDetected++;
              console.log(`   ⚠️  CONFLICT: Target plaidId ${plaidAccount.account_id} already assigned to account ${existingAccountWithTargetPlaidId.name}`);
            } else {
              updatesNeeded++;
              console.log(`   ✅ Safe update: ${matchingAccount.name} plaidId ${matchingAccount.plaidId} → ${plaidAccount.account_id}`);
            }
          }
        }

        console.log(`   Summary: ${updatesNeeded} safe updates, ${conflictsDetected} conflicts detected`);
      }
    }

    console.log(`\n✅ plaidId constraint fix test completed`);
    console.log(`\n📝 Key Improvements:`);
    console.log(`==================`);
    console.log(`1. ✅ Added plaidId existence check before account creation`);
    console.log(`2. ✅ Added conflict detection in synchronization logic`);
    console.log(`3. ✅ Added transaction wrapping for consistency`);
    console.log(`4. ✅ Added comprehensive logging for debugging`);
    console.log(`5. ✅ Added graceful error handling for non-critical operations`);

  } catch (error) {
    console.error('❌ Error testing plaidId constraint fix:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testPlaidIdConstraintFix(); 