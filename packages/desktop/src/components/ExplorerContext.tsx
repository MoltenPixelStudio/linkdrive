import { createContext, useContext } from 'react';
import type { Source } from '../utils/source';

export const ExplorerSourceContext = createContext<Source | null>(null);

export function useExplorerSource(): Source | null {
  return useContext(ExplorerSourceContext);
}
