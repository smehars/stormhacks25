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
FORWARD_TILT_THRESHOLD = 3.0  
HEAD_Y_DIFF_THRESHOLD = 3.0  
SHOULDER_DIFF_THRESHOLD = 3.0
BACK_ANGLE_DEG_THRESHOLD = 12.0  

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
    """
    Robust landmark lookup: supports list-of-dicts by index (landmarks[idx])
    or list-of-dicts that include an 'idx' field.
    """
    if not landmarks:
        return None
    # first try objects with "idx" key
    try:
        lm = next((p for p in landmarks if isinstance(p, dict) and p.get("idx") == idx), None)
        if lm:
            return lm
    except Exception:
        pass
    # fall back to positional index
    try:
        if isinstance(landmarks, list) and 0 <= idx < len(landmarks):
            item = landmarks[idx]
            if isinstance(item, dict) and "x" in item and "y" in item:
                return item
    except Exception:
        pass
    return None

def check_vis(lm: Optional[Dict]) -> bool:
    # treat missing visibility as not visible
    if lm is None:
        return False
    vis = lm.get("visibility", None)
    if vis is None:
        return False
    return vis >= VISIBILITY_THRESHOLD

def raw_head_angle_degrees(landmarks: List[Dict]) -> Optional[Dict[str, float]]:


    ls = find_landmark(landmarks, LEFT_SHOULDER)
    rs = find_landmark(landmarks, RIGHT_SHOULDER)
    nose = find_landmark(landmarks, NOSE)
    le = find_landmark(landmarks, LEFT_EAR)
    re = find_landmark(landmarks, RIGHT_EAR)

    # require shoulders and at least one head landmark
    if not (check_vis(ls) and check_vis(rs) and (check_vis(nose) or check_vis(le) or check_vis(re))):
        return None

    sx = (ls["x"] + rs["x"]) / 2.0
    sy = (ls["y"] + rs["y"]) / 2.0  

    # collect available head points
    head_points = []
    if check_vis(nose):
        head_points.append((nose["x"], nose["y"]))
    if check_vis(le):
        head_points.append((le["x"], le["y"]))
    if check_vis(re):
        head_points.append((re["x"], re["y"]))
    if not head_points:
        return None

    hx = sum(p[0] for p in head_points) / len(head_points)
    hy = sum(p[1] for p in head_points) / len(head_points)

    dx = hx - sx
    dy = hy - sy
    
    side_rad = math.atan2(dx, dy)
    side_deg = math.degrees(side_rad)

    dy_pitch = sy - hy
    horiz = max(abs(hx - sx), 1e-6)  # horizontal distance
    pitch_rad = math.atan2(dy_pitch, horiz)
    pitch_deg = math.degrees(pitch_rad)

    return {
        "side_tilt_deg": side_deg,
        "forward_tilt_deg": pitch_deg
    }

#calc shoulder tilt (vertical difference)
def shoulder_angle_difference(landmarks: List[Dict]) -> Optional[float]:
    ls = find_landmark(landmarks, LEFT_SHOULDER)
    rs = find_landmark(landmarks, RIGHT_SHOULDER)

    if not (ls and rs):
        return None
    return abs(ls["y"] - rs["y"])

#public api helpers
def avg_point(landmarks: List[dict], indx1: int, indx2: int):
    p1 = find_landmark(landmarks, indx1)
    p2 = find_landmark(landmarks, indx2)
    if p1 and p2:
        return {"x": (p1["x"] + p2["x"]) / 2.0, "y": (p1["y"] + p2["y"]) / 2.0}
    return None

