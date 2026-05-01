# ESTATIQ Backend

> RESTful API for the ESTATIQ Smart Property Platform. Built with Node.js, Express.js, MongoDB, and OpenAI GPT-4o Vision for AI-powered image analysis, automatic cover image selection, luxury description generation, and intelligent property tagging.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js v18+ |
| Framework | Express.js |
| Database | MongoDB + Mongoose |
| AI | OpenAI GPT-4o Vision |
| Image Upload | Multer (local filesystem) |
| Environment | dotenv |

---

## Project Structure

```
smart-property-backend/
├── src/
│   ├── app.js                      ← Express app entry point
│   ├── config/
│   │   └── db.js                   ← MongoDB connection
│   ├── models/
│   │   ├── Property.js             ← Property schema + indexes
│   │   └── Image.js                ← Image schema with AI fields
│   ├── routes/
│   │   ├── property.routes.js      ← Property endpoints
│   │   └── image.routes.js         ← Image upload endpoints
│   ├── controllers/
│   │   ├── property.controller.js  ← Property CRUD logic
│   │   └── image.controller.js     ← Upload + async AI trigger
│   ├── services/
│   │   └── openai.service.js       ← GPT-4o Vision integration
│   └── middleware/
│       └── upload.js               ← Multer config (5 files, 10MB)
├── uploads/                        ← Stored property images
├── .env.example                    ← Environment variable template
├── .gitignore
└── package.json
```

---

## Setup Instructions

### Prerequisites
- Node.js v18+
- MongoDB running locally on port 27017
- OpenAI API Key with GPT-4o access

### 1. Install Dependencies

```bash
cd smart-property-backend
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
PORT=8000
MONGODB_URI=mongodb://localhost:27017/smart_property_db
OPENAI_API_KEY=your_openai_api_key_here
```

### 3. Run the Server

```bash
# Development (auto-reload)
npm run dev

# Production
npm start
```

Server runs at: **http://localhost:8000**

Uploaded images served at: **http://localhost:8000/uploads/**

---

## Database Schema

### `properties` Collection

```json
{
  "_id": "ObjectId",
  "title": "String (required)",
  "price": "Number (required, min: 0)",
  "location": "String (required)",
  "description": "String (AI generated, nullable)",
  "tags": ["String"],
  "coverImage": "ObjectId → images",
  "status": "processing | ready | failed",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

### `images` Collection

```json
{
  "_id": "ObjectId",
  "propertyId": "ObjectId → properties",
  "url": "String (/uploads/filename.jpg)",
  "filename": "String",
  "roomType": "bedroom | kitchen | exterior | pool | ...",
  "features": ["pool", "sea_view", "garden", "luxury_interior"],
  "improvements": ["improve lighting", "better angle"],
  "score": "Number (0–100, AI quality rating)",
  "isCover": "Boolean",
  "aiStatus": "pending | done | failed",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

---

## API Reference

### Health Check

```
GET /health
→ { status: "OK", message: "Smart Property API is running 🚀" }
```

---

### Properties

#### Create Property
```
POST /api/properties
Content-Type: application/json

Body:
{
  "title": "Beachfront Villa in Goa",
  "price": 4500000,
  "location": "Goa, India"
}

Response 201:
{
  "success": true,
  "message": "Property created successfully",
  "data": {
    "_id": "...",
    "title": "Beachfront Villa in Goa",
    "price": 4500000,
    "location": "Goa, India",
    "status": "processing",
    "tags": [],
    "coverImage": null
  }
}
```

#### List Properties
```
GET /api/properties

Query Parameters:
  page        number   Page number (default: 1)
  limit       number   Items per page (default: 9)
  search      string   Search title or location
  location    string   Filter by location (partial match)
  minPrice    number   Minimum price
  maxPrice    number   Maximum price
  tags        string   Comma-separated tags e.g. luxury,pool,sea_view

Response 200:
{
  "success": true,
  "data": [ ...properties with populated coverImage ],
  "pagination": {
    "total": 40,
    "page": 1,
    "limit": 9,
    "totalPages": 5
  }
}
```

#### Get Property Details
```
GET /api/properties/:id

Response 200:
{
  "success": true,
  "data": {
    "_id": "...",
    "title": "Beachfront Villa in Goa",
    "price": 4500000,
    "location": "Goa, India",
    "description": "AI generated luxury description...",
    "tags": ["luxury", "pool", "sea_view"],
    "status": "ready",
    "coverImage": { ...image object },
    "images": [ ...all image objects sorted by score desc ]
  }
}
```

---

### Images

#### Upload Images
```
POST /api/properties/:id/images
Content-Type: multipart/form-data

Field name: "images" (1–5 files)
Accepted types: JPEG, PNG, WebP
Max size: 10MB per file

Response 202:
{
  "success": true,
  "message": "Images uploaded. AI analysis running in background.",
  "data": [ ...image records with aiStatus: "pending" ]
}
```

> Returns **202 Accepted** immediately. AI analysis runs asynchronously in the background.

#### Get Property Images
```
GET /api/properties/:id/images

Response 200:
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "propertyId": "...",
      "url": "/uploads/uuid.jpg",
      "roomType": "exterior",
      "features": ["pool", "sea_view"],
      "improvements": ["improve lighting"],
      "score": 87,
      "isCover": true,
      "aiStatus": "done"
    }
  ]
}
```

---

## AI Integration

### Flow

```
User uploads images
       ↓
Images saved to /uploads/ (immediate)
       ↓
202 Accepted → response sent to client
       ↓
Background job starts (async, non-blocking)
       ↓
For each image → GPT-4o Vision API call
       ↓
Returns: roomType, features[], improvements[], score
       ↓
Best score image → set as coverImage (isCover: true)
       ↓
All features → aggregated into property tags
       ↓
GPT-4o → generates luxury description from all insights
       ↓
Property status: "processing" → "ready"
```

### GPT-4o Vision Prompt (Image Analysis)

Each image is converted to base64 and sent to GPT-4o with this prompt:

```
Analyze this real estate property image and respond ONLY with valid JSON:
{
  "roomType": "bedroom | living_room | kitchen | bathroom | dining_room | exterior | garden | pool | balcony | other",
  "features": ["pool", "sea_view", "garden", "luxury_interior", ...],
  "improvements": ["short improvement suggestions"],
  "score": <integer 0-100>
}
```

### Cover Image Selection

The image with the **highest AI quality score** (0–100) is automatically selected as the cover image. Score factors include:
- Image clarity and resolution
- Lighting quality
- Subject matter (exterior/pool shots score higher)
- Overall visual appeal for real estate

### Fallback Behavior

If OpenAI fails for any reason, the system **does not crash**:
- Image defaults: `{ roomType: "other", features: [], improvements: [], score: 50 }`
- Description defaults to a generic luxury template
- Property is still created and fully usable
- `aiStatus` is set to `"failed"` on the image record

---

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "message": "Human-readable error message",
  "error": "Technical detail (dev only)"
}
```

### Common Error Codes

| Code | Cause |
|------|-------|
| 400 | Missing required fields, invalid file type, too many files |
| 404 | Property not found |
| 500 | Server/database error |

### Upload-Specific Errors

```json
// File too large
{ "success": false, "message": "File too large. Maximum size is 10MB per image." }

