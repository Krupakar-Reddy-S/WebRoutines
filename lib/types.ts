export type NavigationMode = 'same-tab' | 'tab-group';

export interface RoutineLink {
  id: string;
  url: string;
  title?: string;
}

export interface Routine {
  id?: number;
  name: string;
  links: RoutineLink[];
  createdAt: number;
  updatedAt: number;
}

export interface RoutineSession {
  routineId: number;
  mode: NavigationMode;
  currentIndex: number;
  tabId: number | null;
  tabGroupId: number | null;
  tabIds: number[];
  startedAt: number;
}
