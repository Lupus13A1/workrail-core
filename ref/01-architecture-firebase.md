# 01 — สถาปัตยกรรมแพลตฟอร์ม (Multi-Tenant Organization / Workspace), Firebase Auth และ Realtime Database

## 1. ภาพรวมสถาปัตยกรรมแพลตฟอร์ม (Multi-Tenant Platform Architecture)

เพื่อให้ **Workrail** ทำงานเป็นแพลตฟอร์มที่รองรับผู้ใช้งานและทีมจำนวนมากได้อย่างสมบูรณ์โดยข้อมูลไม่ปนกัน ระบบจึงใช้ **`Organization / Workspace` (`orgId`)** เป็นตัวคั่นระดับบนสุด (Tenant Boundary) โดยมีหลักการสำคัญ 6 ข้อ:

1. **Multi-Tenant Organization / Workspace Isolation (`/orgs/{orgId}/...`):**
   - ทุก Project, Issue, Sprint, เอกสาร, Agent Account และ Token จะอยู่ภายใต้ `orgId` เสมอ
   - **Project Key ไม่ชนกันข้ามองค์กร:** ทีม A และทีม B สามารถสร้างโปรเจกต์ที่ใช้คีย์ `APP` หรือ `WEB` เหมือนกันได้ใน Organization ของตัวเอง (`/orgs/{orgId}/projects/APP`)
   - **ขอบเขตการมองเห็นคน (`list_people` & `@mention`) และลิงก์ข้ามโปรเจกต์:** จำกัดเฉพาะสมาชิกและโปรเจกต์ที่อยู่ใน `orgId` เดียวกันเท่านั้น
   - **สร้าง Default Organization อัตโนมัติตอนสมัคร (Zero-friction Onboarding):** เมื่อผู้ใช้สมัครสมาชิกหรือล็อกอินด้วย Google ครั้งแรก ระบบจะสร้าง Organization เริ่มต้นให้ทันที (เช่น `"Thanet's Workspace"`) โดยไม่ต้องกรอกข้อมูลนิติบุคคล/บริษัท และ**ไม่มีระบบคิดเงินค่า Seat หรือโควตา Agent**
2. **Markdown-First Records (`/o/{org_id}/p/{project_key}/...`):**
   - ทุก Project, Issue, Comment, Sprint และเอกสารของโปรเจกต์ (Brief, Working Notes, Handoffs) มีโครงสร้างข้อมูลที่แปลงเป็นไฟล์ `.md` พร้อม YAML Frontmatter ได้เสมอ
   - **Firebase Realtime Database (RTDB)** ทำหน้าที่เก็บ JSON Tree สำหรับค้นหา กรอง และซิงก์หน้าบอร์ดแบบ Real-time (`onValue`)
3. **3 Software Delivery Templates (`src/lib/project-dashboard.ts`):**
   - **Scrum:** `Backlog` → `To Do` → `In Progress` → `In Review` → `Done` (มีระบบ Sprints & Story Points Burndown)
   - **Kanban:** `Backlog` → `To Do` → `In Progress` → `In Review` → `Testing (UAT)` → `Done` (ไหลต่อเนื่อง + WIP Limits)
   - **Delivery Pipeline:** `Development` → `Testing · DEV` → `Passed · DEV` → `Testing · SIT` → `Passed · SIT` → `Testing · UAT` → `Passed · UAT` → `Released` (พร้อมมุมมอง Pipeline Stages: `Development` → `Staging / QA` → `Testing (UAT)` → `Production (Released)`)
4. **Firebase Authentication & Third-Party Login:**
   - รองรับการเข้าสู่ระบบด้วย **Email/Password** และ **Third-Party Providers ของ Firebase** (เช่น **Google Sign-In** `GoogleAuthProvider` / `signInWithPopup` และขยายไป GitHub / Microsoft ได้ทันที)
   - Backend ตรวจสอบสิทธิ์ทุก Request ด้วย `admin.auth().verifyIdToken(idToken)` พร้อมตรวจสิทธิ์การเป็นสมาชิกใน `orgId` ปัจจุบัน (`/orgs/{orgId}/members/{uid}`)
