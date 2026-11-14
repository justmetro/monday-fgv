export interface Collection<T> { name: string; __t?: T }
export function defineCollection<T>(opts: { name: string; indexes?: string[] }): Collection<T> {
  return { name: opts.name };
}
