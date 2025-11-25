# Event App Backend

NestJS + Prisma backend for the event sharing application. Provides REST and WebSocket APIs for profiles, events, chats, sharing, folders, and friends with real-time updates.

## Requirements

- Node.js 18+
- pnpm / npm / yarn
- PostgreSQL 14+
- Redis 6+
- (Optional) S3-compatible storage (MinIO, AWS S3) for media uploads

## Environment Variables

Create `.env` based on the template below:

```
NODE_ENV=development
PORT=4000
CORS_ORIGIN=http://localhost:3000

DATABASE_URL=postgresql://postgres:postgres@localhost:5432/event_app
REDIS_URL=redis://localhost:6379

JWT_ACCESS_SECRET=replace-with-strong-secret
JWT_REFRESH_SECRET=replace-with-strong-secret-2
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d

APP_BACKEND_BASE_URL=http://localhost:4000

SENDGRID_API_KEY=your-sendgrid-api-key
SENDGRID_FROM_EMAIL=no-reply@example.com
EMAIL_VERIFICATION_REDIRECT_URL=http://localhost:3000/auth/verify
PASSWORD_RESET_REDIRECT_URL=http://localhost:3000/auth/reset

GOOGLE_CLIENT_ID=google-oauth-client-id
GOOGLE_CLIENT_SECRET=google-oauth-client-secret

# Object storage (optional)
STORAGE_ENDPOINT=http://localhost:9000
STORAGE_BUCKET=event-app
STORAGE_ACCESS_KEY=minio
STORAGE_SECRET_KEY=minio123
STORAGE_REGION=us-east-1
STORAGE_PUBLIC_BASE_URL=http://localhost:9000/event-app
```

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start infrastructure (example using docker-compose):
   ```bash
   docker compose up postgres redis minio
   ```

3. Generate Prisma client and run migrations:
   ```bash
   npm run prisma:generate
   npm run prisma:migrate
   ```

4. Start development server:
   ```bash
   npm run start:dev
   ```

API will be available at `http://localhost:4000`.

## REST API Overview

### Auth
| Method | Path | Description |
| - | - | - |
| `POST` | `/auth/register` | Register new user (email/password) and send verification link |
| `POST` | `/auth/login` | Login (email/password) |
| `POST` | `/auth/refresh` | Refresh tokens |
| `POST` | `/auth/logout` | Revoke refresh tokens |
| `POST` | `/auth/verify-email` | Confirm e-mail with token (JSON flow) |
| `GET` | `/auth/verify-email?token=` | Confirm e-mail via link (HTML redirect) |
| `POST` | `/auth/request-password-reset` | Trigger password reset email |
| `POST` | `/auth/reset-password` | Reset password with token |
| `POST` | `/auth/google` | Login/Register via Google ID token |
| `GET` | `/auth/me` | Current user profile |

### Users
| Method | Path | Description |
| - | - | - |
| `GET` | `/users/me` | My profile |
| `GET` | `/users/:id` | Public profile |
| `PATCH` | `/users/:id` | Update profile (owner only) |

### Events
| Method | Path | Description |
| - | - | - |
| `POST` | `/events` | Create event (organizer) |
| `GET` | `/events` | List events (filter by `organizerId`, `upcoming` ) |
| `GET` | `/events/:id` | Event detail |
| `POST` | `/events/:id/join` | Request participation |
| `PATCH` | `/events/:eventId/requests/:membershipId?accept=true` | Organizer accepts/rejects request |
| `GET` | `/events/:id/members` | List accepted members |

### Chats
| Method | Path | Description |
| - | - | - |
| `GET` | `/chats` | List chats for user |
| `POST` | `/chats/:chatId/messages` | Send message / share event |

### Folders
| Method | Path | Description |
| - | - | - |
| `POST` | `/folders` | Create folder |
| `GET` | `/folders` | List folders with chats |

### Friends
| Method | Path | Description |
| - | - | - |
| `GET` | `/friends` | List accepted friendships |
| `POST` | `/friends/:friendId` | Add (accept) friend |
| `DELETE` | `/friends/:friendId` | Remove friend |

## WebSocket API

- Namespace: `ws://<host>:4000/ws/chats`
- Authentication: send `{ auth: { token: 'Bearer <ACCESS_TOKEN>' } }` or `Authorization` header
- Rooms:
  - `chat:<chatId>` — specific chat updates
  - `user:<userId>` — user-level notifications

### Events
| Event | Direction | Payload |
| - | - | - |
| `chat:join` | client → server | `{ chatId }` — join chat room |
| `message:send` | client → server | `{ chatId, dto: { content?, eventId? } }` |
| `message:new` | server → clients | Message object with sender |
| `chats:update` | server → user room | Notify to refetch chat list |

## Scripts

- `npm run start:dev` – start NestJS in watch mode
- `npm run build` – compile TypeScript to `dist`
- `npm run prisma:migrate` – apply migrations interactively
- `npm run prisma:deploy` – apply migrations in production

## Project Structure

```
server/
  prisma/
    schema.prisma        # Database schema
  src/
    auth/                # Authentication module
    chats/               # Chats & messages module + WebSocket gateway
    events/              # Events, invitations, sharing
    folders/             # Message folders management
    friends/             # Friendships
    users/               # User profiles
    redis/               # Redis providers
    ws/                  # WebSocket adapters
    config/              # Config and validation
    prisma/              # Prisma module/service
    health/              # Health endpoints
    shared/              # Shared utilities (decorators, guards)
    main.ts              # App bootstrap
    app.module.ts        # Root module
```

## Pending Modules

- Extend friends module with requests/invitations endpoints
- File upload service (S3 / MinIO)
- Notifications delivery
- Integration tests (Jest / Pactum)

## License

MIT