5. **User Parity & Agent Accounts (ผูกกับ `userId` + `orgId`):**
   - ผู้ใช้สร้าง **Agent Account** ในองค์กรนั้น (มีชื่อ ไอคอน บทบาทเริ่มต้น เช่น `Developer`, `QA` และปุ่ม **Pause / Resume**) หรือออก **Personal Access Token (`board_pat_...`)** และเชื่อมต่อผ่าน **OAuth 2.1**
   - Token และ Agent จะผูกกับทั้ง **`userId` (เจ้าของ)** และ **`orgId` (องค์กรที่เลือกตอนสร้าง/อนุมัติ)** ทำให้ AI Agent เห็นและแก้ไขได้เฉพาะโปรเจกต์ใน `orgId` นั้นตามสิทธิ์ของเจ้าของ
6. **Optimistic Concurrency Control (`409 version_conflict`) & Multi-Agent Coordination (`working` / `touches`):**
   - ใช้ **RTDB Transactions (`ref.transaction()`)** ในการตรวจค่า `version` ทุกครั้งที่แก้ไขข้อมูล รวมถึงการรันเลข Issue (`{KEY}-{n}`) และการเคลมการ์ดด้วย `if_unassigned: true`

```mermaid
flowchart TB
    subgraph Clients["Frontend Web UI & AI Clients"]
        UI["Workrail Web UI\n(React 19 / TanStack Start + Firebase Client SDK)"]
        MCPClient["AI Clients (Claude Code, Cursor, VS Code, Windsurf, Gemini CLI, ChatGPT)\nStreamable HTTP: /mcp?tools=full|essential|..."]
    end

    subgraph FirebaseAuth["Firebase Authentication"]
        FBAuth["Firebase Auth\n(Email/Password + Third-Party Login: Google OAuth)"]
    end

    subgraph Backend["Workrail Backend Server (NestJS / Express / Node.js + firebase-admin)"]
        subgraph Controllers["API & Transport Layer"]
            REST["REST API Controllers (/api/v1/orgs/:orgId/*)"]
            MCP["MCP Streamable HTTP Gateway (/mcp)"]
        end

        subgraph Guards["Auth, Tenant & Workflow Guards"]
            Auth["Auth & Tenant Guard\n(Verify Firebase ID Token / PAT board_pat_* + Verify orgId Membership)"]
            AgentState["Agent Status & Rate Limit Guard\n(403 agent_paused / 429 rate_limited)"]
            OCC["Optimistic Concurrency & Lane Validator\n(RTDB runTransaction -> 409 version_conflict / 409 already_assigned / role_lane_warning)"]
        end

        subgraph Modules["Core Backend Modules (11 Modules)"]
            M1["1. AuthModule"]
            M2["2. OrganizationsModule (Tenant & Workspace)"]
            M3["3. UsersModule (Profile & Org Members)"]
            M4["4. ProjectsModule"]
            M5["5. IssuesModule"]
            M6["6. CommentsAttachmentsModule"]
            M7["7. SprintsModule"]
            M8["8. ProjectDocsModule"]
            M9["9. ReleasesPipelineModule"]
            M10["10. AgentsMcpModule"]
            M11["11. InsightsInboxModule"]
        end
    end

    subgraph Storage["Firebase Realtime Database & Object Storage"]
        RTDB[("Firebase Realtime Database (RTDB)\n/users/{uid} & /orgs/{orgId}/... + Real-time onValue() Sync")]
        Blob[("Object Storage\n(Firebase Storage / Azure Blob Storage)")]
    end

    UI <-->|Sign-in & Third-Party Login (Google)| FBAuth
    UI -->|REST JSON + Bearer Firebase ID Token| REST
    UI <-->|Real-time Board Sync (onValue /orgs/{orgId}/...)| RTDB
    MCPClient -->|MCP JSON-RPC + Bearer board_pat_* / OAuth (Scoped to orgId)| MCP
    REST & MCP --> Auth
    Auth -.->|admin.auth().verifyIdToken()| FBAuth
    Auth --> AgentState --> OCC --> Modules
    Modules -->|admin.database() / transaction()| RTDB & Blob
```

