import { motion } from 'framer-motion'

// Temporary placeholder: confirms React, Tailwind and Framer Motion work.
// Not a design. Gets replaced in the next step.
export default function App() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="text-lg"
      >
        AtlasTax setup works.
      </motion.p>
    </main>
  )
}
