// Data shown on the style guide. Values mirror the tokens in src/index.css.
import {
  ArrowSquareOutIcon,
  CaretDownIcon,
  CaretLeftIcon,
  CheckIcon,
  CircleDashedIcon,
  ClockIcon,
  DownloadSimpleIcon,
  FileTextIcon,
  HouseIcon,
  MagnifyingGlassIcon,
  MinusCircleIcon,
  PlusIcon,
  TrashIcon,
  QuestionIcon,
  UploadSimpleIcon,
  UserIcon,
  WarningCircleIcon,
  XIcon,
  type Icon,
} from '@phosphor-icons/react'
import { TAX_YEAR } from '../config'

// Spacing scale in pt. Tailwind step = value / 4 (e.g. 16pt → p-4).
export const spacing = [4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80]

export type GridSpec = {
  device: string
  range: string
  example: number // width used for the diagram
  columns: number
  margin: number
  gutter: number
  maxContent?: number
}

export const grids: GridSpec[] = [
  { device: 'Phone', range: 'up to 599px', example: 390, columns: 4, margin: 16, gutter: 16 },
  { device: 'iPad', range: '600–1023px', example: 820, columns: 8, margin: 24, gutter: 24 },
  {
    device: 'Laptop',
    range: '1024px and up',
    example: 1280,
    columns: 12,
    margin: 32,
    gutter: 24,
    maxContent: 1120,
  },
]

export type TypeStyle = {
  name: string
  className: string
  size: number
  lineHeight: number
  use: string
  sample: string
}

// 4 sizes only. Each can be set in the display font (Fraunces) or UI font (Inter).
export const typeScale: TypeStyle[] = [
  { name: 'Display', className: 'text-display', size: 34, lineHeight: 40, use: 'Questions, screen titles', sample: 'What is your visa type?' },
  { name: 'Title', className: 'text-title', size: 22, lineHeight: 28, use: 'Section titles, answer codes', sample: `File for ${TAX_YEAR}` },
  { name: 'Body', className: 'text-body', size: 17, lineHeight: 24, use: 'Reading text, buttons, links', sample: 'These quick questions help us file your taxes accurately.' },
  { name: 'Small', className: 'text-small', size: 13, lineHeight: 20, use: 'Helpers, captions, descriptions', sample: 'To personalize the experience and show only visa-relevant forms' },
]

export const radii = [
  { name: 'sm', className: 'rounded-sm', value: 12, use: 'Buttons, inputs, list rows' },
  { name: 'md', className: 'rounded-md', value: 16, use: 'Cards, answer tiles' },
  { name: 'lg', className: 'rounded-lg', value: 24, use: 'Bottom sheets, large panels' },
]

export const shadows = [
  { name: 'Level 1', className: 'shadow-1', use: 'Resting cards, tiles' },
  { name: 'Level 2', className: 'shadow-2', use: 'Raised: tab bar, sticky bars' },
  { name: 'Level 3', className: 'shadow-3', use: 'Overlays: bottom sheets, menus' },
]

// Color roles, in display order. Hex values come from src/index.css.
export const palette: { group: string; roles: { name: string; use: string }[] }[] = [
  {
    group: 'Neutrals',
    roles: [
      { name: 'background', use: 'Page background' },
      { name: 'surface', use: 'Cards, tiles, sheets' },
      { name: 'sage-100', use: 'Quiet fills, pressed, disabled' },
      { name: 'border-decorative', use: 'Dividers only' },
      { name: 'border-strong', use: 'Control borders' },
      { name: 'text-muted', use: 'Helper text, captions' },
      { name: 'text', use: 'Main text, selected state' },
    ],
  },
  {
    group: 'Brand',
    roles: [
      { name: 'primary', use: 'One primary element per screen' },
      { name: 'primary-pressed', use: 'Primary while pressed' },
      { name: 'primary-tint', use: 'Light primary wash' },
      { name: 'on-primary', use: 'Text on primary' },
    ],
  },
  {
    group: 'Status',
    roles: [
      { name: 'success', use: 'Success messages' },
      { name: 'error', use: 'Error messages' },
    ],
  },
]

// Every icon in the app, and why it exists.
export const icons: { name: string; Icon: Icon; reason: string }[] = [
  { name: 'House', Icon: HouseIcon, reason: 'Home tab' },
  { name: 'FileText', Icon: FileTextIcon, reason: 'Documents tab' },
  { name: 'User', Icon: UserIcon, reason: 'Profile tab' },
  { name: 'CaretLeft', Icon: CaretLeftIcon, reason: 'Back on question screens' },
  { name: 'Question', Icon: QuestionIcon, reason: '"Not sure?" help links' },
  { name: 'Check', Icon: CheckIcon, reason: 'Selected answer, done section, uploaded doc, “Done” on the Reading pill' },
  { name: 'CaretDown', Icon: CaretDownIcon, reason: 'Opens a list: stepper sheet, dropdowns' },
  { name: 'UploadSimple', Icon: UploadSimpleIcon, reason: 'Upload a document' },
  { name: 'DownloadSimple', Icon: DownloadSimpleIcon, reason: 'Download a form or the checklist PDF' },
  { name: 'X', Icon: XIcon, reason: 'Close a bottom sheet' },
  { name: 'MagnifyingGlass', Icon: MagnifyingGlassIcon, reason: 'Search field (country)' },
  { name: 'CircleDashed', Icon: CircleDashedIcon, reason: 'Status: not added yet / details needed / not checked or skipped on Review (with text)' },
  { name: 'Clock', Icon: ClockIcon, reason: 'Status: “I’ll add it later” (with text)' },
  { name: 'MinusCircle', Icon: MinusCircleIcon, reason: 'Status: “I don’t have this” (with text)' },
  { name: 'WarningCircle', Icon: WarningCircleIcon, reason: 'Needs your attention (with text): a trip that doesn’t add up, past the student years, a document we couldn’t read (Reading page, Review), “Please check” on a detail' },
  { name: 'Plus', Icon: PlusIcon, reason: 'Add a trip' },
  { name: 'Trash', Icon: TrashIcon, reason: 'Delete a trip (button labelled for screen readers)' },
  { name: 'ArrowSquareOut', Icon: ArrowSquareOutIcon, reason: 'Link opens another website in a new tab (other ways to file)' },
]
