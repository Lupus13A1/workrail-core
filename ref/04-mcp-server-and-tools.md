# 04 — สเปก MCP Server (`/mcp`) และการกรองชุดเครื่องมือ (`?tools=`) สำหรับ Multi-Tenant Platform

## 1. การเชื่อมต่อ MCP Streamable HTTP Endpoint (`/mcp`) และการแยกขอบเขตตาม Organization (`orgId`)

- **Endpoint:** `POST / GET / DELETE /mcp` (ตามมาตรฐาน MCP Streamable HTTP Transport)
- **การยืนยันตัวตนและการระบุ Organization (`orgId`):**
  1. **Personal Access Token (`board_pat_<secret>`):**
     - ส่งใน Header `Authorization: Bearer board_pat_<secret>`
     - Backend นำ SHA-256 hash ของ Token ไปค้นใน `/access_tokens/{tokenHash}` ซึ่งเก็บทั้ง `userId`, `orgId` และ `agentId` (ถ้าผูกกับ Agent Account)
     - ทุก MCP Tool Call ใน Session นั้นจะทำงานภายใต้ `/orgs/{orgId}/...` โดยอัตโนมัติ โดยที่ AI Agent ไม่ต้องส่ง `orgId` มาในพารามิเตอร์ของ Tool
  2. **OAuth 2.1 with PKCE:**
     - เมื่อ AI Client (เช่น Claude Code, Cursor, VS Code, Windsurf, Gemini CLI, ChatGPT) เชื่อมต่อโดยยังไม่มี Token ให้ตอบ `401 Unauthorized` พร้อม `WWW-Authenticate`
     - Client จะเปิดเบราว์เซอร์มาที่หน้ายืนยันสิทธิ์ของ Workrail ผู้ใช้ล็อกอินด้วย Firebase Auth / Google Sign-In แล้วเลือก:
       - **Organization / Workspace** ที่ต้องการให้ AI เชื่อมต่อ
       - **เชื่อมต่อในนาม:** `ตัวฉัน` หรือ `Agent X` ใน Organization นั้น

---

## 2. การกรองชุดเครื่องมือด้วย `?tools=` เพื่อลดขนาด Token

AI Client บางตัวโหลด Schema ของทุก Tool ทุกครั้งที่เริ่ม Session ระบบจึงรองรับการเลือกชุดเครื่องมือผ่าน Query Parameter `?tools=` (ตรงกับสวิตช์ **Full | Essential | Custom** ในหน้า `Agent & MCP access`):

- **`/mcp` (Full mode):** โหลดครบทุกเครื่องมือ
- **`/mcp?tools=essential` (หรือ `?tools=lean`):** โหลดเฉพาะเครื่องมือหลักที่จำเป็น + กลุ่มที่ตั้งเป็น `essentialDefault` (`work_context`, `sprints`, `files`)
- **`/mcp?tools=work_context,sprints,releases` (Custom mode):** เลือกเปิดเฉพาะกลุ่มที่ระบุ หรือใส่เครื่องหมาย `-` นำหน้าเพื่อปิดเฉพาะกลุ่ม (เช่น `?tools=-work_context,-inbox`)
  - หาก AI เรียก Tool ที่อยู่ในกลุ่มที่ถูกปิด ให้ตอบ Error `tool_disabled` พร้อมบอกชื่อกลุ่ม
  - หากพิมพ์ชื่อกลุ่มใน `tools` ผิด ให้ตอบ `400 Bad Request` (`invalid_tools_filter`) พร้อมรายชื่อกลุ่มที่ถูกต้องทั้งหมด

---

## 3. ตารางกลุ่มเครื่องมือ MCP ทั้ง 8 กลุ่ม

