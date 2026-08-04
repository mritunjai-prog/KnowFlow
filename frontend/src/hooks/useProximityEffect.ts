import { useRef, useState, useCallback, useEffect } from 'react';

type Falloff = 'linear' | 'smooth' | 'sharp';

const FALLOFF_CURVES: Record<Falloff, (p: number) => number> = {
  linear: p => p,
  smooth: p => p * p * (3 - 2 * p),
  sharp: p => p * p * p
};

interface UseProximityEffectOptions {
  proximityRadius?: number;
  falloff?: Falloff;
  smoothing?: number;
  defaultActive?: number | null;
}

export function useProximityEffect(options: UseProximityEffectOptions = {}) {
  const {
    proximityRadius = 120,
    falloff = 'smooth',
    smoothing = 100,
    defaultActive = null
  } = options;

  const listRef = useRef<HTMLElement | null>(null);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);
  const targetsRef = useRef<number[]>([]);
  const currentRef = useRef<number[]>([]);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);

  const [activeIndex, setActiveIndex] = useState<number | null>(defaultActive);
  const activeRef = useRef<number | null>(defaultActive);
  const smoothingRef = useRef(smoothing);

  useEffect(() => {
    activeRef.current = activeIndex;
  }, [activeIndex]);

  useEffect(() => {
    if (defaultActive !== null && defaultActive !== activeRef.current) {
      setActiveIndex(defaultActive);
    }
  }, [defaultActive]);

  smoothingRef.current = smoothing;

  const runFrame = useCallback((now: number) => {
    const dt = Math.min((now - lastRef.current) / 1000, 0.05);
    lastRef.current = now;
    const tau = Math.max(smoothingRef.current, 1) / 1000;
    const k = 1 - Math.exp(-dt / tau);

    let moving = false;
    const itemEls = itemRefs.current;
    for (let i = 0; i < itemEls.length; i++) {
      const el = itemEls[i];
      if (!el) continue;
      const target = Math.max(targetsRef.current[i] ?? 0, activeRef.current === i ? 1 : 0);
      const cur = currentRef.current[i] ?? 0;
      const next = cur + (target - cur) * k;
      const settled = Math.abs(target - next) < 0.0015;
      const value = settled ? target : next;
      currentRef.current[i] = value;
      el.style.setProperty('--effect', value.toFixed(4));
      if (!settled) moving = true;
    }

    rafRef.current = moving ? requestAnimationFrame(runFrame) : null;
  }, []);

  const startLoop = useCallback(() => {
    if (rafRef.current != null) return;
    lastRef.current = performance.now();
    rafRef.current = requestAnimationFrame(runFrame);
  }, [runFrame]);

  // Use native DOM event listeners attached to listRef — avoids React synthetic event type issues
  useEffect(() => {
    const container = listRef.current;
    if (!container) return;

    const ease = FALLOFF_CURVES[falloff] ?? FALLOFF_CURVES.linear;

    const onMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      const pointerY = e.clientY - rect.top;
      const itemEls = itemRefs.current;
      for (let i = 0; i < itemEls.length; i++) {
        const el = itemEls[i];
        if (!el) continue;
        const elRect = el.getBoundingClientRect();
        const center = elRect.top - rect.top + elRect.height / 2;
        const distance = Math.abs(pointerY - center);
        targetsRef.current[i] = ease(Math.max(0, 1 - distance / proximityRadius));
      }
      startLoop();
    };

    const onLeave = () => {
      targetsRef.current = itemRefs.current.map(() => 0);
      startLoop();
    };

    container.addEventListener('pointermove', onMove);
    container.addEventListener('pointerleave', onLeave);

    return () => {
      container.removeEventListener('pointermove', onMove);
      container.removeEventListener('pointerleave', onLeave);
    };
  // Re-attach if container mounts/unmounts or options change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [falloff, proximityRadius, startLoop]);

  useEffect(() => {
    startLoop();
  }, [activeIndex, startLoop]);

  useEffect(() => () => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
  }, []);

  return {
    listRef,
    itemRefs,
    activeIndex,
    setActiveIndex,
  };
}
