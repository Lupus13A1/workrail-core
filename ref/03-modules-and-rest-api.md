# 03 — รายการ Backend Modules (11 Modules) และ REST API Endpoints (Multi-Tenant Platform)

Base URL: `/api/v1`  
Tenant Context (การระบุ Organization / Workspace ปัจจุบัน):
- **สำหรับ Web UI:** ส่ง `Authorization: Bearer <Firebase_ID_Token>` และระบุ `orgId` ผ่าน URL `/api/v1/orgs/:orgId/...` (หรือส่ง Header `X-Org-Id: <orgId>` ซึ่งหากไม่ส่งจะใช้ `activeOrgId` ของผู้ใช้คนนั้น)
- **สำหรับ AI Agents (MCP):** ส่ง `Authorization: Bearer board_pat_<token>` หรือ MCP OAuth Access Token ซึ่งผูกกับ `userId` และ `orgId` ไว้ใน `/access_tokens/{tokenHash}` เรียบร้อยแล้ว

---

## 1. สรุป 11 Core Backend Modules

| ลำดับ | ชื่อ Module | โฟลเดอร์แนะนำ | ขอบเขตความรับผิดชอบหลัก |
| :---: | :--- | :--- | :--- |
| **1** | **AuthModule** | `src/modules/auth` | ยืนยันตัวตนด้วย **Firebase Authentication** (Email/Password และ **Third-Party Login** เช่น Google Sign-In), ตรวจ `verifyIdToken()`, สร้าง **Default Organization / Workspace** ให้ผู้ใช้ใหม่อัตโนมัติ และจัดการ OAuth 2.1 สำหรับ MCP Clients |
| **2** | **OrganizationsModule** | `src/modules/organizations` | จัดการ **Organization / Workspace (`/orgs/{orgId}`)** บนแพลตฟอร์ม: สร้าง Workspace ใหม่, แก้ไขชื่อ, สลับ Workspace ปัจจุบัน (`switch-org`) และตรวจสอบขอบเขตสิทธิ์ระดับ Tenant |
| **3** | **UsersModule** | `src/modules/users` | จัดการโปรไฟล์ผู้ใช้ใน `/users/{uid}` และจัดการสมาชิกของแต่ละ Organization ใน `/orgs/{orgId}/members/{uid}`, การเชิญสมาชิกเข้า Organization (`org_invites`), การกำหนด Role / Role Lane (`Project admin`, `Developer`, `QA`, `BA`, `DevOps`, `Viewer`) และการระงับสมาชิกใน Organization (`Active` / `Suspended` ซึ่งสั่ง Pause Agent ของผู้ใช้นั้นใน Org นั้นอัตโนมัติ) |
| **4** | **ProjectsModule** | `src/modules/projects` | จัดการโปรเจกต์ใน `/orgs/{orgId}/projects/{projectKey}` (`Scrum`, `Kanban`, `Delivery Pipeline`), ตรวจสอบ Project Key (`2–10` ตัวอักษร A-Z/0-9 ไม่ซ้ำภายใน `orgId` เดียวกัน), จัดการคอลัมน์ (`boardConfig`), WIP Limits, Role Lanes, รายการโปรด (`favorite`) และสมาชิกในโปรเจกต์ |
| **5** | **IssuesModule** | `src/modules/issues` | จัดการ Issue CRUD ใน `/orgs/{orgId}/issues/{projectKey}/{issueKey}`, Atomic Key Running (`{KEY}-{n}`), Subtasks (`parent`), การย้ายสถานะและลำดับ (`rank`), โหมดเลือกหลายใบ (`bulk-move`), Work Context (`working`, `touches`, `if_unassigned`), Issue Links (ภายใน `orgId` เดียวกัน), Votes, Watchers, History และ Raw `.md` |
| **6** | **CommentsAttachmentsModule** | `src/modules/comments-attachments` | จัดการความคิดเห็นใน `/orgs/{orgId}/issue_comments/{issueKey}/{seq}`, การตอบกลับแบบ Thread 1 ชั้น (`reply_to`, `in_reply_to`), การแก้ไข/ลบคอมเมนต์, การแท็ก `[@ชื่อ](mention:usr_...)` และการอัปโหลดไฟล์แนบแยกตามโฟลเดอร์ `orgs/{orgId}/attachments/...` |
| **7** | **SprintsModule** | `src/modules/sprints` | จัดการ Sprint ใน `/orgs/{orgId}/sprints/{projectKey}/{sprintCode}` (`planned`, `active`, `closed`), การสร้าง/แก้ไข Sprint, การกด **Start sprint** (เฉพาะคนกดในเว็บ), **Complete sprint**, การลบ Sprint ที่ยังไม่เริ่ม และการคำนวณ Story Points / Burndown Chart |
| **8** | **ProjectDocsModule** | `src/modules/project-docs` | จัดการเอกสาร Markdown ใน `/orgs/{orgId}/project_docs/{projectKey}` ทั้ง 3 ชนิด: **Brief**, **Working Notes** (พร้อม Scoped Labels สูงสุด 10 อัน) และ **Handoffs** (`open` → `acknowledged` → `closed`), ประวัติเวอร์ชัน และ `get_docs_context` |
| **9** | **ReleasesPipelineModule** | `src/modules/releases-pipeline` | จัดการ Delivery Pipeline (`Development` → `Staging / QA` → `Testing (UAT)` → `Production (Released)`), ปุ่ม **Promote**, การจัดการเวอร์ชัน Release ใน `/orgs/{orgId}/releases/{projectKey}/{releaseId}`, Release Notes, `add_to_release` และบันทึกประวัติ Deploy |
| **10** | **AgentsMcpModule** | `src/modules/agents-mcp` | จัดการ **Agent Accounts** ใน `/orgs/{orgId}/agent_accounts/{agentId}` (สร้าง, แก้ไข, กด Pause/Resume รายตัวหรือทั้งหมดใน Org, ดู Run Logs), จัดการ **Personal Access Tokens (`board_pat_...`)** ใน `/access_tokens` (ผูกกับ `orgId`), แปลง Token/OAuth เป็น Agent Account และ MCP Endpoint (`/mcp`) |
| **11** | **InsightsInboxModule** | `src/modules/insights-inbox` | คำนวณข้อมูลหน้า **Manager Insights** ของโปรเจกต์ใน Org นั้น, ระบบค้นหารวมภายใน Org (`Global Search`) และกล่องแจ้งเตือนใน `/orgs/{orgId}/inbox/{uid}` |

