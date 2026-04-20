import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
      .then((registration) => {
        // Force a version check now and every time the tab becomes visible,
        // so deployments are picked up without waiting the default 24h.
        registration.update();
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') registration.update();
        });
      })
      .catch((error) => {
        console.error('SW registration failed:', error);
      });
  });

  // When a new SW takes control (skipWaiting + clients.claim fired), reload
  // so the page runs the freshly cached JS/CSS bundles.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload();
  });
}
