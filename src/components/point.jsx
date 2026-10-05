import { useEffect, useRef } from 'react';
import './point.css';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export default function Point({ scope = 'canvas', spacing = 16, pointSize = .8, radius = 72, movement = 2, color = 'rgba(111, 149, 188, .38)' }) {
  const wrapperRef = useRef(null), canvasRef = useRef(null);

  useEffect(() => {
    const wrapper = wrapperRef.current, canvas = canvasRef.current;
    const surface = scope === 'application' ? document : wrapper.closest('[data-point-surface]') || wrapper.parentElement;
    const base = document.createElement('canvas'), ctx = canvas.getContext('2d'), baseCtx = base.getContext('2d');
    if (!ctx || !baseCtx) return;
    const step = clamp(spacing, 8, 80), size = clamp(pointSize, .4, 2), reach = clamp(radius, 16, 160), offset = clamp(movement, 0, 3);
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    let width = 0, height = 0, scale = 1, frame = null, bounds = null, pointer = null, patch = null;
    function dot(context, x, y) { context.beginPath(); context.arc(x, y, size, 0, Math.PI * 2); context.fill(); }
    function restore() {
      if (patch) {
        const { x, y, w, h } = patch;
        ctx.clearRect(x, y, w, h);
        ctx.drawImage(base, x * scale, y * scale, w * scale, h * scale, x, y, w, h);
        patch = null;
      }
      wrapper.dataset.state = 'idle';
    }
    function reset() {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null; pointer = null; restore();
    }
    function resize() {
      bounds = null;
      const rect = wrapper.getBoundingClientRect(), density = Math.min(devicePixelRatio || 1, 2);
      if (!rect.width || !rect.height || (width === rect.width && height === rect.height && scale === density)) return;
      reset(); width = rect.width; height = rect.height; scale = density;
      canvas.width = base.width = Math.ceil(width * scale); canvas.height = base.height = Math.ceil(height * scale);
      ctx.setTransform(scale, 0, 0, scale, 0, 0); baseCtx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.fillStyle = baseCtx.fillStyle = color;
      for (let y = step / 2; y < height; y += step) for (let x = step / 2; x < width; x += step) dot(baseCtx, x, y);
      ctx.drawImage(base, 0, 0, width, height);
    }
    function draw() {
      frame = null; restore();
      if (!pointer || motion.matches || document.hidden) return;
      bounds ||= wrapper.getBoundingClientRect();
      const px = pointer.x - bounds.left, py = pointer.y - bounds.top;
      if (px < 0 || py < 0 || px > width || py > height) return;
      const left = Math.max(0, Math.floor((px - reach - step) / step) * step), top = Math.max(0, Math.floor((py - reach - step) / step) * step);
      patch = { x: left, y: top, w: Math.min(width, Math.ceil((px + reach + step) / step) * step) - left, h: Math.min(height, Math.ceil((py + reach + step) / step) * step) - top };
      ctx.clearRect(left, top, patch.w, patch.h);
      for (let y = top + step / 2; y < top + patch.h; y += step) {
        for (let x = left + step / 2; x < left + patch.w; x += step) {
          const dx = x - px, dy = y - py, distance = Math.hypot(dx, dy);
          const shift = distance > 0 && distance < reach ? offset * (1 - distance / reach) ** 2 / distance : 0;
          dot(ctx, x + dx * shift, y + dy * shift);
        }
      }
      wrapper.dataset.state = 'reacting';
    }
    function move(e) {
      if (motion.matches || e.buttons || (scope === 'application' && e.target.closest?.('[data-point-surface="canvas"], .wf-editor'))) { reset(); return; }
      pointer = { x: e.clientX, y: e.clientY };
      if (frame === null && !document.hidden) frame = requestAnimationFrame(draw);
    }
    function preference() { wrapper.dataset.motion = motion.matches ? 'reduced' : 'interactive'; reset(); }
    const invalidateBounds = () => { bounds = null; };
    const observer = new ResizeObserver(resize);
    observer.observe(wrapper); resize(); preference();
    surface.addEventListener('pointermove', move, { capture: true, passive: true });
    surface.addEventListener('pointerleave', reset, { passive: true });
    surface.addEventListener('pointerdown', reset, { capture: true, passive: true });
    window.addEventListener('scroll', invalidateBounds, { capture: true, passive: true });
    window.addEventListener('resize', resize, { passive: true });
    document.addEventListener('visibilitychange', reset);
    motion.addEventListener('change', preference);
    return () => {
      observer.disconnect(); reset();
      surface.removeEventListener('pointermove', move, true); surface.removeEventListener('pointerleave', reset); surface.removeEventListener('pointerdown', reset, true);
      window.removeEventListener('scroll', invalidateBounds, true); window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', reset); motion.removeEventListener('change', preference);
    };
  }, [scope, spacing, pointSize, radius, movement, color]);

  return <div ref={wrapperRef} className="point-background" data-point-scope={scope} aria-hidden="true"><canvas ref={canvasRef} /></div>;
}
