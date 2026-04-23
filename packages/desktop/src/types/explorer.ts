export type ColumnId = 'name' | 'size' | 'type' | 'modified' | 'permissions' | 'owner';

export type Column = {
  id: ColumnId;
  label: string;
  width: number;
  minWidth: number;
  visible: boolean;
  align?: 'left' | 'right';
};

export type ViewMode =
  | 'details'
  | 'large-icons'
  | 'medium-icons'
  | 'small-icons'
  | 'list'
  | 'tiles';

export const DEFAULT_COLUMNS: Column[] = [
  { id: 'name', label: 'Name', width: 360, minWidth: 120, visible: true },
  { id: 'size', label: 'Size', width: 120, minWidth: 70, visible: true, align: 'right' },
  { id: 'type', label: 'Type', width: 120, minWidth: 80, visible: true },
  { id: 'modified', label: 'Date modified', width: 170, minWidth: 100, visible: true, align: 'right' },
  { id: 'permissions', label: 'Permissions', width: 110, minWidth: 80, visible: false },
  { id: 'owner', label: 'Owner', width: 110, minWidth: 80, visible: false },
];
