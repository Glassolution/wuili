import AdminRefundsPageCurrent from "@/pages/admin/AdminRefundsPage";
import AdminRefundsPageOld from "@/pages/admin/AdminRefundsPageOld";
import { getAdminPanelStyle } from "@/lib/adminPanelStyle";

const AdminRefundsRoutePage = () => (getAdminPanelStyle() === "old" ? <AdminRefundsPageOld /> : <AdminRefundsPageCurrent />);

export default AdminRefundsRoutePage;
