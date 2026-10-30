"""
Skill Taxonomy and Normalization Engine
Provides maintainable hierarchical categories, alias mappings, explainable extraction,
and the mapping from broad role requirements (e.g. "Linux Internals & Bash") to the
concrete skills a resume actually mentions (e.g. "Linux", "Bash").
"""
import bisect
import re
from typing import Dict, Iterable, List, Tuple, Any, Union

from rapidfuzz import fuzz

SKILL_TAXONOMY = {
    "Programming Languages": [
        "Python", "JavaScript", "TypeScript", "Java", "C++", "C#", "C", "Go", "Rust",
        "Kotlin", "Swift", "PHP", "Ruby", "Scala", "R", "SQL", "Bash", "Shell Scripting", "Dart",
        "MATLAB", "Perl", "Lua", "Assembly Language"
    ],
    "Frameworks & Libraries": [
        "React", "Next.js", "Vue.js", "Angular", "Node.js", "Express.js", "FastAPI",
        "Django", "Flask", "Spring Boot", "ASP.NET", "Ruby on Rails", "Tailwind CSS",
        "Bootstrap", "Flutter", "React Native", "GraphQL", "Redux", "Svelte", "NestJS",
        "HTML", "CSS", "Sass", "jQuery", "iOS Development", "Android Development"
    ],
    "Data & AI / ML": [
        "Machine Learning", "Deep Learning", "Natural Language Processing", "Computer Vision",
        "Large Language Models", "Generative AI", "PyTorch", "TensorFlow", "Keras",
        "Scikit-learn", "Pandas", "NumPy", "OpenCV", "Hugging Face", "LangChain",
        "Data Science", "Data Analysis", "Feature Engineering", "Statistical Modeling",
        "Statistics", "A/B Testing", "Reinforcement Learning", "MLOps", "Vector Databases",
        "Retrieval-Augmented Generation", "Apache Spark", "Hadoop", "Apache Airflow", "ETL",
        "Data Warehousing"
    ],
    "Databases & Storage": [
        "PostgreSQL", "MySQL", "MongoDB", "Redis", "SQLite", "Oracle", "Microsoft SQL Server",
        "Cassandra", "DynamoDB", "Elasticsearch", "Firebase", "Supabase", "Snowflake",
        "BigQuery", "Neo4j"
    ],
    "Cloud & DevOps": [
        "AWS", "Azure", "Google Cloud Platform", "Docker", "Kubernetes", "CI/CD",
        "Terraform", "Git", "GitHub Actions", "Jenkins", "Ansible", "Linux",
        "Serverless", "Nginx", "Prometheus", "Grafana", "Infrastructure as Code",
        "Observability", "Helm"
    ],
    "System Design & Architecture": [
        "System Design", "Microservices", "REST APIs", "gRPC", "Distributed Systems",
        "Event-Driven Architecture", "Kafka", "RabbitMQ", "WebSockets", "Caching",
        "Load Balancing", "API Gateway"
    ],
    "Core CS & Methodology": [
        "Data Structures", "Algorithms", "Object-Oriented Programming", "Design Patterns",
        "DBMS", "Operating Systems", "Computer Networks", "Agile", "Scrum", "Test-Driven Development",
        "Computer Architecture", "Concurrency", "Linux Kernel", "Network Protocols"
    ],
    "Testing & QA": [
        "Test Automation", "Unit Testing", "Selenium", "Cypress", "Playwright", "Pytest",
        "JUnit", "Jest", "Performance Testing"
    ],
    "Security": [
        "Cybersecurity", "Penetration Testing", "Threat Modeling", "Cryptography",
        "Network Security", "OWASP"
    ],
    "Graphics & Game Development": [
        "Unity", "Unreal Engine", "OpenGL", "Vulkan", "DirectX", "Shader Programming",
        "Game Development", "Computer Graphics", "Linear Algebra", "Physics Simulation"
    ],
    "Hardware & Embedded": [
        "Embedded Systems", "Embedded C", "RTOS", "ARM Cortex", "Microcontrollers", "I2C", "SPI",
        "UART", "CAN Bus", "Verilog", "SystemVerilog", "VHDL", "FPGA", "RTL Design", "ASIC Design",
        "Static Timing Analysis", "UVM", "PCB Design", "Circuit Simulation", "Analog Circuit Design",
        "Digital Signal Processing", "Power Electronics", "Battery Management Systems",
        "Electric Vehicles", "Motor Control", "Power Systems", "IoT", "MQTT", "CoAP",
        "Bluetooth Low Energy", "LoRaWAN", "Zigbee"
    ],
    "Robotics & Controls": [
        "Robotics", "ROS", "SLAM", "Sensor Fusion", "Motion Planning", "Control Systems",
        "Kinematics", "Simulink", "PLC", "SCADA", "Mechatronics"
    ],
    "Mechanical & Core Engineering": [
        "SolidWorks", "AutoCAD", "CATIA", "Fusion 360", "Creo", "3D CAD Modeling",
        "Finite Element Analysis", "Computational Fluid Dynamics", "GD&T", "Thermodynamics",
        "Heat Transfer", "Fluid Mechanics", "Materials Science", "Manufacturing Processes",
        "Aerodynamics", "Propulsion", "Flight Dynamics", "Orbital Mechanics", "Structural Analysis",
        "Reinforced Concrete Design", "Steel Design", "Geotechnical Engineering", "Process Simulation",
        "Mass Transfer", "Reaction Engineering", "Biomechanics", "Biomaterials",
        "Biomedical Signal Processing", "Medical Device Regulations"
    ],
    "Soft Skills": [
        "Communication", "Teamwork", "Leadership", "Problem Solving", "Critical Thinking",
        "Time Management", "Adaptability", "Cross-Functional Collaboration", "Ownership"
    ]
}

