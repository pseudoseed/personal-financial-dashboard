"use client";

import { Fragment } from 'react';
import { Menu, Transition } from '@headlessui/react';
import { ChevronDownIcon } from '@heroicons/react/20/solid';
import { 
  HomeIcon, 
  CreditCardIcon, 
  ArrowPathIcon, 
  ChartBarIcon,
  BanknotesIcon
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/Button';

const navigation = [
  { 
    name: 'Overview', 
    href: '/dashboard', 
    description: 'Main dashboard view',
    icon: HomeIcon,
    color: 'text-blue-600 dark:text-blue-400'
  },
  { 
    name: 'Accounts', 
    href: '/dashboard/accounts', 
    description: 'Account management',
    icon: CreditCardIcon,
    color: 'text-purple-600 dark:text-purple-400'
  },
  { 
    name: 'Transactions', 
    href: '/dashboard/transactions', 
    description: 'Transaction history',
    icon: ArrowPathIcon,
    color: 'text-green-600 dark:text-green-400'
  },
  { 
    name: 'Analytics', 
    href: '/dashboard/analytics', 
    description: 'Financial analytics',
    icon: ChartBarIcon,
    color: 'text-orange-600 dark:text-orange-400'
  },
];

export function NavigationMenu() {
  const pathname = usePathname();
  
  const currentPage = navigation.find(item => item.href === pathname) || navigation[0];
  
  // Get display name for mobile navigation
  const getMobileDisplayName = () => {
    if (pathname === '/') return 'Dashboard';
    return currentPage.name;
  };

  return (
    <Menu as="div" className="relative inline-block text-left">
      <div>
        <Menu.Button as={Button} variant="ghost" size="sm" className="gap-2 px-4 py-2 h-auto border border-gray-300 shadow-sm hover:bg-gray-200 dark:bg-surface-800 dark:border-surface-700 dark:shadow-md dark:hover:bg-surface-900 transition-all duration-200">
          <BanknotesIcon className="h-5 w-5 text-primary-600 dark:text-primary-400" />
          <div className="flex flex-col items-start">
            <span className="text-sm font-semibold text-surface-900 dark:text-surface-100">
              {getMobileDisplayName()}
            </span>
            <span className="text-xs text-surface-600 dark:text-surface-400 hidden sm:block">
              Financial Dashboard
            </span>
          </div>
          <ChevronDownIcon className="h-4 w-4 text-surface-600 dark:text-surface-400 transition-transform duration-200 ui-open:rotate-180" aria-hidden="true" />
        </Menu.Button>
      </div>

      <Transition
        as={Fragment}
        enter="transition ease-out duration-200"
        enterFrom="transform opacity-0 scale-95 translate-y-2"
        enterTo="transform opacity-100 scale-100 translate-y-0"
        leave="transition ease-in duration-150"
        leaveFrom="transform opacity-100 scale-100 translate-y-0"
        leaveTo="transform opacity-0 scale-95 translate-y-2"
      >
        <Menu.Items className="absolute left-0 mt-3 w-64 origin-top-left z-50 rounded-2xl shadow-xl bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 p-3 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-surface-900">
          <div className="space-y-1">
            {navigation.map((item, idx) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              
              return (
                <Menu.Item key={item.name}>
                  {({ active }) => (
                    <Link
                      href={item.href}
                      className={`
                        group flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200
                        ${active ? 'bg-surface-100 dark:bg-surface-700 scale-[1.02]' : ''}
                        ${isActive 
                          ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800' 
                          : 'text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700/50'
                        }
                      `}
                    >
                      <div className={`
                        p-2 rounded-lg transition-all duration-200
                        ${isActive 
                          ? 'bg-primary-100 dark:bg-primary-900/30' 
                          : 'bg-surface-100 dark:bg-surface-700 group-hover:bg-surface-200 dark:group-hover:bg-surface-600'
                        }
                      `}>
                        <Icon className={`h-5 w-5 ${item.color}`} />
                      </div>
                      <div className="flex flex-col flex-1 min-w-0">
                        <span className={`font-semibold text-sm ${isActive ? 'text-primary-700 dark:text-primary-300' : 'text-surface-900 dark:text-surface-100'}`}>
                          {item.name}
                        </span>
                        <span className={`text-xs ${isActive ? 'text-primary-600 dark:text-primary-400' : 'text-surface-600 dark:text-surface-400'}`}>
                          {item.description}
                        </span>
                      </div>
                      {isActive && (
                        <div className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0" />
                      )}
                    </Link>
                  )}
                </Menu.Item>
              );
            })}
          </div>
          
          {/* Footer */}
          <div className="mt-3 pt-3 border-t border-surface-200 dark:border-surface-700">
            <div className="px-4 py-2">
              <div className="text-xs text-surface-500 dark:text-surface-400">
                Navigate your finances
              </div>
            </div>
          </div>
        </Menu.Items>
      </Transition>
    </Menu>
  );
} 