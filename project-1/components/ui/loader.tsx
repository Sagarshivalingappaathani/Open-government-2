'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

const Loader = ({ className, size = 'md', ...props }: { className?: string; size?: 'sm' | 'md' | 'lg'; [key: string]: any }) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  };

  return (
    <div
      className={cn(
        'animate-spin rounded-full border-2 border-current border-t-transparent',
        sizeClasses[size],
        className
      )}
      role="status"
      {...props}
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
};

Loader.displayName = 'Loader';

export { Loader };
