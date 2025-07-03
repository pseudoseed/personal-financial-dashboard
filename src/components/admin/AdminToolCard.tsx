"use client";

import React from 'react';
import { Card } from '@/components/ui/Card';

interface AdminToolCardProps {
  title: string;
  description: string;
  status?: 'active' | 'warning' | 'error' | 'info';
  statusText?: string;
  children?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function AdminToolCard({ 
  title, 
  description, 
  status, 
  statusText, 
  children, 
  actions,
  className = "" 
}: AdminToolCardProps) {
  const getStatusColor = () => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'error':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      case 'info':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  return (
    <Card className={`p-6 ${className}`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
            {title}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {description}
          </p>
        </div>
        {status && (
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor()}`}>
            {statusText || status}
          </span>
        )}
      </div>
      
      {children && (
        <div className="mb-4">
          {children}
        </div>
      )}
      
      {actions && (
        <div className="flex gap-2">
          {actions}
        </div>
      )}
    </Card>
  );
} 