---

## 2. รายละเอียด REST API Endpoints ทั้งหมด

### 2.1 AuthModule (`/api/v1/auth` — Firebase Auth & Third-Party Login)
| Method | Endpoint | คำอธิบาย | Request Body / Query | Response หลัก |
| :---: | :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/session` | ตรวจสอบ Firebase `idToken` (จาก Email/Password หรือ **Third-Party Login เช่น Google**) และสร้าง/ซิงก์ข้อมูลผู้ใช้ใน `/users/{uid}` พร้อมสร้าง **Default Organization** ให้ทันทีหากเป็นผู้ใช้ใหม่ | `{ idToken, firstName?, lastName? }` | `{ user, activeOrg, orgs: [...], isNewUser }` |
| `POST` | `/api/v1/auth/register` | สมัครสมาชิกใหม่หรือซิงก์หลัง `createUserWithEmailAndPassword` บนหน้า `/register` พร้อมสร้าง Default Organization | `{ idToken?, firstName, lastName, email, orgName? }` | `{ user, activeOrg, orgs: [...] }` |
| `POST` | `/api/v1/auth/third-party` | เข้าสู่ระบบหรือสมัครด้วย **Firebase Third-Party Login** (Google OAuth `signInWithPopup` / `signInWithCredential`) | `{ idToken, providerId: "google.com" \| "github.com" }` | `{ user, activeOrg, orgs: [...], isNewUser }` |
| `POST` | `/api/v1/auth/forgot-password` | ส่งอีเมลรีเซ็ตรหัสผ่านผ่าน Firebase Auth (`sendPasswordResetEmail`) | `{ email }` | `{ sent: true }` |
| `POST` | `/api/v1/auth/logout` | ออกจากระบบและเพิกถอน Refresh Tokens ใน Firebase (`admin.auth().revokeRefreshTokens(uid)`) | - | `{ success: true }` |
| `GET` | `/api/v1/auth/oauth/authorize` | หน้ายืนยันสิทธิ์เมื่อเชื่อม MCP Client ด้วย OAuth 2.1 (เลือก Organization และเลือกเชื่อมเป็นตัวเอง หรือ Agent Account ใน Org นั้น) | `?client_id=...&code_challenge=...` | `{ orgs, agentsByOrg, clientInfo }` |
| `POST` | `/api/v1/auth/oauth/token` | แลกเปลี่ยน Authorization Code เป็น MCP OAuth Token ที่ผูกกับ `uid` และ `orgId` | `{ code, code_verifier, orgId, actAsAgentId? }` | `{ access_token, token_type, expires_in, orgId }` |

---

### 2.2 OrganizationsModule (`/api/v1/orgs`)
จัดการพื้นที่ทำงาน (Organization / Workspace) บนแพลตฟอร์ม

| Method | Endpoint | คำอธิบาย | Request Body / Query | Response หลัก |
| :---: | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/orgs` | ดึงรายชื่อ Organizations / Workspaces ทั้งหมดที่ผู้ใช้เป็นสมาชิก พร้อม `activeOrgId` | - | `{ activeOrgId, orgs: [...] }` |
| `POST` | `/api/v1/orgs` | สร้าง Organization / Workspace ใหม่บนแพลตฟอร์ม (ผู้สร้างเป็น `Org admin`) | `{ name, slug? }` | `{ org }` |
| `GET` | `/api/v1/orgs/:orgId` | ดูรายละเอียดของ Organization ปัจจุบัน | - | `{ org, memberCount, projectCount }` |
| `PATCH` | `/api/v1/orgs/:orgId` | แก้ไขชื่อหรือ slug ของ Organization (เฉพาะ `Org admin`) | `{ name?, slug? }` | `{ org }` |
| `POST` | `/api/v1/orgs/:orgId/switch` | สลับ Organization ปัจจุบันของผู้ใช้ (` updates /users/{uid}/activeOrgId`) | - | `{ activeOrgId, org }` |

