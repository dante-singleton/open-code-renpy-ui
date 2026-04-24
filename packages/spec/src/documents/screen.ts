import { z } from 'zod';
import { AssetRef, Expression, Id, RenPyIdentifier, SpecVersionLiteral } from '../primitives';

/** See SPEC.md §9. */
const WidgetCommon = {
  style: z.string().optional(),
};

export const ScreenWidget: z.ZodType<ScreenWidget> = z.lazy(() =>
  z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('frame'),
      background: z.string().optional(),
      padding: z.number().optional(),
      children: z.array(ScreenWidget),
      ...WidgetCommon,
    }),
    z.object({
      kind: z.literal('vbox'),
      spacing: z.number().optional(),
      children: z.array(ScreenWidget),
      ...WidgetCommon,
    }),
    z.object({
      kind: z.literal('hbox'),
      spacing: z.number().optional(),
      children: z.array(ScreenWidget),
      ...WidgetCommon,
    }),
    z.object({
      kind: z.literal('text'),
      text: z.string(),
      size: z.number().optional(),
      color: z.string().optional(),
      ...WidgetCommon,
    }),
    z.object({
      kind: z.literal('image'),
      asset: AssetRef,
      xalign: z.number().optional(),
      yalign: z.number().optional(),
      ...WidgetCommon,
    }),
    z.object({
      kind: z.literal('button'),
      text: z.string(),
      action: Expression,
      ...WidgetCommon,
    }),
    z.object({
      kind: z.literal('bar'),
      value: Expression,
      range: Expression,
      ...WidgetCommon,
    }),
  ]),
);

export type ScreenWidget =
  | {
      kind: 'frame';
      background?: string;
      padding?: number;
      children: ScreenWidget[];
      style?: string;
    }
  | { kind: 'vbox'; spacing?: number; children: ScreenWidget[]; style?: string }
  | { kind: 'hbox'; spacing?: number; children: ScreenWidget[]; style?: string }
  | { kind: 'text'; text: string; size?: number; color?: string; style?: string }
  | { kind: 'image'; asset: string; xalign?: number; yalign?: number; style?: string }
  | { kind: 'button'; text: string; action: string; style?: string }
  | { kind: 'bar'; value: string; range: string; style?: string };

export const ScreenTemplate = z.enum(['say', 'choice', 'mainMenu', 'custom']);
export type ScreenTemplate = z.infer<typeof ScreenTemplate>;

export const ScreenSpec = z.object({
  specVersion: SpecVersionLiteral,
  id: Id,
  name: RenPyIdentifier,
  template: ScreenTemplate,
  parameters: z
    .array(
      z.object({
        name: RenPyIdentifier,
        default: z.string().optional(),
      }),
    )
    .optional(),
  slots: z.record(z.string(), ScreenWidget).default({}),
  /** Only meaningful for template === "custom". */
  raw: z.string().optional(),
});
export type ScreenSpec = z.infer<typeof ScreenSpec>;
