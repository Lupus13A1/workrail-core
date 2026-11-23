# workrail-core

Backend สำหรับระบบ MCP (Model Context Protocol) สร้างด้วย **NestJS** ใช้ **DTO + class-validator** ตรวจสอบข้อมูล, **Firebase Realtime Database** เป็นฐานข้อมูล และ **Firebase Authentication** (Google, GitHub, Apple ฯลฯ) สำหรับ login โดย Backend ตรวจ Firebase ID Token ทุก request

## Tech stack
- NestJS 11, TypeScript
- firebase-admin (Auth + Realtime Database)
- class-validator / class-transformer (DTO)
- Docker + Azure App Service (ดู [DEPLOY_AZURE.md](DEPLOY_AZURE.md))

## โครงสร้างโปรเจกต์
```
src/
├─ main.ts                 # bootstrap: prefix /api, ValidationPipe, CORS
├─ app.module.ts
├─ config/                 # ตรวจ environment variables
├─ common/                 # decorators (@Public, @Roles, @CurrentUser), filters, role enum
├─ firebase/               # FirebaseService (Auth + RTDB) แบบ global module
├─ auth/                   # FirebaseAuthGuard, RolesGuard, /auth/me, /auth/role
├─ users/                  # โปรไฟล์ผู้ใช้ใน RTDB
└─ mcp/
   ├─ servers/             # CRUD MCP Server + DTO
   ├─ tools/               # interface สำหรับ External Tool connectors (ต่อยอด)
   └─ ai/                  # interface สำหรับ AI providers (ต่อยอด)
```

## ข้อกำหนดเบื้องต้น
- Node.js 22+ และ npm
- Firebase project ที่เปิดใช้ Realtime Database และ Authentication (เปิด provider ที่ต้องการ เช่น Google)

## วิธีรัน (Local)
1. ติดตั้ง dependencies
   ```bash
   npm install
   ```
2. สร้างไฟล์ env
   ```bash
   cp .env.example .env        # Windows PowerShell: Copy-Item .env.example .env
   ```
3. ตั้งค่า `.env`
   - `FIREBASE_DATABASE_URL` (จำเป็น) เช่น `https://<project>-default-rtdb.<region>.firebasedatabase.app`
   - Service account เลือกแบบใดแบบหนึ่ง
     - ดาวน์โหลดจาก Firebase Console → Project settings → Service accounts → Generate new private key แล้วบันทึกเป็น `serviceAccount.json` ในโฟลเดอร์โปรเจกต์ และตั้ง `GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json`
     - หรือใส่ `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (ใช้ `\n` แทนการขึ้นบรรทัดใหม่)
4. รัน
   ```bash
   npm run start:dev     # โหมดพัฒนา (watch)
   npm run build && npm run start:prod   # โหมด production
   ```
5. ทดสอบ: `GET http://localhost:3000/api/health` ควรได้ `{"status":"ok"}`

> อย่า commit `.env` และ `serviceAccount*.json` (อยู่ใน `.gitignore` แล้ว)

## รันด้วย Docker
```bash
docker build -t workrail-core .
docker run --env-file .env -p 8080:8080 workrail-core
```
หากใช้ไฟล์ service account ให้ mount ไฟล์เข้าไปและตั้ง `GOOGLE_APPLICATION_CREDENTIALS` ให้ตรง path ใน container หรือใช้ตัวแปร `FIREBASE_*` แบบ inline

## Environment variables
| ตัวแปร | จำเป็น | คำอธิบาย |
|---|---|---|
| `PORT` | ไม่ | พอร์ตที่ฟัง (ค่าเริ่มต้น 3000) |
| `CORS_ORIGINS` | ไม่ | origin ที่อนุญาต คั่นด้วย comma |
| `FIREBASE_DATABASE_URL` | ใช่ | URL ของ Realtime Database |
| `GOOGLE_APPLICATION_CREDENTIALS` | * | path ไปยัง service account JSON |
| `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` | * | ใช้แทนไฟล์ service account |

\* ต้องมี credentials อย่างใดอย่างหนึ่ง

## การยืนยันตัวตน
Client login ผ่าน Firebase SDK (Google ฯลฯ) แล้วส่ง ID Token มาใน header
```
Authorization: Bearer <FIREBASE_ID_TOKEN>
```
ทุก endpoint ถูกป้องกันโดยค่าเริ่มต้น endpoint สาธารณะให้ใส่ `@Public()` และจำกัดสิทธิ์ด้วย `@Roles(Role.Admin)`

Role เก็บใน Firebase custom claims ผู้ใช้ใหม่เป็น `user` ส่วน admin คนแรกต้องตั้งค่าเองด้วย Admin SDK เช่น
```js
admin.auth().setCustomUserClaims('<uid>', { role: 'admin' })
```
หลังจากนั้น admin เรียก `POST /api/auth/role` เพื่อตั้ง role ให้ผู้ใช้อื่นได้ (ผู้ใช้ต้อง login ใหม่)

## API
| Method | Path | สิทธิ์ | คำอธิบาย |
|---|---|---|---|
| GET | `/api/health` | public | ตรวจสถานะ |
| GET | `/api/auth/me` | login | ข้อมูลผู้ใช้จาก token |
| POST | `/api/auth/role` | admin | ตั้ง role `{ "uid", "role" }` |
| GET / PATCH | `/api/users/me` | login | โปรไฟล์ของตัวเอง |
| POST / GET | `/api/mcp/servers` | login | สร้าง / แสดงรายการ MCP Server |
| GET / PATCH / DELETE | `/api/mcp/servers/:id` | owner | ดู / แก้ไข / ลบ |

ตัวอย่างสร้าง MCP Server
```bash
curl -X POST http://localhost:3000/api/mcp/servers \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"my-server","transport":"streamable-http","url":"http://localhost:4000/mcp"}'
```
- `transport` = `stdio` ต้องมี `command` (และ `args`, `env` ได้)
- `transport` = `sse` หรือ `streamable-http` ต้องมี `url`

## Firebase Realtime Database rules
ใช้ไฟล์ [database.rules.json](database.rules.json) (ผู้ใช้เข้าถึงได้เฉพาะข้อมูลของตัวเอง) Backend ใช้ Admin SDK จึงไม่ถูกจำกัดโดย rules นี้

## Scripts
| คำสั่ง | หน้าที่ |
|---|---|
| `npm run start:dev` | รันโหมด watch |
| `npm run build` | build ไปที่ `dist/` |
| `npm run start:prod` | รันจาก `dist/` |
| `npm run typecheck` | ตรวจ type |

## Deploy
ดู [DEPLOY_AZURE.md](DEPLOY_AZURE.md)

## Roadmap
- เชื่อมต่อ MCP จริงด้วย MCP SDK (จัดการ connection / เรียก tools)
- AI providers และ Tool connectors ผ่าน interface ใน `src/mcp/`
