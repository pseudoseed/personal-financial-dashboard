import React from 'react';

interface MetricCardProps {
  title: string;
  value: string;
  color?: string;
  progress?: number;
  progressColor?: string;
}

export const MetricCard = ({ title, value, color, progress, progressColor }: MetricCardProps) => {
  return (
    <div className="card flex flex-col justify-between min-h-[90px]">
      <div>
        <h3 className="text-xl font-semibold text-surface-600 dark:text-gray-200 mb-2">
          {title}
        </h3>
        <p className={`text-2xl font-bold ${color || 'text-surface-900 dark:text-surface-dark-900'} leading-tight break-words`}>
          {value}
        </p>
      </div>
      {progress !== undefined && (
        <div className="w-full bg-surface-200 dark:bg-surface-dark-300 rounded-full h-2 mt-2">
          <div
            className={`h-2 rounded-full ${progressColor}`}
            style={{ width: `${Math.min(progress, 100)}%` }}
          ></div>
        </div>
      )}
    </div>
  );
}; 