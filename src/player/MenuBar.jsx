import React, { useState, useEffect, useRef } from 'react';

/**
 * Win98 menu bar driven by data:
 * menus: [{ id, label, accessKey, items: [{ label, onSelect, checked?, disabled? } | 'separator'] }]
 * Click opens a menu; while one is open, hovering another switches to it.
 */
const MenuBar = ({ menus }) => {
  const [openId, setOpenId] = useState(null);
  const barRef = useRef(null);

  useEffect(() => {
    if (!openId) return undefined;
    const onDown = (e) => {
      if (barRef.current && !barRef.current.contains(e.target)) setOpenId(null);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpenId(null);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [openId]);

  const renderLabel = (label, accessKey) => {
    const index = accessKey ? label.toLowerCase().indexOf(accessKey.toLowerCase()) : -1;
    if (index < 0) return label;
    return (
      <>
        {label.slice(0, index)}<u>{label[index]}</u>{label.slice(index + 1)}
      </>
    );
  };

  return (
    <div className="menu-bar" ref={barRef} role="menubar">
      {menus.map((menu) => (
        <div className="menu-bar-dropdown" key={menu.id}>
          <button
            type="button"
            className={`menu-bar-item ${openId === menu.id ? 'open' : ''}`}
            aria-haspopup="menu"
            aria-expanded={openId === menu.id}
            onClick={() => setOpenId((current) => (current === menu.id ? null : menu.id))}
            onPointerEnter={(e) => {
              if (openId && e.pointerType === 'mouse') setOpenId(menu.id);
            }}
          >
            {renderLabel(menu.label, menu.accessKey)}
          </button>
          {openId === menu.id && (
            <div className="menu-dropdown" role="menu">
              {menu.items.map((item, index) =>
                item === 'separator' ? (
                  <div className="menu-dropdown-separator" key={`sep-${index}`} />
                ) : (
                  <button
                    type="button"
                    key={item.label}
                    role={item.checked !== undefined ? 'menuitemcheckbox' : 'menuitem'}
                    aria-checked={item.checked}
                    className={`menu-dropdown-item ${item.checked ? 'checked' : ''}`}
                    disabled={item.disabled}
                    onClick={() => {
                      setOpenId(null);
                      item.onSelect();
                    }}
                  >
                    {item.label}
                    {item.shortcut && <span className="menu-shortcut">{item.shortcut}</span>}
                  </button>
                )
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default MenuBar;
