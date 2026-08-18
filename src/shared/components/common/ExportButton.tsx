/**
 * ExportButton — Red "Export CSV" button with animation.
 * Preserved from original AdBrief design.
 */
import { motion } from 'framer-motion';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/lib/utils';
import { useExportEnabled } from '@/entities/settings/model/useSettings';

export interface CsvPayload {
  headers: string[];
  rows: (string | number)[][];
}

export function downloadCsv(payload: CsvPayload, filename: string) {
  const escape = (v: string | number) => {
    const s = String(v);
    return /[;\n"]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // ";" separator: id-ID locale uses "," as decimal mark, so Excel-safe CSV uses ";"
  const lines = [payload.headers.map(escape).join(';'), ...payload.rows.map((r) => r.map(escape).join(';'))];
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
  const exportEnabled = useExportEnabled();

  const onClick = () => {
    if (!exportEnabled) {
      toast.error('Data export is disabled by administrator');
      return;
    }
    downloadCsv(getPayload(), filename);
    toast.success('CSV exported', { description: filename });
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
        Export CSV
      </Button>
    </motion.div>
  );
}