---

## 2. การทำงานร่วมกันระหว่าง Frontend, Backend และ Firebase ในรูปแบบแพลตฟอร์ม

### 2.1 ขั้นตอน Authentication & การสร้าง Default Organization อัตโนมัติ
1. **ฝั่ง Frontend (`/login`, `/register`, `/forgot-password`):**
   - ใช้ Firebase Client SDK (`firebase/auth`):
     - สมัครสมาชิก: `createUserWithEmailAndPassword(auth, email, password)`
     - เข้าสู่ระบบ: `signInWithEmailAndPassword(auth, email, password)`
     - **Third-Party Login (ปุ่ม Continue with Google):** `signInWithPopup(auth, new GoogleAuthProvider())`
     - ลืมรหัสผ่าน: `sendPasswordResetEmail(auth, email)`
   - เมื่อสำเร็จ ดึง `const idToken = await user.getIdToken()` แล้วเรียก `POST /api/v1/auth/session` หรือ `POST /api/v1/auth/third-party`
2. **ฝั่ง Backend (`AuthGuard` & `AuthModule`):**
   - ตรวจสอบ Token ด้วย `admin.auth().verifyIdToken(idToken, true)`
   - ตรวจสอบใน RTDB ที่ `/users/${decoded.uid}`:
     - **กรณีผู้ใช้ใหม่ (เพิ่งสมัครหรือเข้าด้วย Google ครั้งแรก):**
       1. สร้างข้อมูลผู้ใช้ใน `/users/${uid}`
       2. สร้าง **Default Organization (`org_${nanoid}`)** ใน `/orgs/${orgId}` (เช่น ชื่อ `"${firstName}'s Workspace"`) โดยตั้งผู้ใช้นั้นเป็น `owner` (`role: "Org admin"`)
       3. บันทึก `activeOrgId: orgId` และ `orgs: { [orgId]: "Org admin" }` ลงใน `/users/${uid}`
     - **กรณีผู้ใช้เดิม:** คืนข้อมูลผู้ใช้พร้อมรายการ `orgs` ทั้งหมดที่ผู้ใช้นั้นเป็นสมาชิก และ `activeOrgId` ล่าสุด

### 2.2 การแยกข้อมูลตาม Organization (`orgId`) บน Firebase Realtime Database
- เมื่อผู้ใช้อยู่ในองค์กรใด (`activeOrgId`) Frontend จะ Subscribe ข้อมูลแบบ Real-time (`onValue`) ภายใต้ Path ขององค์กรนั้นเท่านั้น:
  - `/orgs/{orgId}/projects`
  - `/orgs/{orgId}/issues/{projectKey}`
  - `/orgs/{orgId}/sprints/{projectKey}`
  - `/orgs/{orgId}/project_docs/{projectKey}`
  - `/orgs/{orgId}/inbox/{uid}`
- เมื่อ AI Agent เชื่อมต่อผ่าน MCP ด้วย Token (`board_pat_...`) หรือ OAuth Token ตัวระบบจะดึง `orgId` ที่ผูกไว้กับ Token นั้นขึ้นมาอัตโนมัติ ทำให้ AI Agent ทำงานอยู่ในขอบเขตของ `orgId` นั้นเสมอ ไม่สามารถข้ามไปอ่านหรือแก้ข้อมูลของ Organization อื่นบนแพลตฟอร์มได้