# Lowercase variation -> canonical name(s). Only aliases that are safe to search for in
# free text belong here; a tuple means the alias implies several skills.
ALIAS_TO_CANONICAL: Dict[str, Union[str, Tuple[str, ...]]] = {
    # Languages
    "py": "Python", "python3": "Python", "python 3": "Python",
    "js": "JavaScript", "es6": "JavaScript", "ecmascript": "JavaScript",
    "ts": "TypeScript",
    "cpp": "C++", "cplusplus": "C++",
    "csharp": "C#", "c #": "C#",
    "golang": "Go",
    "c programming": "C", "c language": "C",
    "r programming": "R", "r language": "R",
    "bash scripting": "Bash",
    "shell scripting": "Shell Scripting", "shell script": "Shell Scripting",
    "shell scripts": "Shell Scripting", "unix shell": "Shell Scripting",
    "assembly language": "Assembly Language", "x86 assembly": "Assembly Language",
    "arm assembly": "Assembly Language",

    # Frameworks
    "reactjs": "React", "react.js": "React",
    "nextjs": "Next.js",
    "vue": "Vue.js", "vuejs": "Vue.js",
    "nodejs": "Node.js",
    "expressjs": "Express.js",
    "fast api": "FastAPI",
    "springboot": "Spring Boot", "spring framework": "Spring Boot",
    "tailwind": "Tailwind CSS", "tailwindcss": "Tailwind CSS",
    "react-native": "React Native",
    "html5": "HTML", "css3": "CSS", "scss": "Sass",
    ".net": "ASP.NET", ".net core": "ASP.NET", "dotnet": "ASP.NET",
    "ios": "iOS Development", "uikit": "iOS Development", "swiftui": "iOS Development",
    "xcode": "iOS Development",
    "android": "Android Development", "android sdk": "Android Development",
    "android studio": "Android Development", "jetpack compose": "Android Development",

    # AI / ML / Data
    "ml": "Machine Learning", "machine-learning": "Machine Learning",
    "deep-learning": "Deep Learning",
    "nlp": "Natural Language Processing",
    "llm": "Large Language Models", "llms": "Large Language Models",
    "genai": "Generative AI", "gen-ai": "Generative AI", "generative-ai": "Generative AI",
    "sklearn": "Scikit-learn", "scikit learn": "Scikit-learn",
    "torch": "PyTorch",
    "data analytics": "Data Analysis",
    "statistical analysis": "Statistics",
    "ab testing": "A/B Testing",
    "mlflow": "MLOps", "kubeflow": "MLOps", "model serving": "MLOps", "model deployment": "MLOps",
    "vector database": "Vector Databases", "vector db": "Vector Databases",
    "pinecone": "Vector Databases", "faiss": "Vector Databases", "chromadb": "Vector Databases",
    "weaviate": "Vector Databases", "milvus": "Vector Databases", "qdrant": "Vector Databases",
    "retrieval augmented generation": "Retrieval-Augmented Generation",
    "pyspark": "Apache Spark", "spark sql": "Apache Spark",
    "apache hadoop": "Hadoop", "hdfs": "Hadoop", "mapreduce": "Hadoop",
    "elt": "ETL", "data pipeline": "ETL", "data pipelines": "ETL", "dbt": "ETL",
    "data warehouse": "Data Warehousing",

    # Databases
    "postgres": "PostgreSQL", "psql": "PostgreSQL",
    "mongo": "MongoDB",
    "ms sql": "Microsoft SQL Server", "mssql": "Microsoft SQL Server", "sql server": "Microsoft SQL Server",
    "elastic search": "Elasticsearch",
    "gcp bigquery": "BigQuery",

    # Cloud & DevOps
    "amazon web services": "AWS", "amazon aws": "AWS",
    "microsoft azure": "Azure",
    "gcp": "Google Cloud Platform", "google cloud": "Google Cloud Platform",
    "k8s": "Kubernetes",
    "cicd": "CI/CD", "ci cd": "CI/CD", "continuous integration": "CI/CD",
    "continuous deployment": "CI/CD",
    "gh actions": "GitHub Actions",
    "iac": "Infrastructure as Code", "cloudformation": "Infrastructure as Code",
    "pulumi": "Infrastructure as Code",
    "opentelemetry": "Observability", "datadog": "Observability", "elk stack": "Observability",
    "splunk": "Observability",
    "helm charts": "Helm",

    # System Design & Architecture
    "rest api": "REST APIs", "restful": "REST APIs", "restful apis": "REST APIs",
    "micro-services": "Microservices", "micro services": "Microservices",
    "event driven": "Event-Driven Architecture",
    "apache kafka": "Kafka",
    "websocket": "WebSockets",

    # Core CS
    "dsa": ("Data Structures", "Algorithms"),
    "oop": "Object-Oriented Programming", "oops": "Object-Oriented Programming",
    "object oriented programming": "Object-Oriented Programming",
    "tdd": "Test-Driven Development",
    "computer organization": "Computer Architecture",
    "multithreading": "Concurrency", "multi-threading": "Concurrency",
    "concurrent programming": "Concurrency", "parallel programming": "Concurrency",
    "kernel development": "Linux Kernel", "device drivers": "Linux Kernel",
    "kernel modules": "Linux Kernel",
    "tcp/ip": "Network Protocols", "tcp": "Network Protocols", "udp": "Network Protocols",
    "networking protocols": "Network Protocols", "network programming": "Network Protocols",

    # Testing
    "automation testing": "Test Automation", "automated testing": "Test Automation",
    "qa automation": "Test Automation",
    "unit tests": "Unit Testing",
    "load testing": "Performance Testing", "jmeter": "Performance Testing",

    # Security
    "cyber security": "Cybersecurity", "information security": "Cybersecurity",
    "infosec": "Cybersecurity",
    "pentesting": "Penetration Testing", "pen testing": "Penetration Testing",
    "ethical hacking": "Penetration Testing", "burp suite": "Penetration Testing",
    "metasploit": "Penetration Testing",
    "threat modelling": "Threat Modeling",

    # Graphics & game development
    "unreal": "Unreal Engine", "ue4": "Unreal Engine", "ue5": "Unreal Engine",
    "glsl": "Shader Programming", "hlsl": "Shader Programming", "shaders": "Shader Programming",
    "shader": "Shader Programming",
    "game dev": "Game Development",
    "rendering pipeline": "Computer Graphics",
    "physics engine": "Physics Simulation", "rigid body dynamics": "Physics Simulation",

    # Hardware & embedded
    "embedded software": "Embedded Systems", "firmware": "Embedded Systems",
    "firmware development": "Embedded Systems",
    "embedded c++": "Embedded C",
    "freertos": "RTOS", "zephyr": "RTOS", "vxworks": "RTOS",
    "real-time operating system": "RTOS", "real time operating system": "RTOS",
    "cortex-m": "ARM Cortex", "arm cortex-m": "ARM Cortex",
    "microcontroller": "Microcontrollers", "mcu": "Microcontrollers", "stm32": "Microcontrollers",
    "arduino": "Microcontrollers", "esp32": "Microcontrollers", "avr": "Microcontrollers",
    "8051": "Microcontrollers",
    "i²c": "I2C",
    "canbus": "CAN Bus",
    "system verilog": "SystemVerilog",
    "xilinx": "FPGA", "vivado": "FPGA", "quartus": "FPGA", "zynq": "FPGA",
    "rtl coding": "RTL Design",
    "asic": "ASIC Design", "vlsi": "ASIC Design", "vlsi design": "ASIC Design",
    "physical design": "ASIC Design", "logic synthesis": "ASIC Design",
    "primetime": "Static Timing Analysis", "timing closure": "Static Timing Analysis",
    "universal verification methodology": "UVM",
    "pcb": "PCB Design", "pcb layout": "PCB Design", "altium": "PCB Design",
    "altium designer": "PCB Design", "kicad": "PCB Design", "orcad": "PCB Design",
    "spice": "Circuit Simulation", "ltspice": "Circuit Simulation", "pspice": "Circuit Simulation",
    "ngspice": "Circuit Simulation", "cadence virtuoso": "Circuit Simulation",
    "analog design": "Analog Circuit Design", "analog circuits": "Analog Circuit Design",
    "dsp": "Digital Signal Processing", "signal processing": "Digital Signal Processing",
    "fft": "Digital Signal Processing", "fir filter": "Digital Signal Processing",
    "iir filter": "Digital Signal Processing",
    "inverters": "Power Electronics", "dc-dc converter": "Power Electronics",
    "dc-dc converters": "Power Electronics", "smps": "Power Electronics",
    "bms": "Battery Management Systems", "battery management system": "Battery Management Systems",
    "battery modeling": "Battery Management Systems",
    "electric vehicle": "Electric Vehicles", "ev powertrain": "Electric Vehicles",
    "powertrain": "Electric Vehicles",
    "foc": "Motor Control", "field oriented control": "Motor Control", "bldc": "Motor Control",
    "power grid": "Power Systems", "smart grid": "Power Systems", "electrical grid": "Power Systems",
    "substation": "Power Systems", "etap": "Power Systems", "pscad": "Power Systems",
    "high voltage": "Power Systems",
    "internet of things": "IoT",
    "ble": "Bluetooth Low Energy",
    "lora": "LoRaWAN",

    # Robotics & controls
    "ros2": "ROS", "ros 2": "ROS", "robot operating system": "ROS",
    "kalman filter": "Sensor Fusion", "kalman filtering": "Sensor Fusion",
    "extended kalman filter": "Sensor Fusion", "ekf": "Sensor Fusion",
    "path planning": "Motion Planning", "trajectory planning": "Motion Planning",
    "trajectory optimization": "Motion Planning",
    "control theory": "Control Systems", "pid": "Control Systems", "pid control": "Control Systems",
    "pid controller": "Control Systems", "lqr": "Control Systems",
    "model predictive control": "Control Systems", "mpc": "Control Systems",
    "inverse kinematics": "Kinematics", "forward kinematics": "Kinematics",
    "robot kinematics": "Kinematics",
    "plc programming": "PLC", "ladder logic": "PLC",

    # Mechanical & core engineering
    "solid works": "SolidWorks",
    "fusion360": "Fusion 360",
    "ptc creo": "Creo",
    "cad": "3D CAD Modeling", "3d modeling": "3D CAD Modeling", "cad modeling": "3D CAD Modeling",
    "3d cad": "3D CAD Modeling",
    "fea": "Finite Element Analysis", "finite element method": "Finite Element Analysis",
    "fem": "Finite Element Analysis", "ansys": "Finite Element Analysis",
    "abaqus": "Finite Element Analysis",
    "cfd": "Computational Fluid Dynamics", "ansys fluent": "Computational Fluid Dynamics",
    "openfoam": "Computational Fluid Dynamics", "star-ccm+": "Computational Fluid Dynamics",
    "geometric dimensioning and tolerancing": "GD&T", "tolerance analysis": "GD&T",
    "tolerance stack-up": "GD&T",
    "material science": "Materials Science", "metallurgy": "Materials Science",
    "materials engineering": "Materials Science",
    "dfm": "Manufacturing Processes", "design for manufacturing": "Manufacturing Processes",
    "injection molding": "Manufacturing Processes", "cnc machining": "Manufacturing Processes",
    "cnc": "Manufacturing Processes",
    "rocket propulsion": "Propulsion", "jet propulsion": "Propulsion",
    "flight mechanics": "Flight Dynamics", "flight control": "Flight Dynamics",
    "astrodynamics": "Orbital Mechanics",
    "structural engineering": "Structural Analysis", "staad pro": "Structural Analysis",
    "staad.pro": "Structural Analysis", "etabs": "Structural Analysis", "sap2000": "Structural Analysis",
    "reinforced concrete": "Reinforced Concrete Design", "rcc design": "Reinforced Concrete Design",
    "concrete design": "Reinforced Concrete Design",
    "steel structures": "Steel Design",
    "geotechnical": "Geotechnical Engineering", "soil mechanics": "Geotechnical Engineering",
    "foundation engineering": "Geotechnical Engineering",
    "aspen plus": "Process Simulation", "aspen hysys": "Process Simulation",
    "hysys": "Process Simulation", "chemcad": "Process Simulation", "dwsim": "Process Simulation",
    "distillation column": "Mass Transfer", "distillation columns": "Mass Transfer",
    "separation processes": "Mass Transfer",
    "reaction kinetics": "Reaction Engineering", "reactor design": "Reaction Engineering",
    "chemical reaction engineering": "Reaction Engineering",
    "biosignal processing": "Biomedical Signal Processing", "ecg analysis": "Biomedical Signal Processing",
    "eeg analysis": "Biomedical Signal Processing", "medical imaging": "Biomedical Signal Processing",
    "medical image processing": "Biomedical Signal Processing",
    "iso 13485": "Medical Device Regulations", "fda regulations": "Medical Device Regulations",
    "iec 60601": "Medical Device Regulations",
}

