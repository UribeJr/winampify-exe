import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import '98.css';
import './styles/base.css';
import './styles/shell.css';
import './styles/player.css';
import './styles/mobile.css';
import './styles/assistant.css';
import { loadSkinStyles } from './styles/loadSkin';

// XP / 7 users: load that skin's stylesheets before the first render (falls back to 98 if that fails)
const html = document.documentElement;
const savedSkin = html.getAttribute('data-skin');
const skinReady = savedSkin
  ? loadSkinStyles(savedSkin).catch(() => html.removeAttribute('data-skin'))
  : Promise.resolve();

const root = ReactDOM.createRoot(document.getElementById('root'));
skinReady.then(() => root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
));
