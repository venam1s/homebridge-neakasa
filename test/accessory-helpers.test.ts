/**
 * Tests for pure helper functions used in NeakasaAccessory.
 * Since these are private methods, we test them via extracted logic.
 */

describe('rssiToPercent', () => {
  // Extracted from NeakasaAccessory.rssiToPercent
  function rssiToPercent(rssi: number): number {
    if (rssi >= -50) {
      return 100;
    }
    if (rssi <= -100) {
      return 0;
    }
    return 2 * (rssi + 100);
  }

  it('should return 100 for strong signal (-50 dBm)', () => {
    expect(rssiToPercent(-50)).toBe(100);
  });

  it('should return 100 for very strong signal (-30 dBm)', () => {
    expect(rssiToPercent(-30)).toBe(100);
  });

  it('should return 0 for very weak signal (-100 dBm)', () => {
    expect(rssiToPercent(-100)).toBe(0);
  });

  it('should return 0 for extremely weak signal (-120 dBm)', () => {
    expect(rssiToPercent(-120)).toBe(0);
  });

  it('should return 50 for mid-range signal (-75 dBm)', () => {
    expect(rssiToPercent(-75)).toBe(50);
  });

  it('should scale linearly between -100 and -50', () => {
    expect(rssiToPercent(-60)).toBe(80);
    expect(rssiToPercent(-80)).toBe(40);
    expect(rssiToPercent(-90)).toBe(20);
  });
});

describe('getLastUseTimestampMs', () => {
  // Extracted from NeakasaAccessory.getLastUseTimestampMs
  function getLastUseTimestampMs(lastUse: number): number {
    return lastUse < 1000000000000 ? lastUse * 1000 : lastUse;
  }

  it('should convert seconds to milliseconds', () => {
    const epochSeconds = 1700000000; // Nov 2023
    expect(getLastUseTimestampMs(epochSeconds)).toBe(1700000000000);
  });

  it('should pass through milliseconds unchanged', () => {
    const epochMs = 1700000000000;
    expect(getLastUseTimestampMs(epochMs)).toBe(1700000000000);
  });

  it('should handle 0', () => {
    expect(getLastUseTimestampMs(0)).toBe(0);
  });
});

describe('formatStayTime', () => {
  // Extracted from NeakasaAccessory.formatStayTime
  function formatStayTime(stayTimeSeconds: number): string {
    if (!Number.isFinite(stayTimeSeconds) || stayTimeSeconds <= 0) {
      return 'unknown';
    }

    const totalSeconds = Math.round(stayTimeSeconds);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    if (minutes <= 0) {
      return `${seconds}s`;
    }

    return `${minutes}m ${seconds}s`;
  }

  it('should format seconds only', () => {
    expect(formatStayTime(30)).toBe('30s');
  });

  it('should format minutes and seconds', () => {
    expect(formatStayTime(90)).toBe('1m 30s');
  });

  it('should format exact minutes', () => {
    expect(formatStayTime(120)).toBe('2m 0s');
  });

  it('should return "unknown" for 0', () => {
    expect(formatStayTime(0)).toBe('unknown');
  });

  it('should return "unknown" for negative values', () => {
    expect(formatStayTime(-5)).toBe('unknown');
  });

  it('should return "unknown" for NaN', () => {
    expect(formatStayTime(NaN)).toBe('unknown');
  });

  it('should return "unknown" for Infinity', () => {
    expect(formatStayTime(Infinity)).toBe('unknown');
  });

  it('should round fractional seconds', () => {
    expect(formatStayTime(30.7)).toBe('31s');
  });
});

describe('isLastUseRecent', () => {
  function getLastUseTimestampMs(lastUse: number): number {
    return lastUse < 1000000000000 ? lastUse * 1000 : lastUse;
  }

  function isLastUseRecent(lastUse: number, windowSeconds: number): boolean {
    if (windowSeconds <= 0 || !lastUse) {
      return false;
    }

    const nowMs = Date.now();
    const lastUseMs = getLastUseTimestampMs(lastUse);
    return nowMs >= lastUseMs && nowMs - lastUseMs <= windowSeconds * 1000;
  }

  it('should return true for recent timestamp within window', () => {
    const recentSeconds = Math.floor(Date.now() / 1000) - 30; // 30s ago
    expect(isLastUseRecent(recentSeconds, 60)).toBe(true);
  });

  it('should return false for old timestamp outside window', () => {
    const oldSeconds = Math.floor(Date.now() / 1000) - 300; // 5min ago
    expect(isLastUseRecent(oldSeconds, 60)).toBe(false);
  });

  it('should return false when window is 0', () => {
    const recentSeconds = Math.floor(Date.now() / 1000) - 5;
    expect(isLastUseRecent(recentSeconds, 0)).toBe(false);
  });

  it('should return false when lastUse is 0', () => {
    expect(isLastUseRecent(0, 60)).toBe(false);
  });

  it('should return false for future timestamp', () => {
    const futureSeconds = Math.floor(Date.now() / 1000) + 3600;
    expect(isLastUseRecent(futureSeconds, 60)).toBe(false);
  });
});