---

### 2.3 UsersModule (`/api/v1/users` & `/api/v1/orgs/:orgId/members`)
จัดการโปรไฟล์ผู้ใช้ระดับแพลตฟอร์ม และสมาชิกภายในแต่ละ Organization (เชื่อมกับหน้า **Users & project members**)

| Method | Endpoint | คำอธิบาย | Request Body / Query | Response หลัก |
| :---: | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/users/me` | ดึงข้อมูลโปรไฟล์ผู้ใช้ที่ล็อกอินอยู่ พร้อม `activeOrgId` และรายชื่อ `orgs` | - | `{ user, activeOrgId, orgs }` |
| `PATCH` | `/api/v1/users/me` | แก้ไขชื่อ โปรไฟล์ หรือธีม (`darkMode`) ของตนเอง | `{ firstName?, lastName?, darkMode? }` | `{ user }` |
| `GET` | `/api/v1/orgs/:orgId/members` | ดึงรายชื่อสมาชิกและ Agent Accounts ทั้งหมดใน Organization นี้ (ใช้ในหน้า Users, ช่องเลือก Assignee และ `@mention`) | `?includeAgents=true&status=active` | `{ members: [...], agents: [...] }` |
| `POST` | `/api/v1/orgs/:orgId/members/invite` | สร้างลิงก์เชิญหรือส่งคำเชิญผู้ใช้เข้าร่วม Organization นี้ | `{ email, role: "Org admin" \| "Member" \| "Viewer", defaultLane }` | `{ inviteToken, inviteUrl }` |
| `POST` | `/api/v1/orgs/invites/:inviteToken/accept` | ตอบรับคำเชิญเข้าร่วม Organization | - | `{ orgId, member }` |
| `PATCH` | `/api/v1/orgs/:orgId/members/:userId` | เปลี่ยนบทบาทหรือ Role Lane ของสมาชิกใน Organization (`Project admin`, `Developer`, `QA`, `BA`, `DevOps`, `Viewer`) | `{ role?, defaultLane? }` | `{ member }` |
| `PATCH` | `/api/v1/orgs/:orgId/members/:userId/status` | ระงับหรือเปิดใช้งานสมาชิกใน Organization นี้ (`active` / `suspended`) — **หากถูกระงับ Agent ทุกตัวของสมาชิกคนนี้ใน Organization นี้จะถูก Pause อัตโนมัติ** | `{ status: "active" \| "suspended" }` | `{ member, pausedAgentsCount }` |

---

### 2.4 ProjectsModule (`/api/v1/orgs/:orgId/projects`)
โปรเจกต์ทั้งหมดถูกแยกภายใต้ `orgId` ทำให้ Project Key (`APP`, `CLT`) ไม่ซ้ำกันเฉพาะใน Organization เดียวกัน

| Method | Endpoint | คำอธิบาย | Request Body / Query | Response หลัก |
| :---: | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/orgs/:orgId/projects` | ดึงรายการโปรเจกต์ทั้งหมดใน Organization นี้ พร้อมจำนวน `openIssues`, `assignedIssues`, `sprintStatus` และรายการที่เปิดล่าสุด | `?search=&template=&myWorkOnly=false&sort=recent` | `{ projects: [...], recentProjectIds: [...] }` |
| `POST` | `/api/v1/orgs/:orgId/projects` | สร้างโปรเจกต์ใหม่ใน Organization จาก 1 ใน 3 Templates (`Scrum`, `Kanban`, `Delivery Pipeline`) | `{ name, key, template }` | `{ project }` |
| `GET` | `/api/v1/orgs/:orgId/projects/check-key` | ตรวจสอบว่า Project Key (`2–10` ตัวอักษร A-Z0-9) ถูกต้องและยังไม่ซ้ำภายใน `orgId` นี้ | `?key=MKT` | `{ valid: true, unique: true }` |
| `GET` | `/api/v1/orgs/:orgId/projects/:projectKey` | ดึงข้อมูลโปรเจกต์ตาม `key` หรือ `slug` พร้อมคอลัมน์บอร์ด, WIP limits, Role Lanes และ Sprint ปัจจุบัน | - | `{ project, activeSprint, plannedSprint, stats }` |
| `PATCH` | `/api/v1/orgs/:orgId/projects/:projectKey` | แก้ไขชื่อโปรเจกต์, ปรับคอลัมน์บอร์ด (`boardConfig`), WIP Limits หรือ Role Lanes ของคอลัมน์ | `{ name?, boardConfig?, columnMeta?, roleLanes?, parallelSprints? }` | `{ project }` |
| `POST` | `/api/v1/orgs/:orgId/projects/:projectKey/favorite` | กดติดดาว / ยกเลิกติดดาวโปรเจกต์ | `{ favorite: boolean }` | `{ favorite }` |
| `POST` | `/api/v1/orgs/:orgId/projects/:projectKey/recent` | บันทึกว่าผู้ใช้เพิ่งเปิดโปรเจกต์นี้ (แสดงใน `RECENTLY OPENED`) | - | `{ recentProjectIds }` |
| `GET` | `/api/v1/orgs/:orgId/projects/:projectKey/members` | ดูรายชื่อสมาชิกและ Agent ในโปรเจกต์ | - | `{ members: [...] }` |
| `POST` | `/api/v1/orgs/:orgId/projects/:projectKey/members` | เพิ่มสมาชิกใน Organization เข้าโปรเจกต์พร้อมกำหนดสิทธิ์ (`Project admin`, `Member`, `Viewer`) | `{ userId, role }` | `{ member }` |

