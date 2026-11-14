type Validator = { parse: (v: unknown) => unknown } | ((v: unknown) => unknown);
export interface ServerFn { (opts?: { data?: unknown }): Promise<unknown>; __serverFn: true; run: (data: unknown) => Promise<unknown> }

export function createServerFn(_opts?: { method?: string }) {
  let validator: Validator | null = null;
  const b = {
    validator(v: Validator) { validator = v; return b; },
    inputValidator(v: Validator) { validator = v; return b; },
    middleware(_m: unknown) { return b; },
    handler(h: (ctx: { data: any }) => unknown): ServerFn {
      const run = async (raw: unknown) => {
        let data = raw;
        if (validator) data = typeof validator === 'function' ? (validator as (v: unknown) => unknown)(raw) : validator.parse(raw);
        return h({ data });
      };
      const fn = ((opts?: { data?: unknown }) => run(opts?.data)) as ServerFn;
      fn.__serverFn = true;
      fn.run = run;
      return fn;
    },
  };
  return b;
}

export function serverFnStub(): never {
  throw new Error('serverFnStub não existe no servidor');
}
