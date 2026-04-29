import type { SceneNode } from '@renpy-ui/spec';
import { Button, IconButton, Input, Select } from '@renpy-ui/ui';
import { useShallow } from 'zustand/react/shallow';
import { EMPTY_CHARACTERS, EMPTY_SCREENS, EMPTY_VARIABLES } from '../../state/empty';
import { newEntityId, useProjectStore } from '../../state/project';
import { labelFor } from '../../state/templates';
import { AssetPicker } from '../AssetPicker';
import { ExpressionBuilder } from '../ExpressionBuilder';
import { Field } from './Field';

interface NodeInspectorProps {
  node: SceneNode;
}

export function NodeInspector({ node }: NodeInspectorProps) {
  const updateNode = useProjectStore((s) => s.updateNode);

  const set = (patch: Partial<SceneNode>) => updateNode(node.id, patch);

  return (
    <div className="p-4 space-y-4">
      <header className="space-y-1">
        <div className="text-xs uppercase tracking-wide text-fg-muted">Node</div>
        <div className="text-md font-semibold">{labelFor(node.type)}</div>
        <div className="text-[10px] font-mono text-fg-muted">{node.id}</div>
      </header>

      <Field label="Comment" hint="rendered as `# comment`">
        <Input
          value={node.comment ?? ''}
          onChange={(e) => set({ comment: e.target.value || undefined } as Partial<SceneNode>)}
          placeholder="(optional)"
        />
      </Field>

      <NodeSpecificFields node={node} />
    </div>
  );
}

