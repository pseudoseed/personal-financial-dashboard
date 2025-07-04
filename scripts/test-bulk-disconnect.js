const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testBulkDisconnect() {
  try {
    console.log('🧪 Testing Bulk Disconnect functionality...\n');

    // Check if the new tables exist
    console.log('📊 Checking database schema...');
    
    // Test BulkDisconnectJob table
    const jobCount = await prisma.bulkDisconnectJob.count();
    console.log(`  - BulkDisconnectJob table: ${jobCount} records`);
    
    // Test BulkDisconnectResult table
    const resultCount = await prisma.bulkDisconnectResult.count();
    console.log(`  - BulkDisconnectResult table: ${resultCount} records`);
    
    // Check PlaidItems
    const plaidItemCount = await prisma.plaidItem.count();
    console.log(`  - PlaidItem table: ${plaidItemCount} records`);
    
    const activePlaidItems = await prisma.plaidItem.count({
      where: { status: 'active' }
    });
    console.log(`  - Active PlaidItems: ${activePlaidItems}`);
    
    const disconnectedPlaidItems = await prisma.plaidItem.count({
      where: { status: 'disconnected' }
    });
    console.log(`  - Disconnected PlaidItems: ${disconnectedPlaidItems}`);

    // Check if reports directory exists
    const fs = require('fs');
    const path = require('path');
    const reportsDir = path.join(process.cwd(), 'reports', 'bulk-disconnect');
    
    if (fs.existsSync(reportsDir)) {
      const reportFiles = fs.readdirSync(reportsDir);
      console.log(`  - Reports directory: ${reportFiles.length} files`);
    } else {
      console.log('  - Reports directory: Not found (will be created on first use)');
    }

    console.log('\n✅ Bulk Disconnect functionality is ready for testing');
    console.log('📝 To test with real Plaid tokens:');
    console.log('   1. Go to /admin/bulk-disconnect');
    console.log('   2. Enter comma-separated access tokens');
    console.log('   3. Submit the job and monitor progress');
    console.log('   4. Check job history and download reports');
    console.log('   5. Test retry functionality for failed tokens');

  } catch (error) {
    console.error('❌ Error testing bulk disconnect:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testBulkDisconnect(); 