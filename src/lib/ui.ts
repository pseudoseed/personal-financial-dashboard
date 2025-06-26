import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { cva, type VariantProps } from "class-variance-authority";

/**
 * Utility function to merge Tailwind classes with proper precedence
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Button component variants using class-variance-authority
 */
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation",
  {
    variants: {
      variant: {
        primary: "bg-primary-500 text-white border border-primary-500 hover:bg-primary-600 hover:border-primary-600 hover:shadow-lg hover:-translate-y-0.5 focus:ring-primary-500 active:scale-95",
        secondary: "bg-surface-0 text-foreground border border-gray-200 hover:bg-surface-100 hover:border-gray-300 hover:shadow-sm hover:-translate-y-0.5 focus:ring-primary-500 active:scale-95 dark:bg-surface-100 dark:border-gray-700 dark:hover:bg-surface-200 dark:hover:border-gray-600",
        ghost: "bg-transparent text-secondary-600 border border-transparent hover:bg-surface-100 hover:text-foreground focus:ring-primary-500 active:scale-95 dark:text-secondary-400 dark:hover:bg-surface-200",
        success: "bg-success-500 text-white border border-success-500 hover:bg-success-600 hover:border-success-600 hover:shadow-lg hover:-translate-y-0.5 focus:ring-success-500 active:scale-95",
        error: "bg-error-500 text-white border border-error-500 hover:bg-error-600 hover:border-error-600 hover:shadow-lg hover:-translate-y-0.5 focus:ring-error-500 active:scale-95",
        warning: "bg-warning-500 text-white border border-warning-500 hover:bg-warning-600 hover:border-warning-600 hover:shadow-lg hover:-translate-y-0.5 focus:ring-warning-500 active:scale-95",
      },
      size: {
        sm: "px-3 py-2 text-sm min-h-[44px]",
        md: "px-4 py-2.5 text-sm min-h-[44px]",
        lg: "px-6 py-3 text-base min-h-[48px]",
        xl: "px-8 py-4 text-lg min-h-[52px]",
      },
      fullWidth: {
        true: "w-full",
        false: "",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
      fullWidth: false,
    },
  }
);

export type ButtonVariants = VariantProps<typeof buttonVariants>;

/**
 * Card component variants
 */
export const cardVariants = cva(
  "rounded-lg transition-all duration-200",
  {
    variants: {
      variant: {
        default: "bg-surface-100 shadow-md hover:shadow-lg hover:-translate-y-0.5 dark:bg-surface-800 dark:shadow-lg dark:hover:shadow-xl",
        elevated: "bg-surface-0 shadow-lg hover:shadow-xl hover:-translate-y-1 dark:bg-surface-900 dark:shadow-xl dark:hover:shadow-2xl",
        outline: "bg-transparent border border-border hover:bg-surface-50 dark:hover:bg-surface-800",
      },
      padding: {
        none: "p-0",
        sm: "p-4",
        md: "p-6",
        lg: "p-8",
        xl: "p-10",
      },
    },
    defaultVariants: {
      variant: "default",
      padding: "md",
    },
  }
);

export type CardVariants = VariantProps<typeof cardVariants>;

/**
 * Input component variants
 */
