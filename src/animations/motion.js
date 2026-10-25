import gsap from 'gsap';
import confetti from 'canvas-confetti';
import { triggerHaptic } from '../ui/haptics.js';
import { playSnap, playFlip, playCorrect, playWrong, playFanfare } from './sounds.js';

export const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Hero introduction animation on initial load
 */
export function animateHeroIntro() {
  if (prefersReducedMotion()) return;

  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

  tl.fromTo('.brand-logo-icon', 
    { scale: 0.6, rotation: -18, opacity: 0 },
    { scale: 1, rotation: 0, opacity: 1, duration: 0.8, ease: 'back.out(1.8)' }
  )
  .fromTo('.hero-title-word',
    { y: 30, opacity: 0, filter: 'blur(8px)' },
    { y: 0, opacity: 1, filter: 'blur(0px)', duration: 0.6, stagger: 0.08 },
    '-=0.4'
  )
  .fromTo('.hero-subtitle',
    { y: 15, opacity: 0 },
    { y: 0, opacity: 1, duration: 0.5 },
    '-=0.2'
  )
  .fromTo('.input-card-container',
    { y: 35, opacity: 0 },
    { y: 0, opacity: 1, duration: 0.7, ease: 'power2.out' },
    '-=0.3'
  );

  return tl;
}

/**
 * Magnetic button interaction
 */
export function initMagneticButtons(selector = '.magnetic-btn') {
  if (prefersReducedMotion()) return;

  const buttons = document.querySelectorAll(selector);
  buttons.forEach(btn => {
    // Avoid double attaching
    if (btn.dataset.magneticInit) return;
    btn.dataset.magneticInit = 'true';

    const strength = 20;

    btn.addEventListener('mousemove', (e) => {
      const rect = btn.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;

      gsap.to(btn, {
        x: x * 0.28,
        y: y * 0.28,
        duration: 0.25,
        ease: 'power2.out'
      });
    });

    btn.addEventListener('mouseleave', () => {
      gsap.to(btn, {
        x: 0,
        y: 0,
        duration: 0.5,
        ease: 'elastic.out(1, 0.4)'
      });
    });
  });
}

/**
 * 3D Tilt effect on interactive cards
 */
export function init3DTilt(selector = '.tilt-card') {
  if (prefersReducedMotion()) return;

  const cards = document.querySelectorAll(selector);
  cards.forEach(card => {
    if (card.dataset.tiltInit) return;
    card.dataset.tiltInit = 'true';

    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;

      gsap.to(card, {
        rotationY: x * 10,
        rotationX: -y * 10,
        transformPerspective: 900,
        ease: 'power1.out',
        duration: 0.2
      });

      // Update cursor glow variable
      const glowX = ((e.clientX - rect.left) / rect.width) * 100;
      const glowY = ((e.clientY - rect.top) / rect.height) * 100;
      card.style.setProperty('--glow-x', `${glowX}%`);
      card.style.setProperty('--glow-y', `${glowY}%`);
    });

    card.addEventListener('mouseleave', () => {
      gsap.to(card, {
        rotationY: 0,
        rotationX: 0,
        duration: 0.6,
        ease: 'power2.out'
      });
    });
  });
}

/**
 * The Signature "Snap" Moment
 * Visual compression, shutter flash, haptic pulse, audio snap, and staggered cascade
 */
export function playSnapMoment(sourceElement, targetContainer, onComplete) {
  triggerHaptic([35, 40, 60]);
  playSnap();

  if (prefersReducedMotion()) {
    if (onComplete) onComplete();
    return;
  }

  // 1. Shutter flash overlay
  const flash = document.createElement('div');
  flash.className = 'snap-flash-overlay';
  document.body.appendChild(flash);

  gsap.fromTo(flash,
    { opacity: 0.8 },
    {
      opacity: 0,
      duration: 0.45,
      ease: 'power2.out',
      onComplete: () => flash.remove()
    }
  );

  // 2. Compress the source card
  if (sourceElement) {
    gsap.timeline()
      .to(sourceElement, {
        scale: 0.94,
        filter: 'blur(2px)',
        duration: 0.18,
        ease: 'power2.in'
      })
      .to(sourceElement, {
        scale: 1,
        filter: 'blur(0px)',
        duration: 0.25,
        ease: 'back.out(1.5)'
      });
  }

  // 3. Stagger reveal on the target container
  if (targetContainer) {
    const items = targetContainer.querySelectorAll('.snap-sentence-item, .snap-kw-chip, .stat-chip');
    gsap.fromTo(items,
      { y: 25, opacity: 0, scale: 0.96 },
      {
        y: 0,
        opacity: 1,
        scale: 1,
        duration: 0.5,
        stagger: 0.05,
        ease: 'power3.out',
        onComplete
      }
    );
  } else if (onComplete) {
    onComplete();
  }
}

