import { useEffect, useState } from "react";
import AdminBlankPageCurrent from "@/pages/admin/AdminBlankPage";
import AdminBlankPageOld from "@/pages/admin/AdminBlankPageOld";
import {
  ADMIN_PANEL_STYLE_CHANGED_EVENT,
  getAdminPanelStyle,
  type AdminPanelStyle,
} from "@/lib/adminPanelStyle";

const AdminPanelPage = () => {
  const [style, setStyle] = useState<AdminPanelStyle>(() => getAdminPanelStyle());

  useEffect(() => {
    const syncStyle = () => setStyle(getAdminPanelStyle());

    window.addEventListener("storage", syncStyle);
    window.addEventListener(ADMIN_PANEL_STYLE_CHANGED_EVENT, syncStyle);
    return () => {
      window.removeEventListener("storage", syncStyle);
      window.removeEventListener(ADMIN_PANEL_STYLE_CHANGED_EVENT, syncStyle);
    };
  }, []);

  return style === "old" ? <AdminBlankPageOld /> : <AdminBlankPageCurrent />;
};

export default AdminPanelPage;
