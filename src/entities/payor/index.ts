/**
 * Payor entity — public API.
 */
export type { CreatePayorPayload, UpdatePayorPayload, PayorQueryParams } from './model/payorTypes';
export { payorApi, useGetPayorsQuery, useGetPayorByIdQuery, useCreatePayorMutation, useUpdatePayorMutation, useDeletePayorMutation } from './api/payorApi';