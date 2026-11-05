import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from 'react';
import type { Project } from '../data/project';
import { smoothDamp } from '../globe/GlobeController';
import { LoadedImage } from './LoadedImage';

export type StripAxis = 'x' | 'y';

/** Cards per second at the fastest point between two cards; with the dwell below, about 8 s per project. */
const DRIFT_SPEED = 0.28;
/** Share of that speed kept while a card passes the centre, so each project lingers without stopping. */
const DRIFT_DWELL = 0.2;
/** After a scroll, drag, click or arrow press, the drift waits this long before carrying on. */
const RESUME_AFTER_SECONDS = 6;
const SETTLE_SECONDS = 0.42;
const WHEEL_SETTLE_SECONDS = 0.16;
const DRAG_THRESHOLD_PX = 6;
const FLING_SECONDS = 0.28;
const CARD_GAP_PX = 18;
/** The cards' shape, width over height: landscape, like the projects' photos. */
const CARD_ASPECT = 3 / 2;
/** Cards away from the centre shrink to this scale. */
const SIDE_SCALE = 0.8;

const mod = (value: number, length: number) => ((value % length) + length) % length;

interface Drag {
  pointerId: number;
  start: number;
  last: number;
  lastTime: number;
  startOffset: number;
  velocity: number;
  moved: boolean;
}

interface Motion {
  /** Position along the strip in cards; the card at `round(offset)` is in the centre. */
  offset: number;
  velocity: number;
  target: number | null;
  pausedUntil: number;
  wheelAt: number;
  hover: boolean;
  drag: Drag | null;
  /** The index last reported to the parent, so external changes can be told apart from our own. */
  reported: number;
  suppressClick: boolean;
}

interface Metrics {
  pitch: number;
  /** Cards rendered on each side of the centre. */
  reach: number;
}

interface ProjectStripProps {
  projects: Project[];
  activeIndex: number;
  axis: StripAxis;
  /** Whether the strip may move on its own. */
  drifting: boolean;
  /** False while the strip is hidden; all work stops. */
  running: boolean;
  reducedMotion: boolean;
  onActiveChange: (index: number) => void;
  onOpen: (index: number) => void;
}

const nowSeconds = () => performance.now() / 1000;

/**
 * An endless strip of project images. It drifts slowly on its own, so new
 * projects arrive from the top (or the left on narrow screens), and it can be
 * scrolled, dragged or flung. The card passing the centre is the current
 * project. Motion is written straight to the DOM each frame; React only
 * re-renders when a new card needs to be mounted. The frame loop sleeps while
 * nothing moves (paused, hovered, or waiting to resume) and is woken by
 * whatever could move it again.
 */
