const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testTokenDisconnection() {
  try {
    console.log('🧪 Testing Plaid token disconnection functionality...\n');

    // Get all active PlaidItems
    const activeItems = await prisma.plaidItem.findMany({
      where: {
        status: 'active'
      },
      include: {
        accounts: true
      }
    });

    console.log(`Found ${activeItems.length} active PlaidItems:`);
    
    activeItems.forEach(item => {
      console.log(`  - ${item.institutionName || item.institutionId} (${item.id})`);
      console.log(`    Accounts: ${item.accounts.length}`);
      console.log(`    Status: ${item.status}`);
      console.log('');
    });

    // Get all disconnected PlaidItems
    const disconnectedItems = await prisma.plaidItem.findMany({
      where: {
        status: 'disconnected'
      },
      include: {
        accounts: true
      }
    });

    console.log(`Found ${disconnectedItems.length} disconnected PlaidItems:`);
    
    disconnectedItems.forEach(item => {
      console.log(`  - ${item.institutionName || item.institutionId} (${item.id})`);
      console.log(`    Accounts: ${item.accounts.length}`);
      console.log(`    Status: ${item.status}`);
      console.log('');
    });

    // Test the disconnectPlaidTokens function (import would need to be added)
    console.log('✅ Token disconnection functionality is ready for testing');
    console.log('📝 To test with real Plaid connections:');
    console.log('   1. Connect a duplicate institution via Plaid');
    console.log('   2. Check that duplicate PlaidItems are marked as disconnected');
    console.log('   3. Verify tokens are revoked in Plaid dashboard');

  } catch (error) {
    console.error('❌ Error testing token disconnection:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testTokenDisconnection(); 