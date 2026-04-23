import type { Entry } from '@linkdrive/shared/types';

// Abstracts local fs and remote SFTP behind the same interface. Explorer
// only talks to Source, not to specific invoke commands.
export interface Source {
  kind: 'local' | 'sftp';
  id: string; // 'local' or hostId
  ls(path: string): Promise<Entry[]>;
  stat(path: string): Promise<Entry>;
  readText(path: string): Promise<string>;
  home(): Promise<string>;
  dirSize?(path: string): Promise<number>;
  fileUrl?(path: string): string;
  // Mutations (optional per source)
  mkdir?(path: string): Promise<void>;
  rename?(from: string, to: string): Promise<void>;
  deletePath?(path: string, recursive: boolean): Promise<void>;
}
