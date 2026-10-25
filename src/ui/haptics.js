/**
 * Haptic feedback wrapper for mobile devices
 */
let hapticsEnabled = true;

export function setHapticsEnabled(val) {
  hapticsEnabled = !!val;
}

export function triggerHaptic(pattern = 15) {
  if (!hapticsEnabled) return;
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch (e) {
      // Ignore vibration errors on platforms that block it without direct user gesture
    }
  }
}
