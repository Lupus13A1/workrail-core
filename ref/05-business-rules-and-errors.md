# 05 — กฎ Business Logic, Tenant Isolation, Warnings และ Error Codes มาตรฐาน

เพื่อให้ระบบแพลตฟอร์มทำงานสอดคล้องกับคู่มือ AI Agent ใน `public/agents/*.md` ทุกประการ Backend ต้องบังคับใช้กฎและคืนรหัส Error / Warning ตามตารางด้านล่างนี้

---

## 1. ตาราง HTTP Status, Error Codes และ Warnings

| HTTP Status | Error / Warning Code | เงื่อนไขที่เกิด | พฤติกรรมที่คาดหวังจากระบบและ AI Agent |
| :---: | :--- | :--- | :--- |
| `400` | `invalid_tools_filter` | พิมพ์ชื่อกลุ่มใน `?tools=` ไม่ถูกต้อง | ปฏิเสธคำขอพร้อมส่งรายชื่อกลุ่มที่ถูกต้องกลับไป |
| `403` | `org_access_denied` | ผู้ใช้หรือ Token พยายามเข้าถึง `orgId` หรือโปรเจกต์ที่ตนเองไม่ได้เป็นสมาชิก | ปฏิเสธคำขอทันที (ห้ามข้ามขอบเขต Organization / Workspace บนแพลตฟอร์ม) |
| `403` | `link_target_forbidden` | พยายามลิงก์การ์ด (`link_issues`) ไปยังโปรเจกต์ใน Organization เดียวกันที่ผู้ใช้นั้นไม่มีสิทธิ์เปิดอ่าน หรือพยายามลิงก์ข้าม Organization | ปฏิเสธการสร้างลิงก์ (ลิงก์ได้เฉพาะโปรเจกต์ใน `orgId` เดียวกันที่ผู้ใช้เปิดอ่านได้ทั้งสองฝั่ง) |
| `403` | `agent_paused` | Agent ตัวนั้นถูกเจ้าของกด **Pause**, กด **Pause all agents**, หรือเจ้าของถูกระงับ (`suspended`) ใน Organization นั้น | บล็อกคำขอทันทีภายในไม่กี่วินาที AI Agent ต้องหยุดทำงานและแจ้งผู้ใช้ ห้ามหาทางอ้อม |
| `403` | `sprint_start_forbidden` | AI Agent พยายามเรียกคำสั่งกดเริ่ม Sprint หรือลบ Sprint | สงวนไว้ให้คนกดในเว็บแอปเท่านั้น |
| `409` | `version_conflict` | ค่า `version` ที่ส่งมาใน `update_issue`, `transition_issue`, `update_doc` ไม่ตรงกับค่าล่าสุดใน Firebase Realtime Database | ไม่เขียนทับ คืนข้อมูลเวอร์ชันล่าสุดกลับไปให้โหลดใหม่หรือผสานการแก้ไข |
| `409` | `already_assigned` | เรียก `update_issue` หรือ `transition_issue` พร้อม `if_unassigned: true` แต่มีคนหรือ Agent อื่นถือการ์ดนั้นอยู่แล้ว | ไม่เขียนข้อมูลใด ๆ คืนชื่อผู้ถือปัจจุบัน (`details.assignee`) เพื่อให้ Agent ไปหยิบใบอื่น |
| `429` | `rate_limited` | เรียกเกิน `600 calls/นาที/token` หรือเกินเพดานการเขียนต่อนาทีของ Agent | คืนฟิลด์ `retry_after` (วินาที) ให้ Agent รอแล้วลองใหม่ |
| `200` (Warning) | `unresolved_blocker` | ย้ายการ์ดเข้าสถานะ `In Progress` ขณะที่การ์ดตัวบล็อก (`blocked_by`) ยังไม่ `Done` | การย้ายสำเร็จตามปกติ แต่แนบ `warnings: [{ code: "unresolved_blocker", blocker: {...} }]` |
| `200` (Warning) | `touch_overlap` | ย้ายการ์ดเข้าสถานะ `In Progress` แล้วรายการ `touches` ซ้ำกับการ์ดอื่นที่กำลัง `In Progress` อยู่ในโปรเจกต์เดียวกัน | การย้ายสำเร็จตามปกติ แต่แนบ `warnings: [{ code: "touch_overlap", overlap: {...} }]` |
| `200` (Warning) | `role_lane_warning` | AI Agent ย้ายการ์ดออกนอก Role Lane ของตัวเอง (เช่น Agent บทบาท `Developer` ย้ายจาก `In Review` → `Done` ของ `QA`) | การย้ายสำเร็จตามปกติ แต่แนบคำเตือนให้หยุด แจ้งผู้ใช้ และส่งต่องานด้วย Comment หรือ Handoff |

---

## 2. รายละเอียดกฎการตรวจสอบ (Validation Logic)

