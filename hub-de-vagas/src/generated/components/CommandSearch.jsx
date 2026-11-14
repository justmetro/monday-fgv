import { useMemo } from 'react';
import { Briefcase, User, FolderKanban, TrendingUp, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { downloadPerfilPdf } from '@generated/lib/perfilPdf';
import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@components/ui/command';

export default function CommandSearch({ open, onOpenChange, data, onPick, onProject }) {
  const projetos = useMemo(() => [...new Set(data.vagas.map((v) => v.projeto).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt')), [data.vagas]);
  const pick = (fn) => { onOpenChange(false); fn(); };
  // Fetches the item straight from the board by id — works without the match tab.
  const pdf = (p) => toast.promise(downloadPerfilPdf(p.id), { loading: `Gerando PDF de ${p.name}…`, success: 'PDF gerado', error: (e) => { console.error('[pdf]', e); return 'Não foi possível gerar o PDF do perfil.'; } });

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Busca global" description="Busque por pessoa, vaga ou projeto">
      <CommandInput placeholder="Buscar pessoa, vaga ou projeto…" />
      <CommandList className="max-h-[60vh]">
        <CommandEmpty>Nada encontrado.</CommandEmpty>
        <CommandGroup heading="Pessoas">
          {data.perfis.map((p) => (
            <CommandItem key={p.id} value={`pessoa ${p.name} ${p.id}`} onSelect={() => pick(() => onPick('perfil', p))}>
              <User className="text-muted-foreground" /><span className="truncate">{p.name}</span>
              <span className="ml-auto truncate text-xs text-muted-foreground">{p.statusDoPerfil}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Gerar PDF">
          {data.perfis.map((p) => (
            <CommandItem key={`pdf${p.id}`} value={`gerar pdf pessoa ${p.name} ${p.id}`} onSelect={() => pick(() => pdf(p))}>
              <FileText className="text-muted-foreground" /><span className="truncate">Gerar PDF de {p.name}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Vagas">
          {data.vagas.map((v) => (
            <CommandItem key={v.id} value={`vaga ${v.name} ${v.cargoPapel ?? ''} cod ${v.id}`} onSelect={() => pick(() => onPick('vaga', v))}>
              <Briefcase className="text-muted-foreground" /><span className="truncate">{v.name}</span>
              <span className="ml-auto shrink-0 truncate text-xs text-muted-foreground">Cód. {v.id} · {v.statusDaVaga}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Projetos">
          {projetos.map((p) => (
            <CommandItem key={p} value={`projeto ${p}`} onSelect={() => pick(() => onProject(p))}>
              <FolderKanban className="text-muted-foreground" /><span className="truncate">{p}</span>
              <span className="ml-auto text-xs text-muted-foreground">ver vagas</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
