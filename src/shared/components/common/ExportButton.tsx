/**
 * ExportButton — Red "Export CSV" button with animation.
 * Preserved from original AdBrief design.
 */
import { motion } from 'framer-motion';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/lib/utils';
import { useExportEnabled } from '@/entities/settings/model/useSettings';
import { csvSeparator } from '@/shared/lib/format';

export interface CsvPayload {
  headers: string[];
  rows: (string | number)[][];
}

export function downloadCsv(payload: CsvPayload, filename: string) {
  const sep = csvSeparator();
  // SECURITY (P2.3 / CSV formula injection): neutralize cells that start with
  // = + - @ (Excel/LibreOffice/Sheets would execute them as formulas/macros).
  // A leading apostrophe forces literal text interpretation in all major
  // spreadsheet apps. \t and \r are also DDE injection triggers.
  const escape = (v: string | number) => {
    let s = String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[;\n",]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [payload.headers.map(escape).join(sep), ...payload.rows.map((r) => r.map(escape).join(sep))];
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface ExportButtonProps {
  getPayload: () => CsvPayload;
  filename: string;
  className?: string;
}

/** Red "Export CSV" button — serializes the currently filtered dataset. */
export default function ExportButton({
  getPayload,
  filename,
  className,
}: ExportButtonProps) {
  const { t } = useTranslation();
  const exportEnabled = useExportEnabled();

  const onClick = () => {
    if (!exportEnabled) {
      toast.error(t('export.disabled'));
      return;
    }
    downloadCsv(getPayload(), filename);
    toast.success(t('export.success'), { description: filename });
  };

  // If export is disabled, render nothing — the feature is gated app-wide.
  if (!exportEnabled) return null;

  return (
    <motion.div whileTap="tap" className="inline-block">
      <Button
        onClick={onClick}
        className={cn(
          'gap-2 bg-[#C62828] font-semibold text-white transition-colors hover:bg-[#A91F1F]',
          className,
        )}
      >
        <motion.span variants={{ tap: { y: 3 } }} transition={{ type: 'spring', stiffness: 400, damping: 15 }}>
          <Download className="h-4 w-4" />
        </motion.span>
        {t('export.csv')}
      </Button>
    </motion.div>
  );
}