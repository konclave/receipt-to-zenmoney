import type { Settings } from '$lib/types';

interface ZenMoneyConnectionRepo {
  saveManualZenMoneyToken(token: string): Promise<void>;
  disconnectZenMoney(): Promise<void>;
}

export function createZenMoneyConnectionStore(
  initial: Pick<Settings, 'zenmoneyToken' | 'zenmoneyAccessToken'>,
  repo: ZenMoneyConnectionRepo,
) {
  let manualToken = $state(initial.zenmoneyToken);
  let savedManualToken = $state(initial.zenmoneyToken);
  let savedAccessToken = $state(initial.zenmoneyAccessToken);
  let saving = $state(false);
  let disconnecting = $state(false);
  let error = $state<string | null>(null);
  let success = $state<string | null>(null);

  const connected = $derived(Boolean(savedManualToken || savedAccessToken));

  function startOAuthFlow() {
    window.location.href = '/api/zenmoney/oauth/start';
  }

  async function saveManualToken() {
    saving = true;
    error = null;
    success = null;

    try {
      await repo.saveManualZenMoneyToken(manualToken);
      savedManualToken = manualToken;
      success = 'Saved';
    } catch (cause) {
      success = null;
      error = cause instanceof Error ? cause.message : String(cause);
    } finally {
      saving = false;
    }
  }

  async function disconnect() {
    disconnecting = true;
    error = null;
    success = null;

    try {
      await repo.disconnectZenMoney();
      manualToken = '';
      savedManualToken = '';
      savedAccessToken = '';
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    } finally {
      disconnecting = false;
    }
  }

  return {
    get manualToken() {
      return manualToken;
    },
    set manualToken(value: string) {
      manualToken = value;
    },
    get saving() {
      return saving;
    },
    get disconnecting() {
      return disconnecting;
    },
    get error() {
      return error;
    },
    get success() {
      return success;
    },
    get connected() {
      return connected;
    },
    startOAuthFlow,
    saveManualToken,
    disconnect,
  };
}
