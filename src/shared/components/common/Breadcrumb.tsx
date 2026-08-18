/**
 * Breadcrumb — navigation breadcrumb trail.
 */
import { Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export interface BreadcrumbItem {
  label: string;
  path?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export default function Breadcrumb({ items, className }: BreadcrumbProps) {
  return (
    <nav className={cn('flex items-center gap-1.5 text-sm', className)} aria-label="Breadcrumb">
      <Link to="/" className="text-[#6B7280] transition hover:text-[#2E7D5B]">
        <Home className="h-4 w-4" />
      </Link>
      {items.map((item, idx) => (
        <div key={idx} className="flex items-center gap-1.5">
          <ChevronRight className="h-3.5 w-3.5 text-[#9CA3AF]" />
          {item.path && idx < items.length - 1 ? (
            <Link to={item.path} className="text-[#6B7280] transition hover:text-[#2E7D5B]">
              {item.label}
            </Link>
          ) : (
            <span className="font-medium text-[#1F2A37]">{item.label}</span>
          )}
        </div>
      ))}
    </nav>
  );
}