function NodeSpecificFields({ node }: { node: SceneNode }) {
  const updateNode = useProjectStore((s) => s.updateNode);
  const set = (patch: Partial<SceneNode>) => updateNode(node.id, patch);

  const characters = useProjectStore(
    useShallow((s) => s.bundle?.characters.characters ?? EMPTY_CHARACTERS),
  );
  const variables = useProjectStore(
    useShallow((s) => s.bundle?.variables.variables ?? EMPTY_VARIABLES),
  );
  const screens = useProjectStore(useShallow((s) => s.bundle?.screens ?? EMPTY_SCREENS));

  switch (node.type) {
    case 'start':
    case 'end':
    case 'return':
      return null;

    case 'label':
      return (
        <Field label="Name" hint="Python identifier">
          <Input value={node.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
      );

    case 'jump':
    case 'call':
      return (
        <Field label="Target label" hint="must exist somewhere in the project">
          <Input value={node.target} onChange={(e) => set({ target: e.target.value })} />
        </Field>
      );

    case 'say': {
      const sayChar = characters.find((c) => c.id === node.characterId);
      const sayExpressions = sayChar?.images.expressions ?? [];
      return (
        <>
          <Field label="Character">
            <Select
              value={node.characterId ?? ''}
              onChange={(e) =>
                set({ characterId: e.target.value || undefined } as Partial<SceneNode>)
              }
              options={[
                { value: '', label: 'Narrator' },
                ...characters.map((c) => ({ value: c.id, label: c.displayName })),
              ]}
            />
          </Field>
          <Field label="Expression" hint="optional">
            {sayExpressions.length > 0 ? (
              <Select
                value={node.expressionName ?? ''}
                onChange={(e) =>
                  set({
                    expressionName: e.target.value || undefined,
                  } as Partial<SceneNode>)
                }
                options={[
                  { value: '', label: '(none)' },
                  ...sayExpressions.map((e) => ({ value: e.name, label: e.name })),
                ]}
              />
            ) : (
              <Input
                value={node.expressionName ?? ''}
                onChange={(e) =>
                  set({
                    expressionName: e.target.value || undefined,
                  } as Partial<SceneNode>)
                }
                placeholder="happy, sad, ..."
              />
            )}
          </Field>
          <Field label="Text">
            <textarea
              className={[
                'w-full min-h-[80px] px-3 py-2 rounded-md bg-bg-0 text-fg',
                'border border-[color:var(--color-border)]',
                'hover:border-[color:var(--color-border-strong)]',
                'focus-visible:outline-none focus-visible:border-orange-500',
                'focus-visible:shadow-[var(--shadow-focus-orange)] font-serif',
              ].join(' ')}
              value={node.text}
              onChange={(e) => set({ text: e.target.value })}
            />
          </Field>
          <Field label="With transition" hint="optional">
            <Input
              value={node.withTransition ?? ''}
              onChange={(e) =>
                set({ withTransition: e.target.value || undefined } as Partial<SceneNode>)
              }
              placeholder="dissolve"
            />
          </Field>
          <Field label="Voice line" hint="optional">
            <AssetPicker
              value={node.voice ?? ''}
              onChange={(ref) => set({ voice: ref || undefined } as Partial<SceneNode>)}
              kind="audio"
              subkind="voice"
              placeholder="audio/voice/line_001.ogg"
            />
          </Field>
        </>
      );
    }

    case 'narration':
      return (
        <Field label="Text">
          <textarea
            className="w-full min-h-[80px] px-3 py-2 rounded-md bg-bg-0 text-fg border border-[color:var(--color-border)] focus-visible:outline-none focus-visible:border-orange-500 focus-visible:shadow-[var(--shadow-focus-orange)] font-serif"
            value={node.text}
            onChange={(e) => set({ text: e.target.value })}
          />
        </Field>
      );

    case 'pause':
      return (
        <Field label="Seconds" hint="leave blank for default">
          <Input
            type="number"
            step="0.1"
            value={node.seconds ?? ''}
            onChange={(e) =>
              set({
                seconds: e.target.value === '' ? undefined : Number(e.target.value),
              } as Partial<SceneNode>)
            }
          />
        </Field>
      );

    case 'menu':
      return (
        <div className="space-y-3">
          <Field label="Prompt" hint="optional">
            <Input
              value={node.prompt ?? ''}
              onChange={(e) => set({ prompt: e.target.value || undefined } as Partial<SceneNode>)}
            />
          </Field>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs uppercase tracking-wide text-fg-muted">Choices</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  updateNode(node.id, {
                    choices: [
                      ...node.choices,
                      { id: newEntityId('choice'), text: `Option ${node.choices.length + 1}` },
                    ],
                  } as Partial<SceneNode>)
                }
              >
                + Add
              </Button>
            </div>
            <ul className="space-y-2">
              {node.choices.map((choice, i) => (
                <li key={choice.id} className="flex items-start gap-2">
                  <span className="text-xs text-fg-muted mt-2 font-mono">{i + 1}.</span>
                  <div className="flex-1 space-y-1">
                    <Input
                      value={choice.text}
                      onChange={(e) =>
                        updateNode(node.id, {
                          choices: node.choices.map((c) =>
                            c.id === choice.id ? { ...c, text: e.target.value } : c,
                          ),
                        } as Partial<SceneNode>)
                      }
                      placeholder="Choice text"
                    />
                    <ExpressionBuilder
                      value={choice.condition ?? ''}
                      onChange={(next) =>
                        updateNode(node.id, {
                          choices: node.choices.map((c) =>
                            c.id === choice.id ? { ...c, condition: next || undefined } : c,
                          ),
                        } as Partial<SceneNode>)
                      }
                      placeholder="Condition (optional)"
                      allowEmpty
                    />
                  </div>
                  <IconButton
                    label="Remove choice"
                    size="sm"
                    onClick={() =>
                      updateNode(node.id, {
                        choices: node.choices.filter((c) => c.id !== choice.id),
                      } as Partial<SceneNode>)
                    }
                  >
                    <span aria-hidden>×</span>
                  </IconButton>
                </li>
              ))}
            </ul>
          </div>
        </div>
      );

    case 'sceneBg':
      return (
        <>
          <Field label="Background asset" hint="relative to game/">
            <AssetPicker
              value={node.background}
              onChange={(ref) => set({ background: ref })}
              kind="image"
              subkind="background"
              placeholder="images/bg/room.png"
            />
          </Field>
          <Field label="With transition" hint="optional">
            <Input
              value={node.withTransition ?? ''}
              onChange={(e) =>
                set({ withTransition: e.target.value || undefined } as Partial<SceneNode>)
              }
              placeholder="fade"
            />
          </Field>
        </>
      );

    case 'show': {
      const ch = characters.find((c) => c.id === node.characterId);
      const expressions = ch?.images.expressions ?? [];
      return (
        <>
          <Field label="Character">
            <Select
              value={node.characterId}
              onChange={(e) => set({ characterId: e.target.value })}
              options={[
                { value: '', label: '(select)' },
                ...characters.map((c) => ({ value: c.id, label: c.displayName })),
              ]}
            />
          </Field>
          <Field label="Expression" hint="optional">
            {expressions.length > 0 ? (
              <Select
                value={node.expressionName ?? ''}
                onChange={(e) =>
                  set({
                    expressionName: e.target.value || undefined,
                  } as Partial<SceneNode>)
                }
                options={[
                  { value: '', label: '(none)' },
                  ...expressions.map((e) => ({ value: e.name, label: e.name })),
                ]}
              />
            ) : (
              <Input
                value={node.expressionName ?? ''}
                onChange={(e) =>
                  set({
                    expressionName: e.target.value || undefined,
                  } as Partial<SceneNode>)
                }
                placeholder="happy, sad, ..."
              />
            )}
          </Field>
          <Field label="Position" hint="optional">
            <Select
              value={node.at ?? ''}
              onChange={(e) => set({ at: e.target.value || undefined } as Partial<SceneNode>)}
              options={[
                { value: '', label: '(default)' },
                { value: 'left', label: 'left' },
                { value: 'center', label: 'center' },
                { value: 'right', label: 'right' },
                { value: 'offscreen_left', label: 'offscreen left' },
                { value: 'offscreen_right', label: 'offscreen right' },
              ]}
            />
          </Field>
          <Field label="With transition" hint="optional">
            <Input
              value={node.withTransition ?? ''}
              onChange={(e) =>
                set({
                  withTransition: e.target.value || undefined,
                } as Partial<SceneNode>)
              }
              placeholder="dissolve"
            />
          </Field>
        </>
      );
    }

    case 'hide':
      return (
        <>
          <Field label="Character">
            <Select
              value={node.characterId}
              onChange={(e) => set({ characterId: e.target.value })}
              options={[
                { value: '', label: '(select)' },
                ...characters.map((c) => ({ value: c.id, label: c.displayName })),
              ]}
            />
          </Field>
          <Field label="With transition" hint="optional">
            <Input
              value={node.withTransition ?? ''}
              onChange={(e) =>
                set({
                  withTransition: e.target.value || undefined,
                } as Partial<SceneNode>)
              }
              placeholder="dissolve"
            />
          </Field>
        </>
      );

    case 'transition':
      return (
        <Field label="Name" hint="dissolve, fade, custom">
          <Input value={node.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
      );

    case 'camera':
      return (
        <Field label="Action">
          <Select
            value={node.action}
            onChange={(e) => set({ action: e.target.value as typeof node.action })}
            options={[
              { value: 'zoom', label: 'zoom' },
              { value: 'pan', label: 'pan' },
              { value: 'shake', label: 'shake' },
              { value: 'reset', label: 'reset' },
            ]}
          />
        </Field>
      );

    case 'playMusic':
      return (
        <Field label="Asset" hint="relative to game/">
          <AssetPicker
            value={node.asset}
            onChange={(ref) => set({ asset: ref })}
            kind="audio"
            subkind="music"
            placeholder="audio/music/calm.ogg"
          />
        </Field>
      );

    case 'playSound':
      return (
        <Field label="Asset" hint="relative to game/">
          <AssetPicker
            value={node.asset}
            onChange={(ref) => set({ asset: ref })}
            kind="audio"
            subkind="sfx"
            placeholder="audio/sfx/click.ogg"
          />
        </Field>
      );

    case 'playVoice':
      return (
        <Field label="Asset" hint="relative to game/">
          <AssetPicker
            value={node.asset}
            onChange={(ref) => set({ asset: ref })}
            kind="audio"
            subkind="voice"
            placeholder="audio/voice/line_001.ogg"
          />
        </Field>
      );

    case 'stopMusic':
      return (
        <Field label="Channel" hint="default: music">
          <Input
            value={node.channel ?? ''}
            onChange={(e) => set({ channel: e.target.value || undefined } as Partial<SceneNode>)}
          />
        </Field>
      );

    case 'queue':
      return (
        <>
          <Field label="Channel">
            <Input value={node.channel} onChange={(e) => set({ channel: e.target.value })} />
          </Field>
          <Field label="Asset">
            <AssetPicker value={node.asset} onChange={(ref) => set({ asset: ref })} kind="audio" />
          </Field>
        </>
      );

    case 'if':
      return (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase tracking-wide text-fg-muted">Branches</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                updateNode(node.id, {
                  branches: [...node.branches, { id: newEntityId('branch'), condition: 'True' }],
                } as Partial<SceneNode>)
              }
            >
              + Add
            </Button>
          </div>
          <ul className="space-y-3">
            {node.branches.map((branch, i) => (
              <li key={branch.id} className="flex items-start gap-2">
                <span className="text-xs text-fg-muted mt-2 font-mono w-8">
                  {i === 0 ? 'if' : branch.condition === '' ? 'else' : 'elif'}
                </span>
                <div className="flex-1">
                  <ExpressionBuilder
                    value={branch.condition}
                    onChange={(next) =>
                      updateNode(node.id, {
                        branches: node.branches.map((b) =>
                          b.id === branch.id ? { ...b, condition: next } : b,
                        ),
                      } as Partial<SceneNode>)
                    }
                    placeholder="Python expression (empty = else)"
                    allowEmpty
                  />
                </div>
                <IconButton
                  label="Remove branch"
                  size="sm"
                  onClick={() =>
                    updateNode(node.id, {
                      branches: node.branches.filter((b) => b.id !== branch.id),
                    } as Partial<SceneNode>)
                  }
                >
                  <span aria-hidden>×</span>
                </IconButton>
              </li>
            ))}
          </ul>
        </div>
      );

    case 'setVar':
      return (
        <>
          <Field label="Variable">
            <Select
              value={node.variable}
              onChange={(e) => set({ variable: e.target.value })}
              options={[
                { value: '', label: '(select)' },
                ...variables.map((v) => ({ value: v.name, label: v.name })),
              ]}
            />
          </Field>
          <Field label="Expression" hint="Python">
            <ExpressionBuilder
              value={node.expression}
              onChange={(next) => set({ expression: next })}
              placeholder="True, love_points + 1, ..."
            />
          </Field>
        </>
      );

    case 'increment':
      return (
        <>
          <Field label="Variable">
            <Select
              value={node.variable}
              onChange={(e) => set({ variable: e.target.value })}
              options={[
                { value: '', label: '(select)' },
                ...variables.map((v) => ({ value: v.name, label: v.name })),
              ]}
            />
          </Field>
          <Field label="Delta">
            <Input
              type="number"
              value={node.delta}
              onChange={(e) => set({ delta: Number(e.target.value) })}
            />
          </Field>
        </>
      );

    case 'python':
      return (
        <Field label="Code" hint="emitted inside `python:` block">
          <textarea
            className="w-full min-h-[120px] px-3 py-2 rounded-md bg-bg-0 text-fg font-mono text-xs border border-[color:var(--color-border)] focus-visible:outline-none focus-visible:border-orange-500 focus-visible:shadow-[var(--shadow-focus-orange)]"
            value={node.code}
            onChange={(e) => set({ code: e.target.value })}
            spellCheck={false}
          />
        </Field>
      );

    case 'inventoryOp':
      return (
        <>
          <Field label="Op">
            <Select
              value={node.op}
              onChange={(e) => set({ op: e.target.value as typeof node.op })}
              options={[
                { value: 'add', label: 'add' },
                { value: 'remove', label: 'remove' },
                { value: 'set', label: 'set' },
              ]}
            />
          </Field>
          <Field label="Item id">
            <Input value={node.itemId} onChange={(e) => set({ itemId: e.target.value })} />
          </Field>
          <Field label="Quantity">
            <Input
              type="number"
              value={node.quantity ?? 1}
              onChange={(e) => set({ quantity: Number(e.target.value) })}
            />
          </Field>
        </>
      );

    case 'statOp':
      return (
        <>
          <Field label="Stat">
            <Input value={node.stat} onChange={(e) => set({ stat: e.target.value })} />
          </Field>
          <Field label="Op">
            <Select
              value={node.op}
              onChange={(e) => set({ op: e.target.value as typeof node.op })}
              options={[
                { value: 'add', label: 'add' },
                { value: 'subtract', label: 'subtract' },
                { value: 'set', label: 'set' },
              ]}
            />
          </Field>
          <Field label="Value">
            <Input
              type="number"
              value={node.value}
              onChange={(e) => set({ value: Number(e.target.value) })}
            />
          </Field>
        </>
      );

    case 'relationshipOp':
      return (
        <>
          <Field label="Character">
            <Select
              value={node.characterId}
              onChange={(e) => set({ characterId: e.target.value })}
              options={[
                { value: '', label: '(select)' },
                ...characters.map((c) => ({ value: c.id, label: c.displayName })),
              ]}
            />
          </Field>
          <Field label="Track" hint="default: love">
            <Input
              value={node.track ?? ''}
              onChange={(e) => set({ track: e.target.value || undefined } as Partial<SceneNode>)}
            />
          </Field>
          <Field label="Op">
            <Select
              value={node.op}
              onChange={(e) => set({ op: e.target.value as typeof node.op })}
              options={[
                { value: 'add', label: 'add' },
                { value: 'subtract', label: 'subtract' },
                { value: 'set', label: 'set' },
              ]}
            />
          </Field>
          <Field label="Value">
            <Input
              type="number"
              value={node.value}
              onChange={(e) => set({ value: Number(e.target.value) })}
            />
          </Field>
        </>
      );

    case 'showScreen':
    case 'hideScreen':
    case 'callScreen':
      return (
        <Field label="Screen">
          <Select
            value={node.screenId}
            onChange={(e) => set({ screenId: e.target.value })}
            options={[
              { value: '', label: '(select)' },
              ...screens.map((sc) => ({ value: sc.id, label: sc.name })),
            ]}
          />
        </Field>
      );

    default: {
      const _exhaustive: never = node;
      return _exhaustive;
    }
  }
}
