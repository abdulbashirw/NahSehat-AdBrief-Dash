/**
 * Settings entity — public API.
 */
export type { AppSettings, UpdateSettingsRequest, ProfileUpdateRequest, PasswordChangeRequest } from './model/settingTypes';
export { settingApi, useGetSettingsQuery, useUpdateSettingMutation, useUpdateProfileMutation, useChangePasswordMutation } from './api/settingApi';