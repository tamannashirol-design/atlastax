import { createContext } from 'react'
import type { FlowPosition } from '../flow/sections'

/** Lets a demo inside LaptopPreview move the preview's stepper rail (scene 1 goes from visa type to years). */
export const PreviewContext = createContext<{ setPosition: (p: FlowPosition) => void } | null>(null)
