import { useEffect, useRef, type ReactNode } from 'react';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';

class Pixel {
  width: number;
  height: number;
  ctx: CanvasRenderingContext2D;
  x: number;
  y: number;
  color: string;
  speed: number;
  size: number;
  sizeStep: number;
  minSize: number;
  maxSizeInteger: number;
  maxSize: number;
  delay: number;
  counter: number;
  counterStep: number;
  isIdle: boolean;
  isReverse: boolean;
  isShimmer: boolean;

  constructor(
    canvas: HTMLCanvasElement,
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    color: string,
    speed: number,
    delay: number,
  ) {
    this.width = canvas.width;
    this.height = canvas.height;
    this.ctx = context;
    this.x = x;
    this.y = y;
    this.color = color;
    this.speed = this.getRandomValue(0.1, 0.9) * speed;
    this.size = 0;
    this.sizeStep = Math.max(0.05, Math.random() * 0.4);
    this.minSize = 0.5;
    this.maxSizeInteger = 2;
    this.maxSize = this.getRandomValue(this.minSize, this.maxSizeInteger);
    this.delay = delay;
    this.counter = 0;
    this.counterStep = Math.random() * 4 + (this.width + this.height) * 0.01;
    this.isIdle = false;
    this.isReverse = false;
    this.isShimmer = false;
  }

  getRandomValue(min: number, max: number) {
    return Math.random() * (max - min) + min;
  }

  draw() {
    const centerOffset = this.maxSizeInteger * 0.5 - this.size * 0.5;
    this.ctx.fillStyle = this.color;
    this.ctx.fillRect(this.x + centerOffset, this.y + centerOffset, this.size, this.size);
  }

  appear() {
    this.isIdle = false;
    if (this.counter <= this.delay) {
      this.counter += this.counterStep;
      return;
    }
    if (this.size >= this.maxSize) {
      this.isShimmer = true;
    }
    if (this.isShimmer) {
      this.shimmer();
    } else {
      this.size += this.sizeStep;
    }
    this.draw();
  }

  disappear() {
    this.isShimmer = false;
    this.counter = 0;
    if (this.size <= 0) {
      this.isIdle = true;
      return;
    } else {
      this.size = Math.max(0, this.size - 0.1);
    }
    this.draw();
  }

  shimmer() {
    if (this.size >= this.maxSize) {
      this.isReverse = true;
    } else if (this.size <= this.minSize) {
      this.isReverse = false;
    }
    if (this.isReverse) {
      this.size -= this.speed;
    } else {
      this.size += this.speed;
    }
  }
}

export function PixelCard({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = usePrefersReducedMotion();
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas || reduced) return;
    let ctx: CanvasRenderingContext2D | null;
    try {
      ctx = canvas.getContext('2d');
    } catch {
      return;
    }
    if (!ctx) return;
    const context = ctx;
    let pixels: Pixel[] = [];
    let frame = 0;
    let last = 0;
    let hovered = false;
    let focused = container.contains(document.activeElement);
    let visible = true;
    let width = 0;
    let height = 0;
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
    };
    const render = (now: number) => {
      frame = 0;
      if (document.hidden || !visible) return;
      if (now - last >= 1000 / 30) {
        last = now;
        context.clearRect(0, 0, width, height);
        const mode = hovered || focused ? 'appear' : 'disappear';
        for (const pixel of pixels) pixel[mode]();
        if (pixels.every((pixel) => pixel.isIdle)) return;
      }
      frame = requestAnimationFrame(render);
    };
    const resume = () => {
      if (document.hidden || !visible) {
        stop();
        return;
      }
      if (!frame && pixels.length) frame = requestAnimationFrame(render);
    };
    const resize = () => {
      width = container.clientWidth;
      height = container.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Bound the particle count when validation errors make the card taller.
      const gap = Math.max(8, Math.ceil(Math.sqrt((width * height) / 6000)));
      const colors = ['#e64833', '#fc5841', '#b62515'];
      pixels = [];
      for (let x = 0; x < width; x += gap) {
        for (let y = 0; y < height; y += gap) {
          pixels.push(
            new Pixel(
              canvas,
              context,
              x,
              y,
              colors[Math.floor(Math.random() * colors.length)],
              0.04,
              Math.hypot(x - width / 2, y - height / 2),
            ),
          );
        }
      }
      if (hovered || focused) resume();
    };
    const enter = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      hovered = true;
      resume();
    };
    const leave = () => {
      hovered = false;
      resume();
    };
    const focus = () => {
      focused = true;
      resume();
    };
    const blur = (event: FocusEvent) => {
      focused = event.relatedTarget instanceof Node && container.contains(event.relatedTarget);
      resume();
    };
    const observer = new ResizeObserver(resize);
    const visibility = new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
      resume();
    });
    observer.observe(container);
    visibility.observe(container);
    container.addEventListener('pointerenter', enter);
    container.addEventListener('pointerleave', leave);
    container.addEventListener('focusin', focus);
    container.addEventListener('focusout', blur);
    document.addEventListener('visibilitychange', resume);
    resize();
    return () => {
      stop();
      observer.disconnect();
      visibility.disconnect();
      container.removeEventListener('pointerenter', enter);
      container.removeEventListener('pointerleave', leave);
      container.removeEventListener('focusin', focus);
      container.removeEventListener('focusout', blur);
      document.removeEventListener('visibilitychange', resume);
      pixels = [];
      canvas.width = 0;
      canvas.height = 0;
    };
  }, [reduced]);
  return (
    <div
      ref={containerRef}
      data-pixel-card
      className={`relative isolate overflow-hidden rounded-3xl border border-sage/50 bg-sand/80 shadow-[0_8px_32px_rgba(8,50,62,0.16)] backdrop-blur-md ${className}`}
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full opacity-50"
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
