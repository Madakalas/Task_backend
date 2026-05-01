# ESTATIQ — Smart Property Image & Experience Platform

> AI-powered real estate platform with GPT-4o Vision image analysis, automatic cover image selection, luxury description generation, and a premium Next.js frontend.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js)                    │
│  Listing Page │ Detail Page │ Add Property Page          │
│  Port: 3000                                              │
└───────────────────────┬─────────────────────────────────┘
                        │ HTTP REST API
┌───────────────────────▼─────────────────────────────────┐
│                 BACKEND (Express.js)                     │
│  Port: 8000                                              │
│                                                          │
│  POST /api/properties          → Create property         │
│  GET  /api/properties          → List + filter + paginate│
│  GET  /api/properties/:id      → Property details        │
│  POST /api/properties/:id/images → Upload images         │
│  GET  /api/properties/:id/images → Get images            │
└────────────┬──────────────────────────┬─────────────────┘
             │                          │
┌────────────▼───────┐    ┌─────────────▼──────────────────┐
│  MongoDB (Local)   │    │   OpenAI GPT-4o Vision API      │
│  Port: 27017       │    │                                 │
│  DB: smart_property│    │  • Room type detection          │
│                    │    │  • Feature extraction           │
│  Collections:      │    │  • Quality scoring              │
│  • properties      │    │  • Luxury description gen       │
│  • images          │    │  • Improvement suggestions      │
└────────────────────┘    └─────────────────────────────────┘
             │
┌────────────▼───────┐
│  Local File Storage│
│  /uploads/*.jpg    │
│  Served as static  │
└────────────────────┘
```

---

## Setup Instructions

### Prerequisites
- Node.js v18+
- MongoDB running locally (port 27017)
- OpenAI API Key (GPT-4o access)

### 1. Clone & Install Backend

```bash
cd smart-property-backend
npm install
```

### 2. Environment Variables

```bash
cp .env.example .env
```

Edit `.env`:
```env
PORT=8000
MONGODB_URI=mongodb://localhost:27017/smart_property_db
OPENAI_API_KEY=your_openai_api_key_here
```

### 3. Run Backend

```bash
npm run dev
# Server running at http://localhost:8000
```

### 4. Install & Run Frontend

```bash
cd estatiq_fixed
pnpm install
pnpm dev
# Frontend at http://localhost:3000
```

### 5. Seed Demo Data (optional)

```bash
cd estatiq_fixed
node seed.js
# Creates 40 properties with real images and AI analysis
```

---

## API Reference

### Properties

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/properties` | Create a new property |
| `GET` | `/api/properties` | List properties (paginated + filtered) |
| `GET` | `/api/properties/:id` | Get property with all images |

#### GET /api/properties — Query Parameters

| Param | Type | Description |
|-------|------|-------------|
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 9) |
| `location` | string | Filter by location (partial match) |
| `minPrice` | number | Minimum price |
| `maxPrice` | number | Maximum price |
| `tags` | string | Comma-separated tags e.g. `luxury,pool` |
| `search` | string | Search title or location |

### Images

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/properties/:id/images` | Upload 1–5 images (multipart/form-data, field: `images`) |
| `GET` | `/api/properties/:id/images` | Get all images for a property |

---

## AI Integration

### How It Works

1. User uploads 1–5 images for a property
2. Backend saves images to `/uploads/` and **responds immediately** (202)
3. In the background, each image is sent to **GPT-4o Vision** which returns:
   - `roomType` — bedroom, kitchen, exterior, pool, etc.
   - `features[]` — pool, sea_view, garden, luxury_interior, etc.
   - `improvements[]` — lighting suggestions, clarity tips, etc.
   - `score` — quality rating 0–100
4. The image with the **highest score** is auto-selected as cover image
5. All features are aggregated into **property tags**
6. A **luxury-style description** is generated from all image insights
7. Property `status` changes from `processing` → `ready`

### Frontend Polling
The detail page polls `GET /api/properties/:id` every 4 seconds when `status === "processing"` and updates the UI automatically when AI completes.

### Fallback Behavior
If OpenAI fails for any reason:
- Image analysis defaults to `{ roomType: "other", features: [], score: 50 }`
- Description falls back to a generic luxury template
- Property is still fully usable

---

## Architecture Decisions

| Decision | Rationale | Production Alternative |
|----------|-----------|----------------------|
| Local file storage (Multer) | Simple setup, zero config | AWS S3 / Cloudinary |
| GPT-4o with base64 images | Best vision accuracy | Batch API for scale |
| Async AI (fire-and-forget) | Fast upload UX | Bull queue + Redis |
| MongoDB local | Easy dev setup | MongoDB Atlas |
| No authentication | Out of scope for assignment | JWT + Auth.js |
| Polling for AI status | Simple to implement | WebSockets / SSE |

---

## Trade-offs & Assumptions

- **Image storage**: Local filesystem used for simplicity. In production, S3/Cloudinary would handle CDN, resizing, and reliability
- **AI async**: Fire-and-forget pattern is simple but has no retry on silent failure. Production would use a job queue (Bull/BullMQ)
- **No auth**: Authentication was not listed as a requirement. Role-based access (agent/buyer/admin) would be added in production
- **Cover selection**: Highest AI score wins. Could be improved with ML ranking that considers composition, lighting, and subject matter
- **Tags**: Auto-derived from AI features. Users could also add manual tags in production
- **Port 8000**: Changed from default 5000 due to macOS AirPlay conflict

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS |
| Backend | Node.js, Express.js |
| Database | MongoDB + Mongoose |
| AI | OpenAI GPT-4o Vision |
| Image Storage | Multer (local filesystem) |
| UI Components | shadcn/ui, Lucide React |

