import { useState } from 'react';

const KEY = 'hub-realocacao-views-v1';

const read = () => {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]'); }
  catch (e) { console.error('Falha ao ler visualizações salvas', e); return []; }
};

export function useSavedViews() {
  const [views, setViews] = useState(read);
  const persist = (next) => {
    setViews(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); }
    catch (e) { console.error('Falha ao salvar visualizações', e); }
  };
  return {
    views,
    save: (name, module, state) => persist([...views, { id: String(Date.now()), name, module, state }]),
    remove: (id) => persist(views.filter((v) => v.id !== id)),
  };
}
