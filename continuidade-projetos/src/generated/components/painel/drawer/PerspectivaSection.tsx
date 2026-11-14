import { useState } from 'react';
import { Textarea } from '@components/ui/textarea';
import { RascunhoTag, TemperaturaBadge } from '@generated/components/painel/Chips';
import { Field, Section, SelectField } from '@generated/components/painel/Fields';
import { NIVEIS_PERSPECTIVA, TEMPERATURAS, TIPOS_PERSPECTIVA } from '@generated/lib/negocio';
import type { PerspectivaDoc } from '@generated/server/negocio';
import type { DraftPersp } from '@generated/components/painel/drawer/types';

const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Perspectiva de renovação/aditivo + Temperatura + Mini report de Negócios. Edições são rascunho até o "Salvar" do painel. */
export function PerspectivaSection({ value, onChange, hist, sujo }: {
  value: DraftPersp; onChange: (v: DraftPersp) => void; hist: PerspectivaDoc[]; sujo: boolean;
}) {
  const atual = hist[0];
  const [verHist, setVerHist] = useState(false);
  const set = <K extends keyof DraftPersp>(k: K, v: DraftPersp[K]) => onChange({ ...value, [k]: v });

  return (
    <Section
      title="Perspectiva de renovação/aditivo" id="sec-perspectiva"
      aside={<span className="flex items-center gap-2 text-xs text-muted-foreground">{sujo && <RascunhoTag />}Grava em Decisões do Vibe</span>}
    >
      <div className="grid grid-cols-1 gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Tipo" htmlFor="f-tipo-persp">
            <SelectField id="f-tipo-persp" value={value.tipo} onChange={(v) => set('tipo', v)} options={[...TIPOS_PERSPECTIVA]} />
          </Field>
          <Field label="Perspectiva de renovação/aditivo" htmlFor="f-persp-app">
            <SelectField id="f-persp-app" value={value.nivel} onChange={(v) => set('nivel', v)} options={[...NIVEIS_PERSPECTIVA]} />
          </Field>
          <Field label="Temperatura da perspectiva" htmlFor="f-temp-persp">
            <SelectField id="f-temp-persp" value={value.temperatura} onChange={(v) => set('temperatura', v)} options={[...TEMPERATURAS]} />
            {value.temperatura && <TemperaturaBadge valor={value.temperatura} className="mt-1.5" />}
          </Field>
        </div>
        <Field label="Comentário da perspectiva (mini report de Negócios)" htmlFor="f-report" hint={atual ? `Última atualização: ${atual.user} em ${quando(atual.at)}` : 'Ainda sem registro'}>
          <Textarea id="f-report" value={value.report} onChange={(e) => set('report', e.target.value)} rows={4} maxLength={5000} placeholder="Situação da renovação, conversas com o cliente, próximos passos…" className="bg-card text-base sm:text-sm" />
        </Field>
        {hist.length > 1 && (
          <div>
            <button type="button" onClick={() => setVerHist((v) => !v)} className="min-h-9 rounded-md px-2 text-xs text-primary hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {verHist ? 'Ocultar histórico' : `Ver histórico (${hist.length - 1} anterior${hist.length > 2 ? 'es' : ''})`}
            </button>
          </div>
        )}
        {verHist && (
          <ul className="divide-y divide-border rounded-md border border-border">
            {hist.slice(1).map((h) => (
              <li key={h.id} className="flex flex-col gap-1 px-3 py-2 text-xs">
                <span className="text-muted-foreground">{h.tipo && <>{h.tipo} · </>}<span className="font-medium text-foreground">{h.nivel ?? 'Sem nível'}</span> {h.temperatura && <TemperaturaBadge valor={h.temperatura} />} · {h.user} · {quando(h.at)}</span>
                {h.report && <p className="whitespace-pre-wrap break-words text-foreground">{h.report}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Section>
  );
}
