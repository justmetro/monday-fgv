import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Loader2, Keyboard } from 'lucide-react';
import { Toaster } from '@components/ui/sonner';
import EditProvider from '@generated/components/edit/EditProvider';
import EditControls from '@generated/components/edit/EditControls';
import ShortcutsHelp from '@generated/components/ShortcutsHelp';
import { useShortcuts } from '@generated/hooks/useShortcuts';
import Sidebar, { NAV, ago } from '@generated/components/Sidebar';
import Overview from '@generated/components/Overview';
import ModuleView from '@generated/components/ModuleView';
import DetailSheet from '@generated/components/DetailSheet';
import CommandSearch from '@generated/components/CommandSearch';
import { useHub } from '@generated/hooks/useHub';
import { useSavedViews } from '@generated/hooks/useSavedViews';
import { useThemeMode } from '@generated/hooks/useThemeMode';
import ThemeToggle from '@generated/components/ThemeToggle';
import ActionToday from '@generated/components/ActionToday';
import AutoMatch from '@generated/components/automatch/AutoMatch';
import VagaPage from '@generated/components/pages/VagaPage';
import PessoaPage from '@generated/components/pages/PessoaPage';
import { clean } from '@generated/lib/normalize';
import { MODULES, defaultState, withPreset } from '@generated/lib/modules';

function LoadingState() {
  return (
    <div className="flex flex-col gap-4">
      <div className="h-40 animate-pulse rounded-md bg-muted" />
      <div className="grid gap-4 xl:grid-cols-2">{['a', 'b', 'c', 'd'].map((k) => <div key={k} className="h-64 animate-pulse rounded-md bg-muted" />)}</div>
    </div>
  );
}