---

### 2.5 IssuesModule (`/api/v1/orgs/:orgId/projects/:projectKey/issues` & `/api/v1/orgs/:orgId/issues`)
| Method | Endpoint | คำอธิบาย | Request Body / Query | Response หลัก |
| :---: | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/orgs/:orgId/projects/:projectKey/issues` | ดึงรายการและกรอง Issues ในโปรเจกต์ | `?search=&status=&type=&priority=&assignee=&sprint=&parent=&aiOnly=false&linkedTo=&hideReleased=false` | `{ issues: [...] }` |
| `POST` | `/api/v1/orgs/:orgId/projects/:projectKey/issues` | สร้าง Issue ใหม่ (รันเลข `{KEY}-{n}` แบบ Atomic ด้วย RTDB `transaction()` ต่อโปรเจกต์ใน Org นั้น) | `{ title, type, priority, status, assigneeId?, sprintId?, points?, parent?, tags?, description?, env?, release? }` | `{ issue }` (`version: 1`) |
| `GET` | `/api/v1/orgs/:orgId/issues/:issueKey` | ดึงรายละเอียดครบทุกฟิลด์ของ Issue พร้อม Subtasks, Parent, Links, Working Context และ Raw `.md` | - | `{ issue, subtasks, parentIssue, links, rawMarkdown }` |
| `GET` | `/api/v1/orgs/:orgId/issues/:issueKey/context` | ดึงบริบทรวมของการ์ดในข้อความเดียว (`get_issue_context`) | `?maxChars=24000` | `{ contextMarkdown, version, truncated }` |
| `PATCH` | `/api/v1/orgs/:orgId/issues/:issueKey` | แก้ไขฟิลด์ของ Issue หรือหยิบการ์ดด้วยคำสั่งเดียว (`ifUnassigned: true` + `working` + `touches`) | `{ version, title?, description?, type?, priority?, status?, assigneeId?, points?, sprintId?, parent?, tags?, env?, release?, working?, touches?, ifUnassigned?, reason? }` | `{ issue, warnings: [] }` |
| `POST` | `/api/v1/orgs/:orgId/issues/:issueKey/transition` | ย้ายสถานะคอลัมน์ หรือจัดลำดับการ์ด (`before` / `after` การ์ดอื่น) | `{ version, status, targetIssueId?, position?: "before" \| "after", comment?, reason? }` | `{ issue, warnings: [...] }` |
| `POST` | `/api/v1/orgs/:orgId/projects/:projectKey/issues/bulk-move` | ย้ายสถานะการ์ดหลายใบพร้อมกัน (โหมด **Select** บนบอร์ด) | `{ issueKeys: string[], targetStatus: string, reason?: string }` | `{ moved: [...], skipped: [...] }` |
| `DELETE` | `/api/v1/orgs/:orgId/issues/:issueKey` | ลบ Issue (หรือ Subtask) | `{ version }` | `{ deletedKey }` |
| `POST` | `/api/v1/orgs/:orgId/issues/:issueKey/subtasks` | สร้าง Subtask ย่อยใต้ Issue แม่โดยตรง | `{ title, assigneeId?, priority?, status? }` | `{ subtask, parentProgress }` |
| `POST` | `/api/v1/orgs/:orgId/issues/:issueKey/links` | เชื่อมโยงการ์ดภายใน `orgId` เดียวกัน (`blocks`, `blocked_by`, `relates`, `duplicates`, `clones`) | `{ targetKey, relation }` | `{ links }` |
| `DELETE` | `/api/v1/orgs/:orgId/issues/:issueKey/links/:targetKey` | ยกเลิกการเชื่อมโยงการ์ด | `?relation=relates` | `{ links }` |
| `POST` | `/api/v1/orgs/:orgId/issues/:issueKey/vote` | กดโหวต / ยกเลิกโหวตการ์ด (1 คน 1 เสียง) | - | `{ votes, voted: boolean }` |
| `POST` | `/api/v1/orgs/:orgId/issues/:issueKey/watch` | กดติดตาม / เลิกติดตามการ์ด (Watch) | `{ watch: boolean }` | `{ watchersCount, watching: boolean }` |
| `GET` | `/api/v1/orgs/:orgId/issues/:issueKey/history` | ดูประวัติการแก้ไขของ Issue ทั้งหมด | - | `{ history: [...] }` |

---

### 2.6 CommentsAttachmentsModule (`/api/v1/orgs/:orgId/issues/:issueKey/comments` & `attachments`)
| Method | Endpoint | คำอธิบาย | Request Body / Query | Response หลัก |
| :---: | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/orgs/:orgId/issues/:issueKey/comments` | ดึงรายการคอมเมนต์และเธรดตอบกลับทั้งหมดของการ์ด | - | `{ comments: [...] }` |
| `POST` | `/api/v1/orgs/:orgId/issues/:issueKey/comments` | เพิ่มคอมเมนต์ใหม่ หรือตอบกลับคอมเมนต์ (`inReplyTo`) พร้อมผูกผู้เขียนเข้า Watchers อัตโนมัติ | `{ body, inReplyTo?: number }` | `{ comment, watching: true }` |
| `PATCH` | `/api/v1/orgs/:orgId/issues/:issueKey/comments/:seq` | แก้ไขคอมเมนต์ของตนเอง (ติดป้าย `(แก้ไขแล้ว)` และเพิ่ม `version`) | `{ version, body }` | `{ comment }` |
| `DELETE` | `/api/v1/orgs/:orgId/issues/:issueKey/comments/:seq` | ลบคอมเมนต์ (ล้างเนื้อหาเป็น `"comment นี้ถูกลบ"` โดยคงเลขลำดับและ reply ไว้) | - | `{ comment }` |
| `GET` | `/api/v1/orgs/:orgId/issues/:issueKey/attachments` | ดูรายการไฟล์แนบทั้งหมดของการ์ด | `?type=all\|image\|doc\|video` | `{ attachments: [...] }` |
| `POST` | `/api/v1/orgs/:orgId/issues/:issueKey/attachments/request-upload` | ขอ Presigned PUT URL สำหรับอัปโหลดไฟล์ขึ้น Object Storage (`orgs/{orgId}/attachments/...`) | `{ filename, contentType, sizeBytes }` | `{ uploadId, uploadUrl, expiresAt }` |
| `POST` | `/api/v1/orgs/:orgId/issues/:issueKey/attachments/confirm` | ยืนยันการแนบไฟล์เข้ากับการ์ดหลังจากอัปโหลดสำเร็จ | `{ uploadId }` | `{ attachment }` |
| `DELETE` | `/api/v1/orgs/:orgId/issues/:issueKey/attachments/:attachmentId` | ลบไฟล์แนบถาวร (ผู้อัปโหลด หรือ `Org admin`; หากเป็น Agent ลบได้เฉพาะไฟล์ที่ Token ตัวเองอัปโหลด) | - | `{ deleted: true }` |

