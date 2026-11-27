import { useState, type ReactNode } from 'react';
import { useHub } from '@generated/lib/estado';
import { MODELOS, nomeModelo, fonteModelo } from '@generated/lib/modelos';
import type { Etapa } from '@generated/server/hub';
import { Sparkles, Check, ChevronDown, RotateCw } from 'lucide-react';
import type { EstadoEtapa } from '@generated/server/hub';
import { Botao, Cartao, Selo, Aviso, Progresso, dataBR, cx } from '@generated/components/ui';

export function SeloStatus({ st }: { st: EstadoEtapa }) {
  const m: Record<EstadoEtapa['status'], [string, 'neutro' | 'ok' | 'aviso' | 'erro' | 'azul']> = {
    nao_iniciada: ['Não gerada', 'neutro'], gerando: ['Gerando', 'azul'], pronta: ['Prévia pronta', 'aviso'], erro: ['Erro', 'erro'], gravada: ['Gravada', 'ok'],
  };
  const [t, tom] = m[st.status];
  return <Selo tom={tom}>{st.status === 'gravada' && <Check className="h-3 w-3" />}{t}{st.status === 'gravada' && st.gravadaEm ? ` em ${dataBR(st.gravadaEm)}` : ''}</Selo>;
}

/** Moldura de uma etapa de IA: título, estado, botão de gerar e área da prévia. */
export function Moldura({ titulo, descricao, st, onGerar, podeGerar = true, motivo, extra, children, rotuloGerar, etapa }: {
  titulo: string; descricao: ReactNode; st: EstadoEtapa; onGerar?: () => void; podeGerar?: boolean; motivo?: string; extra?: ReactNode; children?: ReactNode; rotuloGerar?: string;
  /** Etapa de IA: com ela, um erro mostra a opção de continuar com outra IA. */
  etapa?: Exclude<Etapa, 'tap' | 'calculadora'>;
}) {
  const temResultado = st.resultado != null && st.status !== 'gerando';
  const [fechada, setFechada] = useState(false);
  return (
    <Cartao className="p-4 space-y-3 entra">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-[15px] font-semibold">{titulo}</h2>
            <SeloStatus st={st} />
            {st.custo ? <span className="text-[11.5px] text-muted-foreground num">US$ {st.custo.toFixed(2)} · {st.modelo}</span> : null}
          </div>
          <div className="mt-1 text-[13px] text-muted-foreground leading-snug">{descricao}</div>
        </div>
        {extra}
        {temResultado && children && (
          <Botao variante="fantasma" onClick={() => setFechada((f) => !f)} aria-expanded={!fechada} title={fechada ? 'Mostrar a prévia' : 'Minimizar a prévia'}>
            <ChevronDown className={cx('h-4 w-4 transition-transform duration-200', !fechada && 'rotate-180')} /> {fechada ? 'Mostrar' : 'Minimizar'}
          </Botao>
        )}
        {onGerar && (
          <Botao variante={temResultado ? 'secundario' : 'primario'} onClick={onGerar} disabled={!podeGerar || st.status === 'gerando'} title={!podeGerar ? motivo : undefined}>
            <Sparkles className="h-3.5 w-3.5" /> {rotuloGerar ?? (temResultado ? 'Gerar de novo' : 'Gerar com IA')}
          </Botao>
        )}
      </div>
      {!podeGerar && motivo && st.status !== 'gerando' && !temResultado && <Aviso tom="info">{motivo}</Aviso>}
      {st.status === 'gerando' && <Progresso texto={st.progresso || 'A IA está lendo os documentos. Leva de 1 a 4 minutos; pode trocar de aba enquanto isso.'} />}
      {st.status === 'erro' && <Aviso tom="erro">{st.erro}</Aviso>}
      {st.status === 'erro' && etapa && <ContinuarIA etapa={etapa} st={st} />}
      {st.status !== 'gerando' && !!st.trocas?.length && <Aviso tom="info">{st.trocas.join(' ')}</Aviso>}
      {st.status === 'gravada' && st.resumoGravacao && <Aviso tom="ok">{st.resumoGravacao}</Aviso>}
      {temResultado && children && (
        <div className={cx('recolhe', !fechada && 'aberto')}><div className="min-h-0 overflow-hidden">{children}</div></div>
      )}
    </Cartao>
  );
}

/** Barra de gravação no fim de uma prévia. */
export function BarraGravar({ onGravar, gravando, progresso, erro, rotulo, aviso, desabilitado }: { onGravar: () => void; gravando: boolean; progresso: string; erro: string; rotulo: string; aviso?: ReactNode; desabilitado?: boolean }) {
  return (
    <div className="space-y-2 border-t border-border/60 pt-3">
      {aviso}
      {erro && <Aviso tom="erro">{erro}</Aviso>}
      <div className="flex items-center gap-3">
        {gravando && <Progresso texto={progresso || 'Gravando…'} />}
        <div className="flex-1" />
        <Botao variante="primario" onClick={onGravar} carregando={gravando} disabled={desabilitado}>{rotulo}</Botao>
      </div>
    </div>
  );
}

/** Depois de uma falha da IA (sem crédito, limite ou erro), escolhe outra IA e continua de onde parou. */
function ContinuarIA({ etapa, st }: { etapa: Exclude<Etapa, 'tap' | 'calculadora'>; st: EstadoEtapa }) {
  const { run, continuar } = useHub();
  const falhou = st.modeloFalhou || run?.modelo || 'monday-standard';
  // Sugere a primeira IA de outra fonte de crédito (monday, Google ou OpenRouter).
  const sugestao = MODELOS.find((m) => fonteModelo(m.id) !== fonteModelo(falhou))?.id ?? MODELOS[0].id;
  const [modelo, setModelo] = useState<string>(run?.modeloReserva && run.modeloReserva !== falhou ? run.modeloReserva : sugestao);
  const [busy, setBusy] = useState(false);
  const feitos = st.parcial?.feitos?.length ?? 0;
  const ir = async () => { setBusy(true); try { await continuar(etapa, modelo); } finally { setBusy(false); } };
  return (
    <div className="rounded-xl border border-border/60 p-3 space-y-2">
      <div className="text-[13px]">
        {st.erroTipo === 'credito' ? `${nomeModelo(falhou)} ficou sem crédito ou atingiu o limite de uso.` : `A geração parou com ${nomeModelo(falhou)}.`}
        {' '}{feitos ? `${feitos} ${etapa === 'eap' ? 'produtos' : 'riscos'} já saíram e ficam guardados; a outra IA faz só o que falta.` : 'Escolha outra IA para gerar esta etapa.'}
        {st.resultado != null && ' A prévia anterior continua abaixo até a nova sair.'}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select className="rounded-lg border border-input bg-background/60 px-2 h-8 text-[12.5px]" value={modelo} onChange={(e) => setModelo(e.target.value)}>
          {MODELOS.map((m) => <option key={m.id} value={m.id}>{m.nome}{m.id === falhou ? ' (a que falhou)' : ''}</option>)}
        </select>
        <Botao variante="primario" onClick={ir} carregando={busy}><RotateCw className="h-3.5 w-3.5" /> {feitos ? 'Continuar com esta IA' : 'Gerar com esta IA'}</Botao>
      </div>
      {fonteModelo(modelo) === fonteModelo(falhou) && st.erroTipo === 'credito' && <div className="text-[12px] text-muted-foreground">Esta IA usa o mesmo crédito da que falhou e pode parar de novo.</div>}
    </div>
  );
}
