import { TransactionChartSettings } from '@/types/transactionChart';

const SETTINGS_STORAGE_KEY = 'transactionChartSettings';

export const defaultSettings: TransactionChartSettings = {
  selectedAccountIds: [],
  includeAllAccounts: true,
  showIncome: true,
  showExpenses: true,
  categories: [],
  period: 'monthly',
  groupByCategory: false,
  showAccountBreakdown: false,
};

export function loadSettings(): TransactionChartSettings {
  if (typeof window === 'undefined') {
    return defaultSettings;
  }

  try {
    const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        ...defaultSettings,
        ...parsed,
        // Ensure dates are properly parsed
        startDate: parsed.startDate ? new Date(parsed.startDate) : undefined,
        endDate: parsed.endDate ? new Date(parsed.endDate) : undefined,
      };
    }
  } catch (error) {
    console.error('Error loading transaction chart settings:', error);
  }

  return defaultSettings;
}

export function saveSettings(settings: TransactionChartSettings): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Error saving transaction chart settings:', error);
  }
}

export function resetSettings(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.removeItem(SETTINGS_STORAGE_KEY);
  } catch (error) {
    console.error('Error resetting transaction chart settings:', error);
  }
}

export function buildApiUrl(settings: TransactionChartSettings): string {
  const params = new URLSearchParams();
  
  params.set('period', settings.period);
  
  if (settings.selectedAccountIds.length > 0) {
    params.set('accountIds', settings.selectedAccountIds.join(','));
  }
  
  if (!settings.showIncome) {
    params.set('showIncome', 'false');
  }
  
  if (!settings.showExpenses) {
    params.set('showExpenses', 'false');
  }
  
  if (settings.startDate) {
    params.set('startDate', settings.startDate.toISOString().split('T')[0]);
  }
  
  if (settings.endDate) {
    params.set('endDate', settings.endDate.toISOString().split('T')[0]);
  }
  
  if (settings.categories.length > 0) {
    params.set('categories', settings.categories.join(','));
  }
  
  if (settings.minAmount !== undefined) {
    params.set('minAmount', settings.minAmount.toString());
  }
  
  if (settings.maxAmount !== undefined) {
    params.set('maxAmount', settings.maxAmount.toString());
  }
  
  return `/api/transactions?${params.toString()}`;
} 