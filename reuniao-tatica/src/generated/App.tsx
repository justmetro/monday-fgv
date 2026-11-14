import { useMemo, useRef, useState } from 'react';
import { Download, FileUp, Loader2, Presentation, RotateCcw } from 'lucide-react';
import { mondayClient } from '@/context/MondayContextProvider';
import { lerQuadros, type Gql } from './engine/data';
import { gerarPPT, type Coordenacao, type Params } from './engine/gerar';

type Aba = 'tatica' | Coordenacao;
const ABAS: { id: Aba; rot: string; desc: string; arquivo: string }[] = [
  { id: 'tatica', rot: 'Reunião Tática de Monitoramento', desc: 'Todos os projetos do Levantamento de Produtos e do Quadro de Encaminhamentos.', arquivo: 'Reuniao_Tatica_Monitoramento' },
  { id: 'SAE', rot: 'Reunião SAE', desc: 'Só os projetos com Coordenação = SAE no Levantamento de Produtos, e os encaminhamentos desses projetos.', arquivo: 'Reuniao_SAE' },
  { id: 'CDPE', rot: 'Reunião CDPE', desc: 'Só os projetos com Coordenação = CDPE no Levantamento de Produtos, e os encaminhamentos desses projetos.', arquivo: 'Reuniao_CDPE' },
];

const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const somaDias = (base: string, n: number) => iso(new Date(new Date(base + 'T12:00:00').getTime() + n * 86400000));

function padroes(hoje: string): Params {
  // Mesmas distâncias da reunião de 09/11/2026: cadastros de -36 a -4 dias, previsibilidade de -4 a +10.
  return {
    consulta: hoje, prodIni: somaDias(hoje, -36), prodFim: somaDias(hoje, -5),
    prevIni: somaDias(hoje, -4), prevFim: somaDias(hoje, 10), cadIni: somaDias(hoje, -36), cadFim: somaDias(hoje, -4),
  };
}

const gql: Gql = async (query, variables) => {
  const res = await mondayClient.api(query, { variables });
  if (res?.errors?.length) throw new Error(`API do monday: ${res.errors[0].message}`);
  if (res?.error_message) throw new Error(`API do monday: ${res.error_message}`);
  return res.data;
};

