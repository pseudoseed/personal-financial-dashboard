"use client";

import { useState, useEffect } from "react";
import { InformationCircleIcon, CurrencyDollarIcon } from "@heroicons/react/24/outline";
import { Account } from "@/types/account";

interface CostOptimizationCardProps {
  accounts: Account[];
}

interface AccountCost {
  id: string;
  name: string;
  type: string;
  monthlyCost: number;
  products: string[];
  provider: string;
}

export function CostOptimizationCard({ accounts }: CostOptimizationCardProps) {
  const [accountCosts, setAccountCosts] = useState<AccountCost[]>([]);
  const [totalMonthlyCost, setTotalMonthlyCost] = useState(0);
  const [potentialSavings, setPotentialSavings] = useState(0);
  const [plaidAccounts, setPlaidAccounts] = useState<Account[]>([]);
  const [nonPlaidAccounts, setNonPlaidAccounts] = useState<Account[]>([]);

  useEffect(() => {
    // Separate Plaid accounts from non-Plaid accounts
    const plaid = accounts.filter(account => 
      account.plaidItem && 
      account.plaidItem.accessToken && 
      account.plaidItem.accessToken !== 'manual' &&
      account.plaidItem.provider === 'plaid'
    );
    
    const nonPlaid = accounts.filter(account => 
      !account.plaidItem || 
      !account.plaidItem.accessToken ||
      account.plaidItem.accessToken === 'manual' ||
      account.plaidItem.provider !== 'plaid'
    );

    setPlaidAccounts(plaid);
    setNonPlaidAccounts(nonPlaid);

    // Only calculate costs for Plaid accounts
    const costs = plaid.map(account => {
      let monthlyCost = 0.30; // Base Transactions cost
      const products = ['Transactions'];
      
      // Add Liabilities cost for credit/loan accounts
      if (account.type === 'credit' || account.type === 'loan') {
        monthlyCost += 0.20;
        products.push('Liabilities');
      }
      
      // Add Investments cost for investment accounts
      if (account.type === 'investment') {
        monthlyCost += 0.18;
        products.push('Investments');
      }
      
      return {
        id: account.id,
        name: account.name,
        type: account.type,
        monthlyCost,
        products,
        provider: 'plaid',
      };
    });
    
    setAccountCosts(costs);
    const total = costs.reduce((sum, cost) => sum + cost.monthlyCost, 0);
    setTotalMonthlyCost(total);
    
    // Calculate potential savings by optimizing product selection
    const optimizedCosts = costs.map(cost => {
      if (cost.type === 'depository' && cost.products.includes('Liabilities')) {
        return cost.monthlyCost - 0.20; // Remove unnecessary Liabilities
      }
      if (cost.type === 'depository' && cost.products.includes('Investments')) {
        return cost.monthlyCost - 0.18; // Remove unnecessary Investments
      }
      return cost.monthlyCost;
    });
    
    const optimizedTotal = optimizedCosts.reduce((sum, cost) => sum + cost, 0);
    setPotentialSavings(total - optimizedTotal);
  }, [accounts]);

  // Don't show the card if there are no Plaid accounts
  if (plaidAccounts.length === 0) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Plaid Cost Optimization
        </h3>
        <InformationCircleIcon className="h-5 w-5 text-gray-400" />
      </div>
      
      <div className="space-y-4">
        {/* Account Summary */}
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between text-sm">
            <div>
              <p className="font-medium text-gray-900 dark:text-white">
                Account Summary
              </p>
              <p className="text-gray-600 dark:text-gray-400">
                {plaidAccounts.length} Plaid accounts • {nonPlaidAccounts.length} other accounts
              </p>
            </div>
          </div>
        </div>

        {/* Current Cost Summary */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Current Monthly Plaid Cost
              </p>
              <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                ${totalMonthlyCost.toFixed(2)}
              </p>
            </div>
            <CurrencyDollarIcon className="h-8 w-8 text-blue-500" />
          </div>
        </div>

        {/* Potential Savings */}
        {potentialSavings > 0 && (
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-900 dark:text-green-100">
                  Potential Monthly Savings
                </p>
                <p className="text-xl font-bold text-green-900 dark:text-green-100">
                  ${potentialSavings.toFixed(2)}
                </p>
              </div>
              <div className="text-green-500">
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
            </div>
          </div>
        )}

        {/* Plaid Account Breakdown */}
        <div>
          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
            Plaid Account Breakdown
          </h4>
          <div className="space-y-2">
            {accountCosts.map((cost) => (
              <div key={cost.id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {cost.name}
                  </p>
                  <p className="text-gray-500 dark:text-gray-400">
                    {cost.type} • {cost.products.join(', ')}
                  </p>
                </div>
                <span className="font-medium text-gray-900 dark:text-white">
                  ${cost.monthlyCost.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Non-Plaid Accounts Info */}
        {nonPlaidAccounts.length > 0 && (
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              Other Accounts (No Plaid Cost)
            </h4>
            <div className="space-y-1">
              {nonPlaidAccounts.map((account) => (
                <div key={account.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">
                    {account.name} ({account.plaidItem?.provider || 'manual'})
                  </span>
                  <span className="text-green-600 dark:text-green-400 font-medium">
                    $0.00
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Optimization Tips */}
        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
          <h4 className="text-sm font-medium text-yellow-900 dark:text-yellow-100 mb-2">
            💡 Optimization Tips
          </h4>
          <ul className="text-sm text-yellow-800 dark:text-yellow-200 space-y-1">
            <li>• Disable Liabilities for non-credit accounts (-$0.20/month)</li>
            <li>• Disable Investments for non-investment accounts (-$0.18/month)</li>
            <li>• Consider consolidating similar accounts</li>
            <li>• Manual and Coinbase accounts have no Plaid costs</li>
          </ul>
        </div>
      </div>
    </div>
  );
} 