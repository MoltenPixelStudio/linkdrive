// Host + connection models. Credentials never serialized to disk in plain JSON —
// they live in OS keychain, referenced by hostId.

export type AuthConfig =
  | { type: 'key'; keyPath?: string; useAgent: boolean; passphraseInKeychain?: boolean }
  | { type: 'password' }
  | { type: 'key+password'; keyPath?: string; useAgent: boolean };

export type Transport =
  | { mode: 'direct' }
  | { mode: 'tailscale'; magicDns: string }
  | { mode: 'jump'; jumpHostId: string };

export type Protocol = 'sftp' | 'agent' | 'lan-peer';

export type Host = {
  id: string;
  name: string;
  host: string;
  port: number;
  user: string;
  protocol: Protocol;
  auth: AuthConfig;
  transport: Transport;
  knownHostKey?: string;
  defaultPath?: string;
  color?: string;
  tags?: string[];
  createdAt: number;
  lastUsedAt?: number;
};

export type Entry = {
  name: string;
  path: string;
  size: number;
  mtime: number;
  isDir: boolean;
  isSymlink?: boolean;
  mime?: string;
  mode?: number;
  owner?: string;
  group?: string;
};

export type TransferState = 'queued' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

export type Transfer = {
  id: string;
  hostId?: string;
  direction: 'upload' | 'download' | 'local';
  src: string;
  dst: string;
  totalBytes: number;
  sentBytes: number;
  state: TransferState;
  error?: string;
  startedAt: number;
  finishedAt?: number;
};
