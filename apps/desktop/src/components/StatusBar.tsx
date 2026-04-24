export function StatusBar() {
  return (
    <footer
      className={[
        'flex items-center justify-between h-7 shrink-0',
        'px-3 border-t border-[color:var(--color-border)] bg-bg-1',
        'text-xs text-fg-secondary',
      ].join(' ')}
    >
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-success" aria-hidden />
          Idle
        </span>
        <span>No project open</span>
      </div>
      <div className="flex items-center gap-4">
        <span>spec v1.0.0</span>
        <span className="text-fg-muted">M0 · scaffold</span>
      </div>
    </footer>
  );
}
