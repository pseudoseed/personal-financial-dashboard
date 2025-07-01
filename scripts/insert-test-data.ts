import { prisma } from '../src/lib/db';

async function main() {
  // Ensure the default user exists
  await prisma.user.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      email: 'default@example.com',
      name: 'Default User',
    },
  });

  // Create Plaid Items
  const plaidItem1 = await prisma.plaidItem.upsert({
    where: { itemId: 'test-item-1' },
    update: {},
    create: {
      itemId: 'test-item-1',
      accessToken: 'test-access-token-1',
      institutionId: 'ins_1',
      institutionName: 'Test Bank',
      institutionLogo: null,
    },
  });
  const plaidItem2 = await prisma.plaidItem.upsert({
    where: { itemId: 'test-item-2' },
    update: {},
    create: {
      itemId: 'test-item-2',
      accessToken: 'test-access-token-2',
      institutionId: 'ins_2',
      institutionName: 'Edge Credit Union',
      institutionLogo: null,
    },
  });

  // Create Accounts
  const account1 = await prisma.account.upsert({
    where: { plaidId: 'test-account-1' },
    update: {},
    create: {
      plaidId: 'test-account-1',
      name: 'Checking Account',
      type: 'depository',
      subtype: 'checking',
      itemId: plaidItem1.id,
      userId: 'default',
    },
  });
  const account2 = await prisma.account.upsert({
    where: { plaidId: 'test-account-2' },
    update: {},
    create: {
      plaidId: 'test-account-2',
      name: 'Savings Account',
      type: 'depository',
      subtype: 'savings',
      itemId: plaidItem2.id,
      userId: 'default',
    },
  });
  const account3 = await prisma.account.upsert({
    where: { plaidId: 'test-account-3' },
    update: {},
    create: {
      plaidId: 'test-account-3',
      name: 'No Plaid Account',
      type: 'credit',
      subtype: 'credit card',
      itemId: plaidItem1.id,
      userId: 'default',
    },
  });

  // Create Transactions (covering general, granular, and edge cases)
  const transactions = [
    {
      accountId: account1.id,
      plaidId: 'tx-1',
      date: new Date('2024-06-01'),
      name: 'Grocery Store',
      amount: -54.23,
      category: 'Groceries',
      merchantName: 'Whole Foods',
      categoryAiGeneral: 'Food',
      categoryAiGranular: 'Groceries',
    },
    {
      accountId: account1.id,
      plaidId: 'tx-2',
      date: new Date('2024-06-02'),
      name: 'Coffee Shop',
      amount: -4.50,
      category: 'Dining',
      merchantName: 'Starbucks',
      categoryAiGeneral: 'Food',
      categoryAiGranular: 'Coffee Shops',
    },
    {
      accountId: account2.id,
      plaidId: 'tx-3',
      date: new Date('2024-06-03'),
      name: 'Paycheck',
      amount: 2000.00,
      category: 'Income',
      merchantName: 'Employer Inc',
      categoryAiGeneral: 'Income',
      categoryAiGranular: 'Salary',
    },
    {
      accountId: account2.id,
      plaidId: 'tx-4',
      date: new Date('2024-06-04'),
      name: 'ATM Withdrawal',
      amount: -100.00,
      category: 'Cash',
      merchantName: null,
      categoryAiGeneral: 'Cash',
      categoryAiGranular: 'ATM',
    },
    // Edge case: missing categoryAi fields
    {
      accountId: account3.id,
      plaidId: 'tx-5',
      date: new Date('2024-06-05'),
      name: 'Unknown Transaction',
      amount: -20.00,
      category: null,
      merchantName: null,
      categoryAiGeneral: null,
      categoryAiGranular: null,
    },
    // Edge case: missing merchantName
    {
      accountId: account1.id,
      plaidId: 'tx-6',
      date: new Date('2024-06-06'),
      name: 'Utility Bill',
      amount: -120.00,
      category: 'Utilities',
      merchantName: null,
      categoryAiGeneral: 'Bills',
      categoryAiGranular: 'Utilities',
    },
  ];
  for (const tx of transactions) {
    await prisma.transaction.upsert({
      where: { accountId_plaidId: { accountId: tx.accountId, plaidId: tx.plaidId } },
      update: tx,
      create: tx,
    });
  }

  // Create Recurring Expenses
  await prisma.recurringExpense.createMany({
    data: [
      {
        userId: 'default',
        name: 'Netflix Subscription',
        merchantName: 'Netflix',
        category: 'Streaming',
        amount: 15.99,
        frequency: 'monthly',
        nextDueDate: new Date('2024-07-01'),
        lastTransactionDate: new Date('2024-06-01'),
        confidence: 95,
        isActive: true,
        isConfirmed: true,
      },
      {
        userId: 'default',
        name: 'Gym Membership',
        merchantName: 'Anytime Fitness',
        category: 'Health',
        amount: 35.00,
        frequency: 'monthly',
        nextDueDate: new Date('2024-07-05'),
        lastTransactionDate: new Date('2024-06-05'),
        confidence: 90,
        isActive: true,
        isConfirmed: true,
      },
      {
        userId: 'default',
        name: 'Electric Bill',
        merchantName: 'Electric Co',
        category: 'Utilities',
        amount: 60.00,
        frequency: 'monthly',
        nextDueDate: new Date('2024-07-10'),
        lastTransactionDate: new Date('2024-06-10'),
        confidence: 85,
        isActive: true,
        isConfirmed: true,
      },
      {
        userId: 'default',
        name: 'Spotify',
        merchantName: 'Spotify',
        category: 'Streaming',
        amount: 9.99,
        frequency: 'monthly',
        nextDueDate: new Date('2024-07-15'),
        lastTransactionDate: new Date('2024-06-15'),
        confidence: 80,
        isActive: true,
        isConfirmed: false,
      },
    ]
  });

  // Simulate a Netflix price drop with a new transaction
  const netflixAccount = await prisma.account.findFirst({ where: { userId: 'default' } });
  if (netflixAccount) {
    await prisma.transaction.upsert({
      where: { accountId_plaidId: { accountId: netflixAccount.id, plaidId: 'tx-netflix-latest' } },
      update: {
        date: new Date(),
        name: 'Netflix Subscription',
        amount: -13.99,
        category: 'Streaming',
        merchantName: 'Netflix',
        categoryAiGeneral: 'Streaming',
        categoryAiGranular: 'Subscription',
      },
      create: {
        accountId: netflixAccount.id,
        plaidId: 'tx-netflix-latest',
        date: new Date(),
        name: 'Netflix Subscription',
        amount: -13.99,
        category: 'Streaming',
        merchantName: 'Netflix',
        categoryAiGeneral: 'Streaming',
        categoryAiGranular: 'Subscription',
      },
    });
  }

  console.log('Test data inserted successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 