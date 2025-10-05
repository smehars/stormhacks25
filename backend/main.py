from fastapi import FastAPI, Body
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
from pydantic import BaseModel
from utils.posture_analysis import analyze_upper_body, set_neutral_offset, last_angle_value

app = FastAPI(title="Posture Analysis")

origins = [
    "http://localhost:5173",
    "http://localhost:80",
    "http://localhost",
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

@app.get("/health")
def health_check():
    return {"status": "healthy"}

class Landmark(BaseModel):
    idx: int
    x: float
    y: float    
    z: Optional[float] = 0.0
    visibility: Optional[float] = 0.0

class LandmarksPayload(BaseModel):
    landmarks: List[Landmark]   

@app.post("/analyze_posture")
def analyze_posture(payload: LandmarksPayload):
    lm_dicts = [lm.model_dump() for lm in payload.landmarks]
    return analyze_upper_body(lm_dicts)



@app.get("/last_angle")
def last_angle():
    val = last_angle_value()
    if val is None:
        return {"error": "no angle yet"}
    return {"angle_deg": val}

@app.post("/calibrate")
def calibrate(body: dict = Body(...)):
    if "angle_deg" in body:
        set_neutral_offset(float(body["angle_deg"]))
        return {"neutral_offset":float(body["angle_deg"])}
    return {"error": "angle_deg not provided"}
        


