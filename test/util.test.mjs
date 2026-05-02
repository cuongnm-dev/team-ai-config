import { describe, it, expect } from 'vitest';
import {
  fmtN, fmtInt, fmtUsd, fmtPct,
  parseSince, priceOf, costOf,
  classifyError, suggestCommand,
  vlen, padR, padL, sparkline, bar,
} from '../bin/lib/util.mjs';

describe('fmtN', () => {
  it('formats < 1k as plain int', () => expect(fmtN(42)).toBe('42'));
  it('formats thousands with K', () => expect(fmtN(1234)).toBe('1.2K'));
  it('formats millions with M', () => expect(fmtN(2_500_000)).toBe('2.50M'));
  it('formats billions with B', () => expect(fmtN(3_180_000_000)).toBe('3.18B'));
});

describe('fmtInt', () => {
  it('uses vi-VN locale (dot separator)', () => expect(fmtInt(10979)).toBe('10.979'));
  it('handles small numbers', () => expect(fmtInt(42)).toBe('42'));
  it('rounds to integer', () => expect(fmtInt(1234.7)).toBe('1.235'));
});

describe('fmtUsd', () => {
  it('uses en-US locale (comma)', () => expect(fmtUsd(5944.94)).toBe('$5,944.94'));
  it('shows 3 decimals when < $1', () => expect(fmtUsd(0.123)).toBe('$0.123'));
  it('handles zero', () => expect(fmtUsd(0)).toBe('$0.000'));
  it('handles negative', () => expect(fmtUsd(-100)).toBe('-$100.00'));
});

describe('parseSince', () => {
  const NOW = 1_700_000_000_000;  // fixed clock
  it('returns now-30d when input is empty', () => expect(parseSince('', NOW)).toBe(NOW - 30 * 86400_000));
  it('parses 7d', () => expect(parseSince('7d', NOW)).toBe(NOW - 7 * 86400_000));
  it('parses 24h', () => expect(parseSince('24h', NOW)).toBe(NOW - 24 * 3600_000));
  it('parses 2w', () => expect(parseSince('2w', NOW)).toBe(NOW - 2 * 7 * 86400_000));
  it('parses 3m', () => expect(parseSince('3m', NOW)).toBe(NOW - 3 * 30 * 86400_000));
  it('falls back to 30d on garbage input', () => expect(parseSince('xyz', NOW)).toBe(NOW - 30 * 86400_000));
});

describe('priceOf', () => {
  it('matches opus 4', () => expect(priceOf('claude-opus-4-7')).toEqual({in: 15, out: 75, cr: 1.5, cw: 18.75}));
  it('matches sonnet 4', () => expect(priceOf('claude-sonnet-4-6')).toEqual({in: 3, out: 15, cr: 0.3, cw: 3.75}));
  it('matches haiku 4', () => expect(priceOf('claude-haiku-4-5-20251001')).toEqual({in: 0.8, out: 4, cr: 0.08, cw: 1}));
  it('returns default for unknown', () => expect(priceOf('gpt-5')).toEqual({in: 3, out: 15, cr: 0.3, cw: 3.75}));
});

describe('costOf', () => {
  it('computes opus cost correctly', () => {
    const u = {input_tokens: 1_000_000, output_tokens: 1_000_000, cache_read_input_tokens: 0, cache_creation_input_tokens: 0};
    expect(costOf('claude-opus-4-7', u)).toBeCloseTo(15 + 75, 5);
  });
  it('treats missing fields as zero', () => {
    expect(costOf('claude-opus-4-7', {})).toBe(0);
  });
  it('weighs cache tokens correctly', () => {
    const u = {input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 1_000_000, cache_creation_input_tokens: 0};
    expect(costOf('claude-opus-4-7', u)).toBeCloseTo(1.5, 5);
  });
});

describe('classifyError', () => {
  it('classifies File-not-read as workflow', () => {
    const r = classifyError('Edit', '<tool_use_error>File has not been read yet. Read it first before writing.</tool_use_error>');
    expect(r.category).toBe('workflow');
    expect(r.isReal).toBe(true);
  });
  it('classifies grep exit-1 with cmd context as shell_noise', () => {
    const r = classifyError('Bash', 'Exit code 1', 'grep -r "foo" src/');
    expect(r.category).toBe('shell_noise');
    expect(r.isReal).toBe(false);
  });
  it('classifies real shell exit 2 as shell_real', () => {
    const r = classifyError('Bash', 'Exit code 2\nsyntax error', 'invalid command');
    expect(r.category).toBe('shell_real');
    expect(r.isReal).toBe(true);
  });
  it('classifies HTTP 404 as http', () => {
    const r = classifyError('WebFetch', 'Request failed with status code 404');
    expect(r.category).toBe('http');
  });
  it('classifies git diff --quiet exit 1 as noise', () => {
    const r = classifyError('Bash', 'Exit code 1', 'git diff --quiet HEAD');
    expect(r.category).toBe('shell_noise');
  });
  it('falls back to other for unrecognized', () => {
    const r = classifyError('Read', 'Permission denied');
    expect(r.category).toBe('other');
  });
});

describe('suggestCommand', () => {
  const cmds = ['update', 'status', 'doctor', 'rollback', 'doc', 'help', 'statistics'];
  it('suggests update for typo updte', () => {
    expect(suggestCommand('updte', cmds)).toContain('update');
  });
  it('suggests doctor for typo dotor', () => {
    expect(suggestCommand('dotor', cmds)).toContain('doctor');
  });
  it('returns empty for nonsense', () => {
    expect(suggestCommand('xyzqwerty', cmds)).toEqual([]);
  });
  it('returns top 3 matches max', () => {
    const result = suggestCommand('do', cmds);
    expect(result.length).toBeLessThanOrEqual(3);
  });
});

describe('vlen / padR / padL', () => {
  it('vlen strips ANSI', () => expect(vlen('\x1b[31mhello\x1b[0m')).toBe(5));
  it('padR pads right', () => expect(padR('hi', 5)).toBe('hi   '));
  it('padL pads left', () => expect(padL('hi', 5)).toBe('   hi'));
  it('padR with ANSI counts visible only', () => {
    const colored = '\x1b[31mhi\x1b[0m';
    expect(padR(colored, 5)).toBe(colored + '   ');
  });
});

describe('sparkline / bar', () => {
  it('sparkline produces same length as input', () => {
    expect(sparkline([1, 2, 3, 4, 5]).length).toBe(5);
  });
  it('sparkline shows space for zero', () => {
    expect(sparkline([0, 1])[0]).toBe(' ');
  });
  it('bar at ratio 0 is all spaces', () => {
    expect(bar(0, 10).trim()).toBe('');
  });
  it('bar at ratio 1 is all blocks', () => {
    expect(bar(1, 5)).toBe('█████');
  });
  it('bar clamps out-of-range ratios', () => {
    expect(bar(2, 5)).toBe('█████');
    expect(bar(-1, 5).trim()).toBe('');
  });
});
