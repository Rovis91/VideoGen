import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export const Checkbox = forwardRef(({ className, ...props }, ref) => (
  <input
    type="checkbox"
    ref={ref}
    className={cn(
      'h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-2 focus:ring-neutral-400',
      className
    )}
    {...props}
  />
));
Checkbox.displayName = 'Checkbox';
