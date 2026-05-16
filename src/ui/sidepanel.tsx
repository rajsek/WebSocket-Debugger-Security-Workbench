import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { getActiveTabContext, subscribeActiveTabContext } from '../extension/chromeAdapter';
import './styles.css';

createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App surface="sidepanel" loadTabContext={getActiveTabContext} subscribeTabContext={subscribeActiveTabContext} />
  </React.StrictMode>,
);
