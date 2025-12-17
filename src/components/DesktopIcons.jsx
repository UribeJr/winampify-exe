import React from 'react';

const DesktopIcons = () => {
  const icons = [
    { id: 'my-computer', name: 'My Computer', icon: 'computer' },
    { id: 'my-documents', name: 'My Documents', icon: 'documents' },
    { id: 'internet-explorer', name: 'Internet Explorer', icon: 'ie' },
    { id: 'network-neighborhood', name: 'Network Neighborhood', icon: 'network' },
    { id: 'recycle-bin', name: 'Recycle Bin', icon: 'recycle-bin' },
  ];

  return (
    <div className="wmp-desktop-icons">
      {icons.map((icon) => (
        <div key={icon.id} className="desktop-icon">
          <div className={`desktop-icon-img icon-${icon.icon}`}></div>
          <div className="desktop-icon-text">{icon.name}</div>
        </div>
      ))}
    </div>
  );
};

export default DesktopIcons;

