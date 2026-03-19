import { renderHook } from '@testing-library/react';
import useDocumentTitle from '../hooks/useDocumentTitle';

describe('useDocumentTitle', () => {
  const originalTitle = document.title;

  afterEach(() => {
    document.title = originalTitle;
  });

  test('sets document title with Hireabble suffix', () => {
    renderHook(() => useDocumentTitle('Test Page'));
    expect(document.title).toBe('Test Page | Hireabble');
  });

  test('sets just "Hireabble" when title is empty', () => {
    renderHook(() => useDocumentTitle(''));
    expect(document.title).toBe('Hireabble');
  });

  test('sets just "Hireabble" when title is null', () => {
    renderHook(() => useDocumentTitle(null));
    expect(document.title).toBe('Hireabble');
  });

  test('restores previous title on unmount', () => {
    document.title = 'Previous Title';
    const { unmount } = renderHook(() => useDocumentTitle('New Title'));
    expect(document.title).toBe('New Title | Hireabble');

    unmount();
    expect(document.title).toBe('Previous Title');
  });

  test('updates title when value changes', () => {
    const { rerender } = renderHook(({ title }) => useDocumentTitle(title), {
      initialProps: { title: 'First' },
    });
    expect(document.title).toBe('First | Hireabble');

    rerender({ title: 'Second' });
    expect(document.title).toBe('Second | Hireabble');
  });
});
