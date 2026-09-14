import AdminUsersPageCurrent from "@/pages/admin/AdminUsersPage";
import AdminUsersPageOld from "@/pages/admin/AdminUsersPageOld";
import { getAdminPanelStyle } from "@/lib/adminPanelStyle";

const AdminUsersRoutePage = () => (getAdminPanelStyle() === "old" ? <AdminUsersPageOld /> : <AdminUsersPageCurrent />);

export default AdminUsersRoutePage;
