// Every foreground/background color pair the UI uses, and where.
// `npm run contrast` tests each one. When a component starts using a new
// combination, add it here, or the build won't know to check it.
//
//   text     = text or icons people must read    → needs 4.5:1
//   ui       = control borders, indicators, focus → needs 3:1
//   disabled = label on a disabled control        → needs 3:1 (our rule)

export type PairKind = 'text' | 'ui' | 'disabled'

export const thresholds: Record<PairKind, number> = { text: 4.5, ui: 3, disabled: 3 }

export type Pair = { fg: string; bg: string; kind: PairKind; use: string }

export const pairs: Pair[] = [
  // Text
  { fg: 'text', bg: 'background', kind: 'text', use: 'Titles, body text on the page' },
  { fg: 'text', bg: 'surface', kind: 'text', use: 'Tile labels, card text' },
  { fg: 'text', bg: 'sage-100', kind: 'text', use: 'Tile label while pressed' },
  { fg: 'text-muted', bg: 'background', kind: 'text', use: 'Helper text, step counter, upload status' },
  { fg: 'text-muted', bg: 'surface', kind: 'text', use: 'Tile descriptions' },
  { fg: 'text-muted', bg: 'sage-100', kind: 'text', use: 'Tile description while pressed' },
  { fg: 'on-primary', bg: 'primary', kind: 'text', use: 'Primary button label' },
  { fg: 'on-primary', bg: 'primary-pressed', kind: 'text', use: 'Primary button label, pressed' },
  { fg: 'text', bg: 'primary-tint', kind: 'text', use: 'Text on a primary-tint wash (upload drag-over)' },
  { fg: 'text-muted', bg: 'primary-tint', kind: 'text', use: 'Muted text on the upload drag-over tint' },
  { fg: 'success', bg: 'background', kind: 'text', use: 'Success message on the page (upload done)' },
  { fg: 'success', bg: 'surface', kind: 'text', use: 'Success message in a card' },
  { fg: 'error', bg: 'background', kind: 'text', use: 'Error message on the page (upload failed)' },
  { fg: 'error', bg: 'surface', kind: 'text', use: 'Error message in a card; "Remove" / "Remove file" labels' },
  { fg: 'error', bg: 'sage-100', kind: 'text', use: '"Remove" / "Remove file" label while pressed' },

  // UI components
  { fg: 'border-strong', bg: 'background', kind: 'ui', use: 'Unselected tile border vs page' },
  { fg: 'border-strong', bg: 'surface', kind: 'ui', use: 'Unselected tile border vs tile' },
  { fg: 'border-strong', bg: 'sage-100', kind: 'ui', use: 'Tile border while pressed' },
  { fg: 'text', bg: 'surface', kind: 'ui', use: 'Selected tile border + check; upload progress line vs zone' },
  { fg: 'text', bg: 'background', kind: 'ui', use: 'Selected tile border vs page, focus ring; upload progress line vs page' },
  { fg: 'text', bg: 'sage-100', kind: 'ui', use: 'Stepper: done-section check' },
  { fg: 'text', bg: 'border-decorative', kind: 'ui', use: 'Stepper: bar/connector fill vs track' },
  { fg: 'on-primary', bg: 'text', kind: 'ui', use: 'Income card: check on navy badge' },
  { fg: 'text', bg: 'primary-tint', kind: 'ui', use: 'Upload zone: navy border / progress line on drag tint' },
  { fg: 'success', bg: 'background', kind: 'ui', use: 'Upload zone: done border vs page' },
  { fg: 'success', bg: 'primary-tint', kind: 'ui', use: 'Upload: check on the folder front panel (bottom tone)' },
  { fg: 'success', bg: 'sage-100', kind: 'ui', use: 'Upload: check on the folder front panel (darker than its top tone)' },
  { fg: 'error', bg: 'background', kind: 'ui', use: 'Upload zone: error border vs page' },
  { fg: 'primary', bg: 'background', kind: 'ui', use: 'Primary button vs page' },
  { fg: 'primary-pressed', bg: 'background', kind: 'ui', use: 'Pressed primary button vs page' },

  // Disabled
  { fg: 'text-muted', bg: 'sage-100', kind: 'disabled', use: 'Disabled button label' },
]