function baixar(bytes: Uint8Array, nome: string) {
  const blob = new Blob([bytes as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

const CAMPOS: { k: keyof Params; rot: string }[] = [
  { k: 'consulta', rot: 'Data da consulta' },
  { k: 'prodIni', rot: 'Produtos: início' }, { k: 'prodFim', rot: 'Produtos: fim' },
  { k: 'prevIni', rot: 'Previsibilidade: início' }, { k: 'prevFim', rot: 'Previsibilidade: fim' },
  { k: 'cadIni', rot: 'Encaminhamentos: início' }, { k: 'cadFim', rot: 'Encaminhamentos: fim' },
];

export default function App() {
  const hoje = useMemo(() => iso(new Date()), []);
  const [aba, setAba] = useState<Aba>('tatica');
  const atual = ABAS.find((x) => x.id === aba)!;
  const [p, setP] = useState<Params>(() => padroes(hoje));
  const [base, setBase] = useState<File | null>(null);
  const [rodando, setRodando] = useState(false);
  const [msg, setMsg] = useState('');
  const [erro, setErro] = useState('');
  const [res, setRes] = useState<{ bytes: Uint8Array; nome: string; avisos: string[]; resumo: string[] } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const invalido = CAMPOS.some(({ k }) => !p[k]) || p.prodIni > p.prodFim || p.prevIni > p.prevFim || p.cadIni > p.cadFim;

  async function gerar() {
    setRodando(true); setErro(''); setRes(null);
    try {
      setMsg('Carregando o modelo');
      const buf = base ? await base.arrayBuffer() : await (await fetch('./modelo-base.pptx', { cache: 'no-store' })).arrayBuffer();
      const dados = await lerQuadros(gql, setMsg);
      setMsg('Calculando e montando os slides');
      const r = await gerarPPT(buf, dados, { ...p, coord: aba === 'tatica' ? undefined : aba, limparPrioridades: aba !== 'tatica' && !base });
      const nome = `${atual.arquivo}_atualizada_${p.consulta.split('-').reverse().join('_')}.pptx`;
      setRes({ ...r, nome });
      baixar(r.bytes, nome);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setRodando(false); setMsg('');
    }
  }

  return (
    <div className="min-h-screen bg-muted/40 p-6">
      <div className="mx-auto max-w-3xl space-y-5">
        <header className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Presentation className="h-5 w-5" /></div>
          <div>
            <h1 className="text-lg font-semibold">{atual.rot}</h1>
            <p className="text-sm text-muted-foreground">{atual.desc}</p>
          </div>
        </header>

        <nav className="flex gap-1 rounded-lg border border-border bg-card p-1">
          {ABAS.map((x) => (
            <button key={x.id} disabled={rodando}
              onClick={() => { if (x.id !== aba) { setAba(x.id); setRes(null); setErro(''); setBase(null); if (input.current) input.current.value = ''; } }}
              className={`flex-1 rounded-md px-3 py-2 text-sm transition ${x.id === aba ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted'}`}>
              {x.rot}
            </button>
          ))}
        </nav>

        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium">Períodos</h2>
            <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" onClick={() => setP(padroes(p.consulta || hoje))}>
              <RotateCcw className="h-3 w-3" /> Recalcular a partir da data da consulta
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {CAMPOS.map(({ k, rot }) => (
              <label key={k} className={`text-xs text-muted-foreground ${k === 'consulta' ? 'col-span-2 sm:col-span-3' : ''}`}>
                {rot}
                <input type="date" value={String(p[k] ?? "")} onChange={(e) => setP({ ...p, [k]: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/30" />
              </label>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-1 text-sm font-medium">PPT base</h2>
          <p className="mb-3 text-xs text-muted-foreground">Use o PPT da última reunião para manter atualizados os slides que não vêm da monday (2 e 11 a 14) e a prioridade e o apoio de cada gestor. Sem arquivo, o app usa o modelo da Reunião Tática de 09/11/2026{aba !== 'tatica' ? ' e deixa prioridade e apoio do slide 10 a definir' : ''}.</p>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted" onClick={() => input.current?.click()}>
              <FileUp className="h-4 w-4" /> Escolher .pptx
            </button>
            <span className="truncate text-sm text-muted-foreground">{base ? base.name : 'Modelo padrão'}</span>
            {base && <button className="text-xs text-muted-foreground underline" onClick={() => { setBase(null); if (input.current) input.current.value = ''; }}>remover</button>}
            <input ref={input} type="file" accept=".pptx" className="hidden" onChange={(e) => setBase(e.target.files?.[0] ?? null)} />
          </div>
        </section>

        <button disabled={rodando || invalido} onClick={gerar}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-90 disabled:opacity-50">
          {rodando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {rodando ? msg || 'Gerando' : 'Gerar PPT atualizado'}
        </button>
        {invalido && !rodando && <p className="text-xs text-destructive">Confira as datas: todo início precisa ser anterior ao fim.</p>}
        {erro && <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{erro}</div>}

        {res && (
          <section className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-medium">PPT gerado</h2>
              <button className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted" onClick={() => baixar(res.bytes, res.nome)}>
                <Download className="h-4 w-4" /> Baixar de novo
              </button>
            </div>
            <ul className="space-y-1 text-sm">{res.resumo.map((r) => <li key={r}>{r}</li>)}</ul>
            {res.avisos.length > 0 && (
              <div className="rounded-lg bg-muted p-3">
                <p className="mb-1 text-xs font-medium text-muted-foreground">Avisos</p>
                <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">{res.avisos.map((a) => <li key={a}>{a}</li>)}</ul>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
