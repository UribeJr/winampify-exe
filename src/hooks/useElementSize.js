import { useState, useLayoutEffect } from 'react';

// Tracks an element's content size with ResizeObserver. Pass the element (from a callback ref).
export default function useElementSize(element) {
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight - 30 });

  useLayoutEffect(() => {
    if (!element) return undefined;
    const update = () => setSize({ width: element.clientWidth, height: element.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);

  return size;
}
