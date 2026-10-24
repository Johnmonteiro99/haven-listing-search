import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './theme/fonts.css';
import './styles.css';
import './map/mobileMap.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
