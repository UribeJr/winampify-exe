import React, { useEffect, useRef, useLayoutEffect, useState } from 'react';

/**
 * Win98 context menu at (x, y), nudged back on-screen when it would overflow.
 * items: [{ label, action, bold?, disabled? } | { separator: true }]
 */
const ContextMenu = ({ x, y, items, onAction, onClose }) => {
  const menuRef = useRef(null);
  const [pos, setPos] = useState({ left: x, top: y });

  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setPos({
      left: Math.max(4, Math.min(x, window.innerWidth - width - 4)),
      top: Math.max(4, Math.min(y, window.innerHeight - height - 4))
    });
  }, [x, y]);

  useEffect(() => {
    const onDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    // Defer so the long-press/right-click that opened the menu doesn't close it
    const timer = setTimeout(() => {
      document.addEventListener('pointerdown', onDown);
    }, 0);
    document.addEventListener('keydown', onKey);
    window.addEventListener('blur', onClose);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('blur', onClose);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="context-menu"
      role="menu"
      style={pos}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, index) =>
        item.separator ? (
          <div key={`sep-${index}`} className="context-menu-separator" />
        ) : (
          <button
            type="button"
            key={item.label}
            role="menuitem"
            className={`context-menu-item ${item.bold ? 'bold' : ''}`}
            disabled={item.disabled}
            onClick={() => {
              onClose();
              onAction(item.action);
            }}
          >
            {item.label}
          </button>
        )
      )}
    </div>
  );
};

export default ContextMenu;
