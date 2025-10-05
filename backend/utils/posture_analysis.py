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
angle_buffer = deque(maxlen=POINT_WINDOW)
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
def find_landmark(landmarks: List[dict], idx: int):
    return next((p for p in landmarks if p["idx"] == idx), None)

def check_vis(lm: Optional[Dict]) -> bool: ##come back to this might be wrong, feel like if it detects one bad vis, it will return none
    return lm is not None and lm.get("visibility", 0.0) >= VISIBILITY_THRESHOLD

def raw_head_angle_degrees(landmarks: List[Dict]) -> Optional[Dict[str, float]]:

    ls = find_landmark(landmarks, LEFT_SHOULDER)
    rs = find_landmark(landmarks, RIGHT_SHOULDER)
    nose = find_landmark(landmarks, NOSE)
    le = find_landmark(landmarks, LEFT_EAR)
    re = find_landmark(landmarks, RIGHT_EAR)

    if not (check_vis(ls) and check_vis(rs) and check_vis(nose)): #and (check_vis(le) or check_vis(re))):
        return None
    
    sx = (ls["x"] + rs["x"]) / 2.0
    sy = (ls["y"] + rs["y"]) / 2.0  

    #collect head points
    head_points = []
    if check_vis(nose):
        head_points.append((nose["x"], nose["y"]))
    if check_vis(le):
        head_points.append((le["x"], le["y"]))
    if check_vis(re):
        head_points.append((re["x"], re["y"]))
    if not head_points:
        return None
    
    #average head point for ear and nose, this makes it more stable and reduce noise
    hx = sum(p[0] for p in head_points) / len(head_points)
    hy = sum(p[1] for p in head_points) / len(head_points)

    #calculate roll (left and right tilt of head)
    dx = hx - sx
    dy = hy - sy
    if dy == 0:
        dy = 1e-6 #so we dont divide by zero

     #calculate angle of neck tilt 
    angle_rad = math.atan2(dx, dy)
    angle_deg = math.degrees(angle_rad)
   
    #calculate the pitch to forward and back (gamer neck)
    dy_pitch = sy - hy
    if dy_pitch == 0:
        dy_pitch = 1e-6
    pitch_rad = math.atan2(dy_pitch, 1.0)
    pitch_deg = math.degrees(pitch_rad)

    return {
        "side_tilt_deg": angle_deg,
        "forward_tilt_deg": pitch_deg
    }

#calc shoulder tilt
def shoulder_angle_difference(landmarks: List[Dict]) -> Optional[float]:
    ls = find_landmark(landmarks, LEFT_SHOULDER)
    rs = find_landmark(landmarks, RIGHT_SHOULDER)

    if not (check_vis(ls) and check_vis(rs)):
        return None
    return abs(ls["y"] - rs["y"])
   ## come back to this we can add more to track how often we lean to one side

#public api

def avg_point(landmarks: List[dict], indx1: int, indx2: int):
    p1 = next((p for p in landmarks if p["idx"] == indx1), None)
    p2 = next((p for p in landmarks if p["idx"] == indx2), None)
    if p1 and p2:
        return {
            "x": (p1["x"] + p2["x"]) / 2.0,
            "y": (p1["y"] + p2["y"]) / 2.0
        }
    return None

def analyze_upper_body(landmarks: List[dict]) -> Dict:

    global last_angle, bad_streak, good_streak, current_state, neutral_offset 

    raw_angle = raw_head_angle_degrees(landmarks)
    if raw_angle is None:
        return {"error": "insufficient landmarks visibility"}
    
    adj_angle = raw_angle["forward_tilt_deg"] - neutral_offset

    with buffer_lock:
        angle_buffer.append(adj_angle)
        smooth = sum(angle_buffer) / len(angle_buffer)

    last_angle = smooth

    #simple checks 
    shoulder_diff = shoulder_angle_difference(landmarks)
    reason = "forward_head" if smooth >= FORWARD_TILT_THRESHOLD else "good_posture"

    if smooth >= FORWARD_TILT_THRESHOLD:
        bad_streak += 1 
        good_streak = 0
    else:
        good_streak += 1
        bad_streak = 0

    #detect current status
    if bad_streak >= CONSECUTIVE_BAD_REQUIRED:
        current_state = "bad_posture"
    elif good_streak >= CONSECUTIVE_GOOD_REQUIRED:
        current_state = "good_posture"

    response = {
        "angle_deg": round(smooth, 2),
        "raw_angle_deg": round(raw_angle["forward_tilt_deg"], 2),
        "state": current_state,
        "reason": reason,
        "shoulder_level_diff": round(shoulder_diff, 4) if shoulder_diff is not None else None
    }
    return response

def set_neutral_offset(angle_deg: float):
    global neutral_offset
    with buffer_lock:
        neutral_offset = float(angle_deg)

def last_angle_value()->Optional[float]:
    return last_angle
