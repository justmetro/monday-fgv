import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, MinusCircle, AlertCircle, X } from 'lucide-react';
import type { PanelCsvPlan } from '@generated/lib/panelCsv';
import { formatBR, parseDateFlexible } from '@generated/lib/dates';
import { WEEKDAYS, weekdayTitle } from '@generated/lib/weekdays';

interface Props {
  plan: PanelCsvPlan;
  groupName: string;
  analysisDate: string;
  boardName: string | null;
  boardError: string | null;
  groupExists: boolean;
  sameGroupSameDate: boolean;
  otherGroupsSameDate: string[];
  weekStart: string;
  weekEnd: string;
  periodChangeFrom: string | null;
  confirmPeriodChange: boolean;
  onConfirmPeriodChange: (v: boolean) => void;
  confirmOtherGroup: boolean;
  onConfirmOtherGroup: (v: boolean) => void;
  busy: boolean;
  /** otherGroupConfirmed: a pessoa confirmou também o envio da data que já consta em outro grupo */
  onConfirm: (otherGroupConfirmed: boolean) => void;
  onDiscard: () => void;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-[hsl(var(--brand-sky-2))] border border-border p-3 min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold text-[hsl(var(--brand-navy))] tabular-nums truncate" title={String(value)}>{value}</p>
    </div>
  );
}

