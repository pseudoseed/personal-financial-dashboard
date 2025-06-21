export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export function getThisWeek(): DateRange {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
  startOfWeek.setHours(0, 0, 0, 0);
  
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6); // Saturday
  endOfWeek.setHours(23, 59, 59, 999);
  
  return { startDate: startOfWeek, endDate: endOfWeek };
}

export function getThisMonth(): DateRange {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  
  return { startDate: startOfMonth, endDate: endOfMonth };
}

export function getThisQuarter(): DateRange {
  const now = new Date();
  const currentQuarter = Math.floor(now.getMonth() / 3);
  const startOfQuarter = new Date(now.getFullYear(), currentQuarter * 3, 1);
  const endOfQuarter = new Date(now.getFullYear(), (currentQuarter + 1) * 3, 0, 23, 59, 59, 999);
  
  return { startDate: startOfQuarter, endDate: endOfQuarter };
}

export function getLastQuarter(): DateRange {
  const now = new Date();
  const currentQuarter = Math.floor(now.getMonth() / 3);
  const lastQuarter = currentQuarter === 0 ? 3 : currentQuarter - 1;
  const year = lastQuarter === 3 ? now.getFullYear() - 1 : now.getFullYear();
  
  const startOfQuarter = new Date(year, lastQuarter * 3, 1);
  const endOfQuarter = new Date(year, (lastQuarter + 1) * 3, 0, 23, 59, 59, 999);
  
  return { startDate: startOfQuarter, endDate: endOfQuarter };
}

export function getFiscalYear(): DateRange {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  
  // Fiscal year starts July 1st
  let fiscalYearStart = currentYear;
  if (currentMonth < 6) { // January through June
    fiscalYearStart = currentYear - 1;
  }
  
  const startOfFiscalYear = new Date(fiscalYearStart, 6, 1); // July 1st
  const endOfFiscalYear = new Date(fiscalYearStart + 1, 5, 30, 23, 59, 59, 999); // June 30th
  
  return { startDate: startOfFiscalYear, endDate: endOfFiscalYear };
}

export function getYearToDate(): DateRange {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  
  return { startDate: startOfYear, endDate: now };
}

export function formatDateForInput(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function formatDateRange(range: DateRange): string {
  const start = range.startDate.toLocaleDateString();
  const end = range.endDate.toLocaleDateString();
  return `${start} - ${end}`;
}

export function isValidDateRange(startDate: Date, endDate: Date): boolean {
  return startDate <= endDate;
} 