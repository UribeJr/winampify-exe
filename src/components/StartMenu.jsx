import React, { useState, useEffect, useRef } from 'react';

const StartMenu = ({ isOpen, onClose }) => {
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target) && !event.target.closest('.taskbar-start')) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="wmp-start-menu" ref={menuRef}>
      <div className="start-menu-side">
        <span className="start-menu-brand">Windows</span>
        <span className="start-menu-brand-version">98</span>
      </div>
      <div className="start-menu-list">
        <div className="start-menu-item">
          <span className="start-menu-icon icon-update"></span>
          <span className="start-menu-text">Windows Update</span>
        </div>
        <div className="start-menu-separator"></div>
        <div className="start-menu-item">
          <span className="start-menu-icon icon-programs"></span>
          <span className="start-menu-text">Programs</span>
          <span className="start-menu-arrow">▸</span>
        </div>
        <div className="start-menu-item">
          <span className="start-menu-icon icon-favorites"></span>
          <span className="start-menu-text">Favorites</span>
          <span className="start-menu-arrow">▸</span>
        </div>
        <div className="start-menu-item">
          <span className="start-menu-icon icon-documents"></span>
          <span className="start-menu-text">Documents</span>
          <span className="start-menu-arrow">▸</span>
        </div>
        <div className="start-menu-item">
          <span className="start-menu-icon icon-settings"></span>
          <span className="start-menu-text">Settings</span>
          <span className="start-menu-arrow">▸</span>
        </div>
        <div className="start-menu-item">
          <span className="start-menu-icon icon-find"></span>
          <span className="start-menu-text">Find</span>
          <span className="start-menu-arrow">▸</span>
        </div>
        <div className="start-menu-item">
          <span className="start-menu-icon icon-help"></span>
          <span className="start-menu-text">Help</span>
        </div>
        <div className="start-menu-item">
          <span className="start-menu-icon icon-run"></span>
          <span className="start-menu-text">Run...</span>
        </div>
        <div className="start-menu-separator"></div>
        <div className="start-menu-item">
          <span className="start-menu-icon icon-logoff"></span>
          <span className="start-menu-text">Log Off...</span>
        </div>
        <div className="start-menu-item">
          <span className="start-menu-icon icon-shutdown"></span>
          <span className="start-menu-text">Shut Down...</span>
        </div>
      </div>
    </div>
  );
};

export default StartMenu;

