import type { Character, CharacterExpression } from '@renpy-ui/spec';
import { Button, IconButton, Input, Panel } from '@renpy-ui/ui';
import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { AssetPicker } from '../components/AssetPicker';
import { Field } from '../components/inspector/Field';
import { newEntityId, useProjectStore } from '../state/project';

/**
 * Characters tab. List on the left, editor on the right. Editing happens via
 * `upsertCharacter` so the store remains the single mutation entry point and
 * dirty tracking + undo work uniformly.
 */
export function CharactersView() {
  const characters = useProjectStore(useShallow((s) => s.bundle?.characters.characters ?? []));
  const [selectedId, setSelectedId] = useState<string | null>(characters[0]?.id ?? null);
  const upsertCharacter = useProjectStore((s) => s.upsertCharacter);
  const removeCharacter = useProjectStore((s) => s.removeCharacter);

  const selected = characters.find((c) => c.id === selectedId) ?? null;

  function createCharacter() {
    const id = newEntityId('char');
    const newChar: Character = {
      id,
      varName: defaultVarName(characters),
      displayName: 'New Character',
      color: '#FF7A1A',
      images: { tag: defaultVarName(characters), expressions: [] },
    };
    upsertCharacter(newChar);
    setSelectedId(id);
  }

  return (
    <div className="grid grid-cols-[260px_1fr] gap-2 h-full">
      <Panel
        heading={`Characters (${characters.length})`}
        actions={
          <Button variant="primary" size="sm" onClick={createCharacter}>
            + New
          </Button>
        }
      >
        <ul className="p-1.5 space-y-0.5">
          {characters.length === 0 && (
            <li className="px-2 py-1 text-xs text-fg-muted italic">No characters yet.</li>
          )}
          {characters.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setSelectedId(c.id)}
                className={[
                  'w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-md',
                  selectedId === c.id
                    ? 'bg-bg-3 text-fg border-l-2 border-orange-500'
                    : 'text-fg-secondary hover:bg-bg-2 hover:text-fg',
                ].join(' ')}
              >
                <span
                  className="inline-block w-3 h-3 rounded-full shrink-0"
                  style={{ background: c.color }}
                />
                <span className="truncate text-sm">{c.displayName}</span>
                <span className="ml-auto text-[10px] font-mono text-fg-muted">{c.varName}</span>
              </button>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel heading={selected ? `Character · ${selected.displayName}` : 'Character'}>
        {selected ? (
          <CharacterEditor
            character={selected}
            onChange={(c) => upsertCharacter(c)}
            onDelete={() => {
              removeCharacter(selected.id);
              setSelectedId(null);
            }}
          />
        ) : (
          <div className="p-4 text-sm text-fg-muted">
            Select a character on the left, or create a new one.
          </div>
        )}
      </Panel>
    </div>
  );
}

function defaultVarName(existing: Character[]): string {
  let i = existing.length + 1;
  while (existing.some((c) => c.varName === `character_${i}`)) i++;
  return `character_${i}`;
}

function CharacterEditor({
  character,
  onChange,
  onDelete,
}: {
  character: Character;
  onChange: (c: Character) => void;
  onDelete: () => void;
}) {
  const update = (patch: Partial<Character>) => onChange({ ...character, ...patch });

  function setExpressions(expressions: CharacterExpression[]) {
    onChange({ ...character, images: { ...character.images, expressions } });
  }

  return (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Display name">
          <Input
            value={character.displayName}
            onChange={(e) => update({ displayName: e.target.value })}
          />
        </Field>
        <Field label="Variable name" hint="Python identifier">
          <Input value={character.varName} onChange={(e) => update({ varName: e.target.value })} />
        </Field>
        <Field label="Image tag" hint="`show <tag>` in Ren'Py">
          <Input
            value={character.images.tag}
            onChange={(e) =>
              onChange({ ...character, images: { ...character.images, tag: e.target.value } })
            }
          />
        </Field>
        <Field label="Name color" hint="hex">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={character.color}
              onChange={(e) => update({ color: e.target.value })}
              className="w-9 h-9 rounded-md border border-[color:var(--color-border)] bg-bg-0 p-0"
              aria-label="Pick name color"
            />
            <Input value={character.color} onChange={(e) => update({ color: e.target.value })} />
          </div>
        </Field>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs uppercase tracking-wide text-fg-muted">Expressions</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setExpressions([
                ...character.images.expressions,
                { name: `expr_${character.images.expressions.length + 1}`, asset: '' },
              ])
            }
          >
            + Add
          </Button>
        </div>
        <ul className="space-y-2">
          {character.images.expressions.length === 0 && (
            <li className="px-1 py-2 text-xs text-fg-muted italic">No expressions defined.</li>
          )}
          {character.images.expressions.map((e, i) => (
            <li key={`${e.name}-${i}`} className="flex items-start gap-2">
              <Input
                className="w-32"
                value={e.name}
                onChange={(ev) =>
                  setExpressions(
                    character.images.expressions.map((x, idx) =>
                      idx === i ? { ...x, name: ev.target.value } : x,
                    ),
                  )
                }
              />
              <div className="flex-1">
                <AssetPicker
                  value={e.asset}
                  onChange={(ref) =>
                    setExpressions(
                      character.images.expressions.map((x, idx) =>
                        idx === i ? { ...x, asset: ref } : x,
                      ),
                    )
                  }
                  kind="image"
                  subkind="sprite"
                  placeholder={`images/${character.images.tag}/${e.name}.png`}
                />
              </div>
              <IconButton
                label="Remove expression"
                size="sm"
                onClick={() =>
                  setExpressions(character.images.expressions.filter((_, idx) => idx !== i))
                }
              >
                <span aria-hidden>×</span>
              </IconButton>
            </li>
          ))}
        </ul>
      </div>

      <div className="pt-2 border-t border-[color:var(--color-border)] flex justify-end">
        <Button variant="danger" size="sm" onClick={onDelete}>
          Delete character
        </Button>
      </div>
    </div>
  );
}
