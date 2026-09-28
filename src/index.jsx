import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import '98.css';
import './styles/base.css';
import './styles/shell.css';
import './styles/player.css';
import './styles/mobile.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
