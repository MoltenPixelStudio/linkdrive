// Source abstraction — same explorer UI over local fs or SFTP.
import { invoke } from '@tauri-apps/api/core';
import { convertFileSrc } from '@tauri-apps/api/core';
import type { Entry } from '@linkdrive/shared/types';
import {
  ls as localLs,
  stat as localStat,
  readText as localReadText,
  mkdir as localMkdir,
  rename as localRename,
  deletePath as localDelete,
  dirSize as localDirSize,
  homeDir as localHomeDir,
} from './fs';

export type SourceKind = 'local' | 'sftp';

export interface Source {
  kind: SourceKind;
  id: string;
  label: string;
  ls: (path: string) => Promise<Entry[]>;
  stat: (path: string) => Promise<Entry>;
  readText: (path: string) => Promise<string>;
  home: () => Promise<string>;
  mkdir?: (path: string) => Promise<void>;
  rename?: (from: string, to: string) => Promise<void>;
  deletePath?: (path: string, recursive?: boolean) => Promise<void>;
  dirSize?: (path: string) => Promise<number>;
  fileUrl?: (path: string) => string;
}

// ---- Local ----

export const localSource: Source = {
  kind: 'local',
  id: 'local',
  label: 'This device',
  ls: localLs,
  stat: localStat,
  readText: localReadText,
  home: localHomeDir,
  mkdir: localMkdir,
  rename: localRename,
  deletePath: localDelete,
  dirSize: localDirSize,
  fileUrl: (p) => convertFileSrc(p),
};

// ---- SFTP ----

type RustSshEntry = {
  name: string;
  path: string;
  size: number;
  mtime: number;
  isDir: boolean;
  isSymlink: boolean;
  mode?: number;
};

function fromSsh(e: RustSshEntry): Entry {
  return {
    name: e.name,
    path: e.path,
    size: e.size,
    mtime: e.mtime,
    isDir: e.isDir,
    isSymlink: e.isSymlink,
    mode: e.mode,
  };
}

export function sftpSource(hostId: string, label: string): Source {
  return {
    kind: 'sftp',
    id: hostId,
    label,
    ls: async (path) => {
      const rows = await invoke<RustSshEntry[]>('ssh_ls', { hostId, path });
      return rows.map(fromSsh);
    },
    stat: async (path) =>
      fromSsh(await invoke<RustSshEntry>('ssh_stat', { hostId, path })),
    readText: (path) => invoke<string>('ssh_read_text', { hostId, path }),
    home: () => invoke<string>('ssh_home', { hostId }),
  };
}

// ---- SSH commands (for host management) ----

export type ConnectParams = {
  hostId: string;
  host: string;
  port: number;
  user: string;
  password?: string;
  pinnedFingerprint?: string;
  privateKeyPem?: string;
  privateKeyPassphrase?: string;
};

export type ConnectResult = {
  fingerprint: string;
  newlyTrusted: boolean;
};

export function sshConnect(params: ConnectParams): Promise<ConnectResult> {
  return invoke<ConnectResult>('ssh_connect', { params });
}

export function sshDisconnect(hostId: string): Promise<void> {
  return invoke('ssh_disconnect', { hostId });
}

export function sshIsConnected(hostId: string): Promise<boolean> {
  return invoke<boolean>('ssh_is_connected', { hostId });
}
