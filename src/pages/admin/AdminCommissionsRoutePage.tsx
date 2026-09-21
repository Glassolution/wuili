import AdminCommissionsPageCurrent from "@/pages/admin/AdminCommissionsPage";
import AdminCommissionsPageOld from "@/pages/admin/AdminCommissionsPageOld";
import { getAdminPanelStyle } from "@/lib/adminPanelStyle";

const AdminCommissionsRoutePage = () =>
  getAdminPanelStyle() === "old" ? <AdminCommissionsPageOld /> : <AdminCommissionsPageCurrent />;

export default AdminCommissionsRoutePage;
