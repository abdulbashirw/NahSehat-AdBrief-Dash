/**
 * MemberSearchFilterBar — Modul 1a.
 *
 * Top filter bar for member search:
 * - Nama Lengkap (text)
 * - Tanggal Lahir (native date input, YYYY-MM-DD)
 * - Jenis Kelamin (dropdown M/F)
 * - Search button (with loading state)
 *
 * Inline validation: SEMUA kolom wajib diisi (nama min. 3 chars,
 * tglLahir & gender tidak boleh kosong) sebelum tombol Search aktif.
 */
import { Loader2, Search, UserRound, Users } from 'lucide-react';
import type { MemberSearchFilter, MemberGender } from '../model/onboardingTypes';

export interface MemberSearchFilterBarProps {
  filter: MemberSearchFilter;
  onChange: (filter: MemberSearchFilter) => void;
  onSearch: () => void;
  searching?: boolean;
}

export default function MemberSearchFilterBar({
  filter,
  onChange,
  onSearch,
  searching = false,
}: MemberSearchFilterBarProps) {
  const namaError = filter.nama.trim().length > 0 && filter.nama.trim().length < 3
    ? 'Nama minimal 3 karakter'
    : '';
  // Semua kolom wajib diisi sebelum pencarian (nama, tanggal lahir, jenis kelamin).
  const allFilled =
    filter.nama.trim().length >= 3 &&
    filter.tglLahir.trim().length > 0 &&
    filter.gender !== '';
  const canSubmit = allFilled && !searching;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (canSubmit) onSearch();
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="mb-6 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
          <Search className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-900">Cari Data Member</h2>
          <p className="mt-1 text-sm leading-5 text-slate-500">
            Masukkan identitas member untuk memeriksa data di jaringan AdMedika.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-12">
        {/* Nama Lengkap */}
        <div className="sm:col-span-2 lg:col-span-5">
          <label htmlFor="member-name" className="block text-sm font-medium text-slate-700">
            Nama Lengkap *
          </label>
          <div className="relative mt-2">
            <Users className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              id="member-name"
              type="text"
              value={filter.nama}
              onChange={(e) => onChange({ ...filter, nama: e.target.value })}
              placeholder="Contoh: Budi Santoso"
              autoComplete="name"
              aria-invalid={Boolean(namaError)}
              aria-describedby={namaError ? 'member-name-error' : undefined}
              required
              className={`h-11 w-full rounded-lg border bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-600/20 ${
                namaError ? 'border-rose-400 focus:border-rose-500' : 'border-slate-300 focus:border-indigo-600'
              }`}
            />
          </div>
          {namaError && <p id="member-name-error" className="mt-1.5 text-xs font-medium text-rose-600">{namaError}</p>}
        </div>

        {/* Tanggal Lahir */}
        <div className="sm:col-span-1 lg:col-span-3">
          <label htmlFor="member-birth-date" className="block text-sm font-medium text-slate-700">
            Tanggal Lahir *
          </label>
          <input
            id="member-birth-date"
            type="date"
            value={filter.tglLahir}
            onChange={(e) => onChange({ ...filter, tglLahir: e.target.value })}
            autoComplete="bday"
            required
            className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 transition-colors focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
          />
        </div>

        {/* Jenis Kelamin */}
        <div className="sm:col-span-1 lg:col-span-2">
          <label htmlFor="member-gender" className="block text-sm font-medium text-slate-700">
            Jenis Kelamin *
          </label>
          <div className="relative mt-1.5">
            <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <select
              id="member-gender"
              value={filter.gender}
              onChange={(e) => onChange({ ...filter, gender: e.target.value as '' | MemberGender })}
              required
              className="h-11 w-full appearance-none rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-8 text-sm text-slate-900 transition-colors focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            >
              <option value="">Pilih jenis kelamin</option>
              <option value="M">Laki-laki (M)</option>
              <option value="F">Perempuan (F)</option>
            </select>
          </div>
        </div>

        {/* Search button */}
        <div className="flex flex-col justify-end sm:col-span-2 lg:col-span-2">
          <button
            type="submit"
            disabled={!canSubmit}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-indigo-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-indigo-800 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {searching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            <span>{searching ? 'Mencari...' : 'Cari Member'}</span>
          </button>
        </div>
      </div>
    </form>
  );
}