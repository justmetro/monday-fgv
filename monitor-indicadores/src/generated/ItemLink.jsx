import mondaySdk from 'monday-sdk-js';
import { BOARD_IND, itemUrl } from '@generated/lib';

const BASE = `https://fgvdgpe-projetos.monday.com/boards/${BOARD_IND}/views`;
export const VIEWS = { med: '237599106', ind: '237599107' };
/** URL of the 01.01 table view (MEDIÇÃO / INDICADORES), highlighting the item when id is given */
export const viewUrl = (view, id) => `${BASE}/${VIEWS[view]}${id ? `/pulses/${id}` : ''}`;

let monday = null;
try { monday = mondaySdk(); } catch (e) { console.error(e); }

/** Always opens in a NEW tab (app stays open): monday openLinkInTab → window.open fallback */
export async function goToView(url) {
  try {
    if (!monday?.execute) throw new Error('monday SDK indisponível');
    await monday.execute('openLinkInTab', { url });
    return;
  } catch (e) { console.error(e); }
  window.open(url, '_blank', 'noopener');
}

/**
 * Link to an item. Items of the own board (01.01) go to the table view (`view`: 'med' | 'ind');
 * other boards open in a new tab.
 */
export default function ItemLink({ board, id, view, className, title, children }) {
  const own = String(board) === BOARD_IND;
  const url = own ? viewUrl(view ?? 'med', id) : itemUrl(board, id);
  return (
    <a href={url} target="_blank" rel="noreferrer" className={className} title={title}
      onClick={own ? (e) => { e.preventDefault(); goToView(url); } : undefined}>
      {children}
    </a>
  );
}
