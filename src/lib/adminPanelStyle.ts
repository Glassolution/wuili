export type AdminPanelStyle = "old" | "current";

export const ADMIN_PANEL_STYLE_STORAGE_KEY = "velo:admin-panel-style";
export const ADMIN_PANEL_STYLE_CHANGED_EVENT = "velo:admin-panel-style-changed";

export const getAdminPanelStyle = (): AdminPanelStyle => {
  if (typeof window === "undefined") return "current";
  try {
    return window.localStorage?.getItem(ADMIN_PANEL_STYLE_STORAGE_KEY) === "old" ? "old" : "current";
  } catch {
    return "current";
  }
};

export const setAdminPanelStyle = (style: AdminPanelStyle) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage?.setItem(ADMIN_PANEL_STYLE_STORAGE_KEY, style);
  } catch {
    return;
  }
  window.dispatchEvent(new CustomEvent(ADMIN_PANEL_STYLE_CHANGED_EVENT, { detail: style }));
};
