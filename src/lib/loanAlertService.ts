import { prisma } from './db';
import { LoanDetails, LoanAlert, AlertType, AlertSeverity } from '@/types/loan';

export interface AlertCondition {
  type: AlertType;
  severity: AlertSeverity;
  condition: (loan: LoanDetails) => boolean;
  title: string;
  message: string;
}

export class LoanAlertService {
  private static alertConditions: AlertCondition[] = [
    // Introductory rate expiring
    {
      type: 'intro_rate_expiring',
      severity: 'high',
      condition: (loan) => {
        if (!loan.introductoryRateExpiry) return false;
        const daysUntilExpiry = Math.ceil(
          (new Date(loan.introductoryRateExpiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
      },
      title: 'Introductory Rate Expiring Soon',
      message: 'Your introductory rate will expire within 30 days. Consider refinancing options.'
    },
    {
      type: 'intro_rate_expiring',
      severity: 'critical',
      condition: (loan) => {
        if (!loan.introductoryRateExpiry) return false;
        const daysUntilExpiry = Math.ceil(
          (new Date(loan.introductoryRateExpiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        return daysUntilExpiry <= 7 && daysUntilExpiry > 0;
      },
      title: 'Introductory Rate Expiring This Week',
      message: 'Your introductory rate expires within 7 days. Take action immediately.'
    },
    // High interest rate
    {
      type: 'high_interest',
      severity: 'medium',
      condition: (loan) => {
        return (loan.currentInterestRate || 0) > 15;
      },
      title: 'High Interest Rate Detected',
      message: 'Your loan has a high interest rate. Consider refinancing to save money.'
    },
    {
      type: 'high_interest',
      severity: 'high',
      condition: (loan) => {
        return (loan.currentInterestRate || 0) > 25;
      },
      title: 'Very High Interest Rate',
      message: 'Your loan has a very high interest rate. Refinancing could save significant money.'
    },
    // Payment due soon
    {
      type: 'payment_due',
      severity: 'medium',
      condition: (loan) => {
        // This would need to be calculated based on payment schedule
        // For now, we'll use a simple heuristic
        return false; // TODO: Implement payment due logic
      },
      title: 'Payment Due Soon',
      message: 'Your next payment is due within 7 days.'
    },
    // High balance
    {
      type: 'balance_high',
      severity: 'medium',
      condition: (loan) => {
        // This would need account balance data
        // For now, we'll use a placeholder
        return false; // TODO: Implement balance check logic
      },
      title: 'High Balance Alert',
      message: 'Your loan balance is high. Consider making extra payments.'
    }
  ];

  /**
   * Generate alerts for a specific loan
   */
  static async generateAlertsForLoan(loanId: string): Promise<LoanAlert[]> {
    try {
      const loan = await prisma.loanDetails.findUnique({
        where: { id: loanId },
        include: {
          account: true,
          alerts: true
        }
      });

      if (!loan) {
        throw new Error(`Loan not found: ${loanId}`);
      }

      const newAlerts: LoanAlert[] = [];
      const existingAlerts = loan.alerts || [];

      // Check each alert condition
      for (const condition of this.alertConditions) {
        if (condition.condition(loan)) {
          // Check if this alert already exists and is active
          const existingAlert = existingAlerts.find(
            (alert: LoanAlert) => alert.alertType === condition.type && 
                     alert.severity === condition.severity && 
                     !alert.isDismissed
          );

          if (!existingAlert) {
            // Create new alert
            const newAlert = await prisma.loanAlert.create({
              data: {
                loanId: loan.id,
                alertType: condition.type,
                title: condition.title,
                message: condition.message,
                severity: condition.severity,
                isActive: true,
                isDismissed: false
              }
            });
            newAlerts.push(newAlert);
          }
        }
      }

      return newAlerts;
    } catch (error) {
      console.error('Error generating alerts for loan:', error);
      throw error;
    }
  }

  /**
   * Generate alerts for all loans
   */
  static async generateAlertsForAllLoans(): Promise<{ loanId: string; alerts: LoanAlert[] }[]> {
    try {
      const loans = await prisma.loanDetails.findMany({
        include: {
          alerts: true
        }
      });

      const results = [];
      for (const loan of loans) {
        const alerts = await this.generateAlertsForLoan(loan.id);
        if (alerts.length > 0) {
          results.push({ loanId: loan.id, alerts });
        }
      }

      return results;
    } catch (error) {
      console.error('Error generating alerts for all loans:', error);
      throw error;
    }
  }

  /**
   * Dismiss an alert
   */
  static async dismissAlert(alertId: string): Promise<LoanAlert> {
    try {
      return await prisma.loanAlert.update({
        where: { id: alertId },
        data: {
          isDismissed: true,
          dismissedAt: new Date()
        }
      });
    } catch (error) {
      console.error('Error dismissing alert:', error);
      throw error;
    }
  }

  /**
   * Get active alerts for a loan
   */
  static async getActiveAlerts(loanId: string): Promise<LoanAlert[]> {
    try {
      return await prisma.loanAlert.findMany({
        where: {
          loanId,
          isActive: true,
          isDismissed: false
        },
        orderBy: {
          severity: 'desc'
        }
      });
    } catch (error) {
      console.error('Error getting active alerts:', error);
      throw error;
    }
  }

  /**
   * Get all active alerts across all loans
   */
  static async getAllActiveAlerts(): Promise<LoanAlert[]> {
    try {
      return await prisma.loanAlert.findMany({
        where: {
          isActive: true,
          isDismissed: false
        },
        include: {
          loan: {
            include: {
              account: true
            }
          }
        },
        orderBy: [
          { severity: 'desc' },
          { createdAt: 'desc' }
        ]
      });
    } catch (error) {
      console.error('Error getting all active alerts:', error);
      throw error;
    }
  }

  /**
   * Get alert statistics
   */
  static async getAlertStats(): Promise<{
    total: number;
    bySeverity: Record<AlertSeverity, number>;
    byType: Record<AlertType, number>;
  }> {
    try {
      const alerts = await prisma.loanAlert.findMany({
        where: {
          isActive: true,
          isDismissed: false
        }
      });

      const bySeverity: Record<AlertSeverity, number> = {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0
      };

      const byType: Record<AlertType, number> = {
        intro_rate_expiring: 0,
        high_interest: 0,
        payment_due: 0,
        balance_high: 0
      };

      alerts.forEach((alert: LoanAlert) => {
        bySeverity[alert.severity as AlertSeverity]++;
        byType[alert.alertType as AlertType]++;
      });

      return {
        total: alerts.length,
        bySeverity,
        byType
      };
    } catch (error) {
      console.error('Error getting alert stats:', error);
      throw error;
    }
  }

  /**
   * Clean up old dismissed alerts
   */
  static async cleanupOldAlerts(daysToKeep: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const result = await prisma.loanAlert.deleteMany({
        where: {
          isDismissed: true,
          dismissedAt: {
            lt: cutoffDate
          }
        }
      });

      return result.count;
    } catch (error) {
      console.error('Error cleaning up old alerts:', error);
      throw error;
    }
  }

  /**
   * Add custom alert condition
   */
  static addAlertCondition(condition: AlertCondition): void {
    this.alertConditions.push(condition);
  }

  /**
   * Remove alert condition by type and severity
   */
  static removeAlertCondition(type: AlertType, severity: AlertSeverity): void {
    this.alertConditions = this.alertConditions.filter(
      condition => !(condition.type === type && condition.severity === severity)
    );
  }
} 