# Aliases that are fine when the input is already known to be a skill name (LLM output,
# stored skills) but match ordinary words in prose: "CV" (curriculum vitae), "the rest of
# the team", "a tree node", "Spring 2024 semester", "Shell" (the company).
NAME_ONLY_ALIASES: Dict[str, str] = {
    "cv": "Computer Vision",
    "rest": "REST APIs",
    "node": "Node.js",
    "spring": "Spring Boot",
    "tf": "TensorFlow",
    "dl": "Deep Learning",
    "shell": "Shell Scripting",
    "sta": "Static Timing Analysis",
    "rtl": "RTL Design",
    "airflow": "Apache Airflow",
    "distillation": "Mass Transfer",
}

# Skills whose names are also everyday words or abbreviations; matched only as written
# ("Go", not "go live"; "CAN bus", not "can").
CASE_SENSITIVE_TERMS: Dict[str, str] = {
    "Go": "Go",
    "Swift": "Swift",
    "Rust": "Rust",
    "Dart": "Dart",
    "Unity": "Unity",
    "Helm": "Helm",
    "Spark": "Apache Spark",
    "Airflow": "Apache Airflow",
    "RAG": "Retrieval-Augmented Generation",
    "CAN": "CAN Bus",
    "EV": "Electric Vehicles",
}