def analyze_upper_body(landmarks: List[dict]) -> Dict:
   
    global last_angle, bad_streak, good_streak, current_state, neutral_offset

    raw = raw_head_angle_degrees(landmarks)
    if raw is None:
        return {"error": "insufficient landmarks visibility"}

    raw_pitch = raw["forward_tilt_deg"]
    adj_angle = raw_pitch - neutral_offset

    with buffer_lock:
        angle_buffer.append(adj_angle)
        smooth = sum(angle_buffer) / len(angle_buffer)

    last_angle = smooth

    # shoulder level diff
    shoulder_diff = shoulder_angle_difference(landmarks)
    shoulder_bad = False
    if shoulder_diff is not None:
        shoulder_bad = shoulder_diff > SHOULDER_DIFF_THRESHOLD

    # head vertical offset relative to shoulder center
    nose = find_landmark(landmarks, NOSE)
    head_y_bad = False
    if nose:
        ls = find_landmark(landmarks, LEFT_SHOULDER)
        rs = find_landmark(landmarks, RIGHT_SHOULDER)
        if ls and rs:
            sy = (ls["y"] + rs["y"]) / 2.0
            head_y_diff = nose["y"] - sy
            head_y_bad = abs(head_y_diff) > HEAD_Y_DIFF_THRESHOLD

    # back / lean check using shoulder -> hip vector
    mid_shoulder = avg_point(landmarks, LEFT_SHOULDER, RIGHT_SHOULDER)
    mid_hip = avg_point(landmarks, 23, 24)
    back_bad = False
    dev = None
    if mid_shoulder and mid_hip:
        ang = abs(math.degrees(math.atan2(mid_hip["y"] - mid_shoulder["y"], mid_hip["x"] - mid_shoulder["x"])))
        dev = abs(90.0 - ang)
        back_bad = dev > BACK_ANGLE_DEG_THRESHOLD

    # forward head check using smoothed pitch degrees
    pitch_bad = abs(smooth) >= FORWARD_TILT_THRESHOLD

    reasons = []
    if pitch_bad:
        reasons.append("forward_head")
    if head_y_bad:
        reasons.append("head_vertical_offset")
    if shoulder_bad:
        reasons.append("shoulder_level")
    if back_bad:
        reasons.append("back_lean")

    # update streaks
    is_bad = bool(reasons)
    if is_bad:
        bad_streak += 1
        good_streak = 0
    else:
        good_streak += 1
        bad_streak = 0

    # detect current status
    if bad_streak >= CONSECUTIVE_BAD_REQUIRED:
        current_state = "bad_posture"
    elif good_streak >= CONSECUTIVE_GOOD_REQUIRED:
        current_state = "good_posture"
    else:
        current_state = "unknown"

    response = {
        "angle_deg": round(smooth, 2),
        "raw_angle_deg": round(raw_pitch, 2),
        "state": current_state,
        "reason": reasons[0] if reasons else "good_posture",
        "shoulder_level_diff": round(shoulder_diff, 4) if shoulder_diff is not None else None,
        "back_deviation_deg": round(dev, 2) if dev is not None else None,
        "feedback": get_posture_feedback(landmarks, smooth_angle=smooth, raw_pitch=raw_pitch, shoulder_diff=shoulder_diff, back_dev=dev)
    }
    return response

def set_neutral_offset(angle_deg: float):
    global neutral_offset
    with buffer_lock:
        neutral_offset = float(angle_deg)

def get_posture_feedback(landmarks: List[dict], smooth_angle: Optional[float]=None, raw_pitch: Optional[float]=None, shoulder_diff: Optional[float]=None, back_dev: Optional[float]=None) -> str:

    msgs = []

    nose = find_landmark(landmarks, NOSE)
    ls = find_landmark(landmarks, LEFT_SHOULDER)
    rs = find_landmark(landmarks, RIGHT_SHOULDER)

    if not (nose and ls and rs):
        return "Insufficient landmarks"

    # head vertical position relative to shoulders (same as React's headYDiff)
    sy = (ls["y"] + rs["y"]) / 2.0
    head_y_diff = nose["y"] - sy
    if head_y_diff > HEAD_Y_DIFF_THRESHOLD:
        msgs.append("Lift your head")
    elif head_y_diff < -HEAD_Y_DIFF_THRESHOLD:
        msgs.append("Lower your head")

    # shoulder level
    if shoulder_diff is None:
        shoulder_diff = abs(ls["y"] - rs["y"])
    if shoulder_diff > SHOULDER_DIFF_THRESHOLD:
        msgs.append("Levle shoulders.")

    # forward head tilt (prefer smoothed angle)
    pitch = smooth_angle if smooth_angle is not None else (raw_pitch if raw_pitch is not None else last_angle)
    if pitch is not None and abs(pitch) >= FORWARD_TILT_THRESHOLD:
        if pitch > 0:
            msgs.append("Move head up")
        else:
            msgs.append("Move head down")

    # back lean
    if back_dev is not None and back_dev > BACK_ANGLE_DEG_THRESHOLD:
        msgs.append("Straighten back")

    if not msgs:
        return "Good Posture"
    return " ".join(msgs)

def last_angle_value() -> Optional[float]:
    return last_angle