| รหัสกลุ่ม (`?tools=`) | ชื่อในหน้า UI | อยู่ใน Essential | รายชื่อ MCP Tools ในกลุ่มนี้ |
| :--- | :--- | :---: | :--- |
| **(Core — โหลดเสมอ)** | Core Projects, Issues & Docs | ✅ | `list_projects`, `get_project`, `list_people`, `list_my_issues`, `start_run`, `get_docs_context`, `get_issue_context`, `search_issues`, `get_issue`, `create_issue`, `update_issue`, `transition_issue`, `link_issues`, `unlink_issues`, `list_comments`, `add_comment`, `reply_comment`, `edit_comment`, `delete_comment`, `list_docs`, `get_doc`, `create_doc`, `update_doc`, `acknowledge_handoff` |
| `work_context` | Work context (`working` / `touches`) | ✅ | เปิดใช้งานฟิลด์ `working`, `touches` และ `if_unassigned` ใน `update_issue` / `transition_issue` พร้อมการตรวจ `touch_overlap` และ `unresolved_blocker` |
| `sprints` | Sprints | ✅ | `list_sprints`, `get_sprint`, `create_sprint`, `update_sprint`, `move_to_sprint`, `close_sprint`, `get_burndown` |
| `files` | Files and doc history | ✅ | `list_dir`, `read_file`, `write_file`, `diff`, `get_history`, `get_doc_history`, `restore_doc_version`, `delete_doc` |
| `inbox` | Inbox | ⬜ | `list_inbox`, `read_inbox` |
| `releases` | Releases | ⬜ | `list_releases`, `get_release`, `create_release`, `update_release`, `add_to_release`, `move_to_release`, `add_release_deployment` |
| `attachments` | Attachments | ⬜ | `list_attachments`, `request_upload`, `attach_file`, `get_download_url`, `delete_attachment` |
| `votes_watchers` | Votes and watchers | ⬜ | `vote_issue`, `unvote_issue`, `watch_issue`, `unwatch_issue`, `list_watchers` |
| `insights` | Insights | ⬜ | `get_project_insights`, `list_summaries`, `get_summary` |

---

## 4. รายละเอียดการทำงานของ MCP Tools สำคัญภายใต้ขอบเขต `orgId`

1. **`list_projects` & `list_people`:**
   - คืนเฉพาะโปรเจกต์และสมาชิก/Agents ที่อยู่ใน `/orgs/{orgId}` เดียวกับ Token เท่านั้น
2. **`get_docs_context({ project_key })`:**
   - บอก AI Agent ว่าตัวเองคือใคร (`"คุณคือ agent X ของ Y ใน workspace Z"`), บทบาทเริ่มต้น (`role`), ความหมายของคอลัมน์ในโปรเจกต์นั้น, เนื้อหา **Project Brief** (ในบล็อก `BEGIN RULES ... END RULES`) และรายการ **Working Notes** + **Open Handoffs** (ในบล็อก `BEGIN USER CONTENT [token] ... END USER CONTENT [token]`)
3. **`get_issue_context({ project_key, issue_key, max_chars = 24000 })`:**
   - คืนเอกสาร Markdown เดียวที่รวมทุกอย่างเกี่ยวกับการ์ดใบนั้นใน `/orgs/{orgId}/issues/{projectKey}/{issueKey}`:
     - ตัวการ์ด ฟิลด์ทั้งหมด และค่า `version` ล่าสุดพร้อมอัปเดตต่อได้ทันที
     - `working` และ `touches` ของการ์ดนี้
     - `parent`, `subtasks` และการ์ดพี่น้องใต้ parent เดียวกัน พร้อม `status`, `assignee` และ `working`
     - การ์ดที่ลิงก์ทุกใบ (`linked[]` ภายใน `orgId` เดียวกัน) พร้อมผู้ถือ, `working`, `touches` และ `agent_live` (เป็น `true` เมื่อมี Agent เรียก Tool บนการ์ดนั้นภายใน 10 นาทีที่ผ่านมา)
     - คอมเมนต์ล่าสุด 20 รายการ
     - Handoff ที่เปิดอยู่และอ้างอิงถึงการ์ดนี้
     - **Notes for this card:** Working notes ล่าสุด 3 รายการที่มี `labels` ตรงกับ `labels` ของการ์ดใบนี้
4. **`update_issue` / `transition_issue` พร้อมการหยิบการ์ดในคำสั่งเดียว:**
   ```json
   {
     "project_key": "APP",
     "issue_key": "APP-104",
     "version": 7,
     "status": "In Progress",
     "working": "Rate-limit POST /login with a token bucket per IP in auth/limiter.ts",
     "touches": ["auth/limiter.ts", "POST /login", "auth/config.ts"],
     "if_unassigned": true,
     "reason": "Starting APP-104"
   }
   ```
   - หากการ์ดยังไม่มีผู้รับผิดชอบ ระบบจะตั้ง `assignee` เป็นผู้ใช้นั้น (หรือ Agent Account นั้น) พร้อมย้ายสถานะและบันทึก `working` / `touches` ใน RTDB Transaction เดียวกัน
   - เมื่อการ์ดย้ายเข้าสถานะหมวด `Done` ระบบจะล้างค่า `working` และ `touches` ออกจากการ์ดโดยอัตโนมัติ (แต่ยังเก็บไว้ใน `issue_history`)
