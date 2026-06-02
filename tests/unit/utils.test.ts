import { describe, it, expect } from 'vitest';
import { formatBytes, formatDate, formatNumber } from '@/utils/tauri';

describe('formatBytes', () => {
  it('formats 0 bytes', () => expect(formatBytes(0)).toBe('0 B'));
  it('formats kilobytes', () => expect(formatBytes(1024)).toBe('1 KB'));
  it('formats megabytes', () => expect(formatBytes(1024 * 1024)).toBe('1 MB'));
  it('formats gigabytes', () => expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB'));
  it('formats partial MB', () => expect(formatBytes(1500)).toBe('1.5 KB'));
});

describe('formatNumber', () => {
  it('formats zero', () => expect(formatNumber(0)).toBe('0'));
  it('formats thousands with separator', () => {
    const result = formatNumber(1000);
    expect(result).toMatch(/1[,.]000/);
  });
  it('formats large numbers', () => {
    const result = formatNumber(1234567);
    expect(result).toContain('234');
  });
});

describe('formatDate', () => {
  it('formats ISO date string', () => {
    const result = formatDate('2024-01-15T10:30:00Z');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
  it('handles invalid date gracefully', () => {
    const result = formatDate('not-a-date');
    expect(typeof result).toBe('string');
  });
});
