export type RoutineRunMode = 'same-tab' | 'tab-group';
export type TabLoadMode = 'eager' | 'lazy';
export type RoutineScheduleDay = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type RunActionEventType = 'run-start' | 'navigate' | 'step-sync' | 'run-stop';
export type RunActionEventSource = 'sidepanel' | 'popup' | 'focus-controller' | 'background' | 'system';
export type RunActionEventAction =
  | 'next'
  | 'previous'
  | 'jump'
  | 'open-current'
  | 'manual-tab-activate'
  | 'tab-removed-shift'
  | 'group-removed'
  | 'tabs-closed'
  | 'user-stop'
  | 'system-stop';

export interface RoutineSchedule {
  days: RoutineScheduleDay[];
}

export interface RunStepNote {
  stepIndex: number;
  note: string;
  updatedAt: number;
}

export interface RunStepTime {
  stepIndex: number;
  activeMs: number;
}

export interface RoutineLink {
  id: string;
  url: string;
  title?: string;
}

export interface Routine {
  id?: number;
  name: string;
  links: RoutineLink[];
  schedule?: RoutineSchedule;
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
  stepNotes?: RunStepNote[];
  stepTimes?: RunStepTime[];
}

export interface RunActionEvent {
  id?: number;
  runId: number;
  routineId: number;
  timestamp: number;
  type: RunActionEventType;
  action?: RunActionEventAction;
  source: RunActionEventSource;
  fromStepIndex?: number;
  toStepIndex?: number;
  meta?: {
    stopReason?: RunStopReason;
  };
}
