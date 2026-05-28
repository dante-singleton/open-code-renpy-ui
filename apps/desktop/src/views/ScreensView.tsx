import type { ScreenSpec, ScreenTemplate, ScreenWidget } from '@renpy-ui/spec';
import { Button, Input, Panel, Select, cn } from '@renpy-ui/ui';
import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Field } from '../components/inspector/Field';
import { WidgetTree } from '../components/screens/WidgetTree';
import { type WidgetPath, defaultWidget } from '../components/screens/widgets';
import { EMPTY_SCREENS } from '../state/empty';
import { newEntityId, useProjectStore } from '../state/project';

const TEMPLATES: Array<{ value: ScreenTemplate; label: string; defaultSlots: string[] }> = [
  { value: 'say', label: 'Say (dialogue overlay)', defaultSlots: ['window'] },
  { value: 'choice', label: 'Choice menu', defaultSlots: ['vbox'] },
  { value: 'mainMenu', label: 'Main menu', defaultSlots: ['logo', 'menuButtons'] },
  { value: 'custom', label: 'Custom (raw screen language)', defaultSlots: [] },
];

function templateInfo(t: ScreenTemplate) {
  return TEMPLATES.find((x) => x.value === t) ?? TEMPLATES[3]!;
}

export function ScreensView() {
  const screens = useProjectStore(useShallow((s) => s.bundle?.screens ?? EMPTY_SCREENS));
  const upsertScreen = useProjectStore((s) => s.upsertScreen);
  const removeScreen = useProjectStore((s) => s.removeScreen);
  const [selectedId, setSelectedId] = useState<string | null>(screens[0]?.id ?? null);

  const selected = screens.find((s) => s.id === selectedId) ?? null;

  function createScreen() {
    const id = newEntityId('screen');
    const name = nextName(screens, 'screen');
    const screen: ScreenSpec = {
      specVersion: '1.0.0',
      id,
      name,
      template: 'custom',
      slots: {},
      raw: '',
    };
    upsertScreen(screen);
    setSelectedId(id);
  }

  return (
    <div className="grid grid-cols-[260px_1fr] gap-2 h-full">
      <Panel
        heading={`Screens (${screens.length})`}
        actions={
          <Button variant="primary" size="sm" onClick={createScreen}>
            + New
          </Button>
        }
      >
        <ul className="p-1.5 space-y-0.5">
          {screens.length === 0 && (
            <li className="px-2 py-1 text-xs text-fg-muted italic">No screens yet.</li>
          )}
          {screens.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => setSelectedId(s.id)}
                className={cn(
                  'w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-md',
                  selectedId === s.id
                    ? 'bg-bg-3 text-fg border-l-2 border-orange-500'
                    : 'text-fg-secondary hover:bg-bg-2 hover:text-fg',
                )}
              >
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: 'var(--node-screens)' }}
                />
                <span className="truncate text-sm">{s.name}</span>
                <span className="ml-auto text-[10px] font-mono text-fg-muted">{s.template}</span>
              </button>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel heading={selected ? `Screen · ${selected.name}` : 'Screen'} scrollable={false}>
        {selected ? (
          <ScreenEditor
            screen={selected}
            onChange={(s) => upsertScreen(s)}
            onDelete={() => {
              removeScreen(selected.id);
              setSelectedId(null);
            }}
          />
        ) : (
          <div className="p-4 text-sm text-fg-muted">
            Select a screen on the left, or create a new one.
          </div>
        )}
      </Panel>
    </div>
  );
}

function nextName(screens: readonly ScreenSpec[], prefix: string): string {
  let i = screens.length + 1;
  while (screens.some((s) => s.name === `${prefix}_${i}`)) i++;
  return `${prefix}_${i}`;
}

