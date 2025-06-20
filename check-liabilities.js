const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkLiabilities() {
  try {
    console.log('Checking for credit and loan accounts...');
    
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

    // Check all accounts to see what types we have
    const allAccounts = await prisma.account.findMany({
      select: {
        name: true,
        type: true
      }
    });

    console.log('All account types:');
    const typeCount = {};
    allAccounts.forEach(acc => {
      typeCount[acc.type] = (typeCount[acc.type] || 0) + 1;
    });
    Object.entries(typeCount).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkLiabilities(); 