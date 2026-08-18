/**
 * CMS Payor types — shared across Payor Management module.
 */
import type { PayorCategory } from '@/shared/types';

export interface CreatePayorPayload {
  name: string;
  code: string;
  category: PayorCategory;
  description?: string;
  isActive?: boolean;
}

export interface UpdatePayorPayload {
  name?: string;
  code?: string;
  category?: PayorCategory;
  description?: string;
  isActive?: boolean;
}

export interface PayorQueryParams {
  page: number;
  pageSize: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}