# Single-letter languages are only counted on a line that also lists other skills
# ("C, C++, Python" counts; "Grade: C" or "R&D" does not).
LIST_CONTEXT_TERMS: Dict[str, str] = {"C": "C", "R": "R"}

# Role requirements in the catalog are broader than the skills a resume mentions, so each
# one lists the resume-level skills that satisfy it. Requirements that are themselves
# taxonomy skills (e.g. "Python") match directly and need no entry.
ROLE_SKILL_EQUIVALENTS: Dict[str, List[str]] = {
    "ARM Cortex & Microcontrollers": ["ARM Cortex", "Microcontrollers"],
    "ASIC Synthesis & Layout": ["ASIC Design"],
    "AWS Cloud Architecture": ["AWS"],
    "Aerodynamics & Propulsion Systems": ["Aerodynamics", "Propulsion"],
    "Apache Spark & Big Data": ["Apache Spark", "Hadoop"],
    "Automated Testing & QA": ["Test Automation", "Selenium", "Cypress", "Playwright", "Pytest", "JUnit", "Jest", "Unit Testing"],
    "Biomechanics & Biomaterials": ["Biomechanics", "Biomaterials"],
    "Biomedical Signal & Image Processing": ["Biomedical Signal Processing"],
    "Bus Protocols (I2C/SPI/UART/CAN)": ["I2C", "SPI", "UART", "CAN Bus"],
    "CI/CD Pipelines": ["CI/CD", "GitHub Actions", "Jenkins"],
    "Chemical Process Simulation (Aspen Plus)": ["Process Simulation"],
    "Circuit Simulation (SPICE)": ["Circuit Simulation"],
    "Computational Fluid Dynamics (CFD)": ["Computational Fluid Dynamics"],
    "Concurrency & Multithreading": ["Concurrency"],
    "Control Systems & PID": ["Control Systems"],
    "Cybersecurity & Threat Modeling": ["Cybersecurity", "Threat Modeling", "Penetration Testing", "Network Security"],
    "Data Pipelines & ETL": ["ETL", "Apache Airflow", "Data Warehousing"],
    "Digital Signal Processing (DSP)": ["Digital Signal Processing"],
    "EV Powertrain & Battery Systems (BMS)": ["Electric Vehicles", "Battery Management Systems"],
    "Embedded C/C++": ["Embedded C", "Embedded Systems"],
    "Finite Element Analysis (FEA / Ansys)": ["Finite Element Analysis"],
    "Flight Dynamics & Orbital Mechanics": ["Flight Dynamics", "Orbital Mechanics"],
    "Flutter & React Native": ["Flutter", "React Native"],
    "GCP / Azure Cloud": ["Google Cloud Platform", "Azure"],
    "GD&T & Mechanical Tolerance Analysis": ["GD&T"],
    "Geotechnical & Soil Mechanics": ["Geotechnical Engineering"],
    "HTML/CSS": ["HTML", "CSS", "Tailwind CSS", "Bootstrap", "Sass"],
    "High Voltage Grid & Power Systems": ["Power Systems"],
    "IoT Protocols (MQTT/CoAP)": ["MQTT", "CoAP", "IoT", "Bluetooth Low Energy", "LoRaWAN", "Zigbee"],
    "Kinematics & Dynamics": ["Kinematics"],
    "Kotlin / Android Development": ["Kotlin", "Android Development"],
    "Large Language Models (LLMs)": ["Large Language Models", "Generative AI", "LangChain", "Hugging Face"],
    "Linux Internals & Bash": ["Linux", "Bash", "Shell Scripting", "Linux Kernel"],
    "MATLAB & Simulink": ["MATLAB", "Simulink"],
    "MLOps & Model Serving": ["MLOps"],
    "Mass & Heat Transfer Operations": ["Mass Transfer", "Heat Transfer"],
    "Materials Science & Metallurgy": ["Materials Science"],
    "Medical Device Regulatory Standards (FDA/ISO)": ["Medical Device Regulations"],
    "Motion Planning & Pathfinding": ["Motion Planning"],
    "Natural Language Processing (NLP)": ["Natural Language Processing"],
    "Network Protocols & TCP/IP": ["Network Protocols", "Computer Networks"],
    "PCB Design & Altium": ["PCB Design"],
    "Physics & Geometry": ["Physics Simulation", "Linear Algebra", "Computer Graphics"],
    "Power Electronics & Inverters": ["Power Electronics"],
    "Prometheus, Grafana & Observability": ["Prometheus", "Grafana", "Observability"],
    "ROS & ROS2": ["ROS"],
    "RTOS (FreeRTOS/Zephyr)": ["RTOS"],
    "Reaction Kinetics & Reactor Design": ["Reaction Engineering"],
    "Reinforced Concrete & Steel Design": ["Reinforced Concrete Design", "Steel Design"],
    "SLAM & Sensor Fusion": ["SLAM", "Sensor Fusion"],
    "SolidWorks & 3D CAD Modeling": ["SolidWorks", "3D CAD Modeling", "AutoCAD", "CATIA", "Fusion 360", "Creo"],
    "Static Timing Analysis (STA)": ["Static Timing Analysis"],
    "Statistical Modeling & A/B Testing": ["Statistical Modeling", "A/B Testing", "Statistics"],
    "Structural Analysis & AutoCAD": ["Structural Analysis", "AutoCAD"],
    "Swift / iOS Development": ["Swift", "iOS Development"],
    "System Architecture": ["System Design", "Microservices", "Distributed Systems"],
    "Terraform & IaC": ["Terraform", "Infrastructure as Code", "Ansible"],
    "Thermodynamics & Heat Transfer": ["Thermodynamics", "Heat Transfer"],
    "VHDL & FPGA Design": ["VHDL", "FPGA"],
    "Vector Databases & RAG": ["Vector Databases", "Retrieval-Augmented Generation"],
    "Verilog & SystemVerilog": ["Verilog", "SystemVerilog"],
}

