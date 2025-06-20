import React from 'react';

interface Stat {
  label: string;
  value: string | number;
}

interface ListStatCardProps {
  title: string;
  stats: Stat[];
}

export const ListStatCard = ({ title, stats }: ListStatCardProps) => {
  return (
    <div className="card p-4">
      <h3 className="text-xl font-semibold text-surface-600 dark:text-gray-200 mb-3">
        {title}
      </h3>
      <div className="space-y-2 text-sm">
        {stats.map((stat, index) => (
          <div key={index} className="flex justify-between items-center">
            <span className="text-secondary-600 dark:text-secondary-400">
              {stat.label}
            </span>
            <span className="font-medium text-foreground">
              {stat.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}; 