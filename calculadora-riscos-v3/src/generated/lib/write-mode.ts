import { atom, useAtom } from 'jotai';
import { useCallback } from 'react';
import { toast } from 'sonner';
import { isPermissionError } from '@generated/lib/config';

/** Estado global de gravação: vira "modo leitura" quando o quadro recusa uma gravação por permissão. */
export const readOnlyAtom = atom<boolean>(false);

export function useWriteMode() {
  const [readOnly, setReadOnly] = useAtom(readOnlyAtom);

  const reportWriteError = useCallback(
    (e: unknown) => {
      console.error('Falha ao gravar no quadro 09.4', e);
      if (isPermissionError(e)) {
        setReadOnly(true);
        toast.error('Sem permissão para gravar no quadro 09.4. O app passou para o modo leitura.');
      } else {
        toast.error('Não foi possível salvar. A alteração foi desfeita, tente novamente.');
      }
    },
    [setReadOnly],
  );

  return { readOnly, setReadOnly, reportWriteError };
}
