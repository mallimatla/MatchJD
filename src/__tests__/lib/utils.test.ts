import {
  cn,
  formatDate,
  formatCurrency,
  formatPercentage,
  getStatusColor,
  getUrgencyColor,
  truncate,
  generateId,
} from '@/lib/utils';

describe('Utility Functions', () => {
  describe('cn (classNames)', () => {
    it('merges class names', () => {
      expect(cn('class1', 'class2')).toBe('class1 class2');
    });

    it('handles conditional classes', () => {
      expect(cn('base', true && 'included', false && 'excluded')).toBe('base included');
    });

    it('merges tailwind classes correctly', () => {
      expect(cn('p-4', 'p-2')).toBe('p-2');
    });

    it('handles undefined and null', () => {
      expect(cn('base', undefined, null, 'end')).toBe('base end');
    });
  });

  describe('formatDate', () => {
    it('formats Date object', () => {
      const date = new Date('2024-01-15');
      expect(formatDate(date)).toMatch(/Jan 15, 2024/);
    });

    it('formats date string', () => {
      expect(formatDate('2024-01-15')).toMatch(/Jan 15, 2024/);
    });
  });

  describe('formatCurrency', () => {
    it('formats numbers as USD', () => {
      expect(formatCurrency(1000)).toBe('$1,000');
      expect(formatCurrency(1000000)).toBe('$1,000,000');
      expect(formatCurrency(50000000)).toBe('$50,000,000');
    });

    it('handles zero', () => {
      expect(formatCurrency(0)).toBe('$0');
    });

    it('handles negative numbers', () => {
      expect(formatCurrency(-1000)).toBe('-$1,000');
    });
  });

  describe('formatPercentage', () => {
    it('formats decimals as percentages', () => {
      expect(formatPercentage(0.95)).toBe('95%');
      expect(formatPercentage(0.5)).toBe('50%');
      expect(formatPercentage(1)).toBe('100%');
    });

    it('handles zero', () => {
      expect(formatPercentage(0)).toBe('0%');
    });
  });

  describe('getStatusColor', () => {
    it('returns correct colors for document statuses', () => {
      expect(getStatusColor('uploading')).toContain('blue');
      expect(getStatusColor('processing')).toContain('yellow');
      expect(getStatusColor('review_required')).toContain('orange');
      expect(getStatusColor('approved')).toContain('green');
      expect(getStatusColor('rejected')).toContain('red');
      expect(getStatusColor('failed')).toContain('red');
    });

    it('returns correct colors for project statuses', () => {
      expect(getStatusColor('prospecting')).toContain('gray');
      expect(getStatusColor('site_control')).toContain('blue');
      expect(getStatusColor('development')).toContain('purple');
      expect(getStatusColor('operational')).toContain('green');
    });

    it('returns default color for unknown status', () => {
      expect(getStatusColor('unknown_status')).toContain('gray');
    });
  });

  describe('getUrgencyColor', () => {
    it('returns correct colors for urgency levels', () => {
      expect(getUrgencyColor('low')).toContain('gray');
      expect(getUrgencyColor('medium')).toContain('blue');
      expect(getUrgencyColor('high')).toContain('orange');
      expect(getUrgencyColor('critical')).toContain('red');
    });
  });

  describe('truncate', () => {
    it('truncates long strings', () => {
      expect(truncate('This is a long string', 10)).toBe('This is a ...');
    });

    it('does not truncate short strings', () => {
      expect(truncate('Short', 10)).toBe('Short');
    });

    it('handles exact length', () => {
      expect(truncate('Exactly10!', 10)).toBe('Exactly10!');
    });
  });

  describe('generateId', () => {
    it('generates unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
    });

    it('generates non-empty strings', () => {
      const id = generateId();
      expect(id.length).toBeGreaterThan(0);
    });
  });
});
