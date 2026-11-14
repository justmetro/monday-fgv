import { ArrowUpRight } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@components/ui/sheet';
import { Cell, Pill } from '@generated/components/Pill';
import { EditableStatus } from '@generated/components/edit/Editable';
import { kindOf } from '@generated/lib/editing';
import { VAGA_FIELDS, PERFIL_FIELDS, PROG_FIELDS, MATCH_FIELDS } from '@generated/lib/fields';
import { fmtDate } from '@generated/lib/data';
import OpenInMonday from '@generated/components/OpenInMonday';
import { textVal } from '@generated/lib/engine';

const CONF = {
  vaga: { label: 'Vaga', fields: VAGA_FIELDS, status: 'statusDaVaga' },
  perfil: { label: 'Perfil para realocação', fields: PERFIL_FIELDS, status: 'statusDoPerfil' },
  prog: { label: 'Pedido de progressão', fields: PROG_FIELDS, status: 'statusProgresso' },
  match: { label: 'Match', fields: MATCH_FIELDS, status: 'statusDoMatch' },
};
const SKIP = new Set(['name', 'temDias', '_pessoa']);

function Related({ title, rows }) {
  return (
    <section className="mt-6">
      <h3 className="mb-2 text-sm font-medium">{title} <span className="text-muted-foreground">({rows.length})</span></h3>
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum registro.</p> : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {rows.map((r) => (
            <li key={r.key}>
              <button onClick={r.onClick} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-accent/40">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{r.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{r.sub}</span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">{r.pills}</span>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function DetailSheet({ detail, onClose, onOpen, byId }) {
  const conf = detail ? CONF[detail.type] : null;
  const it = detail?.item;
  const go = (id, fallback) => { const t = byId[id]; if (t) onOpen(t.type, t.item); else if (fallback) onOpen(...fallback); };

  return (
    <Sheet open={!!detail} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        {it && (
          <>
            <SheetHeader className="space-y-2 border-b border-border pb-4">
              <SheetDescription className="text-xs text-primary">{conf.label}</SheetDescription>
              <SheetTitle className="text-xl font-medium leading-snug tracking-tight">{detail.type === 'match' ? it._pessoa : it.name}</SheetTitle>
              <div className="flex flex-wrap items-center gap-2">
                {kindOf(conf.status, it) ? <EditableStatus item={it} fieldKey={conf.status} /> : <Pill fieldKey={conf.status} label={it[conf.status]} />}
                <OpenInMonday type={detail.type} itemId={it.id} className="ml-auto" />
              </div>
            </SheetHeader>
            <div className="px-4 pb-8">
              <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                {conf.fields.filter((f) => !SKIP.has(f.key)).map((f) => (
                  <div key={f.key} className={f.type === 'longtext' ? 'sm:col-span-2' : 'min-w-0'}>
                    <dt className="text-xs text-muted-foreground">{f.label}</dt>
                    <dd className="mt-0.5 min-w-0 break-words text-sm">
                      {f.type === 'longtext' ? <span className="whitespace-pre-wrap">{textVal(f, it) || '—'}</span> : <Cell field={f} item={it} />}
                    </dd>
                  </div>
                ))}
              </dl>

              {detail.type === 'vaga' && (
                <Related title="Pessoas em match" rows={it._matches.map((m) => ({
                  key: m.id, title: m._semPerfil ? `${m._pessoa} · sem perfil vinculado` : m._multiPerfil ? `${m._pessoa} · mais de um perfil vinculado` : m._pessoa, sub: `Envio ${fmtDate(m.dataDeEnvioDoCard)} · ${m.prximaAo || 'sem próxima ação'}`,
                  pills: <><Pill fieldKey="rodada" label={m.rodada} /><Pill fieldKey="statusDoMatch" label={m.statusDoMatch} /></>,
                  onClick: () => (m._perfilId && byId[m._perfilId] ? go(m._perfilId) : onOpen('match', m)),
                }))} />
              )}
              {detail.type === 'perfil' && (
                <Related title="Vagas em que está em match" rows={it._matches.map((m) => ({
                  key: m.id, title: m._vagaName, sub: m.resultadoDaRodada || 'Sem resultado',
                  pills: <><Pill fieldKey="rodada" label={m.rodada} /><Pill fieldKey="statusDoMatch" label={m.statusDoMatch} /></>,
                  onClick: () => go(m._vagaId),
                }))} />
              )}
              {detail.type === 'match' && (
                <Related title="Relacionados" rows={[
                  { key: 'v', title: it._vagaName, sub: 'Vaga', pills: null, onClick: () => go(it._vagaId) },
                  ...(it._links ?? []).filter((l) => byId[l.id]).map((l) => ({ key: `p-${l.id}`, title: l.name, sub: it._multiPerfil ? 'Perfil vinculado · atenção: mais de um perfil vinculado' : 'Perfil vinculado', pills: null, onClick: () => go(l.id) })),
                ]} />
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
