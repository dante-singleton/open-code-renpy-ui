import type { ScreenWidget } from '@renpy-ui/spec';

export type WidgetKind = ScreenWidget['kind'];

export const WIDGET_KINDS: WidgetKind[] = [
  'frame',
  'vbox',
  'hbox',
  'text',
  'image',
  'button',
  'bar',
];

export const CONTAINER_KINDS = new Set<WidgetKind>(['frame', 'vbox', 'hbox']);

export function isContainer(kind: WidgetKind): boolean {
  return CONTAINER_KINDS.has(kind);
}

export function defaultWidget(kind: WidgetKind): ScreenWidget {
  switch (kind) {
    case 'frame':
      return { kind, padding: 12, children: [] };
    case 'vbox':
      return { kind, spacing: 8, children: [] };
    case 'hbox':
      return { kind, spacing: 8, children: [] };
    case 'text':
      return { kind, text: 'Hello' };
    case 'image':
      return { kind, asset: '' };
    case 'button':
      return { kind, text: 'OK', action: 'Return()' };
    case 'bar':
      return { kind, value: '0', range: '100' };
  }
}

/**
 * Switch a widget to a new kind, preserving as much of the previous shape
 * as makes sense. Containers keep their children when switching to another
 * container; other transitions reset to the default shape.
 */
export function switchKind(prev: ScreenWidget, next: WidgetKind): ScreenWidget {
  if (prev.kind === next) return prev;
  if (isContainer(prev.kind) && isContainer(next)) {
    const children = (prev as { children: ScreenWidget[] }).children;
    if (next === 'frame') return { kind: 'frame', children, padding: 12 };
    if (next === 'vbox') return { kind: 'vbox', children, spacing: 8 };
    return { kind: 'hbox', children, spacing: 8 };
  }
  return defaultWidget(next);
}

/**
 * Path through a widget tree. Each entry is the index of the child within
 * its parent's `children` array. The first entry is the index within the
 * slot's root container (or `0` when the slot is a leaf widget).
 */
export type WidgetPath = number[];

/** Get the widget at `path` within `root`. Returns undefined if any step misses. */
export function widgetAt(root: ScreenWidget, path: WidgetPath): ScreenWidget | undefined {
  let cur: ScreenWidget = root;
  for (const idx of path) {
    if (!isContainer(cur.kind)) return undefined;
    const child = (cur as { children: ScreenWidget[] }).children[idx];
    if (!child) return undefined;
    cur = child;
  }
  return cur;
}

/** Replace the widget at `path` with `replacement`. Returns a new tree. */
export function replaceAt(
  root: ScreenWidget,
  path: WidgetPath,
  replacement: ScreenWidget,
): ScreenWidget {
  if (path.length === 0) return replacement;
  if (!isContainer(root.kind)) return root;
  const [head, ...rest] = path;
  const container = root as Extract<ScreenWidget, { children: ScreenWidget[] }>;
  const children = container.children.map((c, i) =>
    i === head ? replaceAt(c, rest, replacement) : c,
  );
  return { ...container, children };
}

/** Insert `widget` as the last child at `containerPath`. */
export function appendChild(
  root: ScreenWidget,
  containerPath: WidgetPath,
  widget: ScreenWidget,
): ScreenWidget {
  if (containerPath.length === 0) {
    if (!isContainer(root.kind)) return root;
    const container = root as Extract<ScreenWidget, { children: ScreenWidget[] }>;
    return { ...container, children: [...container.children, widget] };
  }
  return replaceAt(
    root,
    containerPath,
    appendChild(widgetAt(root, containerPath) as ScreenWidget, [], widget),
  );
}

/** Remove the widget at `path`. Returns the original tree if `path` is empty. */
export function removeAt(root: ScreenWidget, path: WidgetPath): ScreenWidget {
  if (path.length === 0) return root;
  if (!isContainer(root.kind)) return root;
  if (path.length === 1) {
    const container = root as Extract<ScreenWidget, { children: ScreenWidget[] }>;
    return {
      ...container,
      children: container.children.filter((_, i) => i !== path[0]),
    };
  }
  const [head, ...rest] = path;
  const container = root as Extract<ScreenWidget, { children: ScreenWidget[] }>;
  const children = container.children.map((c, i) => (i === head ? removeAt(c, rest) : c));
  return { ...container, children };
}

/** Move a widget within a container by index delta (-1 up, +1 down). */
export function moveSibling(root: ScreenWidget, path: WidgetPath, delta: number): ScreenWidget {
  if (path.length === 0) return root;
  const parentPath = path.slice(0, -1);
  const idx = path[path.length - 1] ?? 0;
  const parent = parentPath.length === 0 ? root : widgetAt(root, parentPath);
  if (!parent || !isContainer(parent.kind)) return root;
  const children = (parent as { children: ScreenWidget[] }).children.slice();
  const target = idx + delta;
  if (target < 0 || target >= children.length) return root;
  const item = children[idx];
  if (!item) return root;
  children.splice(idx, 1);
  children.splice(target, 0, item);
  const updated = { ...parent, children } as ScreenWidget;
  return replaceAt(root, parentPath, updated);
}
