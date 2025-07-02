#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';
import { loanService } from '../src/lib/loanService';

const prisma = new PrismaClient();

async function insertLoanTestData() {
  console.log('🚀 Starting loan test data insertion...');

  try {
    // Ensure default user exists
    const user = await prisma.user.upsert({
      where: { email: 'default@example.com' },
      update: {},
      create: {
        email: 'default@example.com',
        name: 'Default User'
      }
    });

    console.log('✅ User ensured:', user.email);

    // Get or create some test accounts
    const accounts = await prisma.account.findMany({
      where: { userId: user.id },
      take: 5
    });

    if (accounts.length === 0) {
      console.log('⚠️  No accounts found. Creating test accounts...');
      
      // Create test accounts
      const testAccounts = [
        {
          name: 'Chase Credit Card',
          type: 'credit',
          subtype: 'credit card',
          plaidId: 'test_credit_card_1',
          itemId: 'test_item_1',
          userId: user.id,
          lastStatementBalance: 2500.00,
          minimumPaymentAmount: 35.00,
          nextPaymentDueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days from now
          nextMonthlyPayment: 250.00
        },
        {
          name: 'Wells Fargo Mortgage',
          type: 'loan',
          subtype: 'mortgage',
          plaidId: 'test_mortgage_1',
          itemId: 'test_item_2',
          userId: user.id,
          lastStatementBalance: 285000.00,
          minimumPaymentAmount: 1850.00,
          nextPaymentDueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
          nextMonthlyPayment: 1850.00
        },
        {
          name: 'Auto Loan - Toyota',
          type: 'loan',
          subtype: 'auto',
          plaidId: 'test_auto_loan_1',
          itemId: 'test_item_3',
          userId: user.id,
          lastStatementBalance: 18500.00,
          minimumPaymentAmount: 425.00,
          nextPaymentDueDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000), // 8 days from now
          nextMonthlyPayment: 425.00
        },
        {
          name: 'Student Loan - Federal',
          type: 'loan',
          subtype: 'student',
          plaidId: 'test_student_loan_1',
          itemId: 'test_item_4',
          userId: user.id,
          lastStatementBalance: 45000.00,
          minimumPaymentAmount: 350.00,
          nextPaymentDueDate: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000), // 12 days from now
          nextMonthlyPayment: 350.00
        },
        {
          name: 'Personal Loan - SoFi',
          type: 'loan',
          subtype: 'personal',
          plaidId: 'test_personal_loan_1',
          itemId: 'test_item_5',
          userId: user.id,
          lastStatementBalance: 12000.00,
          minimumPaymentAmount: 280.00,
          nextPaymentDueDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000), // 20 days from now
          nextMonthlyPayment: 280.00
        }
      ];

      for (const accountData of testAccounts) {
        await prisma.account.create({
          data: accountData
        });
      }

      console.log('✅ Created 5 test accounts');
    }

    // Get updated accounts
    const updatedAccounts = await prisma.account.findMany({
      where: { userId: user.id },
      take: 5
    });

    console.log(`📊 Found ${updatedAccounts.length} accounts to create loans for`);

    // Create loan details for each account
    const loanData = [
      {
        accountId: updatedAccounts[0]?.id,
        loanType: 'credit_card' as const,
        currentInterestRate: 18.99,
        currentInterestRateSource: 'plaid' as const,
        introductoryRate: 0.00,
        introductoryRateSource: 'plaid' as const,
        introductoryRateExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        introductoryRateExpirySource: 'plaid' as const,
        rateType: 'variable' as const,
        paymentsPerMonth: 1,
        paymentsPerMonthSource: 'manual' as const,
        paymentsRemaining: 12,
        paymentsRemainingSource: 'calculated' as const,
        autoCalculatePayments: true,
        loanTerm: 12,
        gracePeriod: 25
      },
      {
        accountId: updatedAccounts[1]?.id,
        loanType: 'mortgage' as const,
        currentInterestRate: 4.25,
        currentInterestRateSource: 'plaid' as const,
        introductoryRate: null,
        introductoryRateSource: 'plaid' as const,
        introductoryRateExpiry: null,
        introductoryRateExpirySource: 'plaid' as const,
        rateType: 'fixed' as const,
        paymentsPerMonth: 1,
        paymentsPerMonthSource: 'manual' as const,
        paymentsRemaining: 324, // 27 years remaining
        paymentsRemainingSource: 'calculated' as const,
        autoCalculatePayments: true,
        loanTerm: 360, // 30 years
        gracePeriod: 15
      },
      {
        accountId: updatedAccounts[2]?.id,
        loanType: 'auto' as const,
        currentInterestRate: 5.75,
        currentInterestRateSource: 'plaid' as const,
        introductoryRate: null,
        introductoryRateSource: 'plaid' as const,
        introductoryRateExpiry: null,
        introductoryRateExpirySource: 'plaid' as const,
        rateType: 'fixed' as const,
        paymentsPerMonth: 1,
        paymentsPerMonthSource: 'manual' as const,
        paymentsRemaining: 48, // 4 years remaining
        paymentsRemainingSource: 'calculated' as const,
        autoCalculatePayments: true,
        loanTerm: 60, // 5 years
        gracePeriod: 10
      },
      {
        accountId: updatedAccounts[3]?.id,
        loanType: 'student' as const,
        currentInterestRate: 3.85,
        currentInterestRateSource: 'plaid' as const,
        introductoryRate: null,
        introductoryRateSource: 'plaid' as const,
        introductoryRateExpiry: null,
        introductoryRateExpirySource: 'plaid' as const,
        rateType: 'fixed' as const,
        paymentsPerMonth: 1,
        paymentsPerMonthSource: 'manual' as const,
        paymentsRemaining: 120, // 10 years remaining
        paymentsRemainingSource: 'calculated' as const,
        autoCalculatePayments: true,
        loanTerm: 120, // 10 years
        gracePeriod: 6
      },
      {
        accountId: updatedAccounts[4]?.id,
        loanType: 'personal' as const,
        currentInterestRate: 8.50,
        currentInterestRateSource: 'plaid' as const,
        introductoryRate: 5.99,
        introductoryRateSource: 'plaid' as const,
        introductoryRateExpiry: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
        introductoryRateExpirySource: 'plaid' as const,
        rateType: 'introductory' as const,
        paymentsPerMonth: 1,
        paymentsPerMonthSource: 'manual' as const,
        paymentsRemaining: 48, // 4 years remaining
        paymentsRemainingSource: 'calculated' as const,
        autoCalculatePayments: true,
        loanTerm: 48, // 4 years
        gracePeriod: 5
      }
    ];

    // Create loan details
    for (const loanInfo of loanData) {
      if (loanInfo.accountId) {
        try {
          const loan = await loanService.createOrUpdateLoan(
            loanInfo.accountId,
            loanInfo,
            false // Don't preserve manual entries for test data
          );

          console.log(`✅ Created loan for account: ${updatedAccounts.find(a => a.id === loanInfo.accountId)?.name}`);

          // Create some test alerts
          await createTestAlerts(loan.id);

          // Create some test payment history
          await createTestPaymentHistory(loan.id);

        } catch (error) {
          console.error(`❌ Failed to create loan for account ${loanInfo.accountId}:`, error);
        }
      }
    }

    // Create some manual entry loans (not from Plaid)
    const manualLoanData = [
      {
        accountId: updatedAccounts[0]?.id,
        currentInterestRate: 22.99,
        currentInterestRateSource: 'manual' as const,
        paymentsPerMonth: 2, // Bi-weekly payments
        paymentsPerMonthSource: 'manual' as const,
        loanType: 'credit_card' as const,
        autoCalculatePayments: false
      }
    ];

    for (const manualLoan of manualLoanData) {
      if (manualLoan.accountId) {
        try {
          await loanService.updateLoan(
            (await prisma.loanDetails.findUnique({ where: { accountId: manualLoan.accountId } }))?.id || '',
            manualLoan,
            false
          );
          console.log(`✅ Updated loan with manual entries for account: ${updatedAccounts.find(a => a.id === manualLoan.accountId)?.name}`);
        } catch (error) {
          console.error(`❌ Failed to update loan with manual entries:`, error);
        }
      }
    }

    // Create account balances for testing
    await createTestBalances(updatedAccounts);

    console.log('🎉 Loan test data insertion completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`- Created/updated ${loanData.length} loan records`);
    console.log(`- Created test alerts and payment history`);
    console.log(`- Created test account balances`);
    console.log(`- Demonstrated manual entry protection`);

  } catch (error) {
    console.error('❌ Error inserting loan test data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

async function createTestAlerts(loanId: string) {
  const alerts = [
    {
      loanId,
      alertType: 'intro_rate_expiring',
      title: 'Introductory Rate Expiring Soon',
      message: 'Your 0% introductory rate will expire in 30 days. Consider paying off the balance to avoid interest charges.',
      severity: 'high' as const,
      isActive: true,
      isDismissed: false
    },
    {
      loanId,
      alertType: 'payment_due',
      title: 'Payment Due Soon',
      message: 'Your payment of $250.00 is due in 5 days.',
      severity: 'medium' as const,
      isActive: true,
      isDismissed: false
    },
    {
      loanId,
      alertType: 'high_interest',
      title: 'High Interest Rate Detected',
      message: 'This loan has a high interest rate of 18.99%. Consider refinancing or paying off early.',
      severity: 'medium' as const,
      isActive: true,
      isDismissed: false
    }
  ];

  for (const alert of alerts) {
    await prisma.loanAlert.create({
      data: alert
    });
  }
}

async function createTestPaymentHistory(loanId: string) {
  const payments = [
    {
      loanId,
      paymentDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      amount: 250.00,
      isScheduled: false,
      notes: 'Regular monthly payment'
    },
    {
      loanId,
      paymentDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
      amount: 250.00,
      isScheduled: false,
      notes: 'Regular monthly payment'
    },
    {
      loanId,
      paymentDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days ago
      amount: 300.00,
      isScheduled: false,
      notes: 'Extra payment to reduce balance'
    }
  ];

  for (const payment of payments) {
    await prisma.loanPaymentHistory.create({
      data: payment
    });
  }
}

async function createTestBalances(accounts: any[]) {
  for (const account of accounts) {
    await prisma.accountBalance.create({
      data: {
        accountId: account.id,
        current: account.lastStatementBalance || 0,
        available: account.lastStatementBalance || 0,
        date: new Date()
      }
    });
  }
}

// Run the script
if (require.main === module) {
  insertLoanTestData()
    .then(() => {
      console.log('✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
} 