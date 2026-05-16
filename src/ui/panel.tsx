import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { getDevtoolsTabContext } from '../extension/chromeAdapter';
import './styles.css';

createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App surface="devtools" loadTabContext={async () => getDevtoolsTabContext()} />
  </React.StrictMode>,
);
