export const FLASH_CONFIG = {
  // Timing (milliseconds)
  onDuration: 200,
  offDuration: 150,

  // Repetitions
  chatFlashCount: 3,
  messageFlashCount: 1,
  indicatorFlashCount: 3,

  // Behavior
  restartOnNewMessage: true,
  stopOnSelect: true,
} as const;

export type FlashConfig = typeof FLASH_CONFIG;
