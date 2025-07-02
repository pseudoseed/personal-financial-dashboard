import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { TransactionLink, TransactionLinkMetadata } from '@/types/transactionLink';

const prisma = new PrismaClient();

describe('Transaction Link Service', () => {
  let testTransactionId: string;
  let testLoanId: string;

  beforeEach(async () => {
    // Create test transaction
    const transaction = await prisma.transaction.create({
      data: {
        name: 'Test Transaction',
        amount: 100.00,
        date: new Date('2024-01-15'),
        accountId: 'test-account',
        userId: 'test-user',
        category: 'Test Category',
        merchantName: 'Test Merchant',
      },
    });
    testTransactionId = transaction.id;

    // Create test loan
    const loan = await prisma.loanDetails.create({
      data: {
        accountId: 'test-loan-account',
        userId: 'test-user',
        currentInterestRate: 5.5,
        paymentsPerMonth: 1,
      },
    });
    testLoanId = loan.id;
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.transactionLink.deleteMany({
      where: {
        transactionId: testTransactionId,
      },
    });
    await prisma.transaction.delete({
      where: { id: testTransactionId },
    });
    await prisma.loanDetails.delete({
      where: { id: testLoanId },
    });
  });

  describe('CRUD Operations', () => {
    it('should create a transaction link with loan payment metadata', async () => {
      const loanPaymentMetadata: TransactionLinkMetadata = {
        paymentDate: '2024-01-15',
        paymentAmount: 100.00,
        paymentType: 'combined',
        detectionMethod: 'manual',
        notes: 'Test loan payment',
        isScheduled: false,
      };

      const link = await prisma.transactionLink.create({
        data: {
          transactionId: testTransactionId,
          entityType: 'loan',
          entityId: testLoanId,
          metadata: loanPaymentMetadata,
        },
      });

      expect(link).toBeDefined();
      expect(link.transactionId).toBe(testTransactionId);
      expect(link.entityType).toBe('loan');
      expect(link.entityId).toBe(testLoanId);
      expect(link.metadata).toEqual(loanPaymentMetadata);
    });

    it('should create a transaction link with subscription metadata', async () => {
      const subscriptionMetadata: TransactionLinkMetadata = {
        billingCycle: 'monthly',
        serviceName: 'Netflix',
        planType: 'Standard',
        renewalDate: '2024-02-15',
        autoRenew: true,
        detectionMethod: 'automatic',
        notes: 'Netflix subscription',
      };

      const link = await prisma.transactionLink.create({
        data: {
          transactionId: testTransactionId,
          entityType: 'subscription',
          entityId: 'netflix-sub',
          metadata: subscriptionMetadata,
        },
      });

      expect(link).toBeDefined();
      expect(link.entityType).toBe('subscription');
      expect(link.entityId).toBe('netflix-sub');
      expect(link.metadata).toEqual(subscriptionMetadata);
    });

    it('should retrieve transaction links by entity', async () => {
      // Create multiple links
      await prisma.transactionLink.createMany({
        data: [
          {
            transactionId: testTransactionId,
            entityType: 'loan',
            entityId: testLoanId,
            metadata: {
              paymentDate: '2024-01-15',
              paymentAmount: 100.00,
              paymentType: 'combined',
              detectionMethod: 'manual',
              notes: 'Payment 1',
              isScheduled: false,
            },
          },
          {
            transactionId: testTransactionId,
            entityType: 'loan',
            entityId: testLoanId,
            metadata: {
              paymentDate: '2024-02-15',
              paymentAmount: 100.00,
              paymentType: 'combined',
              detectionMethod: 'manual',
              notes: 'Payment 2',
              isScheduled: false,
            },
          },
        ],
      });

      const links = await prisma.transactionLink.findMany({
        where: {
          entityType: 'loan',
          entityId: testLoanId,
        },
      });

      expect(links).toHaveLength(2);
      expect(links[0].entityType).toBe('loan');
      expect(links[1].entityType).toBe('loan');
    });

    it('should update transaction link metadata', async () => {
      const link = await prisma.transactionLink.create({
        data: {
          transactionId: testTransactionId,
          entityType: 'loan',
          entityId: testLoanId,
          metadata: {
            paymentDate: '2024-01-15',
            paymentAmount: 100.00,
            paymentType: 'combined',
            detectionMethod: 'manual',
            notes: 'Original notes',
            isScheduled: false,
          },
        },
      });

      const updatedMetadata = {
        paymentDate: '2024-01-15',
        paymentAmount: 150.00, // Updated amount
        paymentType: 'combined',
        detectionMethod: 'manual',
        notes: 'Updated notes',
        isScheduled: false,
      };

      const updatedLink = await prisma.transactionLink.update({
        where: { id: link.id },
        data: { metadata: updatedMetadata },
      });

      expect(updatedLink.metadata).toEqual(updatedMetadata);
    });

    it('should delete a transaction link', async () => {
      const link = await prisma.transactionLink.create({
        data: {
          transactionId: testTransactionId,
          entityType: 'loan',
          entityId: testLoanId,
          metadata: {
            paymentDate: '2024-01-15',
            paymentAmount: 100.00,
            paymentType: 'combined',
            detectionMethod: 'manual',
            notes: 'Test payment',
            isScheduled: false,
          },
        },
      });

      await prisma.transactionLink.delete({
        where: { id: link.id },
      });

      const deletedLink = await prisma.transactionLink.findUnique({
        where: { id: link.id },
      });

      expect(deletedLink).toBeNull();
    });
  });

  describe('Metadata Validation', () => {
    it('should handle different metadata types correctly', async () => {
      const billMetadata: TransactionLinkMetadata = {
        billType: 'utility',
        dueDate: '2024-01-15',
        serviceProvider: 'Test Provider',
        accountNumber: '12345',
        detectionMethod: 'automatic',
        notes: 'Utility bill',
      };

      const investmentMetadata: TransactionLinkMetadata = {
        investmentType: 'contribution',
        securityName: '401k',
        detectionMethod: 'automatic',
        notes: '401k contribution',
      };

      const billLink = await prisma.transactionLink.create({
        data: {
          transactionId: testTransactionId,
          entityType: 'bill',
          entityId: 'test-bill',
          metadata: billMetadata,
        },
      });

      const investmentLink = await prisma.transactionLink.create({
        data: {
          transactionId: testTransactionId,
          entityType: 'investment',
          entityId: 'test-investment',
          metadata: investmentMetadata,
        },
      });

      expect(billLink.metadata).toEqual(billMetadata);
      expect(investmentLink.metadata).toEqual(investmentMetadata);
    });
  });

  describe('Unique Constraints', () => {
    it('should enforce unique constraint on transaction-entity combination', async () => {
      const metadata = {
        paymentDate: '2024-01-15',
        paymentAmount: 100.00,
        paymentType: 'combined',
        detectionMethod: 'manual',
        notes: 'Test payment',
        isScheduled: false,
      };

      // Create first link
      await prisma.transactionLink.create({
        data: {
          transactionId: testTransactionId,
          entityType: 'loan',
          entityId: testLoanId,
          metadata,
        },
      });

      // Attempt to create duplicate link
      await expect(
        prisma.transactionLink.create({
          data: {
            transactionId: testTransactionId,
            entityType: 'loan',
            entityId: testLoanId,
            metadata,
          },
        })
      ).rejects.toThrow();
    });
  });
}); 