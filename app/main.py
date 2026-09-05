from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .database import Base, engine
from .api import routes_investigations

# Create DB tables on startup
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="FinSpectra — Multi-Agent Investigation & Planning Engine",
    description="LangGraph Task-Driven Financial Crime Investigation Engine",
    version="2.4.1"
)

# Enable CORS for Next.js frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routes at /api root
app.include_router(routes_investigations.router, prefix="/api", tags=["Investigations & Alerts"])

@app.get("/api/health")
def health():
    return {
        "status": "online",
        "version": "2.4.1",
        "llm_mode": "mock" if settings.mock_llm_mode else "groq"
    }