---

### 2.7 SprintsModule (`/api/v1/orgs/:orgId/projects/:projectKey/sprints`)
| Method | Endpoint | คำอธิบาย | Request Body / Query | Response หลัก |
| :---: | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/orgs/:orgId/projects/:projectKey/sprints` | ดูรายการ Sprint ทั้งหมด (`planned`, `active`, `closed`) | `?status=` | `{ sprints: [...] }` |
| `POST` | `/api/v1/orgs/:orgId/projects/:projectKey/sprints` | สร้าง Sprint ใหม่ในสถานะ `planned` (รหัส `S-1`, `S-2`, ...) | `{ name, goal?, start, end }` | `{ sprint }` |
| `PATCH` | `/api/v1/orgs/:orgId/projects/:projectKey/sprints/:sprintCode` | แก้ไขชื่อ, เป้าหมาย (`goal`), วันเริ่ม หรือวันสิ้นสุดของ Sprint | `{ version, name?, goal?, start?, end? }` | `{ sprint }` |
| `POST` | `/api/v1/orgs/:orgId/projects/:projectKey/sprints/:sprintCode/start` | **กดเริ่ม Sprint (`planned` → `active`)** — *สงวนไว้ให้คนกดจากเว็บ UI เท่านั้น ห้าม AI Agent เรียก* | `{ name, duration, start, end, goal? }` | `{ sprint }` |
| `POST` | `/api/v1/orgs/:orgId/projects/:projectKey/sprints/:sprintCode/complete` | ปิด Sprint (`active` → `closed`) พร้อมเลือกย้ายงานที่ยังไม่ Done ไป Backlog หรือ Sprint อื่น | `{ moveIncompleteTo: "backlog" \| "new_sprint" \| string }` | `{ completedSprint, movedIssuesCount }` |
| `DELETE` | `/api/v1/orgs/:orgId/projects/:projectKey/sprints/:sprintCode` | ลบ Sprint ที่ยังไม่เริ่ม (`status === "planned"`) และย้ายการ์ดทั้งหมดใน Sprint นั้นกลับเข้า Backlog | - | `{ deletedCode, returnedToBacklogCount }` |
| `POST` | `/api/v1/orgs/:orgId/projects/:projectKey/sprints/:sprintCode/issues` | ย้ายการ์ด 1 หรือหลายใบเข้า Sprint (หรือส่ง `backlog` เพื่อย้ายกลับ Backlog) | `{ issueKeys: string[] }` | `{ updatedCount }` |
| `GET` | `/api/v1/orgs/:orgId/projects/:projectKey/sprints/:sprintCode/burndown` | ดึงข้อมูล Story Points (`committed`, `done`, `remaining`, `progressPct`) และจุดกราฟรายวันสำหรับวาด Burndown Chart | - | `{ committed, done, remaining, progressPct, dailySeries: [...] }` |

---

### 2.8 ProjectDocsModule (`/api/v1/orgs/:orgId/projects/:projectKey/docs`)
| Method | Endpoint | คำอธิบาย | Request Body / Query | Response หลัก |
| :---: | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/orgs/:orgId/projects/:projectKey/docs` | ดึงรายการเอกสารทั้งหมดในโปรเจกต์ แยกตามชนิด (`brief`, `notes`, `handoffs`) | `?kind=&label=&includeDeleted=false` | `{ docs: [...] }` |
| `GET` | `/api/v1/orgs/:orgId/projects/:projectKey/docs/context` | รวมเนื้อหา **Brief + Working Notes + Open Handoffs** เป็น Markdown เดียว (`get_docs_context`) | - | `{ markdown, agentIdentity, projectRules }` |
| `GET` | `/api/v1/orgs/:orgId/projects/:projectKey/docs/:docId` | อ่านเนื้อหาเอกสาร `.md` พร้อม `version` และผู้แก้ไขล่าสุด | - | `{ doc }` |
| `POST` | `/api/v1/orgs/:orgId/projects/:projectKey/docs` | สร้างเอกสารใหม่ (`brief` เฉพาะ Project admin; `notes` ใส่ labels ได้ถึง 10 อัน; `handoffs` ระบุ `targetRole` และ `issues`) | `{ kind, title, markdown, labels?: string[], targetRole?: string, issueKeys?: string[] }` | `{ doc }` |
| `PATCH` | `/api/v1/orgs/:orgId/projects/:projectKey/docs/:docId` | แก้ไขเอกสาร หรือเปลี่ยนสถานะ Handoff (`open`, `closed`) | `{ version, title?, markdown?, labels?, status?, changeSummary? }` | `{ doc }` |
| `POST` | `/api/v1/orgs/:orgId/projects/:projectKey/docs/:docId/acknowledge` | กดรับทราบการส่งมอบงาน (**Acknowledge handoff**: `open` → `acknowledged`) | `{ note? }` | `{ doc }` |
| `GET` | `/api/v1/orgs/:orgId/projects/:projectKey/docs/:docId/history` | ดูประวัติทุกเวอร์ชันของเอกสาร | - | `{ versions: [...] }` |
| `POST` | `/api/v1/orgs/:orgId/projects/:projectKey/docs/:docId/restore` | กู้คืนเอกสารจากเวอร์ชันเก่า (สร้างเป็น `version` ใหม่โดยไม่ลบประวัติ) | `{ targetVersion }` | `{ doc }` |