export function ProjectStrip({
  projects,
  activeIndex,
  axis,
  drifting,
  running,
  reducedMotion,
  onActiveChange,
  onOpen,
}: ProjectStripProps) {
  const count = projects.length;
  const stripRef = useRef<HTMLDivElement>(null);
  const slots = useRef(new Map<number, HTMLButtonElement>());
  const motion = useRef<Motion>({
    offset: activeIndex,
    velocity: 0,
    target: null,
    pausedUntil: 0,
    wheelAt: -Infinity,
    hover: false,
    drag: null,
    reported: activeIndex,
    suppressClick: false,
  });
  const [base, setBase] = useState(activeIndex);
  const [metrics, setMetrics] = useState<Metrics>({ pitch: 1, reach: 2 });
  // The frame loop reads the latest props through this, so it never restarts for a prop change.
  const live = useRef({ drifting, reducedMotion, axis, metrics, onActiveChange, count });
  /** Restarts the sleeping frame loop; a no-op while it runs or while the strip is hidden. */
  const wake = useRef(() => {});

  useLayoutEffect(() => {
    live.current = { drifting, reducedMotion, axis, metrics, onActiveChange, count };
    // A new card, a new size or a change of props may all need the loop: new cards stay hidden until it places them.
    wake.current();
  });

  // Card size follows the strip's width (or height when horizontal); the spacing follows the card.
  useLayoutEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const measure = () => {
      const across = axis === 'y' ? strip.clientWidth : strip.clientHeight;
      const along = axis === 'y' ? strip.clientHeight : strip.clientWidth;
      const cardLength = axis === 'y' ? across / CARD_ASPECT : across * CARD_ASPECT;
      strip.style.setProperty('--card-w', `${axis === 'y' ? across : cardLength}px`);
      strip.style.setProperty('--card-h', `${axis === 'y' ? cardLength : across}px`);
      const pitch = cardLength * ((1 + SIDE_SCALE) / 2) + CARD_GAP_PX;
      setMetrics({ pitch, reach: Math.ceil(along / 2 / pitch) + 1 });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(strip);
    return () => observer.disconnect();
  }, [axis]);

  // A project chosen elsewhere (arrows, keys, the globe): glide the strip to the nearest copy of it.
  useEffect(() => {
    const m = motion.current;
    if (activeIndex === m.reported) return;
    m.reported = activeIndex;
    const current = Math.round(m.offset);
    let delta = mod(activeIndex - current, count);
    if (delta > count / 2) delta -= count;
    const goal = current + delta;
    m.pausedUntil = nowSeconds() + RESUME_AFTER_SECONDS;
    if (!running || reducedMotion) {
      m.offset = goal;
      m.target = null;
      m.velocity = 0;
    } else {
      m.target = goal;
    }
    wake.current();
  }, [activeIndex, count, running, reducedMotion]);

  // Coming back from a project, give the visitor a moment before the strip moves on. On first load it moves straight away.
  const wasRunning = useRef(running);
  useEffect(() => {
    if (running && !wasRunning.current) motion.current.pausedUntil = nowSeconds() + RESUME_AFTER_SECONDS;
    wasRunning.current = running;
  }, [running]);

  useEffect(() => {
    if (!running) return;
    let frame = 0;
    let timer = 0;
    let last = nowSeconds();
    let shownBase = Math.floor(motion.current.offset);

    const tick = () => {
      frame = 0;
      const now = nowSeconds();
      const dt = Math.min(0.05, now - last);
      last = now;
      const m = motion.current;
      const { drifting: mayDrift, reducedMotion: reduced, axis: direction, metrics: size, count: total } = live.current;
      let moving = true;

      if (m.drag?.moved) {
        // The pointer handlers move the strip directly.
      } else if (m.target !== null) {
        if (reduced) {
          m.offset = m.target;
          m.velocity = 0;
        } else {
          const next = smoothDamp(m.offset, m.target, m.velocity, SETTLE_SECONDS, dt);
          m.offset = next.value;
          m.velocity = next.velocity;
        }
        if (Math.abs(m.target - m.offset) < 1e-3 && Math.abs(m.velocity) < 1e-3) {
          m.offset = m.target;
          m.velocity = 0;
          m.target = null;
        }
      } else if (now - m.wheelAt < WHEEL_SETTLE_SECONDS) {
        // Still scrolling; settle once the wheel goes quiet.
      } else if (mayDrift && !m.hover && !m.drag && now >= m.pausedUntil) {
        const between = Math.sin(Math.PI * (m.offset - Math.floor(m.offset)));
        m.offset += DRIFT_SPEED * (DRIFT_DWELL + (1 - DRIFT_DWELL) * between * between) * dt;
      } else if (!m.drag && Math.abs(m.offset - Math.round(m.offset)) > 1e-3) {
        m.target = Math.round(m.offset);
      } else {
        moving = false;
      }

      const centre = Math.round(m.offset);
      for (const [slot, element] of slots.current) {
        const distance = m.offset - slot;
        const away = Math.min(1, Math.abs(distance));
        const shift = (distance * size.pitch).toFixed(1);
        const scale = (1 - (1 - SIDE_SCALE) * away).toFixed(4);
        const along = direction === 'y' ? `0, ${shift}px` : `${shift}px, 0`;
        element.style.transform = `translate(-50%, -50%) translate3d(${along}, 0) scale(${scale})`;
        element.style.opacity = Math.max(0.12, 1 - 0.5 * away - 0.28 * Math.max(0, Math.abs(distance) - 1)).toFixed(3);
        element.style.zIndex = String(100 - Math.round(Math.abs(distance) * 10));
        const isCentre = slot === centre;
        if ((element.dataset.current === 'true') !== isCentre) element.dataset.current = String(isCentre);
      }

      const index = mod(centre, total);
      if (index !== m.reported) {
        m.reported = index;
        live.current.onActiveChange(index);
      }
      const nextBase = Math.floor(m.offset);
      if (nextBase !== shownBase) {
        shownBase = nextBase;
        setBase(nextBase);
      }

      if (moving) frame = requestAnimationFrame(tick);
      // Only the pause after a scroll, drag or click is left: sleep until it ends.
      else if (mayDrift && !m.hover && !m.drag) timer = window.setTimeout(wake.current, (m.pausedUntil - now) * 1000);
    };

    wake.current = () => {
      window.clearTimeout(timer);
      if (frame) return;
      last = nowSeconds();
      frame = requestAnimationFrame(tick);
    };
    wake.current();
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      wake.current = () => {};
    };
  }, [running]);

  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const onWheel = (event: WheelEvent) => {
      const { axis: direction, metrics: size } = live.current;
      const across = Math.abs(event.deltaX) > Math.abs(event.deltaY);
      // A horizontal strip leaves vertical scrolling to the page.
      if (direction === 'x' && !across) return;
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 32 : event.deltaMode === 2 ? size.pitch : 1;
      const delta = (direction === 'y' && !across ? event.deltaY : event.deltaX) * unit;
      const m = motion.current;
      const now = nowSeconds();
      m.offset -= delta / size.pitch;
      m.target = null;
      m.velocity = 0;
      m.wheelAt = now;
      m.pausedUntil = now + RESUME_AFTER_SECONDS;
      wake.current();
    };
    strip.addEventListener('wheel', onWheel, { passive: false });
    return () => strip.removeEventListener('wheel', onWheel);
  }, []);

  const coordinate = (event: PointerEvent) => (axis === 'y' ? event.clientY : event.clientX);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const m = motion.current;
    const at = coordinate(event);
    m.drag = { pointerId: event.pointerId, start: at, last: at, lastTime: nowSeconds(), startOffset: m.offset, velocity: 0, moved: false };
    wake.current();
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const m = motion.current;
    const drag = m.drag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const at = coordinate(event);
    if (!drag.moved) {
      if (Math.abs(at - drag.start) < DRAG_THRESHOLD_PX) return;
      drag.moved = true;
      // Pick up from wherever the strip is now, so the grab does not jump.
      drag.start = at;
      drag.startOffset = m.offset;
      m.target = null;
      m.velocity = 0;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    const now = nowSeconds();
    const { pitch } = live.current.metrics;
    m.offset = drag.startOffset + (at - drag.start) / pitch;
    const dt = Math.max(1 / 240, now - drag.lastTime);
    drag.velocity = 0.4 * drag.velocity + 0.6 * ((at - drag.last) / pitch / dt);
    drag.last = at;
    drag.lastTime = now;
    wake.current();
  };

  const handlePointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    const m = motion.current;
    const drag = m.drag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    m.drag = null;
    wake.current();
    if (!drag.moved) return;
    const now = nowSeconds();
    // A pointer that stopped before release should not fling the strip.
    const velocity = now - drag.lastTime > 0.08 ? 0 : drag.velocity;
    m.target = Math.round(m.offset + velocity * FLING_SECONDS);
    m.velocity = velocity;
    m.pausedUntil = now + RESUME_AFTER_SECONDS;
    // The click that follows a drag must not open a project.
    m.suppressClick = true;
    window.setTimeout(() => {
      m.suppressClick = false;
    }, 0);
  };

  const handleOpen = (slot: number) => {
    if (motion.current.suppressClick) return;
    motion.current.pausedUntil = nowSeconds() + RESUME_AFTER_SECONDS;
    onOpen(mod(slot, count));
  };

  const slotNumbers: number[] = [];
  for (let slot = base - metrics.reach; slot <= base + metrics.reach + 1; slot++) slotNumbers.push(slot);

  return (
    <div
      ref={stripRef}
      className="strip"
      data-axis={axis}
      aria-hidden="true"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse') motion.current.hover = true;
      }}
      onPointerLeave={() => {
        motion.current.hover = false;
        wake.current();
      }}
    >
      {slotNumbers.map((slot) => {
        const project = projects[mod(slot, count)];
        return (
          <button
            key={slot}
            ref={(element) => {
              if (element) slots.current.set(slot, element);
              else slots.current.delete(slot);
            }}
            type="button"
            className="strip__card"
            tabIndex={-1}
            onClick={() => handleOpen(slot)}
          >
            <LoadedImage src={project.thumbnail} alt="" draggable={false} decoding="async" />
          </button>
        );
      })}
    </div>
  );
}