// Too many files
{ "success": false, "message": "Too many files. Maximum 5 images allowed." }

// Wrong file type
{ "success": false, "message": "Only JPEG, PNG, and WebP images are allowed" }
```

---

## Architecture Decisions

| Decision | Rationale | Production Alternative |
|----------|-----------|----------------------|
| **Local file storage** | Zero config, simple setup | AWS S3 / Cloudinary |
| **GPT-4o with base64** | Best vision accuracy, no URL sharing needed | Batch API for scale |
| **Async AI (fire-and-forget)** | Fast upload UX, non-blocking | Bull queue + Redis for retry |
| **MongoDB local** | Easy dev setup, no Atlas account needed | MongoDB Atlas |
| **No authentication** | Out of assignment scope | JWT + refresh tokens |
| **Polling for status** | Simple client implementation | WebSockets / Server-Sent Events |
| **Port 8000** | Port 5000 conflicts with macOS AirPlay | Configurable via `.env` |

---

## Trade-offs & Assumptions

- **Image storage**: Local filesystem used for simplicity. In production, images should be on S3/Cloudinary with CDN for global delivery and reliability.

- **AI async pattern**: Fire-and-forget is simple but provides no retry mechanism if AI fails silently. A production system would use a job queue (BullMQ) with retry logic, dead letter queues, and failure alerts.

- **No authentication**: Role-based access (agent, buyer, admin) was not listed as a core requirement. JWT-based auth would be added in production.

- **Cover image logic**: Highest AI score wins. Could be enhanced with a composite score factoring in image composition, subject matter priority (exterior > interior), and aspect ratio.

- **Tag generation**: Tags are auto-derived from AI-detected features using a mapping table. Production could allow manual tag override by agents.

- **Single database**: Properties and images are in separate collections but the same database. At scale, consider sharding or separating the image metadata store.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default: 8000) |
| `MONGODB_URI` | Yes | MongoDB connection string |
| `OPENAI_API_KEY` | Yes | OpenAI API key (needs GPT-4o access) |

---

## Scripts

```bash
npm run dev     # Start with nodemon (auto-reload on file changes)
npm start       # Start production server
```