export function PanelUploadPreview({
  plan, groupName, analysisDate, boardName, boardError, groupExists, sameGroupSameDate, otherGroupsSameDate,
  weekStart, weekEnd, periodChangeFrom, confirmPeriodChange, onConfirmPeriodChange,
  confirmOtherGroup, onConfirmOtherGroup, busy, onConfirm, onDiscard,
}: Props) {
  const [showOverwriteModal, setShowOverwriteModal] = useState(false);
  const needsOtherConfirm = otherGroupsSameDate.length > 0;
  const missingDays = plan.missingDayColumns.length > 0;
  const blocked = (plan.rows.length === 0 && plan.deactivations.length === 0) || missingDays || (needsOtherConfirm && !sameGroupSameDate && !confirmOtherGroup) || (Boolean(periodChangeFrom) && !confirmPeriodChange);

  const handleConfirmClick = () => {
    if (sameGroupSameDate) { setShowOverwriteModal(true); return; }
    onConfirm(confirmOtherGroup);
  };

  return (
    <section className="bg-card rounded-3xl soft-stack-card p-5 sm:p-6 space-y-5 relative">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Prévia obrigatória</p>
        <h3 className="text-lg font-medium text-foreground">Grava primeiro na Base e depois espelha em “{boardName ?? 'quadro'}”</h3>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Stat label="Grupo" value={`${groupName} · ${boardName ? (groupExists ? 'existente' : 'novo') : '—'}`} />
        <Stat label="Data da análise" value={formatBR(parseDateFlexible(analysisDate))} />
        <Stat label="Período da semana (digitado)" value={`${weekStart.split('-').reverse().join('/')} a ${weekEnd.split('-').reverse().join('/')}`} />
        <Stat label="Dia da análise" value={weekdayTitle(plan.weekday)} />
        <Stat label="Checks novos" value={plan.checksToMark} />
        <Stat label="Linhas a criar" value={plan.toCreate} />
        <Stat label="Linhas a atualizar" value={plan.toUpdate} />
        <Stat label="Sem alteração" value={plan.unchanged} />
        <Stat label="Linhas lidas" value={plan.rowsRead} />
        <Stat label="Ignoradas (desativadas sem linha na semana)" value={plan.discardedByStatus} />
      </div>

      <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs space-y-1.5">
        <p className="font-medium text-foreground">Status das pessoas nesta semana</p>
        <p className="text-muted-foreground">
          Serão criadas: <strong className="text-foreground">{plan.toCreate}</strong> · Serão atualizadas: <strong className="text-foreground">{plan.toUpdate}</strong>
          {Object.keys(plan.updatedByStatus).length > 0 && <> ({Object.entries(plan.updatedByStatus).map(([k, n]) => `${n} hoje ${k}`).join(', ')})</>}
          {' '}· Reativadas (Desativado → Ativado): <strong className="text-foreground">{plan.reactivated}</strong>
        </p>
        <p className="text-muted-foreground">
          Serão marcadas como Desativado nesta semana: <strong className="text-foreground">{plan.deactivations.length}</strong>
          {plan.deactivatedEmails.length > 0 && <> — {plan.deactivatedEmails.join(', ')}{plan.deactivations.length > 10 ? ` e mais ${plan.deactivations.length - 10}` : ''}</>}
        </p>
        <p className="text-muted-foreground">
          Ignoradas por virem desativadas sem linha na semana: <strong className="text-foreground">{plan.discardedByStatus}</strong>
          {Object.keys(plan.discardedByLabel).length > 0 && <> ({Object.entries(plan.discardedByLabel).map(([k, n]) => `${k} ${n}`).join(', ')})</>}. Só a linha desta semana muda; checks e outras semanas ficam como estão.
        </p>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Checks novos por dia: {WEEKDAYS.map((w) => `${w.short} (${plan.checksByWeekday[w.key]})`).join(', ')}. Último acesso fora da semana: {plan.outsideWeek} (sem check). Sem último acesso: {plan.noLastAccess}.
        {plan.duplicatesInCsv > 0 && ` Repetidos no CSV (ignorados): ${plan.duplicatesInCsv}.`}
      </p>

      {boardError && (
        <p className="text-xs text-foreground bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-start gap-2 break-words">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
          Quadro indisponível agora ({boardError}). Você pode gravar na Base; o envio ao quadro ficará na fila da semana.
        </p>
      )}
      {missingDays && boardName ? (
        <p className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-xl p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          Faltam colunas de check no quadro: {plan.missingDayColumns.join(', ')}. O quadro precisa das sete (Domingo a Sábado); nada será gravado até elas existirem.
        </p>
      ) : null}

      {sameGroupSameDate && (
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-foreground">Este dia já foi enviado anteriormente para este grupo</p>
            <p className="text-muted-foreground mt-0.5">Nada será duplicado: as linhas existentes são atualizadas e nenhum check é removido.</p>
          </div>
        </div>
      )}

      {periodChangeFrom ? (
        <label className="text-xs text-foreground bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-start gap-2 cursor-pointer">
          <input type="checkbox" checked={confirmPeriodChange} onChange={(e) => onConfirmPeriodChange(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0" />
          <span>O grupo “{groupName}” já existe com o período {periodChangeFrom}. Confirmo a mudança para {weekStart.split('-').reverse().join('/')} a {weekEnd.split('-').reverse().join('/')}. Os checks já gravados não são removidos.</span>
        </label>
      ) : null}

      {needsOtherConfirm && !sameGroupSameDate && (
        <label className="text-xs text-foreground bg-[hsl(var(--brand-sky))] border border-border rounded-xl p-3 flex items-start gap-2 cursor-pointer">
          <input type="checkbox" checked={confirmOtherGroup} onChange={(e) => onConfirmOtherGroup(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Esta data já foi enviada para outro grupo ({otherGroupsSameDate.join(', ')}). Confirmo que quero enviá-la também para “{groupName}”.</span>
        </label>
      )}

      <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs space-y-1">
        <p className="font-medium text-foreground">Equipes</p>
        {plan.teamHeader ? (
          <p className="text-muted-foreground">
            Coluna do CSV: <strong className="text-foreground">“{plan.teamHeader}”</strong> · preenchida para {plan.teamFilled} pessoas · vazia para {plan.teamEmpty}
            {boardName && (plan.teamBoardColumn
              ? plan.teamBoardColumn.writable
                ? <> · no quadro: “{plan.teamBoardColumn.title}” ({plan.teamBoardColumn.type}), gravada em chamada separada dos checks</>
                : <> · a coluna “{plan.teamBoardColumn.title}” do quadro é do tipo {plan.teamBoardColumn.type} e não aceita gravação: a equipe fica só na Base</>
              : <> · o quadro não tem coluna Equipes: a equipe fica só na Base</>)}
          </p>
        ) : (
          <p className="text-muted-foreground">Nenhuma coluna de equipe encontrada no CSV (aceitos: Equipes, Equipe, Times, Teams). A equipe ficará vazia.</p>
        )}
      </div>

      {boardName && (
        <div className="grid md:grid-cols-3 gap-4 text-xs">
          <div className="space-y-2 min-w-0">
            <p className="font-medium text-foreground flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-primary" /> Colunas casadas ({plan.matched.length})</p>
            <ul className="space-y-1 max-h-56 overflow-y-auto pr-1">
              <li className="text-muted-foreground">1ª coluna → nome do item · Data da análise → Date</li>
              <li className="text-muted-foreground">Check de {weekdayTitle(plan.weekday)} só para quem tem último acesso igual à Data da análise (semana {plan.weekRangeLabel})</li>
              {plan.matched.map((m) => (
                <li key={m.csvHeader} className="truncate text-foreground" title={`${m.csvHeader} → ${m.columnTitle}`}>
                  {m.csvHeader} <span className="text-muted-foreground">→ {m.columnTitle} ({m.type})</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-2 min-w-0">
            <p className="font-medium text-foreground flex items-center gap-1.5"><MinusCircle className="w-3.5 h-3.5 text-muted-foreground" /> Sem coluna no quadro ({plan.unmatchedHeaders.length})</p>
            <ul className="space-y-1 max-h-56 overflow-y-auto pr-1 text-muted-foreground">
              {plan.unmatchedHeaders.length === 0 ? <li>Nenhuma</li> : plan.unmatchedHeaders.map((h) => <li key={h} className="truncate" title={h}>{h}</li>)}
            </ul>
          </div>
          <div className="space-y-2 min-w-0">
            <p className="font-medium text-foreground flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 text-muted-foreground" /> Ignoradas pelo tipo ({plan.ignoredByType.length})</p>
            <ul className="space-y-1 max-h-56 overflow-y-auto pr-1 text-muted-foreground">
              {plan.ignoredByType.length === 0 ? <li>Nenhuma</li> : plan.ignoredByType.map((c) => <li key={c.csvHeader} className="truncate" title={c.csvHeader}>{c.columnTitle} ({c.type})</li>)}
            </ul>
          </div>
        </div>
      )}

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 border-t border-border">
        <button type="button" onClick={onDiscard} disabled={busy} className="h-11 px-4 rounded-full border border-border text-xs text-foreground hover:bg-muted disabled:opacity-50">
          Descartar prévia
        </button>
        <button type="button" onClick={handleConfirmClick} disabled={busy || blocked} className="h-11 px-5 rounded-full bg-[hsl(var(--brand-navy))] text-card text-xs font-medium hover:opacity-90 disabled:opacity-50 inline-flex items-center justify-center gap-2">
          {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} {boardError ? `Gravar na Base (${plan.rows.length} pessoas)` : `Confirmar e gravar (${plan.rows.length} pessoas)`}
        </button>
      </div>

      {showOverwriteModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 grid place-items-center shrink-0"><AlertTriangle className="w-5 h-5" /></div>
              <button type="button" onClick={() => setShowOverwriteModal(false)} className="p-1 rounded-full hover:bg-muted text-muted-foreground" aria-label="Fechar"><X className="w-4 h-4" /></button>
            </div>
            <div>
              <h4 className="text-base font-semibold text-foreground">Reescrever dados do dia já enviado?</h4>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                A análise do dia <strong className="text-foreground">{formatBR(parseDateFlexible(analysisDate))}</strong> já consta como enviada para o grupo <strong className="text-foreground">“{groupName}”</strong>.
              </p>
              {needsOtherConfirm && (
                <p className="text-xs text-foreground mt-2 leading-relaxed rounded-xl bg-amber-500/10 border border-amber-500/20 p-2.5">
                  Atenção: esta data também consta como enviada para outro grupo ({otherGroupsSameDate.join(', ')}). Ao confirmar, você aceita gravá-la também em “{groupName}”. O outro grupo não é alterado.
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">Tem certeza de que deseja atualizar e reescrever os dados para esta data com o novo arquivo CSV? Nada é duplicado e nenhum check já marcado é removido.</p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowOverwriteModal(false)} disabled={busy} className="h-10 px-4 rounded-full border border-border text-xs text-foreground hover:bg-muted font-medium">Cancelar</button>
              <button type="button" onClick={() => { setShowOverwriteModal(false); onConfirm(true); }} disabled={busy} className="h-10 px-5 rounded-full bg-[hsl(var(--brand-navy))] text-card text-xs font-medium hover:opacity-90">
                Sim, reescrever dados
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
