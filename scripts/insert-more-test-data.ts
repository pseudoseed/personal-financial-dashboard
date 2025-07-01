import { prisma } from '../src/lib/db';

async function main() {
  // Add a new Plaid Item if it doesn't exist
  const plaidItem3 = await prisma.plaidItem.upsert({
    where: { itemId: 'test-item-3' },
    update: {},
    create: {
      itemId: 'test-item-3',
      accessToken: 'test-access-token-3',
      institutionId: 'ins_3',
      institutionName: 'Sample Savings Bank',
      institutionLogo: null,
    },
  });

  // Add a new Account if it doesn't exist
  const account4 = await prisma.account.upsert({
    where: { plaidId: 'test-account-4' },
    update: {},
    create: {
      plaidId: 'test-account-4',
      name: 'Sample Savings',
      type: 'depository',
      subtype: 'savings',
      itemId: plaidItem3.id,
      userId: 'default',
    },
  });

  // Get existing accounts for variety
  const existingAccounts = await prisma.account.findMany({
    where: { userId: 'default' },
    select: { id: true },
  });
  const accountIds = existingAccounts.map(a => a.id);

  // Helper to pick a random account
  function randomAccountId() {
    return accountIds[Math.floor(Math.random() * accountIds.length)];
  }

  // Prepare new transactions
  const baseDate = new Date();
  const transactions = [
    {
      plaidId: 'tx-101',
      date: new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() - 1),
      name: 'Amazon Purchase',
      amount: -89.99,
      category: 'Shopping',
      merchantName: 'Amazon',
      categoryAiGeneral: 'Shopping',
      categoryAiGranular: 'Online Shopping',
    },
    {
      plaidId: 'tx-102',
      date: new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() - 2),
      name: 'Uber Ride',
      amount: -15.75,
      category: 'Transport',
      merchantName: 'Uber',
      categoryAiGeneral: 'Transport',
      categoryAiGranular: 'Rideshare',
    },
    {
      plaidId: 'tx-103',
      date: new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() - 3),
      name: 'Salary',
      amount: 2500.00,
      category: 'Income',
      merchantName: 'Employer Inc',
      categoryAiGeneral: 'Income',
      categoryAiGranular: 'Salary',
    },
    {
      plaidId: 'tx-104',
      date: new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() - 4),
      name: 'Electric Bill',
      amount: -60.00,
      category: 'Utilities',
      merchantName: 'Electric Co',
      categoryAiGeneral: 'Bills',
      categoryAiGranular: 'Utilities',
    },
    {
      plaidId: 'tx-105',
      date: new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() - 5),
      name: 'Dinner Out',
      amount: -45.00,
      category: 'Dining',
      merchantName: 'Olive Garden',
      categoryAiGeneral: 'Food',
      categoryAiGranular: 'Restaurants',
    },
    {
      plaidId: 'tx-106',
      date: new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() - 6),
      name: 'Gym Membership',
      amount: -35.00,
      category: 'Health',
      merchantName: 'Anytime Fitness',
      categoryAiGeneral: 'Health',
      categoryAiGranular: 'Fitness',
    },
    {
      plaidId: 'tx-107',
      date: new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() - 7),
      name: 'Interest Payment',
      amount: 1.25,
      category: 'Income',
      merchantName: 'Sample Savings Bank',
      categoryAiGeneral: 'Income',
      categoryAiGranular: 'Interest',
    },
    // Edge case: missing merchantName
    {
      plaidId: 'tx-108',
      date: new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() - 8),
      name: 'Mystery Charge',
      amount: -12.34,
      category: 'Other',
      merchantName: null,
      categoryAiGeneral: 'Other',
      categoryAiGranular: 'Miscellaneous',
    },
    // Edge case: missing category
    {
      plaidId: 'tx-109',
      date: new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() - 9),
      name: 'Unknown Expense',
      amount: -22.22,
      category: null,
      merchantName: 'Unknown Vendor',
      categoryAiGeneral: null,
      categoryAiGranular: null,
    },
    // Edge case: future-dated transaction
    {
      plaidId: 'tx-110',
      date: new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + 10),
      name: 'Future Payment',
      amount: -100.00,
      category: 'Bills',
      merchantName: 'Future Co',
      categoryAiGeneral: 'Bills',
      categoryAiGranular: 'Scheduled',
    },
  ];

  let inserted = 0;
  for (const tx of transactions) {
    const accountId = randomAccountId();
    // Only insert if not already present (unique on accountId + plaidId)
    const exists = await prisma.transaction.findUnique({ where: { accountId_plaidId: { accountId, plaidId: tx.plaidId } } });
    if (!exists) {
      await prisma.transaction.create({
        data: {
          ...tx,
          accountId,
        },
      });
      inserted++;
    }
  }

  console.log(`Inserted ${inserted} new transactions and 1 new account.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 