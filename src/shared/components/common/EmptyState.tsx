/**
 * EmptyState — Displayed when no records match the current filters.
 * Preserved from original AdBrief design.
 */
export interface EmptyStateProps {
  message?: string;
}

export default function EmptyState({ message = 'No records match the current filters.' }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <img src={`${import.meta.env.BASE_URL}empty-state.svg`} alt="" className="h-40 w-auto opacity-80" />
      <p className="text-sm font-medium text-[#9CA3AF]">{message}</p>
    </div>
  );
}