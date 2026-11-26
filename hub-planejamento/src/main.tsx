import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import '@generated/theme-tokens.css';
import { MondayContextProvider, mondayClient } from '@/context/MondayContextProvider';
import { definirExecutor } from '@generated/lib/monday';
import App from '@generated/App';

// No navegador, as chamadas à API saem com o login de quem usa o app.
definirExecutor((query: string, variables: Record<string, unknown>) => mondayClient.api(query, { variables, apiVersion: '2026-10' }));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MondayContextProvider>
      <App />
    </MondayContextProvider>
  </StrictMode>
);
