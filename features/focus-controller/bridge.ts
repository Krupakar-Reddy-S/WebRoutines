export interface ControllerBridgeResponse<TState = unknown> {
  ok: boolean;
  error?: string;
  state?: TState;
}

export function isRuntimeContextAvailable(): boolean {
  try {
    return Boolean(browser?.runtime?.id);
  } catch {
    return false;
  }
}

export async function sendFocusControllerMessage<TState = unknown>(
  message: unknown,
): Promise<ControllerBridgeResponse<TState> | null> {
  if (!isRuntimeContextAvailable()) {
    return null;
  }

  try {
    return normalizeControllerResponse<TState>(
      await browser.runtime.sendMessage(message),
    );
  } catch (error) {
    if (isExtensionContextInvalidError(error)) {
      return null;
    }

    return {
      ok: false,
      error: 'Unable to contact extension controller.',
    };
  }
}

export function isExtensionContextInvalidError(value: unknown): boolean {
  if (!(value instanceof Error) || typeof value.message !== 'string') {
    return false;
  }

  const message = value.message.toLowerCase();
  return (
    message.includes('extension context invalidated')
    || message.includes('could not establish connection')
    || message.includes('receiving end does not exist')
    || message.includes('message port closed before a response was received')
  );
}

function normalizeControllerResponse<TState>(value: unknown): ControllerBridgeResponse<TState> | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<ControllerBridgeResponse<TState>>;
  if (typeof candidate.ok !== 'boolean') {
    return null;
  }

  return {
    ok: candidate.ok,
    error: typeof candidate.error === 'string' ? candidate.error : undefined,
    state: candidate.state,
  };
}
