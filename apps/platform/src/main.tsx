import { cssVariables } from 'platform-tokens';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Shell } from './shell';
import 'platform-ui/styles.css';
import './shell.css';

const tokenStyle = document.createElement('style');
tokenStyle.textContent = cssVariables();
document.head.appendChild(tokenStyle);

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root');

createRoot(root).render(
  <StrictMode>
    <Shell />
  </StrictMode>,
);
