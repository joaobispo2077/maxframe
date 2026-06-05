import { act, renderHook } from '@testing-library/react';
import { useAppNavigation } from '@ui/hooks/useAppNavigation';
import { describe, expect, it } from 'vitest';

describe('useAppNavigation', () => {
  it('defaults to analyze tab', () => {
    const { result } = renderHook(() => useAppNavigation());

    expect(result.current.activeTab).toBe('analyze');
  });

  it('updates active tab via setActiveTab', () => {
    const { result } = renderHook(() => useAppNavigation());

    act(() => {
      result.current.setActiveTab('queue');
    });

    expect(result.current.activeTab).toBe('queue');
  });
});
