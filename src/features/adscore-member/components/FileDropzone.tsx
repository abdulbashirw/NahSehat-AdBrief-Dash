/**
 * FileDropzone — reusable uploader (click + drag & drop).
 *
 * Supports single or multiple files, extension & size validation,
 * and a file list with per-file remove buttons.
 */
import { useRef, useState } from 'react';
import type { ChangeEvent, DragEvent, ReactNode } from 'react';
import { Check, FileText, Paperclip, Trash2, Upload } from 'lucide-react';

export interface FileDropzoneProps {
  label: string;
  /** e.g. '.pdf,.jpg,.jpeg,.png' */
  accept: string;
  hint?: string;
  multiple?: boolean;
  maxSizeMB?: number;
  files: File[];
  onFilesAdded: (files: File[]) => void;
  onRemoveFile: (index: number) => void;
  onValidationError?: (message: string) => void;
  icon?: ReactNode;
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function extOf(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx >= 0 ? name.slice(idx).toLowerCase() : '';
}

export default function FileDropzone({
  label,
  accept,
  hint,
  multiple = false,
  maxSizeMB = 5,
  files,
  onFilesAdded,
  onRemoveFile,
  onValidationError,
  icon,
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const validateAndAdd = (incoming: FileList | File[] | null) => {
    if (!incoming) return;
    const list = Array.from(incoming);
    const allowed = accept.split(',').map((a) => a.trim().toLowerCase());
    const badType: string[] = [];
    const badSize: string[] = [];
    const valid: File[] = [];

    for (const f of list) {
      const ext = extOf(f.name);
      if (!allowed.includes(ext)) {
        badType.push(f.name);
        continue;
      }
      if (f.size > maxSizeMB * 1024 * 1024) {
        badSize.push(f.name);
        continue;
      }
      valid.push(f);
    }

    if (badType.length > 0) {
      onValidationError?.(`Tipe file tidak didukung: ${badType.join(', ')}`);
    }
    if (badSize.length > 0) {
      onValidationError?.(`Ukuran melebihi ${maxSizeMB} MB: ${badSize.join(', ')}`);
    }
    if (valid.length > 0) {
      // single mode: replace; multiple mode: append
      onFilesAdded(multiple ? [...files, ...valid] : [valid[0]]);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    validateAndAdd(e.dataTransfer.files);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    validateAndAdd(e.target.files);
    e.target.value = ''; // allow re-selecting the same file
  };

  const hasFiles = files.length > 0;

  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold text-slate-600">{label}</label>
        {hasFiles && multiple && (
          <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
            {files.length} file dipilih
          </span>
        )}
      </div>

      {/* Dropzone */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`mt-1.5 flex cursor-pointer items-center justify-center gap-3 rounded-xl border-2 border-dashed px-4 py-4 text-center transition-all ${
          dragging
            ? 'border-indigo-400 bg-indigo-50/80'
            : 'border-slate-300 bg-slate-50/60 hover:border-indigo-300 hover:bg-indigo-50/40'
        }`}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200">
          {icon ?? <Upload className="h-4 w-4" />}
        </div>
        <div className="text-left">
          <p className="text-xs font-bold text-slate-700">
            Klik atau seret file ke sini
            {multiple && <span className="ml-1 font-medium text-slate-400">(bisa lebih dari satu)</span>}
          </p>
          {hint && <p className="mt-0.5 text-[11px] text-slate-400">{hint}</p>}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={handleInputChange}
      />

      {/* Selected files */}
      {hasFiles && (
        <ul className="mt-2 space-y-1.5">
          {files.map((f, idx) => (
            <li
              key={`${f.name}-${idx}`}
              className="flex items-center gap-3 rounded-xl border border-emerald-200/80 bg-emerald-50/50 px-3 py-2"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white ring-1 ring-emerald-200">
                <FileText className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="min-w-0 flex-1 text-left">
                <p className="truncate text-xs font-bold text-slate-700">{f.name}</p>
                <p className="text-[11px] text-slate-400">
                  {formatSize(f.size)} · {extOf(f.name).replace('.', '').toUpperCase()} · siap diunggah
                </p>
              </div>
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                <Check className="h-3 w-3" />
              </span>
              <button
                type="button"
                onClick={() => onRemoveFile(idx)}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                title="Hapus file"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {!hasFiles && (
        <p className="mt-1.5 flex items-center gap-1 text-[11px] text-slate-400">
          <Paperclip className="h-3 w-3" />
          Belum ada file dipilih
        </p>
      )}
    </div>
  );
}