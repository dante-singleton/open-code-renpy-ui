import type { Variable, VariableKind } from '@renpy-ui/spec';
import { Button, IconButton, Input, Panel, Select } from '@renpy-ui/ui';
import { useShallow } from 'zustand/react/shallow';
import { EMPTY_VARIABLES } from '../state/empty';
import { newEntityId, useProjectStore } from '../state/project';

const KIND_OPTIONS: Array<{ value: VariableKind; label: string; defaultLiteral: string }> = [
  { value: 'bool', label: 'bool', defaultLiteral: 'False' },
  { value: 'int', label: 'int', defaultLiteral: '0' },
  { value: 'float', label: 'float', defaultLiteral: '0.0' },
  { value: 'string', label: 'string', defaultLiteral: '""' },
  { value: 'list', label: 'list', defaultLiteral: '[]' },
  { value: 'dict', label: 'dict', defaultLiteral: '{}' },
  { value: 'python', label: 'python', defaultLiteral: 'None' },
];

function defaultLiteralFor(kind: VariableKind): string {
  return KIND_OPTIONS.find((k) => k.value === kind)?.defaultLiteral ?? 'None';
}

/**
 * Variables tab. Single-pane table editor; smaller surface than characters
 * so a side-by-side layout would waste space.
 */
export function VariablesView() {
  const variables = useProjectStore(
    useShallow((s) => s.bundle?.variables.variables ?? EMPTY_VARIABLES),
  );
  const upsertVariable = useProjectStore((s) => s.upsertVariable);
  const removeVariable = useProjectStore((s) => s.removeVariable);

  function add() {
    const variable: Variable = {
      id: newEntityId('var'),
      name: nextName(variables),
      kind: 'bool',
      default: 'False',
      persistent: false,
    };
    upsertVariable(variable);
  }

  return (
    <Panel
      heading={`Variables (${variables.length})`}
      actions={
        <Button variant="primary" size="sm" onClick={add}>
          + New
        </Button>
      }
    >
      <div className="p-3">
        {variables.length === 0 ? (
          <p className="text-sm text-fg-muted italic">No variables yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-fg-muted">
                <th className="py-1.5 pr-3 font-medium">Name</th>
                <th className="py-1.5 pr-3 font-medium">Kind</th>
                <th className="py-1.5 pr-3 font-medium">Default</th>
                <th className="py-1.5 pr-3 font-medium">Persistent</th>
                <th className="py-1.5 pr-3 font-medium">Doc</th>
                <th className="py-1.5" aria-label="actions" />
              </tr>
            </thead>
            <tbody>
              {variables.map((v) => (
                <Row
                  key={v.id}
                  variable={v}
                  onChange={(patch) => upsertVariable({ ...v, ...patch })}
                  onDelete={() => removeVariable(v.id)}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Panel>
  );
}

function Row({
  variable,
  onChange,
  onDelete,
}: {
  variable: Variable;
  onChange: (patch: Partial<Variable>) => void;
  onDelete: () => void;
}) {
  return (
    <tr className="border-t border-[color:var(--color-divider)]">
      <td className="py-1.5 pr-3 align-top">
        <Input value={variable.name} onChange={(e) => onChange({ name: e.target.value })} />
      </td>
      <td className="py-1.5 pr-3 align-top w-28">
        <Select
          value={variable.kind}
          onChange={(e) => {
            const kind = e.target.value as VariableKind;
            // Reset default to a kind-appropriate literal when the user
            // changes the type, but only if they hadn't customised it.
            const wasDefault = KIND_OPTIONS.some((k) => k.defaultLiteral === variable.default);
            onChange({
              kind,
              default: wasDefault ? defaultLiteralFor(kind) : variable.default,
            });
          }}
          options={KIND_OPTIONS.map((k) => ({ value: k.value, label: k.label }))}
        />
      </td>
      <td className="py-1.5 pr-3 align-top">
        <Input
          value={variable.default}
          onChange={(e) => onChange({ default: e.target.value })}
          placeholder="Python literal"
        />
      </td>
      <td className="py-1.5 pr-3 align-top w-24">
        <label className="flex items-center gap-2 text-xs text-fg-secondary">
          <input
            type="checkbox"
            checked={variable.persistent}
            onChange={(e) => onChange({ persistent: e.target.checked })}
          />
          persistent
        </label>
      </td>
      <td className="py-1.5 pr-3 align-top">
        <Input
          value={variable.doc ?? ''}
          onChange={(e) => onChange({ doc: e.target.value || undefined } as Partial<Variable>)}
          placeholder="(optional)"
        />
      </td>
      <td className="py-1.5 align-top w-10">
        <IconButton label="Delete variable" size="sm" onClick={onDelete}>
          <span aria-hidden>×</span>
        </IconButton>
      </td>
    </tr>
  );
}

function nextName(existing: Variable[]): string {
  let i = existing.length + 1;
  while (existing.some((v) => v.name === `var_${i}`)) i++;
  return `var_${i}`;
}
