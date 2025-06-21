const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkLiabilities() {
  try {
    // Find all credit and loan accounts
    const accounts = await prisma.account.findMany({
      where: {
        type: {
          in: ['credit', 'loan']
        }
      },
      select: {
        id: true,
        name: true,
        type: true,
        lastStatementBalance: true,
        minimumPaymentAmount: true,
        nextPaymentDueDate: true,
        nextMonthlyPayment: true
      }
    });

    console.log(`Found ${accounts.length} credit/loan accounts:`);
    
    accounts.forEach(account => {
      console.log(`- ${account.name} (${account.type})`);
      console.log(`  Statement Balance: ${account.lastStatementBalance}`);
      console.log(`  Minimum Payment: ${account.minimumPaymentAmount}`);
      console.log(`  Next Payment Due: ${account.nextPaymentDueDate}`);
      console.log(`  Next Monthly Payment: ${account.nextMonthlyPayment}`);
      console.log('');
    });

    // Also show all account types for reference
    const allAccounts = await prisma.account.findMany({
      select: {
        type: true
      }
    });

    const typeCounts = {};
    allAccounts.forEach(account => {
      typeCounts[account.type] = (typeCounts[account.type] || 0) + 1;
    });

    console.log('All account types:');
    Object.entries(typeCounts).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkLiabilities(); 