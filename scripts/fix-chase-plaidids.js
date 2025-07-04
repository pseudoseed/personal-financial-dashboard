const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixChasePlaidIds() {
  console.log('🔧 Fixing Chase plaidId values after re-authentication');
  console.log('==================================================');
  
  try {
    // The mappings from the logs (old plaidId -> new plaidId)
    const plaidIdMappings = [
      {
        oldPlaidId: 'yyXdN5d8bmsPaqK8AbMXh5ydJZb5KJhgopzP6',
        newPlaidId: 'qVjK9AbqaXHpvdpPkqr4iVekXDbkpPUBwkOnX'
      },
      {
        oldPlaidId: 'kYx5BR5AOrSDPw1vXx4NFwp96Aywq6TvDoPZq',
        newPlaidId: '3PxjzpXdgQULbALOkKXjhMwKQZNKb3C76xYL9'
      },
      {
        oldPlaidId: 'A43x7nx1Xvs4E15zRKxJUwykYvdwpYTnBMpxK',
        newPlaidId: 'yd3gVJb0mOHRxBRvLOzAFAn03pr0XJf3EMkam'
      },
      {
        oldPlaidId: 'vqyQYkQ8bRH89yagmbMeFOqxY1rO9Yc07VyPZ',
        newPlaidId: 'KVOJKzYxDLHwgLwjNk8KIxZonN9oa8f1MX3N9'
      },
      {
        oldPlaidId: 'K7vVEMV0YDIDzY7MKmp9FOBb8j7O58cmvEVKR',
        newPlaidId: 'BJQL0zXk69UyQLyPenX8HaVnBN8nXbUdyLMNY'
      }
    ];

    console.log(`\n📋 Found ${plaidIdMappings.length} plaidId mappings to fix`);

    // Check current state
    console.log(`\n🔍 Checking current account state:`);
    for (const mapping of plaidIdMappings) {
      const accountWithOldPlaidId = await prisma.account.findUnique({
        where: { plaidId: mapping.oldPlaidId },
        include: { plaidItem: true }
      });

      const accountWithNewPlaidId = await prisma.account.findUnique({
        where: { plaidId: mapping.newPlaidId },
        include: { plaidItem: true }
      });

      if (accountWithOldPlaidId) {
        console.log(`   Old plaidId ${mapping.oldPlaidId}: ${accountWithOldPlaidId.name} (${accountWithOldPlaidId.id})`);
      } else {
        console.log(`   Old plaidId ${mapping.oldPlaidId}: NOT FOUND`);
      }

      if (accountWithNewPlaidId) {
        console.log(`   New plaidId ${mapping.newPlaidId}: ${accountWithNewPlaidId.name} (${accountWithNewPlaidId.id})`);
      } else {
        console.log(`   New plaidId ${mapping.newPlaidId}: NOT FOUND`);
      }
      console.log('');
    }

    // Apply the fixes
    console.log(`\n🔧 Applying plaidId fixes:`);
    let successCount = 0;
    let errorCount = 0;

    for (const mapping of plaidIdMappings) {
      try {
        const accountWithOldPlaidId = await prisma.account.findUnique({
          where: { plaidId: mapping.oldPlaidId }
        });

        if (!accountWithOldPlaidId) {
          console.log(`   ⚠️  Account with old plaidId ${mapping.oldPlaidId} not found - skipping`);
          continue;
        }

        // Check if new plaidId already exists
        const accountWithNewPlaidId = await prisma.account.findUnique({
          where: { plaidId: mapping.newPlaidId }
        });

        if (accountWithNewPlaidId) {
          console.log(`   ⚠️  New plaidId ${mapping.newPlaidId} already exists for account ${accountWithNewPlaidId.name} - skipping`);
          continue;
        }

        // Update the plaidId
        await prisma.account.update({
          where: { id: accountWithOldPlaidId.id },
          data: { plaidId: mapping.newPlaidId }
        });

        console.log(`   ✅ Updated account ${accountWithOldPlaidId.name} (${accountWithOldPlaidId.id})`);
        console.log(`      ${mapping.oldPlaidId} → ${mapping.newPlaidId}`);
        successCount++;

      } catch (error) {
        console.log(`   ❌ Error updating plaidId ${mapping.oldPlaidId}: ${error.message}`);
        errorCount++;
      }
    }

    console.log(`\n📊 Fix Summary:`);
    console.log(`   Successful updates: ${successCount}`);
    console.log(`   Errors: ${errorCount}`);
    console.log(`   Total mappings: ${plaidIdMappings.length}`);

    if (successCount > 0) {
      console.log(`\n✅ Successfully fixed ${successCount} plaidId values`);
      console.log(`\n💡 Next steps:`);
      console.log(`   1. Try refreshing the Chase accounts in the dashboard`);
      console.log(`   2. The accounts should now be found in Plaid responses`);
      console.log(`   3. Future re-authentications will use the enhanced sync logic`);
    } else {
      console.log(`\n⚠️  No plaidId values were updated`);
    }

  } catch (error) {
    console.error('❌ Error fixing Chase plaidId values:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the fix
fixChasePlaidIds(); 