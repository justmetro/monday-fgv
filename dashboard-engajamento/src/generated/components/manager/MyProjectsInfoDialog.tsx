import { Info } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@components/ui/dialog';

const ITEMS: { term: string; text: string }[] = [
  { term: 'Projetos sob gestão', text: 'quantidade de projetos ativos sob a sua gestão.' },
  {
    term: 'Colaboradores alocados',
    text: 'quantidade de pessoas diferentes nos seus projetos. Quem está em mais de um projeto é contado uma vez.',
  },
  {
    term: 'Análises',
    text: 'soma, em cada projeto, das pessoas avaliadas. Quem está em mais de um projeto é contado em cada um.',
  },
  { term: 'Presenças ativas', text: 'quantidade de análises em que a pessoa teve ao menos um acesso na semana.' },
  { term: 'Score do projeto', text: 'presenças ativas do projeto dividido pelas análises do projeto.' },
  {
    term: 'Score médio',
    text: 'média simples dos scores dos seus projetos (cada projeto pesa igual, independentemente do número de pessoas).',
  },
  {
    term: 'Período',
    text: 'nos filtros Mês, Trimestre, Semestre e Ano, o cálculo considera as semanas do período, contadas a partir da data de início de cada projeto.',
  },
];

/** Nota explicativa do card "Meus Projetos" (somente Painel do Gerente). */
export function MyProjectsInfoDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="Como os números de Meus Projetos são calculados"
          className="inline-grid place-items-center w-8 h-8 -m-1 rounded-full text-[hsl(var(--brand-navy)/0.7)] hover:text-[hsl(var(--brand-navy))] hover:bg-[hsl(var(--brand-navy)/0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Info className="w-4 h-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-[hsl(var(--brand-navy))]">Como calculamos</DialogTitle>
          <DialogDescription>Meus Projetos</DialogDescription>
        </DialogHeader>
        <dl className="space-y-3 text-sm">
          {ITEMS.map((i) => (
            <div key={i.term}>
              <dt className="inline font-medium text-foreground">{i.term}: </dt>
              <dd className="inline text-muted-foreground">{i.text}</dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