function ScreenEditor({
  screen,
  onChange,
  onDelete,
}: {
  screen: ScreenSpec;
  onChange: (s: ScreenSpec) => void;
  onDelete: () => void;
}) {
  const [activeSlot, setActiveSlot] = useState<string>(
    () => Object.keys(screen.slots)[0] ?? templateInfo(screen.template).defaultSlots[0] ?? 'window',
  );
  const [path, setPath] = useState<WidgetPath>([]);

  const update = (patch: Partial<ScreenSpec>) => onChange({ ...screen, ...patch });

  const slotKeys = Array.from(
    new Set([...templateInfo(screen.template).defaultSlots, ...Object.keys(screen.slots)]),
  );

  function setSlotWidget(slot: string, widget: ScreenWidget | null): void {
    const slots = { ...screen.slots };
    if (widget) slots[slot] = widget;
    else delete slots[slot];
    onChange({ ...screen, slots });
  }

  return (
    <div className="grid grid-rows-[auto_1fr] h-full min-h-0">
      <div className="border-b border-[color:var(--color-border)] p-3 grid grid-cols-3 gap-3">
        <Field label="Name" hint="Python identifier">
          <Input value={screen.name} onChange={(e) => update({ name: e.target.value })} />
        </Field>
        <Field label="Template">
          <Select
            value={screen.template}
            onChange={(e) => {
              const next = e.target.value as ScreenTemplate;
              // Clear `raw` when leaving custom; clear slots when entering custom.
              update({
                template: next,
                slots: next === 'custom' ? {} : screen.slots,
                raw: next === 'custom' ? (screen.raw ?? '') : undefined,
              });
            }}
            options={TEMPLATES.map((t) => ({ value: t.value, label: t.label }))}
          />
        </Field>
        <div className="flex items-end justify-end">
          <Button variant="danger" size="sm" onClick={onDelete}>
            Delete screen
          </Button>
        </div>
      </div>

      {screen.template === 'custom' ? (
        <CustomEditor raw={screen.raw ?? ''} onChange={(raw) => update({ raw })} />
      ) : (
        <SlotEditor
          screen={screen}
          slotKeys={slotKeys}
          activeSlot={activeSlot}
          onActiveSlotChange={(slot) => {
            setActiveSlot(slot);
            setPath([]);
          }}
          path={path}
          onPathChange={setPath}
          onSetSlotWidget={setSlotWidget}
        />
      )}
    </div>
  );
}

function CustomEditor({ raw, onChange }: { raw: string; onChange: (next: string) => void }) {
  return (
    <div className="p-3 min-h-0">
      <Field
        label="Raw screen body"
        hint="Indented one level under `screen <name>():` automatically."
      >
        <textarea
          className="w-full h-full min-h-[300px] px-3 py-2 rounded-md bg-bg-0 text-fg font-mono text-xs border border-[color:var(--color-border)] focus-visible:outline-none focus-visible:border-orange-500 focus-visible:shadow-[var(--shadow-focus-orange)] whitespace-pre"
          value={raw}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
        />
      </Field>
    </div>
  );
}

function SlotEditor({
  screen,
  slotKeys,
  activeSlot,
  onActiveSlotChange,
  path,
  onPathChange,
  onSetSlotWidget,
}: {
  screen: ScreenSpec;
  slotKeys: string[];
  activeSlot: string;
  onActiveSlotChange: (slot: string) => void;
  path: WidgetPath;
  onPathChange: (p: WidgetPath) => void;
  onSetSlotWidget: (slot: string, w: ScreenWidget | null) => void;
}) {
  const widget = screen.slots[activeSlot];
  return (
    <div className="grid grid-rows-[auto_1fr] min-h-0">
      <div className="px-3 pt-2 flex items-center gap-1 border-b border-[color:var(--color-border)] bg-bg-2">
        {slotKeys.map((slot) => {
          const present = Object.hasOwn(screen.slots, slot);
          const active = slot === activeSlot;
          return (
            <button
              key={slot}
              type="button"
              onClick={() => onActiveSlotChange(slot)}
              className={cn(
                'h-7 px-2.5 rounded-t-md text-xs font-medium border-b-2',
                active
                  ? 'bg-bg-1 text-fg border-orange-500'
                  : 'bg-bg-2 text-fg-secondary border-transparent hover:text-fg',
              )}
            >
              <span>{slot}</span>
              {present && <span className="ml-1 text-[10px] text-fg-muted">●</span>}
            </button>
          );
        })}
      </div>

      <div className="p-2 min-h-0 overflow-auto">
        {widget ? (
          <WidgetTree
            root={widget}
            selectedPath={path}
            onSelect={onPathChange}
            onChange={(next) => onSetSlotWidget(activeSlot, next)}
            onRemoveRoot={() => {
              onSetSlotWidget(activeSlot, null);
              onPathChange([]);
            }}
          />
        ) : (
          <div className="p-6 text-center space-y-3">
            <p className="text-sm text-fg-muted">
              The "{activeSlot}" slot is empty. The codegen will fall back to the template default.
            </p>
            <div className="flex justify-center gap-2">
              {(['frame', 'vbox', 'text'] as const).map((kind) => (
                <Button
                  key={kind}
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onSetSlotWidget(activeSlot, defaultWidget(kind));
                    onPathChange([]);
                  }}
                >
                  + {kind}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
