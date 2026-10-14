/** Stable public keys, shared by the editor, validation and public renderer. */
export const EXPERIENCE_ICONS = [
  { key: 'pen', label: 'Writing' },
  { key: 'nib', label: 'Nib testing' },
  { key: 'ink', label: 'Ink bottles' },
  { key: 'swatch', label: 'Ink swatching' },
  { key: 'paper', label: 'Paper' },
  { key: 'book', label: 'Journaling' },
  { key: 'tools', label: 'Repairs' },
  { key: 'gift', label: 'Gifts' },
  { key: 'workshop', label: 'Workshops' },
  { key: 'chat', label: 'Pen community' },
] as const;

export type ExperienceIcon = typeof EXPERIENCE_ICONS[number]['key'];
export const EXPERIENCE_ICON_KEYS = EXPERIENCE_ICONS.map(({key}) => key);
export const DEFAULT_EXPERIENCE_ICON: ExperienceIcon = 'pen';
