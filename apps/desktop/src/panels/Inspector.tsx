import { Panel } from '@renpy-ui/ui';

export function Inspector() {
  return (
    <Panel heading="Inspector">
      <div className="p-4 text-sm text-fg-secondary">
        <p className="text-fg-muted">Nothing selected.</p>
        <p className="mt-2">
          Select a node on the canvas to edit its properties. Node editing lands in M2.
        </p>
      </div>
    </Panel>
  );
}
