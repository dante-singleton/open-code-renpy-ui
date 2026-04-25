import { Input, Select, cn } from '@renpy-ui/ui';
import { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useProjectStore } from '../state/project';

interface ExpressionBuilderProps {
  /** Current expression as a raw Python string (the spec field). */
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  /** Allow `<empty>` to mean "always true" (used by `else` branches). */
  allowEmpty?: boolean;
}

/**
 * Compact expression builder. Two modes:
 *
 *   - **Guided**: pick a variable, an operator, and a literal/expression value.
 *     The component composes `var op value` and writes it back via onChange.
 *   - **Custom**: free-text Python. Used for anything outside `var op value`.
 *
 * Switching from Guided to Custom is automatic when the field doesn't match
 * the simple template (e.g. once the user types `and` / `or`). Switching
 * back is manual via the toggle so we never silently rewrite hand-tuned
 * expressions.
 */

const OPERATORS = ['==', '!=', '>', '>=', '<', '<=', 'in', 'not in'] as const;
type Operator = (typeof OPERATORS)[number];

interface ParsedSimple {
  variable: string;
  operator: Operator;
  value: string;
}

const SIMPLE_RE = new RegExp(
  // <ident> <op> <rest>
  // operator is the longest matching token from OPERATORS, leftmost.
  `^\\s*([A-Za-z_][A-Za-z0-9_]*)\\s+(${OPERATORS.map(escapeForRegex).join('|')})\\s+(.+?)\\s*$`,
);

function escapeForRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseSimple(expr: string): ParsedSimple | null {
  const m = SIMPLE_RE.exec(expr);
  if (!m) return null;
  return { variable: m[1] as string, operator: m[2] as Operator, value: m[3] as string };
}

function compose(parts: ParsedSimple): string {
  return `${parts.variable} ${parts.operator} ${parts.value}`;
}

export function ExpressionBuilder({
  value,
  onChange,
  placeholder = 'Python expression',
  allowEmpty = false,
}: ExpressionBuilderProps) {
  const variables = useProjectStore(
    useShallow((s) => s.bundle?.variables.variables.map((v) => v.name) ?? []),
  );

  const initialParsed = useMemo(() => parseSimple(value), [value]);
  // We store the last guided-mode shape so toggling back to guided after
  // editing in Custom restores the user's previous picks.
  const [mode, setMode] = useState<'guided' | 'custom'>(
    value === '' ? (allowEmpty ? 'custom' : 'guided') : initialParsed ? 'guided' : 'custom',
  );
  const [draft, setDraft] = useState<ParsedSimple>(
    initialParsed ?? { variable: variables[0] ?? 'flag', operator: '==', value: 'True' },
  );

  // Keep the local draft in sync if the value changes externally (undo / redo).
  useEffect(() => {
    const p = parseSimple(value);
    if (p) setDraft(p);
  }, [value]);

  function setGuided(next: Partial<ParsedSimple>): void {
    const merged = { ...draft, ...next };
    setDraft(merged);
    onChange(compose(merged));
  }

  if (mode === 'custom') {
    return (
      <div className="space-y-1">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="font-mono text-xs"
        />
        <ToggleRow
          mode={mode}
          canSwitchToGuided={Boolean(parseSimple(value))}
          onSwitch={() => {
            const p = parseSimple(value);
            if (p) setDraft(p);
            setMode('guided');
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="grid grid-cols-[1fr_auto_1fr] gap-1.5">
        {variables.length > 0 ? (
          <Select
            value={draft.variable}
            onChange={(e) => setGuided({ variable: e.target.value })}
            options={[
              ...(!variables.includes(draft.variable) && draft.variable
                ? [{ value: draft.variable, label: draft.variable }]
                : []),
              ...variables.map((v) => ({ value: v, label: v })),
            ]}
          />
        ) : (
          <Input
            value={draft.variable}
            onChange={(e) => setGuided({ variable: e.target.value })}
            placeholder="variable"
            className="font-mono text-xs"
          />
        )}
        <Select
          value={draft.operator}
          onChange={(e) => setGuided({ operator: e.target.value as Operator })}
          options={OPERATORS.map((op) => ({ value: op, label: op }))}
          className="w-20"
        />
        <Input
          value={draft.value}
          onChange={(e) => setGuided({ value: e.target.value })}
          placeholder="value (Python)"
          className="font-mono text-xs"
        />
      </div>
      <ToggleRow mode={mode} canSwitchToGuided onSwitch={() => setMode('custom')} />
    </div>
  );
}

function ToggleRow({
  mode,
  canSwitchToGuided,
  onSwitch,
}: {
  mode: 'guided' | 'custom';
  canSwitchToGuided: boolean;
  onSwitch: () => void;
}) {
  const targetLabel = mode === 'guided' ? 'Switch to custom' : 'Switch to guided';
  const targetEnabled = mode === 'guided' ? true : canSwitchToGuided;
  return (
    <div className="flex justify-end">
      <button
        type="button"
        disabled={!targetEnabled}
        onClick={onSwitch}
        className={cn(
          'text-[10px] uppercase tracking-wider',
          targetEnabled
            ? 'text-fg-muted hover:text-fg cursor-pointer'
            : 'text-fg-muted/50 cursor-not-allowed',
        )}
      >
        {targetLabel}
      </button>
    </div>
  );
}
