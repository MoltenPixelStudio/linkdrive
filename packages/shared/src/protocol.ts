// LinkDrive agent wire protocol (used only when connecting to a LinkDrive agent,
// not SFTP). Length-prefixed framed binary. Post-handshake payloads are sealed
// with AES-GCM using a Curve25519 shared secret.
//
// Frame:  [u32 be len][u8 type][payload bytes]
//
// SFTP connections skip this entirely and use the SSH protocol directly.

import type { Entry } from './types';

export const WIRE_VERSION = 1;

export enum MsgType {
  HELLO = 0x01,
  PAIR_ACK = 0x02,
  LIST = 0x10,
  LIST_RESP = 0x11,
  STAT = 0x12,
  STAT_RESP = 0x13,
  READ = 0x20,
  READ_CHUNK = 0x21,
  READ_END = 0x22,
  WRITE = 0x30,
  WRITE_ACK = 0x31,
  MKDIR = 0x40,
  RENAME = 0x41,
  DELETE = 0x42,
  WATCH = 0x50,
  WATCH_EVENT = 0x51,
  THUMB = 0x60,
  THUMB_RESP = 0x61,
  SEARCH = 0x70,
  SEARCH_HIT = 0x71,
  SEARCH_END = 0x72,
  ERROR = 0xff,
}

export type Hello = {
  version: number;
  deviceId: string;
  name: string;
  platform: 'desktop' | 'mobile' | 'agent';
  pubkey: string;
};

export type ListReq = { id: number; path: string };
export type ListResp = { id: number; entries: Entry[] };
export type ReadReq = { id: number; path: string; offset: number; len: number };
export type ErrorMsg = { id?: number; code: string; message: string };

export const MAX_FRAME_BYTES = 16 * 1024 * 1024;
export const CHUNK_BYTES = 64 * 1024;