export default function App() {
  const { data, meta, loading, refetching, error, updatedAt, reload, patch } = useHub();
  const saved = useSavedViews();
  const theme = useThemeMode();
  const [active, setActive] = useState('today');
  const [pages, setPages] = useState([]);
  const [states, setStates] = useState(() => {
    const base = { vagas: defaultState('vagas'), perfis: defaultState('perfis'), };
    return base;
  });
  const [detail, setDetail] = useState(null);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);

  const go = useCallback((id, state) => {
    if (state) setStates((s) => ({ ...s, [id]: state }));
    setActive(id);
    setPages([]);
    window.scrollTo({ top: 0 });
  }, []);
  const setModuleState = useCallback((id) => (updater) => setStates((s) => ({ ...s, [id]: typeof updater === 'function' ? updater(s[id]) : updater })), []);
  const openPage = useCallback((type, id) => {
    setDetail(null);
    setPages((p) => (p[p.length - 1]?.id === id ? p : [...p, { type, id }]));
    window.scrollTo({ top: 0 });
  }, []);
  const openDetail = useCallback((type, item) => {
    if ((type === 'vaga' || type === 'perfil') && item?.id) openPage(type, item.id);
    else setDetail({ type, item });
  }, [openPage]);
  const back = () => { setPages((p) => p.slice(0, -1)); window.scrollTo({ top: 0 }); };
  const page = pages[pages.length - 1];
  const pageItem = page ? data.byId[page.id]?.item : null;
  const originLabel = NAV.find((n) => n.id === active)?.label ?? 'Início';
  const toModule = () => setPages([]);
  const openVagaId = (id) => openPage('vaga', id);
  const openPerfilId = (id) => openPage('perfil', id);
  const openMatch = (m) => setDetail({ type: 'match', item: m });


  useShortcuts({
    search: () => setCmdOpen((o) => !o),
    help: () => setHelpOpen(true),
    goto: (id) => go(id),
    escape: () => {
      if (cmdOpen || helpOpen || detail) return; // dialogs/panels close themselves
      if (document.querySelector('[data-radix-popper-content-wrapper], [role="dialog"], [role="alertdialog"]')) return; // open menu/picker
      if (document.activeElement?.tagName === 'INPUT') return;
      if (pages.length) back();
    },
  });

  const navItem = NAV.find((n) => n.id === active);
  const mod = MODULES[active];
  const counts = loading ? null : { today: null, vagas: data.vagas.length, perfis: data.perfis.length };

  // Panels always read the live item so optimistic edits show immediately.
  const liveDetail = detail ? { ...detail, item: data.byId[detail.item?.id]?.item ?? detail.item } : null;

  return (
    <EditProvider patch={patch} lookup={(id) => data.byId[id]?.item}>
    <div className="min-h-screen bg-background text-foreground md:flex">
      <Sidebar active={active} onNav={(id) => go(id)} counts={counts} onSearch={() => setCmdOpen(true)} onRefresh={reload} refetching={refetching} updatedAt={updatedAt} now={now} />
      <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8">
        <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Gestão de Realocação, Progressão e Contratação</p>
            <h2 className="mt-0.5 text-2xl font-medium tracking-tight">{page ? (page.type === 'vaga' ? 'Ficha da vaga' : 'Ficha da pessoa') : navItem?.label}</h2>
          </div>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            {refetching && <span className="hidden items-center gap-1.5 text-xs text-muted-foreground md:flex"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Atualizando…</span>}
            <button onClick={() => setHelpOpen(true)} aria-label="Atalhos de teclado" title="Atalhos de teclado (?)" className="hidden h-9 w-9 items-center justify-center rounded-full border border-border bg-card hover:border-primary/50 md:flex">
              <Keyboard className="h-4 w-4" />
            </button>
            <EditControls />
            <ThemeToggle mode={theme.mode} setMode={theme.setMode} />
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground md:hidden">
            <span>{ago(updatedAt, now)}</span>
            <button onClick={reload} disabled={refetching || loading} aria-label="Atualizar" className="flex h-10 w-10 items-center justify-center rounded-full border border-border disabled:opacity-50">
              {refetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
            <button onClick={reload} className="rounded-full border border-destructive/50 px-3 py-1 text-xs">Tentar novamente</button>
          </div>
        )}

        {!loading && page && (
          pageItem ? (
            <div key={page.id} className="animate-in fade-in-0 slide-in-from-bottom-1 duration-200">
              {page.type === 'vaga'
                ? <VagaPage vaga={pageItem} byId={data.byId} onBack={back} openPerfil={openPerfilId} openMatch={openMatch}
                    crumbs={[{ label: originLabel, onClick: toModule }, { label: clean(pageItem.projeto) ?? 'Sem projeto', onClick: clean(pageItem.projeto) ? () => go('vagas', withPreset('vagas', 'rodadas', { filters: { statusDaVaga: [], projeto: [pageItem.projeto] } })) : null }, { label: pageItem.name }]} />
                : <PessoaPage perfil={pageItem} onBack={back} openVaga={openVagaId}
                    crumbs={[{ label: originLabel, onClick: toModule }, { label: 'Perfis para Realocação', onClick: () => go('perfis') }, { label: pageItem.name }]} />}
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Este item não está mais disponível. <button onClick={back} className="ml-2 text-primary hover:underline">Voltar</button>
            </div>
          )
        )}
        {loading ? <LoadingState /> : (
          <div className={page ? 'hidden' : refetching ? 'opacity-70 transition-opacity' : 'animate-in fade-in-0 duration-200 transition-opacity'}>
            {active === 'today' && <ActionToday data={data} openVaga={openVagaId} openPerfil={openPerfilId} openMatch={openMatch} />}
            {active === 'overview' && <Overview data={data} go={go} />}
            {active === 'automatch' && <AutoMatch reload={reload} updatedAt={updatedAt} openVaga={openVagaId} openPerfil={openPerfilId} />}
            {mod && (
              <ModuleView key={active} mod={mod} state={states[active]} setState={setModuleState(active)} data={data}
                onOpen={openDetail} saved={saved} onApplySaved={(v) => go(v.module, v.state)} />
            )}
          </div>
        )}
      </main>

      <DetailSheet detail={liveDetail} onClose={() => setDetail(null)} onOpen={openDetail} byId={data.byId} />
      <ShortcutsHelp open={helpOpen} onOpenChange={setHelpOpen} />
      <Toaster position="bottom-right" />
      <CommandSearch open={cmdOpen} onOpenChange={setCmdOpen} data={data} onPick={openDetail}
        onProject={(p) => go('vagas', withPreset('vagas', 'rodadas', { filters: { statusDaVaga: [], projeto: [p] } }))} />
    </div>
    </EditProvider>
  );
}
