#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';
import { TransactionLinkMetadata } from '../src/types/transactionLink';

const prisma = new PrismaClient();

async function insertTransactionLinkTestData() {
  console.log('🔗 Inserting transaction link test data...');

  try {
    // Get existing transactions and loans for linking
    const transactions = await prisma.transaction.findMany({
      take: 20,
      orderBy: { date: 'desc' },
      include: {
        account: true,
      },
    });

    const loans = await prisma.loanDetails.findMany({
      take: 5,
    });

    if (transactions.length === 0) {
      console.log('❌ No transactions found. Please run insert-test-data.ts first.');
      return;
    }

    if (loans.length === 0) {
      console.log('❌ No loans found. Please run insert-loan-test-data.ts first.');
      return;
    }

    console.log(`📊 Found ${transactions.length} transactions and ${loans.length} loans`);

    // Create loan payment links
    const loanPaymentLinks = [
      {
        transactionId: transactions[0].id,
        entityType: 'loan' as const,
        entityId: loans[0].id,
        metadata: {
          paymentDate: '2024-01-15',
          paymentAmount: 1250.00,
          paymentType: 'combined' as const,
          detectionMethod: 'automatic' as const,
          notes: 'Monthly mortgage payment',
          isScheduled: false,
        },
      },
      {
        transactionId: transactions[1].id,
        entityType: 'loan' as const,
        entityId: loans[0].id,
        metadata: {
          paymentDate: '2024-02-15',
          paymentAmount: 1250.00,
          paymentType: 'combined' as const,
          detectionMethod: 'automatic' as const,
          notes: 'February mortgage payment',
          isScheduled: false,
        },
      },
      {
        transactionId: transactions[2].id,
        entityType: 'loan' as const,
        entityId: loans[1].id,
        metadata: {
          paymentDate: '2024-01-20',
          paymentAmount: 450.00,
          paymentType: 'combined' as const,
          detectionMethod: 'manual' as const,
          notes: 'Car loan payment',
          isScheduled: false,
        },
      },
      {
        transactionId: transactions[3].id,
        entityType: 'loan' as const,
        entityId: loans[2].id,
        metadata: {
          paymentDate: '2024-01-10',
          paymentAmount: 300.00,
          paymentType: 'interest' as const,
          detectionMethod: 'automatic' as const,
          notes: 'Student loan interest payment',
          isScheduled: false,
        },
      },
    ];

    // Create subscription payment links
    const subscriptionLinks = [
      {
        transactionId: transactions[4].id,
        entityType: 'subscription' as const,
        entityId: 'netflix-subscription',
        metadata: {
          billingCycle: 'monthly' as const,
          serviceName: 'Netflix',
          planType: 'Standard',
          renewalDate: '2024-02-01',
          autoRenew: true,
          detectionMethod: 'automatic' as const,
          notes: 'Netflix monthly subscription',
        },
      },
      {
        transactionId: transactions[5].id,
        entityType: 'subscription' as const,
        entityId: 'spotify-subscription',
        metadata: {
          billingCycle: 'monthly' as const,
          serviceName: 'Spotify',
          planType: 'Premium',
          renewalDate: '2024-02-05',
          autoRenew: true,
          detectionMethod: 'manual' as const,
          notes: 'Spotify Premium subscription',
        },
      },
      {
        transactionId: transactions[6].id,
        entityType: 'subscription' as const,
        entityId: 'gym-membership',
        metadata: {
          billingCycle: 'monthly' as const,
          serviceName: 'Planet Fitness',
          planType: 'Basic',
          renewalDate: '2024-02-03',
          autoRenew: true,
          detectionMethod: 'automatic' as const,
          notes: 'Gym membership monthly fee',
        },
      },
    ];

    // Create bill payment links
    const billLinks = [
      {
        transactionId: transactions[7].id,
        entityType: 'bill' as const,
        entityId: 'electric-bill',
        metadata: {
          billType: 'utility',
          dueDate: '2024-01-15',
          serviceProvider: 'Local Electric Company',
          accountNumber: 'ELEC-12345',
          detectionMethod: 'automatic' as const,
          notes: 'January electric bill',
        },
      },
      {
        transactionId: transactions[8].id,
        entityType: 'bill' as const,
        entityId: 'water-bill',
        metadata: {
          billType: 'utility',
          dueDate: '2024-01-20',
          serviceProvider: 'City Water Department',
          accountNumber: 'WATER-67890',
          detectionMethod: 'manual' as const,
          notes: 'January water bill',
        },
      },
      {
        transactionId: transactions[9].id,
        entityType: 'bill' as const,
        entityId: 'internet-bill',
        metadata: {
          billType: 'service',
          dueDate: '2024-01-10',
          serviceProvider: 'Comcast',
          accountNumber: 'INT-11111',
          detectionMethod: 'automatic' as const,
          notes: 'Internet service monthly bill',
        },
      },
    ];

    // Create recurring expense links
    const recurringExpenseLinks = [
      {
        transactionId: transactions[10].id,
        entityType: 'recurring_expense' as const,
        entityId: 'groceries-weekly',
        metadata: {
          expenseName: 'Weekly Groceries',
          frequency: 'weekly',
          expectedAmount: 120.45,
          category: 'Food & Dining',
          detectionMethod: 'automatic' as const,
          notes: 'Weekly grocery shopping',
        },
      },
      {
        transactionId: transactions[11].id,
        entityType: 'recurring_expense' as const,
        entityId: 'gas-weekly',
        metadata: {
          expenseName: 'Weekly Gas',
          frequency: 'weekly',
          expectedAmount: 45.00,
          category: 'Transportation',
          detectionMethod: 'manual' as const,
          notes: 'Weekly gas fill-up',
        },
      },
    ];

    // Create investment links
    const investmentLinks = [
      {
        transactionId: transactions[12].id,
        entityType: 'investment' as const,
        entityId: '401k-contribution',
        metadata: {
          investmentType: 'contribution' as const,
          securityName: '401k Plan',
          detectionMethod: 'automatic' as const,
          notes: '401k payroll contribution',
        },
      },
      {
        transactionId: transactions[13].id,
        entityType: 'investment' as const,
        entityId: 'roth-ira',
        metadata: {
          investmentType: 'contribution' as const,
          securityName: 'Roth IRA',
          detectionMethod: 'manual' as const,
          notes: 'Roth IRA monthly contribution',
        },
      },
    ];

    // Create other type links
    const otherLinks = [
      {
        transactionId: transactions[14].id,
        entityType: 'other' as const,
        entityId: 'friend-loan',
        metadata: {
          detectionMethod: 'manual' as const,
          notes: 'Repayment to friend for dinner',
        },
      },
    ];

    // Combine all links
    const allLinks = [
      ...loanPaymentLinks,
      ...subscriptionLinks,
      ...billLinks,
      ...recurringExpenseLinks,
      ...investmentLinks,
      ...otherLinks,
    ];

    // Insert all transaction links
    const createdLinks = [];
    for (const linkData of allLinks) {
      try {
        const link = await prisma.transactionLink.create({
          data: {
            transactionId: linkData.transactionId,
            entityType: linkData.entityType,
            entityId: linkData.entityId,
            metadata: linkData.metadata,
          },
        });
        createdLinks.push(link);
        console.log(`✅ Created link: ${linkData.entityType} -> ${linkData.entityId}`);
      } catch (error) {
        console.log(`⚠️  Skipped duplicate link: ${linkData.entityType} -> ${linkData.entityId}`);
      }
    }

    console.log(`\n🎉 Successfully created ${createdLinks.length} transaction links`);
    console.log('\n📋 Summary:');
    console.log(`  - Loan payments: ${loanPaymentLinks.length}`);
    console.log(`  - Subscriptions: ${subscriptionLinks.length}`);
    console.log(`  - Bills: ${billLinks.length}`);
    console.log(`  - Recurring expenses: ${recurringExpenseLinks.length}`);
    console.log(`  - Investments: ${investmentLinks.length}`);
    console.log(`  - Other: ${otherLinks.length}`);

    // Test the API endpoints
    console.log('\n🧪 Testing API endpoints...');
    
    // Test GET /api/transactions/links
    const testResponse = await fetch('http://localhost:3000/api/transactions/links?entityType=loan&entityId=' + loans[0].id);
    if (testResponse.ok) {
      const testData = await testResponse.json();
      console.log(`✅ API test successful: Found ${testData.data.length} links for loan ${loans[0].id}`);
    } else {
      console.log('⚠️  API test failed - make sure the server is running');
    }

  } catch (error) {
    console.error('❌ Error inserting transaction link test data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
insertTransactionLinkTestData()
  .then(() => {
    console.log('\n✨ Transaction link test data insertion complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  }); 