/**
 * Animate numbers in stats strip
 */
export function animateStatCounters() {
  const counters = document.querySelectorAll('.stat-counter');
  counters.forEach(el => {
    const target = parseFloat(el.getAttribute('data-target') || '0');
    const suffix = el.getAttribute('data-suffix') || '';
    const obj = { val: 0 };

    if (prefersReducedMotion()) {
      el.textContent = Math.round(target) + suffix;
      return;
    }

    gsap.to(obj, {
      val: target,
      duration: 1.2,
      ease: 'power2.out',
      onUpdate: () => {
        el.textContent = Math.round(obj.val) + suffix;
      }
    });
  });
}

/**
 * 3D Flashcard Flip
 */
export function flipFlashcard(cardElement, toBack = true) {
  playFlip();
  triggerHaptic(20);

  if (prefersReducedMotion()) {
    cardElement.classList.toggle('flipped', toBack);
    return;
  }

  gsap.to(cardElement, {
    rotationY: toBack ? 180 : 0,
    duration: 0.6,
    ease: 'power2.inOut',
    transformPerspective: 1200
  });
}

/**
 * Swipe Card Away (Left = Hard/Again, Right = Easy)
 */
export function swipeCardFlyOff(cardElement, direction = 'right', onComplete) {
  const isRight = direction === 'right';
  const targetX = isRight ? window.innerWidth * 0.8 : -window.innerWidth * 0.8;
  const rotation = isRight ? 24 : -24;

  triggerHaptic(isRight ? [20, 30] : [50]);

  if (prefersReducedMotion()) {
    if (onComplete) onComplete();
    return;
  }

  gsap.to(cardElement, {
    x: targetX,
    rotation: rotation,
    opacity: 0,
    duration: 0.4,
    ease: 'power2.in',
    onComplete
  });
}

/**
 * Correct answer micro-interaction: green flash & pulse
 */
export function animateCorrectFeedback(element) {
  playCorrect();
  triggerHaptic([30, 40]);

  if (!element) return;
  gsap.fromTo(element,
    { scale: 0.96, boxShadow: '0 0 0 0 rgba(34, 197, 94, 0.7)' },
    {
      scale: 1.02,
      boxShadow: '0 0 0 16px rgba(34, 197, 94, 0)',
      duration: 0.45,
      ease: 'power2.out',
      yoyo: true,
      repeat: 1
    }
  );
}

/**
 * Wrong answer micro-interaction: subtle red shake
 */
export function animateWrongFeedback(element) {
  playWrong();
  triggerHaptic([50, 40, 50]);

  if (!element) return;
  gsap.timeline()
    .to(element, { x: -8, duration: 0.07 })
    .to(element, { x: 8, duration: 0.07 })
    .to(element, { x: -5, duration: 0.07 })
    .to(element, { x: 5, duration: 0.07 })
    .to(element, { x: 0, duration: 0.07 });
}

/**
 * Confetti explosion for completed quiz
 */
export function fireQuizCompletionConfetti() {
  playFanfare();
  triggerHaptic([40, 60, 80]);

  if (prefersReducedMotion()) return;

  const count = 120;
  const defaults = {
    origin: { y: 0.65 },
    spread: 80,
    ticks: 180,
    gravity: 1.1,
    scalar: 1.1,
    colors: ['#6366f1', '#38bdf8', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6']
  };

  confetti({ ...defaults, particleCount: Math.floor(count * 0.4), spread: 45 });
  confetti({ ...defaults, particleCount: Math.floor(count * 0.3), spread: 80, delay: 100 });
  confetti({ ...defaults, particleCount: Math.floor(count * 0.3), spread: 120, delay: 200 });
}