# Reverse lookup: canonical name -> category
CANONICAL_TO_CATEGORY: Dict[str, str] = {}
for category, skills in SKILL_TAXONOMY.items():
    for skill in skills:
        CANONICAL_TO_CATEGORY[skill.lower()] = category
        CANONICAL_TO_CATEGORY[skill] = category

_CANONICAL_BY_LOWER: Dict[str, str] = {
    skill.lower(): skill for skills in SKILL_TAXONOMY.values() for skill in skills
}


def _as_tuple(value: Union[str, Tuple[str, ...]]) -> Tuple[str, ...]:
    return value if isinstance(value, tuple) else (value,)


def _category_of(canonical: str) -> str:
    return CANONICAL_TO_CATEGORY.get(canonical, "Technical")


def normalize_skill(skill_name: str) -> Tuple[str, str]:
    """
    Normalizes any skill variation (e.g. 'react.js', 'postgres', 'k8s')
    into its canonical name and taxonomy category.
    """
    cleaned = skill_name.strip()
    lowered = cleaned.lower()

    # 1. Exact alias match
    if lowered in ALIAS_TO_CANONICAL:
        canonical = _as_tuple(ALIAS_TO_CANONICAL[lowered])[0]
        return canonical, _category_of(canonical)
    if lowered in NAME_ONLY_ALIASES:
        canonical = NAME_ONLY_ALIASES[lowered]
        return canonical, _category_of(canonical)

    # 2. Exact taxonomy match (a skill name, so letter case does not matter here)
    if lowered in _CANONICAL_BY_LOWER:
        canonical = _CANONICAL_BY_LOWER[lowered]
        return canonical, _category_of(canonical)
    for term, canonical in CASE_SENSITIVE_TERMS.items():
        if term.lower() == lowered:
            return canonical, _category_of(canonical)

    # 3. Fuzzy match against aliases with a high threshold
    best_match = None
    best_score = 0
    for alias, canonical in ALIAS_TO_CANONICAL.items():
        score = fuzz.ratio(lowered, alias)
        if score > best_score and score >= 92:
            best_score = score
            best_match = _as_tuple(canonical)[0]

    if best_match:
        return best_match, _category_of(best_match)

    # Not in the taxonomy: keep deliberate capitalization ("gRPC-Web"), title-case the rest
    display = cleaned if any(ch.isupper() for ch in cleaned) else cleaned.title()
    return display, "Other Competencies"

