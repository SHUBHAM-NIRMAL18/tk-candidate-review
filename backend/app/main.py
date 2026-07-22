from fastapi import FastAPI

app = FastAPI(
    title="TechKraft Candidate Review API",
    version="1.0.0"
)

@app.get("/")
def read_root():
    """Health check endpoint to verify backend service status."""
    return {"status": "online", "message": "TechKraft Candidate Review API is running"}
