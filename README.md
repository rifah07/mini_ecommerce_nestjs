# Mini E-Commerce API

A production-ready REST API built with NestJS and MySQL. I rebuilt this from an older Express/MongoDB version to learn a more structured, enterprise-style backend architecture.

## What it does

Handles everything you'd expect from an e-commerce backend — auth, products, cart, and orders — with some extra care put into things like fraud prevention, database transactions, and security.

## Tech stack

- **NestJS** — modular, structured, TypeScript-first
- **MySQL** + **TypeORM** — relational data with proper transactions
- **JWT** — access + refresh tokens stored in HTTP-only cookies
- **Swagger** — auto-generated API docs at `/api/docs`
- **Winston** — structured logging to console and log files
- **Helmet + rate limiting** — basic but solid security defaults

## Getting started

You'll need Node 18+, npm, and MySQL 8 installed.

```bash
# 1. Install dependencies
npm install

# 2. Create the database
mysql -u root -p -e "CREATE DATABASE mini_ecommerce;"

# 3. Set up environment
cp .env.example .env
# Fill in your DB credentials and generate JWT secrets (see below)

# 4. Start in dev mode
npm run start:dev
```

**Generating JWT secrets:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
# Run this twice — one for ACCESS_SECRET, one for REFRESH_SECRET
```

Server starts at `http://localhost:3000` and Swagger docs at `http://localhost:3000/api/docs`.

## Environment variables

```env
NODE_ENV=development
PORT=3000

DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=yourpassword
DB_NAME=mini_ecommerce

JWT_ACCESS_SECRET=long_random_string
JWT_REFRESH_SECRET=different_long_random_string
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d

FRONTEND_URL=http://localhost:3001
```

## Project structure

```
src/
├── config/          # App, database, and logger config
├── common/          # Guards, decorators, filters, interceptors
└── modules/
    ├── auth/        # Register, login, refresh, logout, profile
    ├── users/       # Admin user management
    ├── products/    # Product CRUD + public listing
    ├── cart/        # Per-user cart with price snapshots
    └── orders/      # Orders with transactions and fraud prevention
```

Each module follows the same pattern: `entity → dto → service → controller → module`. Keeps things predictable.

## API overview

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | Public | Create account |
| POST | `/auth/login` | Public | Login, sets cookies |
| POST | `/auth/refresh` | Public | Refresh access token |
| POST | `/auth/logout` | User | Clear cookies |
| GET | `/auth/profile` | User | Get own profile |
| GET | `/products` | Public | List with search + pagination |
| POST | `/products` | Admin | Create product |
| PUT | `/products/:id` | Admin | Update product |
| DELETE | `/products/:id` | Admin | Delete product |
| GET | `/cart` | User | Get cart |
| POST | `/cart` | User | Add item |
| PUT | `/cart/:productId` | User | Update quantity |
| DELETE | `/cart/:productId` | User | Remove item |
| POST | `/orders` | User | Place order from cart |
| GET | `/orders` | User | My order history |
| PUT | `/orders/:id/cancel` | User | Cancel an order |
| GET | `/orders/admin/all` | Admin | All orders |
| PUT | `/orders/admin/:id/status` | Admin | Update order status |

Full docs with request/response examples available at `/api/docs` when running locally.

## How auth works

Login sets two HTTP-only cookies — an access token (15 min) and a refresh token (7 days). The frontend never touches the tokens directly, which prevents XSS attacks from stealing them. When the access token expires, hitting `/auth/refresh` issues a new one using the refresh cookie.

## Order rules

Status can only move forward:
```
pending → shipped → delivered
pending → cancelled
```
`delivered` and `cancelled` are final — no further changes allowed.

## Fraud prevention

A few rules to stop order abuse:
1. Max 3 cancellations within any 24-hour window
2. If a user has 5+ orders, cancellation rate must stay below 70%
3. Stock is restored idempotently on cancellation — safe to retry without double-restoring

## Make yourself admin

After registering, run this in MySQL:
```sql
UPDATE users SET role = 'admin' WHERE email = 'your@email.com';
```

## Scripts

```bash
npm run start:dev   # Development with hot reload
npm run build       # Compile to dist/
npm run start:prod  # Run compiled build
npm run test        # Run tests
```