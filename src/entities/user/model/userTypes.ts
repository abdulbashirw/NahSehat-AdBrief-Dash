/**
 * CMS User types — shared across User Management module.
 */

export interface CreateUserPayload {
  username: string;
  email: string;
  password: string;
  fullName: string;
  role: string;
  payorIds: string[];
  isActive?: boolean;
}

export interface UpdateUserPayload {
  email?: string;
  fullName?: string;
  role?: string;
  payorIds?: string[];
  isActive?: boolean;
}

export interface ResetPasswordPayload {
  newPassword: string;
}

export interface UserQueryParams {
  page: number;
  pageSize: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  role?: string;
  isActive?: boolean;
}