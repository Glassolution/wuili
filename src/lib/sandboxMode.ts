import { useEffect, useState } from "react";

const STORAGE_KEY = "velo:sandbox-mode";
const CHANGE_EVENT = "velo:sandbox-mode-change";

const storageKeyFor = (accountKey?: string | null) =>
  accountKey ? `${STORAGE_KEY}:${accountKey}` : `${STORAGE_KEY}:anonymous`;

export const getSandboxModeEnabled = (accountKey?: string | null) => {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(storageKeyFor(accountKey)) === "on";
};

export const setSandboxModeEnabled = (enabled: boolean, accountKey?: string | null) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKeyFor(accountKey), enabled ? "on" : "off");
  window.localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { accountKey, enabled } }));
};

export const useSandboxMode = (accountKey?: string | null) => {
  const [enabled, setEnabled] = useState(() => getSandboxModeEnabled(accountKey));

  useEffect(() => {
    const sync = () => setEnabled(getSandboxModeEnabled(accountKey));
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener(CHANGE_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(CHANGE_EVENT, sync);
    };
  }, [accountKey]);

  const setForAccount = (nextEnabled: boolean) => setSandboxModeEnabled(nextEnabled, accountKey);

  return [enabled, setForAccount] as const;
};
