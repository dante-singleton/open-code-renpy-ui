import { Panel } from '@renpy-ui/ui';
import { useShallow } from 'zustand/react/shallow';
import { EMPTY_ASSETS, EMPTY_CHARACTERS, EMPTY_SCENES, EMPTY_VARIABLES } from '../state/empty';
import { useProjectStore } from '../state/project';

export function Sidebar() {
  const { scenes, activeSceneId, characters, variables, assets } = useProjectStore(
    useShallow((s) => ({
      scenes: s.bundle?.scenes ?? EMPTY_SCENES,
      activeSceneId: s.activeSceneId,
      characters: s.bundle?.characters.characters ?? EMPTY_CHARACTERS,
      variables: s.bundle?.variables.variables ?? EMPTY_VARIABLES,
      assets: s.bundle?.assets.assets ?? EMPTY_ASSETS,
    })),
  );
  const setActiveScene = useProjectStore((s) => s.setActiveScene);

  return (
    <Panel heading="Project">
      <nav className="p-2 space-y-4">
        <Section title="Scenes" empty="(no scenes)">
          {scenes.map((s) => (
            <Item
              key={s.id}
              active={s.id === activeSceneId}
              onClick={() => setActiveScene(s.id)}
              label={s.title}
              hint={s.label}
            />
          ))}
        </Section>

        <Section title="Characters" empty="(no characters)">
          {characters.map((c) => (
            <Item key={c.id} label={c.displayName} hint={c.varName} />
          ))}
        </Section>

        <Section title="Variables" empty="(no variables)">
          {variables.map((v) => (
            <Item key={v.id} label={v.name} hint={v.kind} />
          ))}
        </Section>

        <Section title={`Assets (${assets.length})`} empty="(no assets)">
          {assets.slice(0, 20).map((a) => (
            <Item key={a.id} label={a.ref} hint={a.kind} />
          ))}
        </Section>
      </nav>
    </Panel>
  );
}

function Section({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode;
}) {
  const arr = (Array.isArray(children) ? children : [children]).filter(Boolean);
  return (
    <div>
      <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-fg-muted">
        {title}
      </div>
      {arr.length === 0 ? (
        <div className="px-2 py-1 text-xs text-fg-muted italic">{empty}</div>
      ) : (
        <ul className="space-y-0.5">{children}</ul>
      )}
    </div>
  );
}

function Item({
  label,
  hint,
  active,
  onClick,
}: {
  label: string;
  hint?: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={[
          'w-full text-left px-2 py-1 rounded-md text-sm flex items-center justify-between',
          active
            ? 'bg-bg-3 text-fg border-l-2 border-orange-500'
            : 'text-fg-secondary hover:bg-bg-2 hover:text-fg',
        ].join(' ')}
      >
        <span className="truncate">{label}</span>
        {hint && <span className="ml-2 text-[10px] text-fg-muted font-mono shrink-0">{hint}</span>}
      </button>
    </li>
  );
}
