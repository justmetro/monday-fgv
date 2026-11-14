import { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';

export interface ComboboxOption {
  value: string;
  label: string;
  subtitle?: string;
  count?: number;
  rate?: number;
}

interface SearchableSelectProps {
  id?: string;
  label?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  value: string;
  onChange: (value: string) => void;
  options: (ComboboxOption | string)[];
  allLabel?: string;
  showAllOption?: boolean;
  className?: string;
  buttonClassName?: string;
  dropdownClassName?: string;
  ariaLabel?: string;
  disabled?: boolean;
}

export function SearchableSelect({
  id,
  placeholder = 'Selecione...',
  searchPlaceholder = 'Digitar para buscar...',
  value,
  onChange,
  options,
  allLabel = 'Todos',
  showAllOption = true,
  className = '',
  buttonClassName = '',
  dropdownClassName = '',
  ariaLabel,
  disabled = false,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Normaliza as opções para o formato ComboboxOption
  const normalizedOptions: ComboboxOption[] = useMemo(() => {
    return options.map((opt) => {
      if (typeof opt === 'string') {
        return { value: opt, label: opt };
      }
      return opt;
    });
  }, [options]);

  // Fecha ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Foco automático no campo de busca ao abrir
  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  const selectedOption = useMemo(() => {
    if (value === 'all' || !value) return null;
    return normalizedOptions.find((o) => o.value === value) || null;
  }, [value, normalizedOptions]);

  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return normalizedOptions;
    const term = searchTerm.toLowerCase().trim();
    return normalizedOptions.filter(
      (o) =>
        o.label.toLowerCase().includes(term) ||
        (o.subtitle && o.subtitle.toLowerCase().includes(term))
    );
  }, [normalizedOptions, searchTerm]);

  const displayText = selectedOption
    ? selectedOption.label
    : showAllOption
    ? allLabel
    : placeholder;

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      {/* Botão Gatilho */}
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={ariaLabel || placeholder}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`h-10 text-xs px-3 rounded border border-border bg-card text-foreground font-normal focus:outline-none focus:ring-1 focus:ring-ring flex items-center justify-between gap-2 min-w-[200px] text-left hover:bg-muted/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${buttonClassName}`}
      >
        <span className="truncate flex-1">
          {displayText}
          {selectedOption && selectedOption.rate !== undefined && (
            <span className="text-muted-foreground ml-1.5">
              ({selectedOption.count} · {selectedOption.rate}%)
            </span>
          )}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown com campo de escrita/busca */}
      {isOpen && (
        <div
          className={`absolute z-50 mt-1 w-72 sm:w-80 max-h-80 bg-popover border border-border rounded-lg shadow-lg flex flex-col overflow-hidden text-xs ${dropdownClassName}`}
        >
          {/* Input para escrever/filtrar */}
          <div className="p-2 border-b border-border bg-muted/30 flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="text-muted-foreground hover:text-foreground p-0.5 rounded"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Lista de Opções filtradas */}
          <div className="overflow-y-auto max-h-64 p-1 divide-y divide-border/20">
            {/* Opção "Todos" (se habilitada) */}
            {showAllOption && (
              <button
                type="button"
                onClick={() => {
                  onChange('all');
                  setIsOpen(false);
                }}
                className={`w-full text-left px-2.5 py-2 rounded flex items-center justify-between hover:bg-muted/60 transition-colors ${
                  value === 'all' || !value ? 'bg-muted font-medium text-foreground' : 'text-foreground'
                }`}
              >
                <span>{allLabel}</span>
                {(value === 'all' || !value) && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
              </button>
            )}

            {filteredOptions.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground text-[11px]">
                Nenhum resultado para "{searchTerm}"
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = value === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-2 rounded flex items-start justify-between gap-2 hover:bg-muted/60 transition-colors ${
                      isSelected ? 'bg-muted font-medium text-foreground' : 'text-foreground'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs">{opt.label}</div>
                      {(opt.subtitle || opt.count !== undefined) && (
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                          {opt.subtitle && <span className="truncate">{opt.subtitle}</span>}
                          {opt.count !== undefined && (
                            <span>
                              {opt.count} pessoas · {opt.rate}%
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
