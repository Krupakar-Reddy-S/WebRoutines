export type RoutineRunMode = 'same-tab' | 'tab-group';
export type TabLoadMode = 'eager' | 'lazy';

export interface RoutineLink {
  id: string;
  url: string;
  title?: string;
}

export interface Routine {
  id?: number;
  name: string;
  links: RoutineLink[];
  lastRunAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface RoutineSession {
  routineId: number;
  mode: 'tab-group';
  loadMode: TabLoadMode;
  currentIndex: number;
  tabId: number | null;
  tabGroupId: number | null;
  tabIds: Array<number | null>;
  startedAt: number;
  runId?: number;
}

export type RunStopReason = 'user-stop' | 'tabs-closed' | 'group-removed' | 'system-stop' | 'unknown';

export type RoutineRunEventType = 'start' | 'step' | 'stop';

export interface RoutineRun {
  id?: number;
  routineId: number;
  startedAt: number;
  stoppedAt: number | null;
  stepsCompleted: number;
  totalSteps: number;
  completedFull: boolean;
  mode: RoutineRunMode;
  durationMs: number | null;
  stopReason?: RunStopReason;
}

export interface RoutineRunEvent {
  id?: number;
  runId: number;
  routineId: number;
  timestamp: number;
  type: RoutineRunEventType;
  stepIndex?: number;
}
