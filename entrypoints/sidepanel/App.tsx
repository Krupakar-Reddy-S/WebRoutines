import { useEffect, useState } from 'react';
import {
  HashRouter,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams,
} from 'react-router-dom';

import { navigateSessionByOffset } from '@/lib/navigation';
import { consumeRequestedSidepanelView, subscribeToRequestedSidepanelView } from '@/lib/session';
import { isTextInputTarget } from '@/lib/dom';

import { ErrorBoundary } from './components/ErrorBoundary';
import { MessageBanner } from './components/MessageBanner';
import { RecoveryCard } from './components/RecoveryCard';
import { EditorView } from './views/EditorView';
import { RunnerHomeView } from './views/RunnerHomeView';
import { RoutinesView } from './views/RoutinesView';
import { SettingsView } from './views/SettingsView';

function SidepanelShell() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void consumeRequestedSidepanelView().then((requestedView) => {
      if (requestedView) {
        navigate(resolveRouteForView(requestedView), { replace: true });
      }
    });

    return subscribeToRequestedSidepanelView((requestedView) => {
      navigate(resolveRouteForView(requestedView), { replace: true });
      setError(null);
      setMessage(null);
    });
  }, [navigate]);

  useEffect(() => {
    if (navigator.storage?.persist) {
      void navigator.storage.persist();
    }
  }, []);

  useEffect(() => {
    if (!message) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setMessage(null);
    }, 3_500);

    return () => window.clearTimeout(timeoutId);
  }, [message]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTextInputTarget(event.target)) {
        return;
      }

      if (event.altKey && event.shiftKey && event.key === 'ArrowLeft') {
        event.preventDefault();
        void navigateSessionByOffset(-1);
      }

      if (event.altKey && event.shiftKey && event.key === 'ArrowRight') {
        event.preventDefault();
        void navigateSessionByOffset(1);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  function openRunner() {
    navigate('/');
  }

  function openRoutines() {
    navigate('/routines');
  }

  function openSettings() {
    navigate('/settings');
  }

  function openCreateRoutine() {
    navigate('/routines/new');
  }

  function openEditRoutine(routineId: number) {
    navigate(`/routines/${routineId}/edit`);
  }

  return (
    <main className="min-h-screen space-y-4 bg-background p-3 text-foreground">
      <ErrorBoundary
        fallback={(reset) => (
          <RecoveryCard
            onReset={() => {
              reset();
              navigate('/', { replace: true });
              setError(null);
              setMessage(null);
            }}
          />
        )}
      >
        <Routes>
          <Route
            path="/"
            element={(
              <RunnerHomeView
                onOpenRoutines={openRoutines}
                onOpenSettings={openSettings}
                onMessage={setMessage}
                onError={setError}
              />
            )}
          />
          <Route
            path="/routines"
            element={(
              <RoutinesView
                onOpenSettings={openSettings}
                onOpenRunner={openRunner}
                onCreateRoutine={openCreateRoutine}
                onEditRoutine={openEditRoutine}
                onMessage={setMessage}
                onError={setError}
              />
            )}
          />
          <Route
            path="/routines/new"
            element={(
              <EditorView
                routineId={null}
                onOpenSettings={openSettings}
                onOpenRoutines={openRoutines}
                onMessage={setMessage}
                onError={setError}
              />
            )}
          />
          <Route
            path="/routines/:id/edit"
            element={(
              <EditorRoute
                onOpenSettings={openSettings}
                onOpenRoutines={openRoutines}
                onMessage={setMessage}
                onError={setError}
              />
            )}
          />
          <Route path="/settings" element={<SettingsView onOpenRunner={openRunner} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ErrorBoundary>

      {error && <MessageBanner variant="error" message={error} />}
      {message && <MessageBanner variant="message" message={message} />}
    </main>
  );
}

interface EditorRouteProps {
  onOpenSettings: () => void;
  onOpenRoutines: () => void;
  onMessage: (message: string | null) => void;
  onError: (message: string | null) => void;
}

function EditorRoute({
  onOpenSettings,
  onOpenRoutines,
  onMessage,
  onError,
}: EditorRouteProps) {
  const params = useParams();
  const parsedId = Number(params.id);

  if (!Number.isFinite(parsedId)) {
    return <Navigate to="/routines" replace />;
  }

  return (
    <EditorView
      routineId={parsedId}
      onOpenSettings={onOpenSettings}
      onOpenRoutines={onOpenRoutines}
      onMessage={onMessage}
      onError={onError}
    />
  );
}

function resolveRouteForView(view: string) {
  switch (view) {
    case 'routines':
      return '/routines';
    case 'editor':
      return '/routines/new';
    case 'settings':
      return '/settings';
    case 'runner':
    default:
      return '/';
  }
}

function App() {
  return (
    <HashRouter>
      <SidepanelShell />
    </HashRouter>
  );
}

export default App;
