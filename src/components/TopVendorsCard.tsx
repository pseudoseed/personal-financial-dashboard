"use client";
import { useEffect, useState, useRef } from 'react';
import { EllipsisHorizontalIcon } from '@heroicons/react/24/solid';
import { useSensitiveData } from '@/app/providers';

const periodOptions = [
  { value: 'this_week', label: 'This Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_30_days', label: 'Last 30 Days' },
  { value: 'this_quarter', label: 'This Quarter' },
  { value: 'last_quarter', label: 'Last Quarter' },
  { value: 'this_year', label: 'This Year' },
];

// Helper function to get initial values from localStorage
function getInitialValues() {
  if (typeof window === 'undefined') {
    return { limit: 11, period: 'this_month' };
  }
  
  const savedLimit = localStorage.getItem('topVendorsLimit');
  const savedPeriod = localStorage.getItem('topVendorsPeriod');
  
  let limit = 11;
  let period = 'this_month';
  
  if (savedLimit) {
    const limitNum = Number(savedLimit);
    if (!isNaN(limitNum) && limitNum >= 2 && limitNum <= 30) {
      limit = limitNum;
    }
  }
  
  if (savedPeriod) {
    const validPeriods = periodOptions.map(p => p.value);
    if (validPeriods.includes(savedPeriod)) {
      period = savedPeriod;
    }
  }
  
  return { limit, period };
}

export default function TopVendorsCard() {
  const { showSensitiveData } = useSensitiveData();
  const initialValues = getInitialValues();
  const [vendors, setVendors] = useState<{ vendor: string; total: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState(initialValues.limit);
  const [period, setPeriod] = useState(initialValues.period);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchVendors() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/transactions/vendors?period=${period}&limit=${limit}`);
        const data = await res.json();
        setVendors(data.vendors || []);
      } catch (err) {
        setError('Failed to load top vendors');
      } finally {
        setLoading(false);
      }
    }
    fetchVendors();
  }, [limit, period]);

  // Save settings to localStorage whenever they change
  useEffect(() => {
    console.log('Saving to localStorage:', { limit, period });
    localStorage.setItem('topVendorsLimit', String(limit));
    localStorage.setItem('topVendorsPeriod', period);
  }, [limit, period]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const midIndex = Math.ceil(vendors.length / 2);
  const leftVendors = vendors.slice(0, midIndex);
  const rightVendors = vendors.slice(midIndex);

  const selectedPeriodLabel = periodOptions.find(p => p.value === period)?.label || 'Vendors';
  const cardTitle = `Top Vendors (${selectedPeriodLabel})`;

  return (
    <div className="card relative">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-md font-semibold">{cardTitle}</h3>
        <div className="relative" ref={menuRef}>
          <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-1 rounded-full text-secondary-500 hover:bg-surface-100 dark:hover:bg-surface-dark-200">
            <EllipsisHorizontalIcon className="h-5 w-5" />
          </button>
          {isMenuOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg shadow-xl z-10 p-4">
              <div className="space-y-4">
                <div>
                  <label htmlFor="period-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Timeline</label>
                  <select
                    id="period-select"
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
                  >
                    {periodOptions.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="limit-input" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Number of Vendors ({limit})</label>
                  <input
                    id="limit-input"
                    type="range"
                    min="2"
                    max="30"
                    value={limit}
                    onChange={(e) => setLimit(Number(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {loading ? (
        <div className="text-secondary-500 dark:text-secondary-400">Loading...</div>
      ) : error ? (
        <div className="text-red-500 dark:text-red-400">{error}</div>
      ) : vendors.length === 0 ? (
        <div className="text-secondary-500 dark:text-secondary-400">No vendor data available.</div>
      ) : (
        <div className="flex space-x-6 text-sm">
          <ul className="space-y-2 flex-1">
            {leftVendors.map((v) => (
              <li key={v.vendor} className="flex justify-between">
                <span className="font-semibold text-gray-800 dark:text-gray-200 truncate pr-2">
                  {showSensitiveData ? v.vendor : "••••••••••"}
                </span>
                <span className="font-mono font-medium text-right text-primary-600 dark:text-primary-400">
                  {showSensitiveData ? `$${v.total.toFixed(2)}` : "••••••"}
                </span>
              </li>
            ))}
          </ul>
          <ul className="space-y-2 flex-1">
            {rightVendors.map((v) => (
              <li key={v.vendor} className="flex justify-between">
                <span className="font-semibold text-gray-800 dark:text-gray-200 truncate pr-2">
                  {showSensitiveData ? v.vendor : "••••••••••"}
                </span>
                <span className="font-mono font-medium text-right text-primary-600 dark:text-primary-400">
                  {showSensitiveData ? `$${v.total.toFixed(2)}` : "••••••"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
} 