---

### 2.9 ReleasesPipelineModule (`/api/v1/orgs/:orgId/projects/:projectKey/releases` & `pipeline`)
| Method | Endpoint | คำอธิบาย | Request Body / Query | Response หลัก |
| :---: | :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/orgs/:orgId/issues/:issueKey/promote` | กดปุ่ม **Promote** ในหน้า Delivery Pipeline เพื่อเลื่อน Stage (`Development` → `Staging / QA` → `Testing (UAT)` → `Production (Released)`) | `{ targetStage? }` | `{ issue }` |
| `GET` | `/api/v1/orgs/:orgId/projects/:projectKey/releases` | ดูรายการ Release ทั้งหมด (`planned`, `shipped`) และ Release ล่าสุดบน Production | - | `{ latestProduction, planned: [...], shipped: [...] }` |
| `POST` | `/api/v1/orgs/:orgId/projects/:projectKey/releases` | สร้างแผน Release ใหม่ (เช่น `v1.4.0` หรือ `R-4`) | `{ name, targetDate?, description?, reason? }` | `{ release }` |
| `GET` | `/api/v1/orgs/:orgId/projects/:projectKey/releases/:releaseId` | ดูรายละเอียดของ Release, รายการ Issues ใน Release, Release Note และประวัติการ Deploy ล่าสุด | - | `{ release, issues, latestDeployments }` |
| `PATCH` | `/api/v1/orgs/:orgId/projects/:projectKey/releases/:releaseId` | แก้ไขชื่อ, วันที่เป้าหมาย, คำอธิบาย หรือเขียน **Release Note** | `{ name?, targetDate?, description?, releaseNote?, reason? }` | `{ release }` |
| `POST` | `/api/v1/orgs/:orgId/projects/:projectKey/releases/:releaseId/issues` | เพิ่มการ์ดเข้า Release ทีละหลายใบ (สูงสุด 50 ใบ; ถ้าเป็น Epic จะพาใบลูกไปด้วย) | `{ issueKeys: string[], reason?: string }` | `{ results: [...] }` |
| `POST` | `/api/v1/orgs/:orgId/projects/:projectKey/releases/:releaseId/deployments` | บันทึกประวัติการ Deploy ลง Environment (`deployed`, `verified`, `failed`, `rolled_back`) | `{ environment, artifact, commit, result, notes? }` | `{ deployment }` |
| `POST` | `/api/v1/orgs/:orgId/projects/:projectKey/releases/:releaseId/ship` | กดยืนยันว่า Release นี้ขึ้น Production แล้ว (`Released to production`) — *เฉพาะคนกดในเว็บแอป* | `{ overrideGateReason? }` | `{ release }` |

---

### 2.10 AgentsMcpModule (`/api/v1/orgs/:orgId/agents`, `/api/v1/orgs/:orgId/tokens`, `/mcp`)
| Method | Endpoint | คำอธิบาย | Request Body / Query | Response หลัก |
| :---: | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/orgs/:orgId/agents` | ดูรายการ Agent Accounts ใน Organization นี้ พร้อมสถานะ `paused`, บทบาท (`role`) และจำนวนการเขียนวันนี้ | - | `{ agents: [...] }` |
| `POST` | `/api/v1/orgs/:orgId/agents` | สร้าง Agent Account ใหม่ใน Organization (ชื่อไม่เกิน 40 ตัวอักษร ไม่ซ้ำใน Org, สีไอคอน, บทบาทเริ่มต้น เช่น `Developer`, `QA`) | `{ name, role, iconColor?, existingTokenId? }` | `{ agent }` |
| `PATCH` | `/api/v1/orgs/:orgId/agents/:agentId` | แก้ไขชื่อ บทบาท หรือกด **Pause / Resume** Agent รายตัว | `{ name?, role?, paused?: boolean }` | `{ agent }` |
| `POST` | `/api/v1/orgs/:orgId/agents/pause-all` | กดปุ่ม **Pause all agents / Resume all agents** เพื่อหยุดหรือเปิดการทำงานของ Agent ทุกตัวใน Organization พร้อมกัน | `{ paused: boolean }` | `{ updatedCount, paused }` |
| `GET` | `/api/v1/orgs/:orgId/agents/:agentId/runs` | ดูไทม์ไลน์ประวัติการทำงาน (Run Logs เก็บ 90 วัน) และกราฟจำนวนการเขียนย้อนหลัง 30 วัน | `?days=30` | `{ runs: [...], dailyWrites: [...] }` |
| `GET` | `/api/v1/orgs/:orgId/tokens` | ดูรายการ Personal Access Tokens (`board_pat_...`) และรายการแอปที่เข้าสู่ระบบผ่าน OAuth (`Signed-in apps`) ใน Organization นี้ | - | `{ tokens: [...], oauthApps: [...] }` |
| `POST` | `/api/v1/orgs/:orgId/tokens` | ออก Personal Access Token ใหม่ที่ผูกกับ `userId` และ `orgId` นี้ (ขึ้นต้นด้วย `board_pat_` แสดงค่าเต็มครั้งเดียวตอนสร้าง) | `{ name, role, expiresIn: "30d" \| "90d" \| "1y" \| "never", agentId? }` | `{ token, secret: "board_pat_..." }` |
| `POST` | `/api/v1/orgs/:orgId/tokens/:tokenId/convert-to-agent` | กดปุ่ม **Convert to agent account** เพื่อย้าย Personal Token หรือ OAuth App ไปผูกกับ Agent Account ใน Organization นี้ | `{ agentName?, role? }` | `{ agent, token }` |
| `DELETE` | `/api/v1/orgs/:orgId/tokens/:tokenId` | ยกเลิก (Revoke) Personal Access Token หรือ Sign out OAuth App | - | `{ revoked: true }` |
| `ALL` | `/mcp` | **Streamable HTTP MCP Endpoint** สำหรับ AI Clients (ดึง `orgId` จาก Token อัตโนมัติ) รองรับ `?tools=essential` หรือ `?tools=work_context,sprints,...` | MCP JSON-RPC 2.0 | MCP Streamable HTTP Response |

