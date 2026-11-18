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
const STRIP_MS = 1900 // the slowest strip: its delay plus its fall
const STRIPS = 16
const COLORS = ['var(--color-primary)', 'var(--color-border-decorative)', 'var(--color-text)', 'var(--color-sage-100)']

// Paper doesn't fall evenly: every strip gets its own width, length, start, speed, sway and spin. Fixed numbers (a seeded
// sequence), so it looks the same every time, but no two strips match.
const rnd = (k: number) => {
  const x = Math.sin(k * 12.9898 + 78.233) * 43758.5453
  return x - Math.floor(x)
}
const stripsFor = (n: number) =>
  Array.from({ length: STRIPS }, (_, i) => {
    const k = n * 31 + i * 7 + 1
    const sway = 10 + rnd(k + 1) * 26
    const dir = rnd(k + 2) < 0.5 ? -1 : 1
    return {
      i,
      color: COLORS[Math.floor(rnd(k + 3) * COLORS.length)],
      w: 2 + Math.round(rnd(k + 4) * 4), // 2 to 6 wide
      h: 10 + Math.round(rnd(k + 5) * 24), // 10 to 34 long
      fall: 150 + rnd(k + 6) * 90, // 150 to 240 down
      sway: [0, dir * sway, -dir * sway * 0.6, dir * sway * 0.9],
      spin: [0, dir * (30 + rnd(k + 7) * 80), -dir * (20 + rnd(k + 8) * 70), dir * (60 + rnd(k + 9) * 140)],
      curl: 0.55 + rnd(k + 10) * 0.35, // how flat it turns as it tumbles (transform only)
      dur: 1.1 + rnd(k + 11) * 0.5, // 1.1 to 1.6s
      delay: 0.12 + rnd(k + 12) * 0.3, // they don't all let go at once
      offset: (rnd(k + 13) - 0.5) * 150, // where along the slot
    }
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
      await wait(FEED_AFTER_MS + STRIP_MS - STAGGER_MS)
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
          <div aria-hidden className="relative h-48 w-60">
            {!failed &&
              bursts.map((n) =>
                stripsFor(n).map((p) => (
                  <motion.span
                    key={`${n}-${p.i}`}
                    className="absolute top-0 left-1/2 block rounded-[1px]"
                    style={{ backgroundColor: p.color, width: p.w, height: p.h, opacity: 0, marginLeft: p.offset }}
                    animate={{
                      y: [0, p.fall * 0.2, p.fall * 0.5, p.fall],
                      x: p.sway,
                      rotate: p.spin,
                      scaleX: [1, p.curl, 1, p.curl],
                      opacity: [0, 1, 1, 1, 0],
                    }}
                    transition={{
                      duration: p.dur,
                      delay: p.delay,
                      times: [0, 0.3, 0.6, 1],
                      y: { duration: p.dur, delay: p.delay, times: [0, 0.3, 0.6, 1], ease: ['easeIn', 'linear', 'easeIn'] }, // speeds up as it drops
                      x: { duration: p.dur, delay: p.delay, times: [0, 0.3, 0.6, 1], ease: 'easeInOut' },
                      rotate: { duration: p.dur, delay: p.delay, times: [0, 0.3, 0.6, 1], ease: 'easeInOut' },
                      opacity: { duration: p.dur, delay: p.delay, times: [0, 0.04, 0.55, 0.8, 1] }, // visible for most of the fall, fades only near the end
                    }}
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
