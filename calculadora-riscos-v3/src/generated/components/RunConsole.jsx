import { ConsoleShell, IdleSteps } from '@generated/components/ConsoleShell';
import { ResultCard } from '@generated/components/ResultCard';

const STEPS = [
  'Lê a configuração, o catálogo de grupos, os vínculos e a base de riscos (09.3 a 09.3).',
  'Para cada projeto, converte as 8 respostas em grupos e seleciona os riscos elegíveis.',
  'Cria no 09.4 os riscos que faltam, trata os que deixaram de se aplicar (sem apagar nada) e atualiza o projeto no 09.1.',
];

function Summary({ results }) {
  const by = (s) => results.filter((r) => r.status === s).length;
  const sum = (k) => results.reduce((s, r) => s + (r.alteracoes?.[k] || 0), 0);
  const parts = [
    `${by('Executada')} sem avisos`,
    `${by('Executada c/ avisos')} com avisos`,
    `${by('Erro')} com erro`,
    `${sum('novos')} novos`,
    `${sum('descartados')} descartados`,
    `${sum('sinalizados')} sinalizados`,
    `${sum('reativados')} reativados`,
  ];
  return <p className="text-sm text-[hsl(var(--paper-dim))]">{parts.join(' · ')}</p>;
}

/** Console da calculadora. */
export function RunConsole({ run, onClear }) {
  return (
    <ConsoleShell
      title="Execução"
      ariaLabel="Execução da calculadora"
      run={run}
      onClear={onClear}
      summary={<Summary results={run.results} />}
      idle={(
        <IdleSteps
          intro={<>Marque projetos na lista e clique em <strong className="font-medium">Rodar para os selecionados</strong>, ou rode todos os que estão em “Executar”.</>}
          steps={STEPS}
          footnote="Pode rodar quantas vezes quiser: riscos já gerados para o projeto não são duplicados."
        />
      )}
    >
      {run.results.map((r) => <ResultCard key={r.id} result={r} />)}
    </ConsoleShell>
  );
}
