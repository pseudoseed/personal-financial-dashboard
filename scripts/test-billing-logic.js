const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Plaid API costs based on actual billing structure
const PLAID_COSTS = {
  // Free endpoints (no charge)
  '/item/get': 0.00,
  '/item/remove': 0.00,
  '/link_token/create': 0.00,
  '/item/public_token/exchange': 0.00,
  '/item/access_token/invalidate': 0.00,
  '/item/access_token/update_version': 0.00,
  '/institutions/get_by_id': 0.00,
  '/accounts/get': 0.00,
  
  // Per-call billing
  '/accounts/balance/get': 0.10, // $0.10 per call
  
  // Per-account/month billing (calculated separately)
  '/transactions/sync': 0.00, // $0.30 per connected account/month (calculated in monthly billing)
  '/transactions/get': 0.00, // $0.30 per connected account/month (calculated in monthly billing)
  '/liabilities/get': 0.00, // $0.20 per connected account/month (calculated in monthly billing)
  '/investments/transactions/get': 0.00, // $0.35 per connected account/month (calculated in monthly billing)
  '/investments/holdings/get': 0.00, // $0.18 per connected account/month (calculated in monthly billing)
};

// Monthly billing rates per connected account
const MONTHLY_BILLING_RATES = {
  transactions: 0.30, // $0.30 per connected account/month
  liabilities: 0.20,  // $0.20 per connected account/month
  investments: 0.35,  // $0.35 per connected account/month (transactions)
  investmentHoldings: 0.18, // $0.18 per connected account/month (holdings)
};

async function testBillingLogic() {
  try {
    console.log('🧪 Testing Updated Plaid Billing Logic...\n');

    // Get recent Plaid API call logs
    const recentLogs = await prisma.plaidApiCallLog.findMany({
      orderBy: { timestamp: 'desc' },
      take: 50,
    });

    console.log('📊 Recent Plaid API Calls Analysis:');
    console.log('====================================');
    
    if (recentLogs.length === 0) {
      console.log('No Plaid API calls logged yet.');
      console.log('Try making some API calls to see tracking in action.');
      return;
    }

    // Calculate per-call costs
    const endpointStats = {};
    let totalPerCallCost = 0;
    
    recentLogs.forEach(log => {
      if (!endpointStats[log.endpoint]) {
        endpointStats[log.endpoint] = {
          calls: 0,
          cost: 0,
          rate: PLAID_COSTS[log.endpoint] || 0.00
        };
      }
      
      const cost = PLAID_COSTS[log.endpoint] || 0.00;
      endpointStats[log.endpoint].calls++;
      endpointStats[log.endpoint].cost += cost;
      totalPerCallCost += cost;
    });

    console.log('\n💰 Per-Call Billing Breakdown:');
    console.log('-------------------------------');
    Object.entries(endpointStats).forEach(([endpoint, stats]) => {
      const rateText = stats.rate === 0 ? 'FREE' : `$${stats.rate.toFixed(2)}/call`;
      console.log(`${endpoint}:`);
      console.log(`  Calls: ${stats.calls}`);
      console.log(`  Rate: ${rateText}`);
      console.log(`  Cost: $${stats.cost.toFixed(2)}`);
    });

    console.log(`\n📈 Total Per-Call Cost: $${totalPerCallCost.toFixed(2)}`);

    // Calculate monthly billing
    const allItems = await prisma.plaidItem.findMany({
      include: {
        accounts: {
          where: {
            archived: false,
          },
        },
      },
    });

    const activeAccounts = allItems
      .filter(item => item.status === 'active' || item.status === null || item.status === undefined)
      .flatMap(item => item.accounts);

    const monthlyBillingBreakdown = {
      transactions: 0,
      liabilities: 0,
      investments: 0,
      investmentHoldings: 0,
    };

    // Count accounts by type for monthly billing
    activeAccounts.forEach(account => {
      // All Plaid accounts get Transactions billing
      monthlyBillingBreakdown.transactions += MONTHLY_BILLING_RATES.transactions;
      
      // Credit and loan accounts get Liabilities billing
      if (account.type === 'credit' || account.type === 'loan') {
        monthlyBillingBreakdown.liabilities += MONTHLY_BILLING_RATES.liabilities;
      }
      
      // Investment accounts get both Investments and Investment Holdings billing
      if (account.type === 'investment') {
        monthlyBillingBreakdown.investments += MONTHLY_BILLING_RATES.investments;
        monthlyBillingBreakdown.investmentHoldings += MONTHLY_BILLING_RATES.investmentHoldings;
      }
    });

    const totalMonthlyCost = Object.values(monthlyBillingBreakdown).reduce((sum, cost) => sum + cost, 0);
    const totalCost = totalPerCallCost + totalMonthlyCost;

    console.log('\n📅 Monthly Billing Breakdown:');
    console.log('-----------------------------');
    console.log(`Active Accounts: ${activeAccounts.length}`);
    console.log(`Transactions ($${MONTHLY_BILLING_RATES.transactions}/account/month): $${monthlyBillingBreakdown.transactions.toFixed(2)}`);
    console.log(`Liabilities ($${MONTHLY_BILLING_RATES.liabilities}/account/month): $${monthlyBillingBreakdown.liabilities.toFixed(2)}`);
    console.log(`Investment Transactions ($${MONTHLY_BILLING_RATES.investments}/account/month): $${monthlyBillingBreakdown.investments.toFixed(2)}`);
    console.log(`Investment Holdings ($${MONTHLY_BILLING_RATES.investmentHoldings}/account/month): $${monthlyBillingBreakdown.investmentHoldings.toFixed(2)}`);
    console.log(`Total Monthly Cost: $${totalMonthlyCost.toFixed(2)}`);

    console.log('\n💵 Total Cost Summary:');
    console.log('======================');
    console.log(`Per-Call Cost: $${totalPerCallCost.toFixed(2)}`);
    console.log(`Monthly Cost: $${totalMonthlyCost.toFixed(2)}`);
    console.log(`Total Estimated Cost: $${totalCost.toFixed(2)}`);

    // Account type breakdown
    const accountTypeBreakdown = {};
    activeAccounts.forEach(account => {
      accountTypeBreakdown[account.type] = (accountTypeBreakdown[account.type] || 0) + 1;
    });

    console.log('\n🏦 Account Type Breakdown:');
    console.log('==========================');
    Object.entries(accountTypeBreakdown).forEach(([type, count]) => {
      console.log(`${type}: ${count} accounts`);
    });

    console.log('\n✅ Billing Logic Test Complete!');
    console.log('\nKey Changes:');
    console.log('- Most endpoints are now FREE ($0.00)');
    console.log('- Only balance calls are charged per-call ($0.10)');
    console.log('- Monthly billing is based on account types and features');
    console.log('- Total cost is now much more accurate to actual Plaid billing');

  } catch (error) {
    console.error('❌ Error testing billing logic:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testBillingLogic(); 