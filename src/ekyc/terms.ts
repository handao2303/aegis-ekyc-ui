/* Điều khoản mở tài khoản trực tuyến – bản hiển thị trong app (màn eKYC-01).
   Nguồn: docs/01-ekyc/1.2-compliance-legal/P01-terms-privacy.md. Phiên bản phải khớp terms_version của ekyc-service
   (server/src/config.ts); đổi nội dung thì tăng phiên bản để khách được hỏi đồng ý lại (SCRUM-46).
   BẢN NHÁP – chờ Pháp chế/Compliance duyệt. */

export const TERMS_VERSION = "2026.11";
export const TERMS_EFFECTIVE = { vi: "01/11/2026", en: "1 Nov 2026" };

type Sec = { h: [string, string]; p: [string, string][] };

export const TERMS: Sec[] = [
  {
    h: ["1. Phạm vi", "1. Scope"],
    p: [
      ["Điều khoản này áp dụng khi bạn mở tài khoản thanh toán Aegis Bank qua ứng dụng, bằng CCCD gắn chip, thẻ Căn cước hoặc hộ chiếu gắn chip.", "These terms apply when you open an Aegis Bank current account in the app using a chip citizen ID, identity card or chip passport."],
      ["Bạn phải là chủ giấy tờ, tự thực hiện các bước và đủ tuổi theo quy định của sản phẩm.", "You must be the document holder, complete the steps yourself and meet the product's minimum age."],
    ],
  },
  {
    h: ["2. Dữ liệu chúng tôi thu thập", "2. Data we collect"],
    p: [
      ["Ảnh giấy tờ, dữ liệu đọc từ chip (họ tên, số định danh, ngày sinh, ảnh khuôn mặt trong chip), ảnh và video khuôn mặt khi xác thực, thông tin thiết bị và số điện thoại.", "Photos of your document, chip data (name, ID number, date of birth, chip photo), face images and video during verification, device information and phone number."],
      ["Dữ liệu sinh trắc học là dữ liệu cá nhân nhạy cảm và chỉ dùng để xác minh danh tính.", "Biometric data is sensitive personal data and is used only to verify your identity."],
    ],
  },
  {
    h: ["3. Mục đích và phạm vi đồng ý", "3. Purposes and consent"],
    p: [
      ["Bắt buộc – Xử lý dữ liệu định danh: xác minh giấy tờ, đối chiếu khuôn mặt, phát hiện gian lận.", "Required – Identity data: verify your document, match your face, detect fraud."],
      ["Bắt buộc – Tra cứu tín dụng và kiểm tra tuân thủ: tra cứu CIC, sàng lọc phòng chống rửa tiền, danh sách cấm và người có ảnh hưởng chính trị.", "Required – Credit and compliance checks: credit bureau lookup and anti-money-laundering, sanctions and politically exposed person screening."],
      ["Tuỳ chọn – Nhận ưu đãi: gửi thông tin sản phẩm phù hợp. Không chọn mục này không ảnh hưởng đến việc mở tài khoản.", "Optional – Offers: send relevant product information. Not choosing this doesn't affect your application."],
    ],
  },
  {
    h: ["4. Kết quả xét duyệt", "4. How we decide"],
    p: [
      ["Hồ sơ có thể được duyệt tự động, chuyển nhân viên xem xét (thường trong 24 giờ) hoặc chưa được chấp nhận. Chúng tôi có thể đề nghị bạn chụp bổ sung giấy tờ; nếu không bổ sung trong 5 ngày, hồ sơ sẽ bị huỷ.", "Your application may be approved automatically, reviewed by our team (usually within 24 hours) or declined. We may ask you to send another photo; if you don't within 5 days, the application is cancelled."],
      ["Vì lý do an ninh, chúng tôi không nêu chi tiết lý do của một số quyết định.", "For security reasons, we don't give detailed reasons for some decisions."],
    ],
  },
  {
    h: ["5. Thời gian lưu trữ", "5. How long we keep data"],
    p: [
      ["Hồ sơ bỏ dở: xoá sau 7 ngày. Rút lại đồng ý khi chưa có tài khoản: xoá trong 24 giờ.", "Unfinished applications: deleted after 7 days. Consent withdrawn before an account is opened: deleted within 24 hours."],
      ["Hồ sơ đã mở tài khoản hoặc bị từ chối: lưu theo thời hạn pháp luật về phòng, chống rửa tiền, sau đó xoá hoặc ẩn danh.", "Approved or declined applications: kept for the period required by anti-money-laundering law, then deleted or anonymised."],
    ],
  },
  {
    h: ["6. Quyền của bạn", "6. Your rights"],
    p: [
      ["Bạn có quyền xem, yêu cầu sửa, rút lại đồng ý và yêu cầu xoá dữ liệu trong phạm vi pháp luật cho phép, tại Cài đặt › Quyền riêng tư hoặc qua tổng đài 1900 6868.", "You can view, correct, withdraw consent and ask us to delete your data where the law allows, in Settings › Privacy or by calling 1900 6868."],
      ["Khi đã có tài khoản, dữ liệu định danh vẫn phải được lưu theo quy định; chúng tôi ngừng mọi xử lý ngoài mục đích bắt buộc.", "Once you have an account, identity data must still be kept by law; we stop all processing beyond what is required."],
    ],
  },
  {
    h: ["7. Bảo mật", "7. Security"],
    p: [
      ["Dữ liệu được mã hoá khi truyền và khi lưu, chỉ nhân viên được phân quyền mới xem được, mọi lần xem đều được ghi nhật ký.", "Data is encrypted in transit and at rest, only authorised staff can see it, and every access is logged."],
      ["Ngân hàng không bao giờ yêu cầu bạn cung cấp mật khẩu hay mã OTP qua điện thoại hoặc tin nhắn.", "We will never ask for your password or OTP by phone or message."],
    ],
  },
  {
    h: ["8. Liên hệ", "8. Contact"],
    p: [["Tổng đài 1900 6868 (8:00–20:00) hoặc bất kỳ chi nhánh Aegis Bank nào.", "Call 1900 6868 (8 am – 8 pm) or visit any Aegis Bank branch."]],
  },
];
