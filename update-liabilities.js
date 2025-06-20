const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function updateLiabilities() {
  try {
    console.log("Updating liability data...");
    
    // Update the first credit card (3781) - due July 3rd
    await prisma.account.updateMany({
      where: {
        mask: "3781",
        type: "credit"
      },
      data: {
        lastStatementBalance: 2190.53,
        minimumPaymentAmount: 40,
        nextPaymentDueDate: new Date("2025-07-03"),
        lastPaymentDate: new Date("2025-06-04"),
        lastPaymentAmount: 883.07
      }
    });

    // Update the second credit card (9620) - due July 3rd
    await prisma.account.updateMany({
      where: {
        mask: "9620",
        type: "credit"
      },
      data: {
        lastStatementBalance: 3920.07,
        minimumPaymentAmount: 535.67,
        nextPaymentDueDate: new Date("2025-07-03"),
        lastPaymentDate: new Date("2025-06-03"),
        lastPaymentAmount: 980.89
      }
    });

    // Update the third credit card (3730) - due July 11th
    await prisma.account.updateMany({
      where: {
        mask: "3730",
        type: "credit"
      },
      data: {
        lastStatementBalance: 3348.77,
        minimumPaymentAmount: 297.11,
        nextPaymentDueDate: new Date("2025-07-11"),
        lastPaymentDate: new Date("2025-06-11"),
        lastPaymentAmount: 282.11
      }
    });

    console.log("Liability data updated successfully!");

    // Verify the updates
    const accounts = await prisma.account.findMany({
      where: {
        type: "credit"
      },
      select: {
        name: true,
        mask: true,
        lastStatementBalance: true,
        minimumPaymentAmount: true,
        nextPaymentDueDate: true
      }
    });

    console.log("\nUpdated accounts:");
    accounts.forEach(account => {
      console.log(`- ${account.name} (${account.mask}): $${account.lastStatementBalance} due ${account.nextPaymentDueDate}`);
    });

  } catch (error) {
    console.error('Error updating liabilities:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateLiabilities(); 