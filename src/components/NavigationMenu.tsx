"use client";

import { Fragment } from 'react';
import { Menu, Transition } from '@headlessui/react';
import { ChevronDownIcon } from '@heroicons/react/20/solid';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/Button';

const navigation = [
  { name: 'Overview', href: '/dashboard', description: 'Main dashboard view' },
  { name: 'Accounts', href: '/dashboard/accounts', description: 'Account management' },
  { name: 'Transactions', href: '/dashboard/transactions', description: 'Transaction history' },
  { name: 'Analytics', href: '/dashboard/analytics', description: 'Financial analytics' },
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
        <Menu.Button as={Button} variant="secondary" size="sm" className="gap-1">
          <span className="hidden xs:inline">Financial Dashboard</span>
          <span className="inline xs:hidden">{getMobileDisplayName()}</span>
          <ChevronDownIcon className="h-4 w-4 text-secondary-600 dark:text-secondary-400" aria-hidden="true" />
        </Menu.Button>
      </div>

      <Transition
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <Menu.Items className="card absolute left-0 mt-2 w-56 origin-top-left z-50">
          <div className="px-1 py-1">
            {navigation.map((item) => (
              <Menu.Item key={item.name}>
                {({ active }) => (
                  <Link
                    href={item.href}
                    className={`${
                      active ? 'bg-surface-100 dark:bg-surface-200' : ''
                    } ${
                      pathname === item.href ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300' : 'text-foreground'
                    } group flex items-center px-4 py-3 text-sm hover:bg-surface-50 dark:hover:bg-surface-200 transition-colors`}
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{item.name}</span>
                      <span className="text-xs text-secondary-600 dark:text-secondary-400 group-hover:text-secondary-700 dark:group-hover:text-secondary-300">
                        {item.description}
                      </span>
                    </div>
                  </Link>
                )}
              </Menu.Item>
            ))}
          </div>
        </Menu.Items>
      </Transition>
    </Menu>
  );
} 