def categorize_skills(skills: List[str]) -> Dict[str, List[str]]:
    """
    Groups a list of skills into taxonomy categories.
    """
    result: Dict[str, List[str]] = {cat: [] for cat in SKILL_TAXONOMY.keys()}
    result["Other Competencies"] = []

    seen = set()
    for s in skills:
        canonical, category = normalize_skill(s)
        if canonical.lower() not in seen:
            seen.add(canonical.lower())
            if category in result:
                result[category].append(canonical)
            else:
                result["Other Competencies"].append(canonical)

    # Filter out empty categories
    return {k: v for k, v in result.items() if v}


def _term_pattern(term: str, flags: int) -> re.Pattern:
    return re.compile(r"(?<![A-Za-z0-9_#+])" + re.escape(term) + r"(?![A-Za-z0-9_#+])", flags)


def _build_patterns() -> List[Tuple[str, Tuple[str, ...], re.Pattern]]:
    terms: Dict[str, Tuple[Tuple[str, ...], int]] = {}
    for alias, canonical in ALIAS_TO_CANONICAL.items():
        terms[alias] = (_as_tuple(canonical), re.IGNORECASE)
    for skills in SKILL_TAXONOMY.values():
        for skill in skills:
            if skill in CASE_SENSITIVE_TERMS or skill in LIST_CONTEXT_TERMS:
                continue
            terms.setdefault(skill.lower(), ((skill,), re.IGNORECASE))
    for term, canonical in CASE_SENSITIVE_TERMS.items():
        terms[term] = ((canonical,), 0)

    # Longest terms first, so "react native" claims its text before "react" can.
    ordered = sorted(terms.items(), key=lambda item: len(item[0]), reverse=True)
    return [(term, canonicals, _term_pattern(term, flags)) for term, (canonicals, flags) in ordered]


