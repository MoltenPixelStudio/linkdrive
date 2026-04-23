import * as fs from '../utils/fs';
import type { Source } from './source';

export const localSource: Source = {
  kind: 'local',
  id: 'local',
  ls: fs.ls,
  stat: fs.stat,
  readText: fs.readText,
  home: fs.homeDir,
  dirSize: fs.dirSize,
  fileUrl: fs.fileUrl,
  mkdir: fs.mkdir,
  rename: fs.rename,
  deletePath: fs.deletePath,
};
