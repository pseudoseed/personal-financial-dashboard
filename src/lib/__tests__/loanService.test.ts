import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { loanService } from '../loanService';
import { prisma } from '../db';

// Mock Prisma
jest.mock('../db', () => ({
  prisma: {
    loanDetails: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    account: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    loanAlert: {
      create: jest.fn(),
    },
    loanPaymentHistory: {
      create: jest.fn(),
    },
  },
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('LoanService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateRemainingPayments', () => {
    it('should calculate remaining payments for a loan with interest', () => {
      const result = loanService.calculateRemainingPayments(10000, 500, 5.0, 1);
      expect(result).toBeGreaterThan(0);
      expect(typeof result).toBe('number');
    });

    it('should calculate remaining payments for a loan without interest', () => {
      const result = loanService.calculateRemainingPayments(10000, 500, 0, 1);
      expect(result).toBe(20); // 10000 / 500 = 20 payments
    });

    it('should handle zero or negative values', () => {
      expect(loanService.calculateRemainingPayments(0, 500, 5.0, 1)).toBe(0);
      expect(loanService.calculateRemainingPayments(10000, 0, 5.0, 1)).toBe(0);
      expect(loanService.calculateRemainingPayments(10000, 500, -5.0, 1)).toBe(0);
    });

    it('should handle bi-weekly payments', () => {
      const result = loanService.calculateRemainingPayments(10000, 500, 5.0, 2);
      expect(result).toBeGreaterThan(0);
      expect(typeof result).toBe('number');
    });
  });

  describe('calculateInterestCharges', () => {
    it('should calculate interest charges correctly', () => {
      const result = loanService.calculateInterestCharges(10000, 5.0, 30);
      expect(result).toBeGreaterThan(0);
      expect(typeof result).toBe('number');
    });

    it('should handle zero or negative values', () => {
      expect(loanService.calculateInterestCharges(0, 5.0, 30)).toBe(0);
      expect(loanService.calculateInterestCharges(10000, 0, 30)).toBe(0);
      expect(loanService.calculateInterestCharges(10000, 5.0, 0)).toBe(0);
    });

    it('should calculate daily interest correctly', () => {
      const dailyRate = 5.0 / 100 / 365;
      const expected = 10000 * dailyRate * 30;
      const result = loanService.calculateInterestCharges(10000, 5.0, 30);
      expect(result).toBeCloseTo(expected, 2);
    });
  });

  describe('calculateOptimalPayment', () => {
    it('should calculate optimal payment to avoid interest', () => {
      const result = loanService.calculateOptimalPayment(10000, 5.0, 30);
      expect(result).toBeGreaterThan(10000);
      expect(typeof result).toBe('number');
    });

    it('should handle zero or negative values', () => {
      expect(loanService.calculateOptimalPayment(0, 5.0, 30)).toBe(0);
      expect(loanService.calculateOptimalPayment(10000, 0, 30)).toBe(10000);
      expect(loanService.calculateOptimalPayment(10000, 5.0, 0)).toBe(10000);
    });

    it('should include accrued interest in optimal payment', () => {
      const balance = 10000;
      const rate = 5.0;
      const days = 30;
      const dailyRate = rate / 100 / 365;
      const interestAccrued = balance * dailyRate * days;
      const expected = balance + interestAccrued;
      
      const result = loanService.calculateOptimalPayment(balance, rate, days);
      expect(result).toBeCloseTo(expected, 2);
    });
  });

  describe('createLoan', () => {
    it('should create a new loan with valid data', async () => {
      const mockLoan = {
        id: 'test-loan-id',
        accountId: 'test-account-id',
        userId: 'default',
        currentInterestRate: 5.0,
        currentInterestRateSource: 'manual' as const,
        paymentsPerMonth: 1,
        paymentsPerMonthSource: 'manual' as const,
        autoCalculatePayments: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.loanDetails.create.mockResolvedValue(mockLoan);

      const result = await loanService.createLoan('test-account-id', {
        currentInterestRate: 5.0,
        paymentsPerMonth: 1,
      });

      expect(result).toEqual(mockLoan);
      expect(mockPrisma.loanDetails.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          accountId: 'test-account-id',
          userId: 'default',
          currentInterestRate: 5.0,
          currentInterestRateSource: 'manual',
          paymentsPerMonth: 1,
          paymentsPerMonthSource: 'manual',
          autoCalculatePayments: true,
        }),
      });
    });

    it('should throw error for invalid interest rate', async () => {
      await expect(
        loanService.createLoan('test-account-id', {
          currentInterestRate: 150, // Invalid: > 100%
        })
      ).rejects.toThrow('Invalid current interest rate');
    });

    it('should throw error for invalid payments per month', async () => {
      await expect(
        loanService.createLoan('test-account-id', {
          paymentsPerMonth: 0, // Invalid: < 1
        })
      ).rejects.toThrow('Invalid payments per month');
    });
  });

  describe('updateLoan', () => {
    it('should update loan with valid data', async () => {
      const existingLoan = {
        id: 'test-loan-id',
        accountId: 'test-account-id',
        userId: 'default',
        currentInterestRate: 5.0,
        currentInterestRateSource: 'plaid' as const,
        paymentsPerMonth: 1,
        paymentsPerMonthSource: 'manual' as const,
        autoCalculatePayments: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedLoan = { ...existingLoan, currentInterestRate: 6.0 };

      mockPrisma.loanDetails.findUnique.mockResolvedValue(existingLoan);
      mockPrisma.loanDetails.update.mockResolvedValue(updatedLoan);

      const result = await loanService.updateLoan('test-loan-id', {
        currentInterestRate: 6.0,
      });

      expect(result).toEqual(updatedLoan);
      expect(mockPrisma.loanDetails.update).toHaveBeenCalledWith({
        where: { id: 'test-loan-id' },
        data: expect.objectContaining({
          currentInterestRate: 6.0,
        }),
      });
    });

    it('should preserve manual entries when preserveManualEntries is true', async () => {
      const existingLoan = {
        id: 'test-loan-id',
        accountId: 'test-account-id',
        userId: 'default',
        currentInterestRate: 5.0,
        currentInterestRateSource: 'manual' as const,
        paymentsPerMonth: 1,
        paymentsPerMonthSource: 'manual' as const,
        autoCalculatePayments: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.loanDetails.findUnique.mockResolvedValue(existingLoan);
      mockPrisma.loanDetails.update.mockResolvedValue(existingLoan);

      // Try to update with null value (should be ignored)
      await loanService.updateLoan('test-loan-id', {
        currentInterestRate: null,
      }, true);

      // Should not call update since manual entry should be preserved
      expect(mockPrisma.loanDetails.update).toHaveBeenCalledWith({
        where: { id: 'test-loan-id' },
        data: {}, // Empty object since no updates should be made
      });
    });

    it('should throw error if loan not found', async () => {
      mockPrisma.loanDetails.findUnique.mockResolvedValue(null);

      await expect(
        loanService.updateLoan('non-existent-id', {
          currentInterestRate: 6.0,
        })
      ).rejects.toThrow('Loan not found');
    });
  });

  describe('getLoanCalculations', () => {
    it('should return loan calculations', async () => {
      const mockLoan = {
        id: 'test-loan-id',
        accountId: 'test-account-id',
        userId: 'default',
        currentInterestRate: 5.0,
        paymentsPerMonth: 1,
        account: {
          balances: [{ current: 10000 }],
          nextMonthlyPayment: 500,
        },
      };

      mockPrisma.loanDetails.findUnique.mockResolvedValue(mockLoan);

      const result = await loanService.getLoanCalculations('test-loan-id');

      expect(result).toHaveProperty('remainingPayments');
      expect(result).toHaveProperty('totalInterest');
      expect(result).toHaveProperty('payoffDate');
      expect(result).toHaveProperty('monthlyPayment');
      expect(result).toHaveProperty('optimalPayment');
      expect(result).toHaveProperty('interestSavings');
    });

    it('should throw error if loan not found', async () => {
      mockPrisma.loanDetails.findUnique.mockResolvedValue(null);

      await expect(
        loanService.getLoanCalculations('non-existent-id')
      ).rejects.toThrow('Loan or account not found');
    });
  });

  describe('getLoanSummary', () => {
    it('should return loan summary', async () => {
      const mockLoans = [
        {
          id: 'loan-1',
          accountId: 'account-1',
          userId: 'default',
          currentInterestRate: 5.0,
          paymentsPerMonth: 1,
          account: {
            balances: [{ current: 10000 }],
            nextMonthlyPayment: 500,
          },
          alerts: [],
        },
        {
          id: 'loan-2',
          accountId: 'account-2',
          userId: 'default',
          currentInterestRate: 6.0,
          paymentsPerMonth: 1,
          account: {
            balances: [{ current: 20000 }],
            nextMonthlyPayment: 1000,
          },
          alerts: [],
        },
      ];

      mockPrisma.loanDetails.findMany.mockResolvedValue(mockLoans);

      const result = await loanService.getLoanSummary('default');

      expect(result).toHaveProperty('totalDebt');
      expect(result).toHaveProperty('averageInterestRate');
      expect(result).toHaveProperty('totalMonthlyPayments');
      expect(result).toHaveProperty('totalInterestProjected');
      expect(result).toHaveProperty('activeAlerts');
      expect(result).toHaveProperty('loansCount');
      expect(result).toHaveProperty('introRateExpiringSoon');

      expect(result.totalDebt).toBe(30000);
      expect(result.averageInterestRate).toBe(5.5);
      expect(result.totalMonthlyPayments).toBe(1500);
      expect(result.loansCount).toBe(2);
    });
  });

  describe('maskLoanData', () => {
    it('should return original data when showSensitiveData is true', () => {
      const loan = {
        id: 'test-loan-id',
        accountId: 'test-account-id',
        userId: 'default',
        currentInterestRate: 5.0,
        introductoryRate: 3.0,
        paymentsRemaining: 24,
        currentInterestRateSource: 'manual' as const,
        paymentsPerMonth: 1,
        paymentsPerMonthSource: 'manual' as const,
        autoCalculatePayments: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = loanService.maskLoanData(loan, true);
      expect(result).toEqual(loan);
    });

    it('should mask sensitive data when showSensitiveData is false', () => {
      const loan = {
        id: 'test-loan-id',
        accountId: 'test-account-id',
        userId: 'default',
        currentInterestRate: 5.0,
        introductoryRate: 3.0,
        paymentsRemaining: 24,
        currentInterestRateSource: 'manual' as const,
        paymentsPerMonth: 1,
        paymentsPerMonthSource: 'manual' as const,
        autoCalculatePayments: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = loanService.maskLoanData(loan, false);
      expect(result.currentInterestRate).toBe('••••••');
      expect(result.introductoryRate).toBe('••••••');
      expect(result.paymentsRemaining).toBe('••••••');
    });
  });
}); 