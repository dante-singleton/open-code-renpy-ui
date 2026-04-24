import type { CharacterCatalog } from '@renpy-ui/spec';
import { generatedHeader } from '../utils/header';
import { BLANK, finalize, renPyString } from '../utils/render';

/**
 * Emit game/generated/characters.rpy:
 *
 *   define alice = Character("Alice", color="#FF7A1A")
 *   image alice happy = "images/alice/happy.png"
 *   image alice sad   = "images/alice/sad.png"
 */
export function emitCharacters(catalog: CharacterCatalog): string {
  const lines: string[] = [...generatedHeader('.renpy-ui/characters.json')];

  const sorted = [...catalog.characters].sort((a, b) =>
    a.varName < b.varName ? -1 : a.varName > b.varName ? 1 : 0,
  );

  for (const c of sorted) {
    const args: string[] = [renPyString(c.displayName), `color=${renPyString(c.color)}`];
    if (c.voiceTag) args.push(`voice_tag=${renPyString(c.voiceTag)}`);
    if (c.sayAttributes) {
      for (const [k, v] of Object.entries(c.sayAttributes).sort()) {
        args.push(`${k}=${renPyString(v)}`);
      }
    }
    lines.push(`define ${c.varName} = Character(${args.join(', ')})`);
  }

  lines.push(BLANK);

  for (const c of sorted) {
    const expressions = [...c.images.expressions].sort((a, b) =>
      a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
    );
    for (const e of expressions) {
      lines.push(`image ${c.images.tag} ${e.name} = ${renPyString(e.asset)}`);
    }
    if (c.images.poses) {
      const poses = [...c.images.poses].sort((a, b) =>
        a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
      );
      for (const p of poses) {
        lines.push(`image ${c.images.tag} ${p.name} = ${renPyString(p.asset)}`);
      }
    }
  }

  return finalize(lines);
}
