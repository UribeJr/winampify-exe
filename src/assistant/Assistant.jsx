import React, { useEffect, useState, useCallback } from 'react';
import Disky from './Disky';
import { useAssistant } from './AssistantProvider';
import { TOUR } from './tips';
import useLongPress from '../hooks/useLongPress';

const SpeechBubble = ({ bubble, onAct, onClose }) => {
  const isTour = bubble.kind === 'tour';
  const actions = isTour
    ? [{ label: bubble.step < TOUR.length - 1 ? 'Next' : 'Done', action: 'next' }]
    : bubble.actions || [];
  return (
    <div className="assistant-bubble" role="status" aria-live="polite">
      <button type="button" className="assistant-bubble-close" aria-label="Close" onClick={onClose}>×</button>
      <p>{bubble.text}</p>
      {isTour && <p className="dialog-note">Step {bubble.step + 1} of {TOUR.length}</p>}
      {actions.length > 0 && (
        <div className={bubble.kind === 'menu' ? 'assistant-menu' : 'assistant-bubble-actions'}>
          {actions.map((a) => (
            <button type="button" key={a.label} onClick={() => onAct(a.action, a.payload)}>{a.label}</button>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Disky on screen. Undocked he sits in the bottom-right corner above the taskbar; docked
 * (phones, or a maximized window) he waits in the taskbar tray (see DiskyTrayButton) so he
 * never covers the player's controls. Speech bubbles appear above him either way.
 */
const Assistant = ({ docked }) => {
  const { hidden, mood, bubble, click, act, close, openMenu } = useAssistant();
  const [entering, setEntering] = useState(true);

  useEffect(() => {
    if (hidden) return undefined;
    setEntering(true);
    const t = setTimeout(() => setEntering(false), 1000);
    return () => clearTimeout(t);
  }, [hidden, docked]);

  useEffect(() => {
    if (!bubble) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [bubble, close]);

  const longPress = useLongPress(useCallback(() => openMenu(), [openMenu]));

  // A reminder the user asked for still pops up while Disky is hidden
  if (hidden && bubble?.kind !== 'reminder') return null;
  if (docked && !bubble) return null; // only the tray icon shows

  return (
    <div className={`assistant ${docked ? 'docked' : ''} ${entering && !docked ? 'entering' : ''}`}>
      {bubble && <SpeechBubble bubble={bubble} onAct={act} onClose={close} />}
      {!docked && (
        <button
          type="button"
          className="assistant-character"
          aria-label="Disky, your assistant"
          title="Disky"
          onClick={click}
          onContextMenu={(e) => { e.preventDefault(); openMenu(); }}
          {...longPress}
        >
          <Disky mood={mood} lookAt={bubble ? 'up' : 'center'} />
        </button>
      )}
    </div>
  );
};

// Docked Disky: a tiny CD in the taskbar tray that wobbles when he has something to say
export const DiskyTrayButton = () => {
  const { hidden, mood, bubble, click } = useAssistant();
  if (hidden) return null;
  return (
    <button
      type="button"
      className={`tray-disky ${bubble ? 'has-news' : ''}`}
      aria-label="Disky, your assistant"
      title="Disky"
      onClick={click}
    >
      <Disky mood={mood === 'sleepy' ? 'sleepy' : 'idle'} size={18} />
    </button>
  );
};

export default Assistant;