_PATTERNS = _build_patterns()
_LIST_CONTEXT_PATTERNS = {
    # Must be followed by list punctuation or the end of the line: "C, C++" or "C/C++".
    term: (canonical, re.compile(r"(?<![A-Za-z0-9_#+./&-])" + re.escape(term) + r"(?=\s*(?:[,/|);]|$))"))
    for term, canonical in LIST_CONTEXT_TERMS.items()
}
_BOUNDARIES = ("\n", "\r", ". ", ";")


def _evidence_snippet(text: str, start: int, end: int, limit: int = 160) -> str:
    """The sentence or line around a match, trimmed to `limit` characters."""
    left = 0
    right = len(text)
    for boundary in _BOUNDARIES:
        before = text.rfind(boundary, 0, start)
        if before != -1:
            left = max(left, before + len(boundary))
        after = text.find(boundary, end)
        if after != -1:
            right = min(right, after)
    snippet = text[left:right].strip()
    if len(snippet) <= limit:
        return snippet
    offset = max(0, (start - left) - limit // 2)
    return snippet[offset:offset + limit].strip()


def extract_skills_with_evidence(text: str) -> List[Dict[str, Any]]:
    """
    Deterministic rule-based extractor: searches text for all taxonomy skills and aliases,
    returning canonical name, category, how often it is mentioned, and the sentence where
    it first appeared as evidence.
    """
    found: Dict[str, Dict[str, Any]] = {}
    line_starts = [0] + [m.end() for m in re.finditer(r"\n", text)]
    lines_with_skills = set()
    work = text  # matched spans are blanked out so shorter terms cannot re-match inside them

    def record(canonical: str, count: int, evidence: str) -> None:
        entry = found.get(canonical)
        if entry is None:
            found[canonical] = {
                "name": canonical,
                "category": _category_of(canonical),
                "evidence": evidence,
                "confidence": 0.95,
                "mentions": count,
            }
        else:
            entry["mentions"] += count

    for _term, canonicals, pattern in _PATTERNS:
        matches = list(pattern.finditer(work))
        if not matches:
            continue
        first = matches[0]
        evidence = _evidence_snippet(text, first.start(), first.end())
        for canonical in canonicals:
            record(canonical, len(matches), evidence)
        for m in matches:
            lines_with_skills.add(bisect.bisect_right(line_starts, m.start()) - 1)
        chars = list(work)
        for m in matches:
            chars[m.start():m.end()] = " " * (m.end() - m.start())
        work = "".join(chars)

    lines = text.split("\n")
    for canonical, pattern in _LIST_CONTEXT_PATTERNS.values():
        count = 0
        evidence = ""
        for index, line in enumerate(lines):
            if index not in lines_with_skills:
                continue
            hits = pattern.findall(line)
            if hits:
                count += len(hits)
                evidence = evidence or line.strip()[:160]
        if count:
            record(canonical, count, evidence)

    return list(found.values())


def index_candidate_skills(candidate_skills: Iterable[str]) -> Dict[str, str]:
    """
    Lowercase lookup of a candidate's skills. Names are normalized first, so skills stored
    by older versions of the extractor still match.
    """
    index: Dict[str, str] = {}
    for skill in candidate_skills:
        if not skill or not skill.strip():
            continue
        canonical, _ = normalize_skill(skill)
        index.setdefault(canonical.lower(), canonical)
        index.setdefault(skill.strip().lower(), canonical)
    return index


def match_role_skill(requirement: str, candidate_index: Dict[str, str]) -> List[str]:
    """Returns the candidate skills that satisfy a role requirement (empty list if unmet)."""
    options = [requirement, normalize_skill(requirement)[0], *ROLE_SKILL_EQUIVALENTS.get(requirement, [])]
    matched: List[str] = []
    for option in options:
        hit = candidate_index.get(option.lower())
        if hit and hit not in matched:
            matched.append(hit)
    return matched


def is_matchable_requirement(requirement: str) -> bool:
    """True if a resume could ever satisfy this requirement (used to validate the role catalog)."""
    if requirement.lower() in _CANONICAL_BY_LOWER:
        return True
    equivalents = ROLE_SKILL_EQUIVALENTS.get(requirement, [])
    return bool(equivalents) and all(e.lower() in _CANONICAL_BY_LOWER for e in equivalents)
