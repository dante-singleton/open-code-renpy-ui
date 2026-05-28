import type { ScreenSpec, ScreenWidget } from '@renpy-ui/spec';
import { generatedHeader } from '../utils/header';
import { BLANK, finalize, indent, renPyString } from '../utils/render';

/**
 * Emit a single Ren'Py screen file (`game/generated/screens/<name>.rpy`).
 *
 * The mapping is straightforward for `custom` templates (we hand the user's
 * raw block straight through after a header). For the built-in templates,
 * we generate a stable wrapper that hosts user-provided widget slots. This
 * keeps the user free of Ren'Py screen-language minutiae for the common
 * cases (say / choice / mainMenu) while still letting them drop into a
 * fully custom screen when they need one.
 */
export function emitScreen(screen: ScreenSpec): string {
  const lines: string[] = [...generatedHeader(`.renpy-ui/screens/${screen.name}.json`)];

  if (screen.template === 'custom') {
    emitCustomScreen(screen, lines);
  } else {
    emitTemplateScreen(screen, lines);
  }

  return finalize(lines);
}

function emitCustomScreen(screen: ScreenSpec, lines: string[]): void {
  // For custom screens we still emit a `screen <name>(<params>):` header so
  // the user can rely on consistent argument ordering. The raw body is
  // indented one level under the header.
  lines.push(`screen ${screen.name}${formatParams(screen)}:`);
  if (!screen.raw || screen.raw.trim() === '') {
    lines.push(indent(1, 'pass'));
    return;
  }
  for (const line of screen.raw.split('\n')) {
    if (line === '') lines.push('');
    else lines.push(indent(1, line));
  }
}

function emitTemplateScreen(screen: ScreenSpec, lines: string[]): void {
  const params = formatParams(screen);

  switch (screen.template) {
    case 'say':
      // `screen say(who, what):` is Ren'Py's standard signature; we always
      // emit those two parameters first, then forward any user-declared
      // extras, so the dialogue runtime keeps working.
      lines.push(`screen ${screen.name}(who, what${appendUserParams(screen)}):`);
      lines.push(indent(1, 'style_prefix "say"'));
      lines.push(BLANK);
      emitSlotOrDefault(screen, 'window', 1, lines, defaultSayWindow);
      break;

    case 'choice':
      lines.push(`screen ${screen.name}(items${appendUserParams(screen)}):`);
      lines.push(indent(1, 'style_prefix "choice"'));
      lines.push(BLANK);
      emitSlotOrDefault(screen, 'vbox', 1, lines, defaultChoiceVbox);
      break;

    case 'mainMenu':
      lines.push(`screen ${screen.name}${params}:`);
      lines.push(indent(1, 'tag menu'));
      lines.push(BLANK);
      emitSlotOrDefault(screen, 'background', 1, lines, defaultMainMenuBackground);
      emitSlotOrDefault(screen, 'logo', 1, lines, defaultMainMenuLogo);
      emitSlotOrDefault(screen, 'menuButtons', 1, lines, defaultMainMenuButtons);
      break;
  }
}

function emitSlotOrDefault(
  screen: ScreenSpec,
  slotName: string,
  level: number,
  lines: string[],
  fallback: (level: number, lines: string[]) => void,
): void {
  const widget = screen.slots[slotName];
  if (widget) {
    emitWidget(widget, level, lines);
  } else {
    fallback(level, lines);
  }
}

function formatParams(screen: ScreenSpec): string {
  if (!screen.parameters || screen.parameters.length === 0) return '()';
  const parts = screen.parameters.map((p) =>
    p.default !== undefined ? `${p.name}=${p.default}` : p.name,
  );
  return `(${parts.join(', ')})`;
}

function appendUserParams(screen: ScreenSpec): string {
  if (!screen.parameters || screen.parameters.length === 0) return '';
  const parts = screen.parameters.map((p) =>
    p.default !== undefined ? `${p.name}=${p.default}` : p.name,
  );
  return `, ${parts.join(', ')}`;
}

// ---------- widget emission ----------

/**
 * Emit a single widget at `level`. Containers (frame/vbox/hbox) recurse
 * into their children one level deeper; leaf widgets emit a single line
 * and any keyword properties via continuation.
 */
