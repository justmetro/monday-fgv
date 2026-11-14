// Cliente: cada função de servidor vira uma chamada HTTP ao backend no monday code.
import { callServer } from './rpc';
type Fn<I, O> = ((arg?: { data?: I }) => Promise<O>) & { __id: string };
export function createServerFn(id: any, _opts?: unknown) {
  const b = {
    validator(_v: unknown) { return b; },
    inputValidator(_v: unknown) { return b; },
    middleware(_m: unknown) { return b; },
    handler<O>(_h: (ctx: { data: any }) => Promise<O> | O): Fn<any, O> {
      const f = ((arg?: { data?: unknown }) => callServer(id, arg?.data)) as Fn<any, O>;
      f.__id = id;
      return f;
    },
  };
  return b;
}
