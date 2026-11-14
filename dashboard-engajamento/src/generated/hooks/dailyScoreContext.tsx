import { createContext, useContext, type ReactNode } from 'react';
import { userScoreFor, type UserScore, type UserScoreIndex } from '@generated/lib/dailyScore';

const EMPTY: UserScoreIndex = { byPerson: new Map() };
const DailyScoreContext = createContext<UserScoreIndex>(EMPTY);

/** Disponibiliza o score geral por semanas (calculado uma vez a partir da base) para todas as telas. */
export function DailyScoreProvider({ value, children }: { value: UserScoreIndex; children: ReactNode }) {
  return <DailyScoreContext.Provider value={value}>{children}</DailyScoreContext.Provider>;
}

export function useDailyScoreIndex(): UserScoreIndex {
  return useContext(DailyScoreContext);
}

export function useDailyScore(personKey: string): UserScore {
  return userScoreFor(useContext(DailyScoreContext), personKey);
}
