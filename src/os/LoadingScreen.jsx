import React, { useState, useEffect } from 'react';

const MESSAGES = [
  "Starting Winampify…",
  "Loading Windows Media Player…"
];

const LoadingScreen = ({ onComplete }) => {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [logsVisible, setLogsVisible] = useState(true);

  useEffect(() => {
    const timeouts = [];
    let completeTimeoutRef = null;

    // Sequence messages and progress
    const messageTimings = [400, 1200];
    const progressTimings = [
      { time: 0, val: 0 },
      { time: 400, val: 20 },
      { time: 800, val: 40 },
      { time: 1200, val: 60 },
      { time: 1800, val: 80 },
      { time: 2400, val: 95 },
      { time: 2800, val: 100 } // Progress bar finishes later
    ];

    // Handle messages appearance
    messageTimings.forEach((time, index) => {
      const timeout = setTimeout(() => {
        setCurrentMessageIndex(index);
      }, time);
      timeouts.push(timeout);
    });

    // Handle progress bar
    progressTimings.forEach(({ time, val }) => {
      const timeout = setTimeout(() => {
        setProgress(val);
      }, time);
      timeouts.push(timeout);
    });

    // 1. Fade out text first (at 2400ms)
    const textFadeTimeout = setTimeout(() => {
      setLogsVisible(false);
    }, 2400);
    timeouts.push(textFadeTimeout);

    // 2. Progress bar finishes (at 2800ms - handled in progressTimings)

    // 3. 200ms pause (after 2800ms), then fade out the whole screen
    const screenFadeTimeout = setTimeout(() => {
      setIsVisible(false);
      // Let the screen fade out completely before calling onComplete
      completeTimeoutRef = setTimeout(() => {
        if (onComplete) onComplete();
      }, 600);
    }, 3000);
    timeouts.push(screenFadeTimeout);

    return () => {
      timeouts.forEach(timeout => clearTimeout(timeout));
      if (completeTimeoutRef) clearTimeout(completeTimeoutRef);
    };
  }, [onComplete]);

  return (
    <div className={`loading-screen ${!isVisible ? 'fade-out' : ''}`}>
      <div className="loading-content">
        <div className={`loading-logs ${!logsVisible ? 'fade-out-text' : ''}`}>
          {MESSAGES.map((msg, idx) => (
            <div 
              key={idx} 
              className={`loading-log ${idx <= currentMessageIndex ? 'visible' : ''}`}
            >
              {idx <= currentMessageIndex ? msg : ''}
            </div>
          ))}
        </div>
        
        <div className="loading-progress-container">
          <div className="loading-progress-bar">
            <div 
              className="loading-progress-fill" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <div className="loading-percentage">{progress}%</div>
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;