function emitWidget(widget: ScreenWidget, level: number, lines: string[]): void {
  switch (widget.kind) {
    case 'frame': {
      lines.push(indent(level, 'frame:'));
      if (widget.background) {
        lines.push(indent(level + 1, `background ${renPyString(widget.background)}`));
      }
      if (widget.padding != null) {
        lines.push(indent(level + 1, `padding (${widget.padding}, ${widget.padding})`));
      }
      if (widget.style) lines.push(indent(level + 1, `style ${renPyString(widget.style)}`));
      if (widget.children.length === 0) {
        lines.push(indent(level + 1, 'null'));
      } else {
        for (const child of widget.children) emitWidget(child, level + 1, lines);
      }
      break;
    }
    case 'vbox':
    case 'hbox': {
      lines.push(indent(level, `${widget.kind}:`));
      if (widget.spacing != null) {
        lines.push(indent(level + 1, `spacing ${widget.spacing}`));
      }
      if (widget.style) lines.push(indent(level + 1, `style ${renPyString(widget.style)}`));
      if (widget.children.length === 0) {
        lines.push(indent(level + 1, 'null'));
      } else {
        for (const child of widget.children) emitWidget(child, level + 1, lines);
      }
      break;
    }
    case 'text': {
      lines.push(indent(level, `text ${renPyString(widget.text)}`));
      if (widget.size != null) lines.push(indent(level + 1, `size ${widget.size}`));
      if (widget.color) lines.push(indent(level + 1, `color ${renPyString(widget.color)}`));
      if (widget.style) lines.push(indent(level + 1, `style ${renPyString(widget.style)}`));
      break;
    }
    case 'image': {
      lines.push(indent(level, `add ${renPyString(widget.asset)}`));
      if (widget.xalign != null) lines.push(indent(level + 1, `xalign ${widget.xalign}`));
      if (widget.yalign != null) lines.push(indent(level + 1, `yalign ${widget.yalign}`));
      break;
    }
    case 'button': {
      lines.push(indent(level, `textbutton ${renPyString(widget.text)}:`));
      lines.push(indent(level + 1, `action ${widget.action}`));
      if (widget.style) lines.push(indent(level + 1, `style ${renPyString(widget.style)}`));
      break;
    }
    case 'bar': {
      lines.push(indent(level, 'bar:'));
      lines.push(indent(level + 1, `value ${widget.value}`));
      lines.push(indent(level + 1, `range ${widget.range}`));
      if (widget.style) lines.push(indent(level + 1, `style ${renPyString(widget.style)}`));
      break;
    }
    default: {
      // Exhaustiveness guard: TS will flag this branch if a new widget kind
      // is added without a matching case above. We can't `return` because
      // the function is `void`, so we just throw — unreachable in practice.
      const _exhaustive: never = widget;
      throw new Error(`unreachable widget kind: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

// ---------- defaults ----------

function defaultSayWindow(level: number, lines: string[]): void {
  lines.push(indent(level, 'window:'));
  lines.push(indent(level + 1, 'id "window"'));
  lines.push(BLANK);
  lines.push(indent(level + 1, 'if who is not None:'));
  lines.push(indent(level + 2, 'window:'));
  lines.push(indent(level + 3, 'id "namebox"'));
  lines.push(indent(level + 3, 'style "namebox"'));
  lines.push(indent(level + 3, 'text who id "who"'));
  lines.push(BLANK);
  lines.push(indent(level + 1, 'text what id "what"'));
}

function defaultChoiceVbox(level: number, lines: string[]): void {
  lines.push(indent(level, 'vbox:'));
  lines.push(indent(level + 1, 'for i in items:'));
  lines.push(indent(level + 2, 'textbutton i.caption:'));
  lines.push(indent(level + 3, 'action i.action'));
}

function defaultMainMenuBackground(_level: number, _lines: string[]): void {
  // Intentionally blank by default; users can drop a frame/image into the
  // "background" slot when they want a backdrop.
}

function defaultMainMenuLogo(level: number, lines: string[]): void {
  lines.push(indent(level, 'text "Untitled"'));
  lines.push(indent(level + 1, 'size 60'));
  lines.push(indent(level + 1, 'xalign 0.5'));
  lines.push(indent(level + 1, 'yalign 0.2'));
}

function defaultMainMenuButtons(level: number, lines: string[]): void {
  lines.push(indent(level, 'vbox:'));
  lines.push(indent(level + 1, 'xalign 0.5'));
  lines.push(indent(level + 1, 'yalign 0.6'));
  lines.push(indent(level + 1, 'spacing 8'));
  lines.push(BLANK);
  lines.push(indent(level + 1, 'textbutton _("Start"):'));
  lines.push(indent(level + 2, 'action Start()'));
  lines.push(indent(level + 1, 'textbutton _("Load"):'));
  lines.push(indent(level + 2, 'action ShowMenu("load")'));
  lines.push(indent(level + 1, 'textbutton _("Quit"):'));
  lines.push(indent(level + 2, 'action Quit(confirm=False)'));
}
