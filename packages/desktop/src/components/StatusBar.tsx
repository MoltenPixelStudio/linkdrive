import { formatBytes } from '@linkdrive/shared/paths';

export function StatusBar({
  count,
  selectedCount,
  totalSize,
}: {
  count: number;
  selectedCount: number;
  totalSize?: number;
}) {
  return (
    <footer className="h-7 shrink-0 border-t border-ld-border bg-ld-card flex items-center justify-between px-3 text-[11px] text-ld-text-muted select-none">
      <span>
        {selectedCount > 0 && (
          <span className="text-brand-red font-medium mr-2">{selectedCount} selected</span>
        )}
        {totalSize !== undefined && selectedCount === 0 && (
          <span className="text-ld-text-dim mr-2">{formatBytes(totalSize)}</span>
        )}
      </span>
      <span>
        {count} item{count === 1 ? '' : 's'}
      </span>
    </footer>
  );
}
