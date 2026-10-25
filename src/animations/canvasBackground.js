/**
 * Ambient Canvas Aurora & Interactive Particle Background
 * Reacts to pointer/touch, dynamically shifts with light/dark theme,
 * auto-pauses when hidden or when prefers-reduced-motion is enabled.
 */

export class CanvasBackground {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.particles = [];
    this.animationFrameId = null;
    this.isRunning = false;
    this.pointer = { x: -1000, y: -1000, targetX: -1000, targetY: -1000, radius: 140 };
    this.isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.isDark = document.documentElement.getAttribute('data-theme') !== 'light';

    this.init();
  }

  init() {
    this.resize = this.resize.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onVisibilityChange = this.onVisibilityChange.bind(this);
    this.render = this.render.bind(this);

    window.addEventListener('resize', this.resize, { passive: true });
    window.addEventListener('pointermove', this.onPointerMove, { passive: true });
    window.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0) {
        this.pointer.targetX = e.touches[0].clientX;
        this.pointer.targetY = e.touches[0].clientY;
      }
    }, { passive: true });

    document.addEventListener('visibilitychange', this.onVisibilityChange);

    this.resize();
    this.createParticles();
    this.start();
  }

  setTheme(isDark) {
    this.isDark = isDark;
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.ctx.scale(dpr, dpr);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
  }

  createParticles() {
    const isMobile = window.innerWidth < 768;
    const count = isMobile ? 26 : 48;
    this.particles = [];

    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        vx: (Math.random() - 0.5) * 0.45,
        vy: (Math.random() - 0.5) * 0.45,
        baseRadius: Math.random() * 2.2 + 1.2,
        radius: Math.random() * 2.2 + 1.2,
        alpha: Math.random() * 0.4 + 0.15,
        hueShift: Math.random() * 40 - 20
      });
    }
  }

  onPointerMove(e) {
    this.pointer.targetX = e.clientX;
    this.pointer.targetY = e.clientY;
  }

  onVisibilityChange() {
    if (document.hidden) {
      this.stop();
    } else {
      this.start();
    }
  }

  start() {
    if (!this.isRunning) {
      this.isRunning = true;
      this.render();
    }
  }

  stop() {
    this.isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  render() {
    if (!this.isRunning) return;

    if (this.isReducedMotion) {
      // Just render static clean gradient once
      this.drawMeshGradient();
      return;
    }

    // Smooth pointer lerp
    this.pointer.x += (this.pointer.targetX - this.pointer.x) * 0.1;
    this.pointer.y += (this.pointer.targetY - this.pointer.y) * 0.1;

    this.ctx.clearRect(0, 0, this.width, this.height);
    this.drawMeshGradient();
    this.drawParticles();

    this.animationFrameId = requestAnimationFrame(this.render);
  }

  drawMeshGradient() {
    // Subtle, high-end aurora mesh effect
    const time = Date.now() * 0.0006;
    const cx1 = this.width * 0.2 + Math.sin(time) * 60;
    const cy1 = this.height * 0.3 + Math.cos(time * 0.8) * 50;
    const r1 = Math.min(this.width, this.height) * 0.55;

    const cx2 = this.width * 0.8 + Math.cos(time * 0.7) * 70;
    const cy2 = this.height * 0.7 + Math.sin(time * 0.9) * 60;
    const r2 = Math.min(this.width, this.height) * 0.6;

    // Gradient 1 (Cyan / Indigo aurora glow)
    const g1 = this.ctx.createRadialGradient(cx1, cy1, 0, cx1, cy1, r1);
    if (this.isDark) {
      g1.addColorStop(0, 'rgba(99, 102, 241, 0.14)');
      g1.addColorStop(0.6, 'rgba(56, 189, 248, 0.05)');
      g1.addColorStop(1, 'rgba(15, 23, 42, 0)');
    } else {
      g1.addColorStop(0, 'rgba(99, 102, 241, 0.12)');
      g1.addColorStop(0.6, 'rgba(56, 189, 248, 0.05)');
      g1.addColorStop(1, 'rgba(248, 250, 252, 0)');
    }

    this.ctx.fillStyle = g1;
    this.ctx.fillRect(0, 0, this.width, this.height);

    // Gradient 2 (Violet / Emerald glow)
    const g2 = this.ctx.createRadialGradient(cx2, cy2, 0, cx2, cy2, r2);
    if (this.isDark) {
      g2.addColorStop(0, 'rgba(168, 85, 247, 0.10)');
      g2.addColorStop(0.5, 'rgba(16, 185, 129, 0.04)');
      g2.addColorStop(1, 'rgba(15, 23, 42, 0)');
    } else {
      g2.addColorStop(0, 'rgba(168, 85, 247, 0.08)');
      g2.addColorStop(0.5, 'rgba(16, 185, 129, 0.03)');
      g2.addColorStop(1, 'rgba(248, 250, 252, 0)');
    }

    this.ctx.fillStyle = g2;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  drawParticles() {
    const isDark = this.isDark;
    const pCount = this.particles.length;

    for (let i = 0; i < pCount; i++) {
      const p = this.particles[i];

      p.x += p.vx;
      p.y += p.vy;

      if (p.x < 0) p.x = this.width;
      if (p.x > this.width) p.x = 0;
      if (p.y < 0) p.y = this.height;
      if (p.y > this.height) p.y = 0;

      // Pointer proximity reaction
      const dx = this.pointer.x - p.x;
      const dy = this.pointer.y - p.y;
      const dist = Math.hypot(dx, dy);

      if (dist < this.pointer.radius) {
        const force = (1 - dist / this.pointer.radius) * 1.5;
        p.x -= (dx / dist) * force;
        p.y -= (dy / dist) * force;
        p.radius = p.baseRadius * 1.6;
      } else {
        p.radius += (p.baseRadius - p.radius) * 0.1;
      }

      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = isDark
        ? `rgba(165, 180, 252, ${p.alpha})`
        : `rgba(99, 102, 241, ${p.alpha * 0.8})`;
      this.ctx.fill();

      // Connect nearby particles with subtle lines
      for (let j = i + 1; j < pCount; j++) {
        const p2 = this.particles[j];
        const lineDist = Math.hypot(p.x - p2.x, p.y - p2.y);
        if (lineDist < 95) {
          const lineAlpha = (1 - lineDist / 95) * (isDark ? 0.07 : 0.04);
          this.ctx.beginPath();
          this.ctx.moveTo(p.x, p.y);
          this.ctx.lineTo(p2.x, p2.y);
          this.ctx.strokeStyle = isDark
            ? `rgba(147, 197, 253, ${lineAlpha})`
            : `rgba(99, 102, 241, ${lineAlpha})`;
          this.ctx.lineWidth = 0.8;
          this.ctx.stroke();
        }
      }
    }
  }

  destroy() {
    this.stop();
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('pointermove', this.onPointerMove);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
  }
}
