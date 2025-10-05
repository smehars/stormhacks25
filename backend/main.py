from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
#from 

app = FastAPI(title="Posture Analysis")

origins = [
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True, 
    allow_methods=["*"],    
    allow_headers=["*"],   
)

@app.get("/")
async def root():
    return {"message": "Hello World"}
#literally everything above is just basic setup for a fastapi server you can find online

class Landmark(Basemodel):
    idx: int
    x: float
    y: float    
    z: Optional[float] = 0.0
    visibility: Optional[float] = 0.0

class LamkarksPayload(Basemodel):
    landmarks: List[Landmark]   

@app.post("/analyze_posture")
def analyze_posture(payload: LandmarksPayload):
    return analyze_landmarks([lm.dict() for lm in payload.landmarks])

@app.get("/last_angle")
def last_angle():
    val = last_angle_value()
    if val is None:
        return {"error": "no angle yet"}
    return {"angle_deg": val}


