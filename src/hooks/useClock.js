import { useState, useEffect } from 'react';

const format = () => new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

// Taskbar clock that actually ticks (re-renders at each minute boundary).
export default function useClock() {
  const [time, setTime] = useState(format);

  useEffect(() => {
    let timer;
    const schedule = () => {
      const msToNextMinute = 60000 - (Date.now() % 60000) + 50;
      timer = setTimeout(() => {
        setTime(format());
        schedule();
      }, msToNextMinute);
    };
    schedule();
    return () => clearTimeout(timer);
  }, []);

  return time;
}
