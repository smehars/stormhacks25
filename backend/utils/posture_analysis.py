print("goonsquad")
import math
from collections import deque
from typing import List, Optional, Dict
import threading

#parameters we want will always be constant
POINT_WINDOW = 6
SEND_RATE = 3
CONSECUTIVE_BAD_REQUIRED = 3
CONSECUTIVE_GOOD_REQUIRED = 2
VISIBILITY_THRESHOLD = 0.3
FORWARD_TILT_THRESHOLD = 10.0 #degree

#internal memory we will manipulate 
angle_buffer = deque(maxlen=SMOOTH_WINDOW)
buffer_lock = threading.Lock()
last_angle: Optional[float] = None
neutral_offset: float = 0.0

#reset to
bad_streak = 0
good_streak = 0
current_state: str = "unknown" #can be "bad", "good", "unknown"

#GLOBAL VAR
NOSE = 0
LEFT_SHOULDER = 11
RIGHT_SHOULDER = 12
LEFT_EAR = 7
RIGHT_EAR = 8

#helper functions
def find_landmark(landmarks: List[dict], idx: int)
    return next((p for p in landmarks if p["idx"] == idx), None)

def check_vis(lm:Dict) -> bool: ##come back to this might be wrong, feel like if it detects one bad vis, it will return none
    return lm is not None and lm.get("visibility", 1.0) >= VISIBILITY_THRESHOLD

def raw_head_angle_degrees(landmarks: List[Dict]) -> Optional[float]:

    ls = find_landmark(landmarks, LEFT_SHOULDER)
    rs = find_landmark(landmarks, RIGHT_SHOULDER)
    nose = find_landmark(landmarks, NOSE)
    #le = find_landmark(landmarks, LEFT_EAR)
    #re = find_landmark(landmarks, RIGHT_EAR)

    if not (check_vis(ls) and check_vis(rs) and check_vis(nose) and (check_vis(le) or check_vis(re))):
        return None
    
    sx = (ls["x"] + rs["x"]) / 2.0
    sy = (ls["y"] + rs["y"]) / 2.0  
    #remember to add ears
    nx = nose["x"]
    ny = nose["y"]

    dx = nx - sx
    dy = ny - sy
#calculates how much your neck is tilted forward
    if dy == 0
        dy = 1e-6 #prevent div by 0, due to the math formula below

    angle_rad = math.atan2(dx, dy)  
    angle_deg = math.degrees(angle_rad)
    return angle_deg

#calc shoulder tilt
def shoulder_angle_difference(landmarks: List[Dict]) -> Optional[float]:
    ls = find_landmark(landmarks, LEFT_SHOULDER)
    rs = find_landmark(landmarks, RIGHT_SHOULDER)

    if not (check_vis(ls) and check_vis(rs)):
        return None
    return abs[ls["y"] - rs["y"]]
   ## come back to this we can add more to track how often we lean to one side

#public api

def analyze_upper_body(landmarks: List[Dict]) -> Dict:


    if dx == 0:
        dx = 1e-6 #prevent div by 0, due to the math formula below

    angle_rad = math.atan2(dy, dx)
    angle_deg = math.degrees(angle_rad)
    return angle_deg

last_angle: Optional[float] = None #global variable

def avg_point(landmarks: List[dict], idx1: int, idx2: 2):
    p1 = next((p for p in landmarks if p["idx"] == indx1), None)
    p2 = next((p for p in landmarks if p["idx"] == indx2), None)
    if p1 and p2:
        return {
         ((p1["x"] + p2["x"]) / 2.0, (p1["y"] + p2["y"]) / 2.0)
        }
    return None

def analyze_landmarks(landmarks: List[dict]) -> Dict:

    global last_angle, bad_streak, good_streak, current_state, neutral_offset 

    raw_angle = raw_head_angle_degrees(landmarks)
    if raw_angle is None:
        return {"error": "insufficient landmarks visibility"}
    
    adj_angle = raw_angle - neutral_offset

    with buffer_lock:
        angle_buffer.append(adj_angle)
        smooth = sum(angle_buffer) / len(angle_buffer)

    last_angle = smooth

    #simple checks 
    shoulder_angle_difference = shoulder_angle_difference(landmarks)
    reason = "forward_head" if smooth >= FORWARD_TILT_THRESHOLD else "good_posture"

    if smooth >= FORWARD_TILT_THRESHOLD:
        bad_streak += 1 
        good_streak = 0
    else:
        good_streak += 1
        bad_streak = 0

    #detect current status
    if bad_streak >= CONSECUTIVE_BAD_REQUIRED
        current_state = "bad_posture"
    elif good_streak >= CONSECUTIVE_GOOD_REQUIRED:
        current_state = "good_posture"

    response = {
        "angle_deg": round(smooth, 2),
        "raw_angle_deg": round(raw_angle, 2),
        "state": current_state,
        "reason": reason,
        "shoulder_level_diff": round(shoulder_angle_difference, 4) if shoulder_angle_difference is not None else None
    }
    return response

def set_neutral_offset(angle):
    global neutral_offset
    with state_lock:
        neutral_offset = angle

 










