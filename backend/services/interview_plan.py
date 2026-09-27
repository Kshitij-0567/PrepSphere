"""
Step plans for video mock interviews.

A plan is the ordered list of steps a candidate works through, chosen from the role's
category and the candidate's seniority. It is stored on the interview so a resumed or
reviewed interview always shows the steps it was created with.
"""
from typing import Any, Dict, List

MAX_FOLLOW_UPS = 2

# kind decides how the candidate answers: spoken (camera and mic), code (editor), design (whiteboard).
STEP_TYPES: Dict[str, Dict[str, Any]] = {
    "intro": {"kind": "spoken", "title": "Introduction", "minutes": 2, "follow_up": False},
    "concept": {"kind": "spoken", "title": "Concept check", "minutes": 3, "follow_up": True},
    "deep_dive": {"kind": "spoken", "title": "Resume deep-dive", "minutes": 3, "follow_up": True},
    "coding": {"kind": "code", "title": "Coding", "minutes": 12, "follow_up": False},
    "design": {"kind": "design", "title": "System design", "minutes": 10, "follow_up": False},
    "behavioral": {"kind": "spoken", "title": "Behavioral", "minutes": 3, "follow_up": True},
    "leadership": {"kind": "spoken", "title": "Leadership", "minutes": 3, "follow_up": True},
}

# Role categories from the seeded role catalog. Unknown categories are treated as software.
FAMILIES: Dict[str, Dict[str, Any]] = {
    "software": {
        "languages": ["python", "javascript", "java", "cpp", "go"],
        "design_title": "System design",
        "design_focus": "a scalable software system: services, data stores, queues and APIs",
    },
    "data": {
        "languages": ["python", "sql"],
        "design_title": "ML system design",
        "design_focus": "a data or machine-learning system: data pipelines, training, serving and monitoring",
    },
    "robotics": {
        "languages": ["cpp", "python"],
        "design_title": "System block diagram",
        "design_focus": "a robotics or automation system: sensors, controllers, actuators and the data flow between them",
    },
    "hardware": {
        "languages": ["c", "cpp", "verilog", "python"],
        "design_title": "Block and timing diagram",
        "design_focus": "a hardware or embedded system: functional blocks, buses, clocks and timing",
    },
    "core": {
        "languages": [],
        "design_title": "Sketch and explain",
        "design_focus": "an engineering sketch in the role's discipline, such as a free-body diagram, process flow or schematic",
    },
}

CATEGORY_FAMILY = {
    "Software & Web": "software",
    "Software & Systems": "software",
    "Cloud & DevOps": "software",
    "AI & Data": "data",
    "Robotics & Automation": "robotics",
    "Hardware & VLSI": "hardware",
    "Core Engineering": "core",
}

LANGUAGE_LABELS = {
    "python": "Python", "javascript": "JavaScript", "java": "Java", "cpp": "C++", "c": "C",
    "go": "Go", "sql": "SQL", "verilog": "Verilog",
}


def family_for(category: str | None) -> str:
    return CATEGORY_FAMILY.get(category or "", "software")


def build_plan(category: str | None, seniority: str | None) -> List[Dict[str, Any]]:
    """Ordered steps for a video interview. Junior plans skip design for software-style roles;
    senior plans add a leadership question."""
    family = family_for(category)
    level = seniority or "Mid"
    if family == "core":
        types = ["intro", "concept", "deep_dive", "concept", "design", "behavioral"]
    else:
        types = ["intro", "concept", "deep_dive", "coding", "design", "behavioral"]
        if level == "Junior":
            types.remove("design")
    if level == "Senior":
        types.append("leadership")

    plan: List[Dict[str, Any]] = []
    for index, step_type in enumerate(types):
        step = {"index": index, "type": step_type, **STEP_TYPES[step_type]}
        if step_type == "concept" and types.count("concept") > 1 and index > types.index("concept"):
            step["title"] = "Applied concept"
        if step_type == "coding":
            step["languages"] = FAMILIES[family]["languages"]
        if step_type == "design":
            step["title"] = FAMILIES[family]["design_title"]
            if family == "core":
                step["minutes"] = 8
        plan.append(step)
    return plan


def plan_minutes(plan: List[Dict[str, Any]]) -> int:
    return sum(step.get("minutes", 0) for step in plan)
