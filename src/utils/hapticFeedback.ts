/**
 * Haptic Feedback Utility for Mobile Devices
 * Provides tactile feedback for important interactions
 */

type HapticStyle = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

const vibrationPatterns: Record<HapticStyle, number | number[]> = {
  light: 10,
  medium: 25,
  heavy: 50,
  success: [10, 50, 10],
  warning: [25, 100, 25],
  error: [50, 100, 50, 100, 50],
};

/**
 * Check if haptic feedback is supported
 */
export function isHapticSupported(): boolean {
  return 'vibrate' in navigator;
}

/**
 * Trigger haptic feedback
 * @param style - The style of haptic feedback
 */
export function haptic(style: HapticStyle = 'light'): void {
  if (!isHapticSupported()) return;

  try {
    const pattern = vibrationPatterns[style];
    navigator.vibrate(pattern);
  } catch (error) {
    // Silently fail if vibration is not allowed
    console.debug('Haptic feedback not available:', error);
  }
}

/**
 * Trigger haptic feedback for button press
 */
export function hapticButton(): void {
  haptic('light');
}

/**
 * Trigger haptic feedback for successful action
 */
export function hapticSuccess(): void {
  haptic('success');
}

/**
 * Trigger haptic feedback for warning
 */
export function hapticWarning(): void {
  haptic('warning');
}

/**
 * Trigger haptic feedback for error
 */
export function hapticError(): void {
  haptic('error');
}

/**
 * Trigger haptic feedback for selection change
 */
export function hapticSelection(): void {
  haptic('medium');
}
