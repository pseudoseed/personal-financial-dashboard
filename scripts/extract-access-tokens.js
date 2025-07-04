const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function extractAccessTokens() {
  try {
    // PlaidItem IDs from the logs
    const plaidItemIds = [
      'cmcehe6ni0000mp019j18h4jk', // active Chase connection
      'cmco8h1i30006p701t5qsiox4'  // disconnected Chase connection
    ];

    console.log('🔍 Extracting access tokens for PlaidItem IDs:');
    console.log(plaidItemIds.join(', '));
    console.log('\n' + '='.repeat(60) + '\n');

    const plaidItems = await prisma.plaidItem.findMany({
      where: {
        id: {
          in: plaidItemIds
        }
      },
      select: {
        id: true,
        institutionId: true,
        itemId: true,
        accessToken: true,
        status: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (plaidItems.length === 0) {
      console.log('❌ No PlaidItems found with the specified IDs');
      return;
    }

    console.log(`✅ Found ${plaidItems.length} PlaidItems:\n`);

    plaidItems.forEach((item, index) => {
      console.log(`${index + 1}. PlaidItem ID: ${item.id}`);
      console.log(`   Institution ID: ${item.institutionId}`);
      console.log(`   Plaid Item ID: ${item.itemId}`);
      console.log(`   Status: ${item.status}`);
      console.log(`   Access Token: ${item.accessToken}`);
      console.log(`   Created: ${item.createdAt}`);
      console.log(`   Updated: ${item.updatedAt}`);
      console.log('');
    });

    console.log('='.repeat(60));
    console.log('📋 Summary of Access Tokens:');
    plaidItems.forEach((item, index) => {
      console.log(`${index + 1}. ${item.id}: ${item.accessToken}`);
    });

  } catch (error) {
    console.error('❌ Error extracting access tokens:', error);
  } finally {
    await prisma.$disconnect();
  }
}

extractAccessTokens(); 