---

### 2.11 InsightsInboxModule (`/api/v1/orgs/:orgId/insights`, `inbox`, `search`)
| Method | Endpoint | คำอธิบาย | Request Body / Query | Response หลัก |
| :---: | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/orgs/:orgId/projects/:projectKey/insights` | ดึงข้อมูลหน้า Manager Insights: Weekly Summary, Average Cycle Time, Issues Completed, Weekly Throughput, Flow by Status และรายการการ์ดที่รอ Review & QA hand-off | `?period=this_week` | `{ summaryText, avgCycleTimeDays, completedCount, activeInReviewCount, throughputSeries, flowByStatus, flaggedIssues }` |
| `GET` | `/api/v1/orgs/:orgId/search` | ค้นหารวมทั้งโปรเจกต์และ Issues เฉพาะภายใน Organization นี้ (`GlobalSearchModal`) | `?q=...` | `{ projects: [...], issues: [...] }` |
| `GET` | `/api/v1/orgs/:orgId/inbox` | ดึงรายการแจ้งเตือนในกระดิ่งจาก `/orgs/{orgId}/inbox/{uid}` | `?unreadOnly=false&limit=30&before=` | `{ items: [...], nextBefore }` |
| `POST` | `/api/v1/orgs/:orgId/inbox/read` | ทำเครื่องหมายว่าอ่านแจ้งเตือนแล้ว (ระบุ `id` เดียว หรือไม่ส่งเพื่ออ่านทั้งหมดใน Org นี้) | `{ id?: string }` | `{ readCount }` |
