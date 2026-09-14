import AdminSalesPageCurrent from "@/pages/admin/AdminSalesPage";
import AdminSalesPageOld from "@/pages/admin/AdminSalesPageOld";
import { getAdminPanelStyle } from "@/lib/adminPanelStyle";

const AdminSalesRoutePage = () => (getAdminPanelStyle() === "old" ? <AdminSalesPageOld /> : <AdminSalesPageCurrent />);

export default AdminSalesRoutePage;
