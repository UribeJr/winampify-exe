import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import '98.css';
import './styles/base.css';
import './styles/shell.css';
import './styles/player.css';
import './styles/mobile.css';
import './styles/assistant.css';
import { loadXpSkin } from './styles/loadSkin';

// XP users: load the XP stylesheets before the first render (falls back to 98 if that fails)
const html = document.documentElement;
const skinReady = html.getAttribute('data-skin') === 'xp'
  ? loadXpSkin().catch(() => html.removeAttribute('data-skin'))
  : Promise.resolve();

const root = ReactDOM.createRoot(document.getElementById('root'));
skinReady.then(() => root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
));
