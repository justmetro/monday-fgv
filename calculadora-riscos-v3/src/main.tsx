import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider as JotaiProvider } from 'jotai';
import './index.css';
import '@generated/theme-tokens.css';
import { MondayContextProvider } from '@/context/MondayContextProvider';
import App from '@generated/App';

document.documentElement.classList.add('dark');
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <JotaiProvider>
      <MondayContextProvider>
        <App />
      </MondayContextProvider>
    </JotaiProvider>
  </StrictMode>
);
