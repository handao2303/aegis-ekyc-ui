"use client";
/* Các màn đọc localStorage / URL ngay khi khởi tạo, nên chỉ render ở trình duyệt.
   Trang tĩnh vẫn có HTML khung + nền đúng màu để không bị chớp trắng. */
import dynamic from "next/dynamic";

const Loading = () => <div className="fixed inset-0 bg-bg-base" aria-busy="true" />;

export const UiKit = dynamic(() => import("../views/UiKit"), { ssr: false, loading: Loading });
export const CustomerApp = dynamic(() => import("../views/CustomerApp"), { ssr: false, loading: Loading });
export const ComplianceApp = dynamic(() => import("../views/ComplianceApp"), { ssr: false, loading: Loading });
export const ReconciliationApp = dynamic(() => import("../ops/Reconciliation"), { ssr: false, loading: Loading });
export const CreditLimitApp = dynamic(() => import("../ops/CreditLimit"), { ssr: false, loading: Loading });