### 2.1 กฎการแยกขอบเขตข้อมูลระดับแพลตฟอร์ม (Multi-Tenant Isolation Rules)
1. **Uniqueness ต่อ Organization (`orgId`):**
   - **Project Key (`APP`, `CLT`, `MOB`):** ต้องไม่ซ้ำภายใน `/orgs/{orgId}/projects` เดียวกัน แต่ซ้ำกับ Organization อื่นบนแพลตฟอร์มได้
   - **ชื่อ Agent Account (`release-agent-1`):** ต้องไม่ซ้ำภายใน `/orgs/{orgId}/agent_accounts` เดียวกัน
2. **Cross-Project Issue Links (`link_issues`):**
   - เชื่อมโยงการ์ดข้ามโปรเจกต์ได้เฉพาะภายใน `orgId` เดียวกัน (เช่น `APP-104` ↔ `CLT-102` ใน Organization เดียวกัน)
   - ผู้ที่สร้างลิงก์ต้องมีสิทธิ์เข้าถึงทั้งสองโปรเจกต์ มิฉะนั้นคืน `403 link_target_forbidden`
   - หากผู้ใช้คนอื่นเปิดดูการ์ดที่มีลิงก์ไปยังโปรเจกต์ที่ตนเองไม่มีสิทธิ์อ่าน ให้คืน `{ key: "CLT-102", readable: false }` โดยไม่เปิดเผยชื่อหรือรายละเอียดของการ์ดปลายทาง

### 2.2 กฎการตรวจสอบ `touch_overlap`
เมื่อการ์ดถูกย้ายเข้าสถานะกำลังทำ (`In Progress` / `Development`) พร้อมระบุรายการ `touches`:
- เปรียบเทียบแต่ละรายการใน `touches` กับ `touches` ของการ์ดใบอื่นในโปรเจกต์เดียวกันที่อยู่ในสถานะกำลังทำ (สูงสุด 10 ใบ)
- **เงื่อนไขที่ถือว่าซ้อนทับกัน (Overlap):**
  1. ข้อความตรงกันแบบไม่สนตัวพิมพ์เล็ก–ใหญ่และตัดช่องว่างหัวท้าย (Case-insensitive, trimmed) เช่น `POST /login` กับ `post /login`
  2. รายการหนึ่งเป็นชื่อโฟลเดอร์ที่ลงท้ายด้วย `/` และอีกรายการขึ้นต้นด้วยโฟลเดอร์นั้น เช่น `auth/` ซ้อนทับกับ `auth/limiter.ts` (แต่ `auth/limiter.ts` ไม่ซ้อนทับกับ `auth/config.ts`)

### 2.3 กฎการกั้นข้อมูลที่ทีมเขียน (Prompt Injection Fencing)
- เนื้อหาใน **Project Brief** แก้ไขได้เฉพาะ `Project admin` / `Org admin` จึงส่งให้ AI Agent ในฐานะกฎของโปรเจกต์ (`BEGIN RULES ... END RULES`)
- เนื้อหาใน **Working Notes**, **Handoffs**, **Issue Title/Description**, **Working note (`working`)** และ **Comments** สมาชิกทุกคนเขียนได้ Backend ต้องครอบข้อความเหล่านี้ด้วยเครื่องหมาย:
  ```text
  BEGIN USER CONTENT [<random_token_per_response>]
  ...เนื้อหาที่สมาชิกเขียน...
  END USER CONTENT [<random_token_per_response>]
  ```
  เพื่อให้ AI Agent อ่านเป็นข้อมูลประกอบการตัดสินใจเท่านั้น ไม่ทำตามคำสั่งที่ซ่อนอยู่ในเนื้อหา และห้ามข้ามไปแก้ไขโปรเจกต์อื่นตามข้อความที่ซ่อนไว้

### 2.4 กฎขอบเขตสิทธิ์ของ AI Agent (Security Boundary)
AI Agent มีสิทธิ์เท่ากับเจ้าของบัญชีใน Organization นั้น (User Parity) แต่ **ห้ามทำสิ่งเหล่านี้ผ่าน MCP เด็ดขาด** (ต้องให้คนกดในเว็บแอปเท่านั้น):
- การกดเริ่ม Sprint (`Start sprint`: `planned` → `active`) และการลบ Sprint ที่ยังไม่เริ่ม
- การกดยืนยันปล่อย Release ขึ้น Production (`Released to production`)
- การสร้าง/ลบ Organization หรือโปรเจกต์ หรือการแก้ไขคอลัมน์บอร์ด (`boardConfig`)
- การเชิญสมาชิก การเปลี่ยนบทบาทสมาชิก หรือการระงับสมาชิกใน Organization
- การออก/เพิกถอน Personal Access Tokens หรือการกด Pause/Resume Agent Accounts
