/**
 * PageHeader — consistent page header with title, description, and actions.
 */
import { cn } from '@/shared/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
  variant?: 'default' | 'glass';
}

export default function PageHeader({ title, description, children, className, variant = 'default' }: PageHeaderProps) {
  const isGlass = variant === 'glass';

  return (
    <div className={cn('mb-6 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between', className)}>
      <div>
        <h1
          className={cn(
            'text-2xl font-bold',
            isGlass ? 'text-white drop-shadow-sm' : 'text-[#1F2A37]',
          )}
        >
          {title}
        </h1>
        {description && (
          <p
            className={cn(
              'mt-1 text-sm',
              isGlass ? 'text-white/70' : 'text-[#6B7280]',
            )}
          >
            {description}
          </p>
        )}
      </div>
      {children && <div className="mt-3 flex items-center gap-3 sm:mt-0">{children}</div>}
    </div>
  );
}