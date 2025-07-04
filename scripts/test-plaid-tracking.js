const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testPlaidTracking() {
  try {
    console.log('🧪 Testing Plaid API Call Tracking...\n');

    // Get recent Plaid API call logs
    const recentLogs = await prisma.plaidApiCallLog.findMany({
      orderBy: { timestamp: 'desc' },
      take: 20,
    });

    console.log('📊 Recent Plaid API Calls:');
    console.log('==========================');
    
    if (recentLogs.length === 0) {
      console.log('No Plaid API calls logged yet.');
      console.log('Try making some API calls to see tracking in action.');
      return;
    }

    // Group by endpoint
    const endpointStats = {};
    recentLogs.forEach(log => {
      if (!endpointStats[log.endpoint]) {
        endpointStats[log.endpoint] = {
          total: 0,
          success: 0,
          errors: 0,
          avgDuration: 0,
          totalDuration: 0
        };
      }
      
      endpointStats[log.endpoint].total++;
      if (log.responseStatus >= 200 && log.responseStatus < 300) {
        endpointStats[log.endpoint].success++;
      } else {
        endpointStats[log.endpoint].errors++;
      }
      
      if (log.durationMs) {
        endpointStats[log.endpoint].totalDuration += log.durationMs;
      }
    });

    // Calculate averages
    Object.keys(endpointStats).forEach(endpoint => {
      const stats = endpointStats[endpoint];
      stats.avgDuration = stats.total > 0 ? Math.round(stats.totalDuration / stats.total) : 0;
    });

    // Display stats
    Object.entries(endpointStats).forEach(([endpoint, stats]) => {
      console.log(`\n🔗 ${endpoint}:`);
      console.log(`   Total calls: ${stats.total}`);
      console.log(`   Success: ${stats.success}`);
      console.log(`   Errors: ${stats.errors}`);
      console.log(`   Avg duration: ${stats.avgDuration}ms`);
    });

    // Show recent calls with details
    console.log('\n📋 Recent API Calls:');
    console.log('===================');
    
    recentLogs.slice(0, 10).forEach((log, index) => {
      const status = log.responseStatus >= 200 && log.responseStatus < 300 ? '✅' : '❌';
      const duration = log.durationMs ? `${log.durationMs}ms` : 'N/A';
      const institution = log.institutionId || 'N/A';
      const account = log.accountId || 'N/A';
      
      console.log(`${index + 1}. ${status} ${log.endpoint}`);
      console.log(`   Status: ${log.responseStatus} | Duration: ${duration}`);
      console.log(`   Institution: ${institution} | Account: ${account}`);
      console.log(`   Time: ${log.timestamp.toISOString()}`);
      if (log.errorMessage) {
        console.log(`   Error: ${log.errorMessage}`);
      }
      console.log('');
    });

    // Check for untracked endpoints
    console.log('🔍 Checking for Common Plaid Endpoints:');
    console.log('=====================================');
    
    const commonEndpoints = [
      '/item/public_token/exchange',
      '/item/get',
      '/institutions/get_by_id',
      '/accounts/get',
      '/accounts/balance/get',
      '/transactions/sync',
      '/transactions/get',
      '/liabilities/get',
      '/link_token/create',
      '/item/remove'
    ];

    commonEndpoints.forEach(endpoint => {
      const hasCalls = recentLogs.some(log => log.endpoint === endpoint);
      const status = hasCalls ? '✅' : '❌';
      console.log(`${status} ${endpoint}`);
    });

  } catch (error) {
    console.error('Error testing Plaid tracking:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testPlaidTracking(); 