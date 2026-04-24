import { Panel } from '@renpy-ui/ui';

const sections: Array<{ title: string; items: string[] }> = [
  { title: 'Scenes', items: ['(no scenes)'] },
  { title: 'Characters', items: ['(no characters)'] },
  { title: 'Variables', items: ['(no variables)'] },
  { title: 'Assets', items: ['(no assets)'] },
  { title: 'Screens', items: ['say (default)'] },
];

export function Sidebar() {
  return (
    <Panel heading="Project">
      <nav className="p-2 space-y-4">
        {sections.map((section) => (
          <div key={section.title}>
            <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-fg-muted">
              {section.title}
            </div>
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li
                  key={item}
                  className={[
                    'px-2 py-1 rounded-md text-sm text-fg-secondary',
                    'hover:bg-bg-2 hover:text-fg cursor-default select-none',
                  ].join(' ')}
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </Panel>
  );
}
