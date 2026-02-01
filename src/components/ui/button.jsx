import { cn } from '@/lib/utils';

export function Button({ className, variant = 'default', ...props }) {
  const variants = {
    default: 'bg-neutral-900 text-white hover:bg-neutral-800',
    outline: 'border border-neutral-200 bg-white hover:bg-neutral-50',
    secondary: 'bg-neutral-100 text-neutral-900 hover:bg-neutral-200',
    ghost: 'hover:bg-neutral-100',
    destructive: 'bg-red-600 text-white hover:bg-red-700',
  };
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-md text-sm font-medium h-10 px-4 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
