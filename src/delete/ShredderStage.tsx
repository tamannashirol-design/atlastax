import { animate, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { documentArt } from '../documents/artwork'
import { spring } from '../lib/motion'
import { Shredder } from './Shredder'

// The shredding stage (MOTION-delete.md). The tax-form cards go into our shredder on their own, one after another,
// 450ms apart. Each: lift to just above the slot (soft), slide down behind the machine's lip (soft, 240ms later), and
// strips fall into the tray. Transform and opacity only. If `failed` turns true (the server said no), feeding stops and
// every card returns to its place. The sequence starts the next card only while the tab is visible.
// Reduced motion: no machine and no strips; the cards just fade out together (`fade`).
// Calls onDone() once the last strip has fallen. The page decides when "deleted" may be shown (server confirmation).
export type StageCard = { id: string; name: string }
const STAGGER_MS = 450
const FIRST_MS = 400
const FEED_AFTER_MS = 240
const STRIP_MS = 900
const STRIPS = 10
const COLORS = ['var(--color-primary)', 'var(--color-border-decorative)', 'var(--color-text)', 'var(--color-sage-100)']

const stripsFor = (n: number) =>
  Array.from({ length: STRIPS }, (_, i) => {
    const k = n * 13 + i * 7
    return { i, color: COLORS[(k + i) % COLORS.length], dx: ((k * 17) % 61) - 30, fall: 96 + ((k * 11) % 56), spin: ((k * 23) % 90) - 45, w: 3 + (k % 3), h: 14 + ((k * 5) % 12), delay: (i % 5) * 0.04 }
  })

function MiniCard({ card, still, refCb }: { card: StageCard; still?: boolean; refCb?: (el: HTMLLIElement | null) => void }) {
  const art = documentArt(card.id)
  return (
    <li ref={refCb} data-card={card.id} className={`relative flex h-24 w-20 flex-col items-center justify-center gap-1 rounded-md border border-border-decorative bg-surface p-2 text-center tablet:h-28 tablet:w-24 ${still ? '' : 'shadow-1'}`}>
      {art && <img src={art.src} srcSet={art.srcSet} sizes="40px" alt="" width={40} height={40} decoding="async" className="size-10 shrink-0 object-contain" />}
      <span className="text-small leading-5 [overflow-wrap:anywhere]">{card.name}</span>
    </li>
  )
}

export function ShredderStage({ cards, kept, failed, reduce, onDone }: { cards: StageCard[]; kept: StageCard[]; failed: boolean; reduce: boolean; onDone: () => void }) {
  const els = useRef(new Map<string, HTMLLIElement>())
  const slot = useRef<HTMLDivElement>(null)
  const [fed, setFed] = useState(0)
  const [bursts, setBursts] = useState<number[]>([])
  const [finished, setFinished] = useState(false)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  // Reduced motion: all cards fade out together
  useEffect(() => {
    if (!reduce) return
    const all = [...els.current.values()]
    if (failed) {
      all.forEach((el) => animate(el, { opacity: 1 }, spring.fade))
      return
    }
    all.forEach((el) => animate(el, { opacity: 0 }, spring.fade))
    const t = window.setTimeout(() => onDoneRef.current(), 160)
    return () => window.clearTimeout(t)
  }, [reduce, failed])

  // The shredding
  useEffect(() => {
    if (reduce || failed) return
    let stop = false
    const timers: number[] = []
    const wait = (ms: number) => new Promise<void>((res) => timers.push(window.setTimeout(res, ms)))
    let off = () => {}
    // Only start the next card while the tab can be seen; carry on from the same card when it's back
    const visible = () =>
      new Promise<void>((res) => {
        if (!document.hidden) return res()
        const h = () => {
          if (document.hidden) return
          document.removeEventListener('visibilitychange', h)
          res()
        }
        off = () => document.removeEventListener('visibilitychange', h)
        document.addEventListener('visibilitychange', h)
      })

    function shred(i: number) {
      const el = els.current.get(cards[i].id)
      const s = slot.current?.getBoundingClientRect()
      if (!el || !s) return
      const r = el.getBoundingClientRect()
      const h = r.height * 0.9
      const dx = s.left + s.width / 2 - (r.left + r.width / 2)
      const dy = s.top - 4 - h / 2 - (r.top + r.height / 2)
      el.style.zIndex = '5' // above the other cards, still below the machine
      animate(el, { x: dx, y: dy, scale: 0.9 }, spring.soft)
      window.setTimeout(() => {
        if (stop) return
        animate(el, { y: dy + h + 8 }, spring.soft)
        setBursts((b) => [...b, i])
        setFed(i + 1)
        window.setTimeout(() => !stop && (el.style.opacity = '0'), 400)
      }, FEED_AFTER_MS)
    }

    ;(async () => {
      await wait(FIRST_MS)
      for (let i = 0; i < cards.length; i++) {
        await visible()
        if (stop) return
        shred(i)
        await wait(STAGGER_MS)
      }
      await wait(FEED_AFTER_MS + 400 + 120 + STRIP_MS - STAGGER_MS)
      if (stop) return
      setFinished(true)
      onDoneRef.current()
    })()
    return () => {
      stop = true
      off()
      timers.forEach(window.clearTimeout)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one run per attempt (the page remounts the stage on Try again)
  }, [reduce, failed])

  // The server said no: every card goes back to its place
  useEffect(() => {
    if (reduce || !failed) return
    setBursts([])
    setFinished(false)
    for (const el of els.current.values()) {
      el.style.opacity = '1'
      animate(el, { x: 0, y: 0, scale: 1, opacity: 1 }, spring.soft).then(() => (el.style.zIndex = ''))
    }
  }, [reduce, failed])

  const total = cards.length
  const setRef = (id: string) => (el: HTMLLIElement | null) => {
    if (el) els.current.set(id, el)
    else els.current.delete(id)
  }

  return (
    <div className="flex w-full flex-col items-center gap-6">
      {total > 0 && (
        <ul className="relative z-0 flex flex-wrap justify-center gap-2" aria-label="Documents being deleted">
          {cards.map((c) => (
            <MiniCard key={c.id} card={c} refCb={setRef(c.id)} />
          ))}
        </ul>
      )}

      {total > 0 && !reduce && (
        <div className="relative z-10 flex flex-col items-center">
          <div ref={slot}>
            <Shredder finished={finished} reduce={reduce} />
          </div>
          {/* The tray: strips fall out of the underside and fade (decoration only) */}
          <div aria-hidden className="relative h-24 w-60">
            {!failed &&
              bursts.map((n) =>
                stripsFor(n).map((p) => (
                  <motion.span
                    key={`${n}-${p.i}`}
                    className="absolute top-0 left-1/2 block rounded-[1px]"
                    style={{ backgroundColor: p.color, width: p.w, height: p.h, opacity: 0, marginLeft: ((p.i - STRIPS / 2) * 12) / 1 }}
                    animate={{ y: [0, p.fall * 0.5, p.fall], x: [0, p.dx * 0.6, p.dx], rotate: [0, p.spin, p.spin * 1.6], opacity: [0, 1, 1, 0] }}
                    transition={{ duration: STRIP_MS / 1000, delay: 0.12 + p.delay, times: [0, 0.5, 1], ease: ['easeIn', 'easeIn'], opacity: { duration: STRIP_MS / 1000, delay: 0.12 + p.delay, times: [0, 0.05, 0.7, 1] } }}
                  />
                )),
              )}
          </div>
        </div>
      )}

      <p aria-hidden className="text-body text-text-muted tabular-nums">
        {failed ? '' : total > 0 && !reduce ? (fed >= total ? 'Deleting' : `Shredding ${Math.min(fed + 1, total)} of ${total}`) : 'Deleting'}
      </p>

      {kept.length > 0 && (
        <section aria-label="Staying" className="flex flex-col items-center gap-2">
          <p className="text-small text-text-muted">Staying</p>
          <ul className="flex flex-wrap justify-center gap-2">
            {kept.map((c) => (
              <MiniCard key={c.id} card={c} still />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
