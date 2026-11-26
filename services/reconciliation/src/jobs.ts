/* Job nền – production chạy bằng Cloud Scheduler theo lịch riêng; bản dev gọi mỗi phút từ main.ts */
import type { RecService } from "./service.ts";

export function runJobs(svc: RecService) {
  const match = svc.runMatching();                 // UC-REC-03: khớp giao dịch mới nạp
  const escalated = svc.escalateOverdue();         // RULE-REC-06: leo thang ngoại lệ quá hạn
  return { matched: match.matched, exceptions: match.exceptions, settlements: match.settlements, escalated };
}
