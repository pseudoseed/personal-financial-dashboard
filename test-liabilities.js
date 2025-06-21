const { PrismaClient } = require('@prisma/client');
const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');

const prisma = new PrismaClient();

const configuration = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});

const plaidClient = new PlaidApi(configuration);

async function testRefreshLiabilities() {
  try {
    console.log("Testing liability refresh...");
    
    const liabilityAccounts = await prisma.account.findMany({
      where: {
        OR: [{ type: "credit" }, { type: "loan" }],
        plaidItem: {
          accessToken: {
            not: "manual",
          },
        },
      },
      include: {
        plaidItem: true,
      },
    });

    console.log(`Found ${liabilityAccounts.length} liability accounts to process`);

    for (const account of liabilityAccounts) {
      try {
        console.log(`\nProcessing account: ${account.name} (${account.plaidId})`);
        console.log(`Access token: ${account.plaidItem.accessToken.substring(0, 20)}...`);
        
        const response = await plaidClient.liabilitiesGet({
          access_token: account.plaidItem.accessToken,
          options: {
            account_ids: [account.plaidId],
          },
        });

        console.log('Plaid response received');
        console.log('Response data:', JSON.stringify(response.data, null, 2));

        const liabilities = response.data.liabilities;
        if (!liabilities) {
          console.log(`No liability data available for account: ${account.name}`);
          continue;
        }

        const credit = liabilities.credit?.find(c => c.account_id === account.plaidId);
        if (credit) {
          console.log('Credit liability found:', credit);
        } else {
          console.log('No credit liability found for this account');
        }

      } catch (error) {
        console.error(`Error processing account ${account.name}:`, error);
      }
    }

  } catch (error) {
    console.error('Error in test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testRefreshLiabilities(); 