export const inputVariants = cva(
  "w-full rounded-lg border bg-surface-0 px-4 py-3 text-sm transition-all duration-200 placeholder:text-secondary-400 focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-surface-100 dark:placeholder:text-secondary-500",
  {
    variants: {
      variant: {
        default: "border-border focus:border-primary-500 focus:ring-primary-500/20",
        error: "border-error-500 focus:border-error-500 focus:ring-error-500/20",
        success: "border-success-500 focus:border-success-500 focus:ring-success-500/20",
      },
      size: {
        sm: "px-3 py-2 text-sm",
        md: "px-4 py-3 text-sm",
        lg: "px-6 py-4 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

export type InputVariants = VariantProps<typeof inputVariants>;

/**
 * Badge component variants
 */
export const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        primary: "bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-100",
        secondary: "bg-secondary-100 text-secondary-700 dark:bg-secondary-800 dark:text-secondary-200",
        success: "bg-success-100 text-success-700 dark:bg-success-900 dark:text-success-100",
        warning: "bg-warning-100 text-warning-700 dark:bg-warning-900 dark:text-warning-100",
        error: "bg-error-100 text-error-700 dark:bg-error-900 dark:text-error-100",
        outline: "border border-border bg-transparent text-secondary-600 dark:text-secondary-400",
      },
      size: {
        sm: "px-2 py-0.5 text-xs",
        md: "px-2.5 py-0.5 text-xs",
        lg: "px-3 py-1 text-sm",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export type BadgeVariants = VariantProps<typeof badgeVariants>;

/**
 * Alert component variants
 */
export const alertVariants = cva(
  "relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground",
  {
    variants: {
      variant: {
        default: "bg-surface-100 text-foreground border-border dark:bg-surface-100",
        primary: "border-primary-200 bg-primary-50 text-primary-900 dark:border-primary-800 dark:bg-primary-900/50 dark:text-primary-100",
        success: "border-success-200 bg-success-50 text-success-900 dark:border-success-800 dark:bg-success-900/50 dark:text-success-100",
        warning: "border-warning-200 bg-warning-50 text-warning-900 dark:border-warning-800 dark:bg-warning-900/50 dark:text-warning-100",
        error: "border-error-200 bg-error-50 text-error-900 dark:border-error-800 dark:bg-error-900/50 dark:text-error-100",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export type AlertVariants = VariantProps<typeof alertVariants>;

/**
 * Utility functions for common design patterns
 */

/**
 * Format currency with proper locale and currency symbol
 */
export function formatCurrency(
  amount: number,
  currency: string = "USD",
  locale: string = "en-US"
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format percentage with proper locale
 */
export function formatPercentage(
  value: number,
  locale: string = "en-US",
  decimals: number = 1
): string {
  return new Intl.NumberFormat(locale, {
    style: "percent",
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(value / 100);
}

/**
 * Format number with proper locale and abbreviations
 */
export function formatNumber(
  value: number,
  locale: string = "en-US",
  options?: Intl.NumberFormatOptions
): string {
  return new Intl.NumberFormat(locale, options).format(value);
}

/**
 * Get color class based on value (positive/negative)
 */
export function getValueColor(value: number, isDark: boolean = false): string {
  if (value > 0) {
    return isDark ? "text-success-400" : "text-success-600";
  } else if (value < 0) {
    return isDark ? "text-error-400" : "text-error-600";
  }
  return isDark ? "text-secondary-400" : "text-secondary-600";
}

/**
 * Get background color class based on value (positive/negative)
 */
export function getValueBgColor(value: number, isDark: boolean = false): string {
  if (value > 0) {
    return isDark ? "bg-success-900/20" : "bg-success-50";
  } else if (value < 0) {
    return isDark ? "bg-error-900/20" : "bg-error-50";
  }
  return isDark ? "bg-secondary-900/20" : "bg-secondary-50";
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

/**
 * Capitalize first letter of each word
 */
export function capitalizeWords(str: string): string {
  return str.replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Generate initials from name
 */
export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Get relative time string
 */
export function getRelativeTime(date: Date | string): string {
  const now = new Date();
  const targetDate = typeof date === "string" ? new Date(date) : date;
  const diffInSeconds = Math.floor((now.getTime() - targetDate.getTime()) / 1000);

  if (diffInSeconds < 60) return "just now";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)}mo ago`;
  return `${Math.floor(diffInSeconds / 31536000)}y ago`;
}

/**
 * Debounce function for performance optimization
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Throttle function for performance optimization
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Masks a value with dots if sensitive info should be hidden.
 * If value is a number, returns dots. If string, returns dots. Otherwise, returns the value as is.
 */
export function maskSensitiveValue<T>(value: T, showSensitiveData: boolean, mask: string = '••••••'): T | string {
  if (showSensitiveData) return value;
  return mask;
} 