import React from 'react';

const PUPIL_OFFSET = { center: [0, 0], left: [-2.2, 0.4], right: [2.2, 0.4], up: [0, -2.2], down: [0, 1.8] };

// Mouth shape per mood (drawn below the center hole)
const MOUTHS = {
  idle: <path d="M25 46 Q32 50 39 46" className="disky-mouth" />,
  talk: <ellipse cx="32" cy="47" rx="4.5" ry="3" className="disky-mouth-fill disky-talking" />,
  happy: <path d="M23 44 Q32 53 41 44 Q32 49 23 44 Z" className="disky-mouth-fill" />,
  wave: <path d="M23 44 Q32 53 41 44 Q32 49 23 44 Z" className="disky-mouth-fill" />,
  surprised: <ellipse cx="32" cy="47.5" rx="3" ry="3.6" className="disky-mouth-fill" />,
  confused: <path d="M25 47 Q28.5 44.5 32 47 T39 46" className="disky-mouth" />,
  dizzy: <path d="M25 47 Q28.5 44.5 32 47 T39 46" className="disky-mouth" />,
  sleepy: <path d="M28 47 Q32 48.5 36 47" className="disky-mouth" />
};

// Eyebrows per mood: [left, right] path data
const BROWS = {
  idle: ['M17 15.5 Q22 13.5 27 15.5', 'M37 15.5 Q42 13.5 47 15.5'],
  talk: ['M17 15 Q22 13 27 15', 'M37 15 Q42 13 47 15'],
  happy: ['M17 14 Q22 11.5 27 14', 'M37 14 Q42 11.5 47 14'],
  wave: ['M17 14 Q22 11.5 27 14', 'M37 14 Q42 11.5 47 14'],
  surprised: ['M17 12.5 Q22 9.5 27 12.5', 'M37 12.5 Q42 9.5 47 12.5'],
  confused: ['M17 16.5 Q22 15.5 27 14', 'M37 12 Q42 10 47 13'],
  dizzy: ['M17 16.5 Q22 15.5 27 14', 'M37 12 Q42 10 47 13'],
  sleepy: ['M17 17 Q22 16.5 27 17', 'M37 17 Q42 16.5 47 17']
};

const Eye = ({ cx, cy, look, closed, dizzy }) => {
  if (closed) return <path d={`M${cx - 5} ${cy + 0.5} Q${cx} ${cy + 3.5} ${cx + 5} ${cy + 0.5}`} className="disky-mouth" />;
  const [dx, dy] = PUPIL_OFFSET[look] || PUPIL_OFFSET.center;
  return (
    <g className="disky-eye">
      <circle cx={cx} cy={cy} r="6" className="disky-eye-white" />
      {dizzy ? (
        <path d={`M${cx - 2.5} ${cy - 2.5} L${cx + 2.5} ${cy + 2.5} M${cx + 2.5} ${cy - 2.5} L${cx - 2.5} ${cy + 2.5}`} className="disky-mouth" />
      ) : (
        <>
          <circle cx={cx + dx} cy={cy + dy} r="2.7" className="disky-pupil" />
          <circle cx={cx + dx + 0.9} cy={cy + dy - 1} r="0.8" fill="#ffffff" />
        </>
      )}
      {/* Eyelid for blinking (scaled from 0 → 1 by CSS) */}
      <ellipse cx={cx} cy={cy} rx="6.6" ry="6.6" className="disky-lid" />
    </g>
  );
};

/**
 * Disky: an original CD mascot (not Clippy). Pure SVG so he's crisp at any size;
 * moods swap the face, and CSS (styles/assistant.css) animates bob/blink/spin/wobble/talk.
 */
const Disky = ({ mood = 'idle', lookAt = 'center', size = 72, className = '' }) => {
  const brows = BROWS[mood] || BROWS.idle;
  const sleepy = mood === 'sleepy';
  return (
    <svg
      className={`disky mood-${mood} ${className}`}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label={`Disky looking ${mood}`}
    >
      <defs>
        <radialGradient id="disky-silver" cx="38%" cy="32%" r="75%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="45%" stopColor="#dde2ea" />
          <stop offset="100%" stopColor="#9ea7b4" />
        </radialGradient>
        <linearGradient id="disky-rainbow" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ff7aa8" />
          <stop offset="22%" stopColor="#ffd36b" />
          <stop offset="45%" stopColor="#7ee08a" />
          <stop offset="68%" stopColor="#6fd3f7" />
          <stop offset="100%" stopColor="#b38bff" />
        </linearGradient>
      </defs>

      <g className="disky-body">
        {/* the disc */}
        <circle cx="32" cy="32" r="28" fill="url(#disky-silver)" stroke="#5f6774" strokeWidth="1.5" />
        <circle cx="32" cy="32" r="20.5" fill="none" stroke="url(#disky-rainbow)" strokeWidth="7" opacity="0.5" className="disky-sheen" />
        <path d="M14 22 A20 20 0 0 1 26 13" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" opacity="0.85" />
        {/* center hole */}
        <circle cx="32" cy="32" r="6.2" fill="#eef1f5" stroke="#8a929e" strokeWidth="1" />
        <circle cx="32" cy="32" r="2.6" fill="#c3c9d2" stroke="#8a929e" strokeWidth="0.8" />

        {/* face */}
        <path d={brows[0]} className="disky-brow" />
        <path d={brows[1]} className="disky-brow" />
        <Eye cx={22} cy={23} look={lookAt} closed={sleepy} dizzy={mood === 'dizzy'} />
        <Eye cx={42} cy={23} look={lookAt} closed={sleepy} dizzy={mood === 'dizzy'} />
        {MOUTHS[mood] || MOUTHS.idle}
        {(mood === 'happy' || mood === 'wave') && (
          <>
            <ellipse cx="14.5" cy="34" rx="3" ry="1.8" fill="#ff9db8" opacity="0.6" />
            <ellipse cx="49.5" cy="34" rx="3" ry="1.8" fill="#ff9db8" opacity="0.6" />
          </>
        )}
      </g>

      {/* a little white glove for waving */}
      {mood === 'wave' && (
        <g className="disky-hand">
          <path d="M57 30 q4 -1 5 -5 q1 -3 -1.5 -3.5 q-1 -2.5 -3 -1.5 q-1.5 -2 -3.5 -0.5 q-2.5 -0.5 -2.5 2 l0.5 6 q1 3 5 2.5 z" fill="#ffffff" stroke="#5f6774" strokeWidth="1" />
        </g>
      )}

      {sleepy && (
        <g className="disky-zzz" fill="#1a3a7a" fontFamily="var(--font-ui)" fontWeight="bold">
          <text x="48" y="14" fontSize="8">z</text>
          <text x="53" y="8" fontSize="6">z</text>
          <text x="57" y="4" fontSize="5">z</text>
        </g>
      )}
    </svg>
  );
};

export default Disky;
