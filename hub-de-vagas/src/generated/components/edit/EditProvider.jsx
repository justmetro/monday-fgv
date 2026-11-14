import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@components/ui/alert-dialog';
import { persist, sameValue, isSensitive, isPermissionError, FIELD_LABEL, rawLabel } from '@generated/lib/editing';
import { isConclusao } from '@generated/lib/esteira';
import { canon } from '@generated/lib/normalize';
import { fmtDate } from '@generated/lib/data';
import { checkPermissions } from '@generated/lib/boardMeta';

const KEY = 'hub-edit-mode';
const EditCtx = createContext({ editMode: false, canFor: () => false, isPending: () => false, edit: async () => {} });
export const useEdit = () => useContext(EditCtx);

const show = (v) => (v instanceof Date || (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) ? fmtDate(v) : canon(v) || 'vazio');

export default function EditProvider({ patch, lookup, children }) {
  const [editMode, setEditModeState] = useState(() => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } });
  const [denied, setDenied] = useState({ main: false, sub: false });
  const [pendingKeys, setPendingKeys] = useState(() => new Set());
  const pendingRef = useRef(new Map()); // `${itemId}:${field}` → version
  const seq = useRef(0);
  const [savedAt, setSavedAt] = useState(null);
  const [ask, setAsk] = useState(null);
  const resolver = useRef(null);
  const lookupRef = useRef(lookup);
  lookupRef.current = lookup;

  // Write permission is checked up-front on both boards; a failed save with a permission error also locks.
  const [perm, setPerm] = useState(null); // null = checking
  const runCheck = useCallback(async () => {
    setPerm(null);
    const p = await checkPermissions();
    console.info('[perm] resultado', p);
    setPerm(p);
    setDenied({ main: false, sub: false });
  }, []);
  useEffect(() => { runCheck(); }, [runCheck]);
  const checking = perm == null;
  const perms = perm ?? { main: false, sub: false };
  const safeMode = perm?.status === 'safe'; // check failed → edit allowed, but no optimistic update
  const canFor = useCallback((kind) => {
    const scope = kind === 'match' ? 'sub' : 'main';
    return !!kind && perms[scope] && !denied[scope];
  }, [perms, denied]);
  const anyEdit = canFor('vaga') || canFor('match');
  const lockReason = checking ? 'Verificando permissões…' : 'Sem permissão de edição';

  const setEditMode = (v) => { setEditModeState(v); try { localStorage.setItem(KEY, v ? '1' : '0'); } catch { /* noop */ } };
  const isPending = useCallback((id, key) => pendingKeys.has(`${id}:${key}`), [pendingKeys]);

  const confirm = (info) => new Promise((resolve) => { resolver.current = resolve; setAsk(info); });
  const close = (ok) => { resolver.current?.(ok); resolver.current = null; setAsk(null); };
  const sync = () => setPendingKeys(new Set(pendingRef.current.keys()));

  const edit = useCallback(async (kind, item, key, value, opts = {}) => {
    if (!kind || !item?.id || !canFor(kind)) return; // never optimistic without permission
    const slot = `${item.id}:${key}`;
    if (pendingRef.current.has(slot)) return; // one write at a time per item+field
    const live = lookupRef.current?.(item.id) ?? item;
    const prev = live[key] ?? null;
    if (opts.expect !== undefined && !sameValue(prev, opts.expect)) {
      toast.warning('Não foi possível desfazer', { description: `${FIELD_LABEL[key]} já foi alterado depois desta edição.` });
      return;
    }
    if (sameValue(prev, value)) return;
    if (!opts.skipConfirm && isSensitive(key, value)) {
      const ok = await confirm({ title: `Alterar ${FIELD_LABEL[key]} para “${canon(value)}”?`, desc: `${live._pessoa ?? live.name} — esta mudança costuma encerrar o processo. Confirme para gravar no quadro.` });
      if (!ok) return;
    }
    const version = ++seq.current;
    pendingRef.current.set(slot, version); sync();
    if (!safeMode) patch(kind, item.id, key, value); // optimistic, this field only (skipped in modo seguro)
    try {
      await persist(kind, live, key, value);
      if (safeMode) patch(kind, item.id, key, value); // modo seguro: show only after the API confirmed
      setSavedAt(Date.now());
      if (opts.undo) toast('Alteração desfeita', { description: `${FIELD_LABEL[key]}: ${show(value)}` });
      else {
        toast.success(`${FIELD_LABEL[key]} atualizado`, {
          description: `${live._pessoa ?? live.name}: ${show(prev)} → ${show(value)}`,
          duration: 10000,
          action: { label: 'Desfazer', onClick: () => edit(kind, live, key, prev, { undo: true, skipConfirm: true, expect: value }) },
        });
        // Realocação/contratação concluída no match → propor fechar a vaga no quadro.
        const vaga = kind === 'match' && isConclusao(key, value) ? lookupRef.current?.(live._vagaId) : null;
        if (vaga && !vaga._alocada && canFor('vaga')) {
          setTimeout(async () => {
            const ok = await confirm({ title: 'Match concluído — fechar a vaga?', desc: `${vaga.name} (Cód. ${vaga.id}): o Status da Vaga passa para “Preenchida” no quadro e a vaga sai das visualizações do app.`, cta: 'Fechar vaga' });
            if (ok) edit('vaga', vaga, 'statusDaVaga', rawLabel('statusDaVaga', 'Preenchida'), { skipConfirm: true });
          }, 0);
        }
      }
    } catch (e) {
      console.error('Falha ao salvar alteração', e);
      // Revert only this field, and only if it still holds what this edit wrote.
      if (!safeMode) patch(kind, item.id, key, prev, (cur) => sameValue(cur, value));
      if (isPermissionError(e)) { console.error('[perm] gravação recusada por permissão', e); setDenied((d) => ({ ...d, [kind === 'match' ? 'sub' : 'main']: true })); }
      toast.error('Não foi possível salvar', { description: isPermissionError(e) ? 'Sem permissão de edição neste quadro.' : (e?.message ?? 'Erro desconhecido. Tente novamente.') });
    } finally {
      if (pendingRef.current.get(slot) === version) pendingRef.current.delete(slot);
      sync();
    }
  }, [patch, canFor, safeMode]);

  const closeVaga = useCallback((vaga) => edit('vaga', vaga, 'statusDaVaga', rawLabel('statusDaVaga', 'Preenchida')), [edit]);

  const value = useMemo(() => ({ closeVaga, editMode, setEditMode, canFor, anyEdit, checking, lockReason, perm, denied, retryPerm: runCheck, edit, isPending, pending: pendingKeys.size, savedAt }),
    [closeVaga, editMode, canFor, anyEdit, checking, lockReason, perm, denied, runCheck, edit, isPending, pendingKeys, savedAt]);

  return (
    <EditCtx.Provider value={value}>
      {children}
      <AlertDialog open={!!ask} onOpenChange={(o) => { if (!o) close(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{ask?.title}</AlertDialogTitle>
            <AlertDialogDescription>{ask?.desc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => close(false)}>{ask?.cta ? 'Agora não' : 'Cancelar'}</AlertDialogCancel>
            <AlertDialogAction onClick={() => close(true)}>{ask?.cta ?? 'Confirmar alteração'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </EditCtx.Provider>
  );
}
