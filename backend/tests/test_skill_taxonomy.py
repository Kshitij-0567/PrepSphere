import pytest

from core import database, models
from services.skill_taxonomy import (
    extract_skills_with_evidence,
    index_candidate_skills,
    is_matchable_requirement,
    match_role_skill,
    normalize_skill,
)


def skills_in(text):
    return {s["name"] for s in extract_skills_with_evidence(text)}


@pytest.mark.parametrize("text, wrong_skill", [
    ("CV - Priya Sharma", "Computer Vision"),
    ("Worked with the rest of the team on onboarding.", "REST APIs"),
    ("Summer internship, Spring 2024 semester.", "Spring Boot"),
    ("Implemented a linked list where each node stores a pointer.", "Node.js"),
    ("Helped the product go live ahead of schedule.", "Go"),
    ("Grade: C", "C"),
    ("Led R&D for battery packs.", "R"),
    ("Ran airflow analysis for the cooling duct.", "Apache Airflow"),
    ("Used knowledge distillation to shrink the model.", "Mass Transfer"),
    ("At the helm of the robotics club.", "Helm"),
    ("Added RTL support to the UI.", "RTL Design"),
    ("React Native mobile app for bookings.", "React"),
])
def test_everyday_words_are_not_skills(text, wrong_skill):
    assert wrong_skill not in skills_in(text)


@pytest.mark.parametrize("text, expected", [
    ("Languages: C, C++, Python", {"C", "C++", "Python"}),
    ("Embedded C/C++ firmware for STM32 over CAN bus", {"C", "C++", "Microcontrollers", "CAN Bus", "Embedded Systems"}),
    ("Backend services in Go, Rust and Node.js", {"Go", "Rust", "Node.js"}),
    ("EV battery modeling in MATLAB and Simulink", {"Electric Vehicles", "Battery Management Systems", "MATLAB", "Simulink"}),
    ("Designed parts in SolidWorks and ran FEA in ANSYS; CFD with OpenFOAM", {"SolidWorks", "Finite Element Analysis", "Computational Fluid Dynamics"}),
    ("RTL design in Verilog and SystemVerilog, synthesized on Xilinx FPGA", {"RTL Design", "Verilog", "SystemVerilog", "FPGA"}),
    ("Built RAG pipelines with LangChain and Pinecone", {"Retrieval-Augmented Generation", "LangChain", "Vector Databases"}),
    ("Strong in DSA", {"Data Structures", "Algorithms"}),
    ("Styled pages with HTML5 and CSS3", {"HTML", "CSS"}),
])
def test_real_skills_are_found(text, expected):
    assert expected <= skills_in(text)


def test_mentions_and_evidence():
    text = "Skills: Docker, Python\nProject: containerized the API with Docker and deployed it."
    docker = next(s for s in extract_skills_with_evidence(text) if s["name"] == "Docker")
    assert docker["mentions"] == 2
    assert docker["evidence"].startswith("Skills:")


def test_evidence_keeps_dotted_names_intact():
    evidence = next(s for s in extract_skills_with_evidence("Built the API with Node.js and Express.js.") if s["name"] == "Node.js")
    assert "Node.js" in evidence["evidence"]


def test_normalize_skill():
    assert normalize_skill("ReactJS") == ("React", "Frameworks & Libraries")
    assert normalize_skill("postgres")[0] == "PostgreSQL"
    assert normalize_skill("node")[0] == "Node.js"          # fine for a known skill name
    assert normalize_skill("gRPC-Web")[0] == "gRPC-Web"     # unknown: keeps its capitalization
    assert normalize_skill("kubernetes operator")[0] == "Kubernetes Operator"


def test_composite_requirements_match_concrete_skills():
    index = index_candidate_skills(["Linux", "Bash", "GitHub Actions", "AWS"])
    assert match_role_skill("Linux Internals & Bash", index) == ["Linux", "Bash"]
    assert match_role_skill("CI/CD Pipelines", index) == ["GitHub Actions"]
    assert match_role_skill("AWS Cloud Architecture", index) == ["AWS"]
    assert match_role_skill("Kubernetes", index) == []


def test_legacy_stored_skill_names_still_match():
    # Older uploads stored "Shell"; it now normalizes to "Shell Scripting".
    index = index_candidate_skills(["Shell"])
    assert match_role_skill("Linux Internals & Bash", index) == ["Shell Scripting"]


def test_every_seeded_role_requirement_can_be_met(client):
    """Guards the role catalog: each requirement must be satisfiable by some resume skill."""
    db = database.SessionLocal()
    try:
        names = {rs.skill.canonical_name for rs in db.query(models.RoleSkill).all()}
    finally:
        db.close()
    assert names, "role catalog was not seeded"
    unmatchable = sorted(n for n in names if not is_matchable_requirement(n))
    assert unmatchable == []
