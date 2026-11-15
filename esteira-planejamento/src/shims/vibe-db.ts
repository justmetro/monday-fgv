export interface VibeCollection<T> { name: string; indexes?: string[]; __t?: T }
export type Collection<T> = VibeCollection<T>;
export function defineCollection<T>(opts: { name: string; indexes?: string[] }): VibeCollection<T> {
  return { name: opts.name, indexes: opts.indexes ?? [] };
}
