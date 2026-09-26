import logging

from sqlalchemy.orm import Session
from . import models

logger = logging.getLogger(__name__)

def seed_roles_and_skills(db: Session):
    """Seed comprehensive universal engineering roles across all disciplines and canonical skills catalog."""
    
    # 1. Comprehensive Canonical Skills Catalog
    skills_data = [
        # Software & Languages
        {"name": "Python", "canonical_name": "Python", "category": "Programming"},
        {"name": "C++", "canonical_name": "C++", "category": "Programming"},
        {"name": "C", "canonical_name": "C", "category": "Programming"},
        {"name": "Java", "canonical_name": "Java", "category": "Programming"},
        {"name": "Rust", "canonical_name": "Rust", "category": "Programming"},
        {"name": "Go", "canonical_name": "Go", "category": "Programming"},
        {"name": "JavaScript", "canonical_name": "JavaScript", "category": "Programming"},
        {"name": "TypeScript", "canonical_name": "TypeScript", "category": "Programming"},
        {"name": "SQL", "canonical_name": "SQL", "category": "Database"},
        {"name": "PostgreSQL", "canonical_name": "PostgreSQL", "category": "Database"},
        {"name": "Data Structures", "canonical_name": "Data Structures", "category": "Technical"},
        {"name": "Algorithms", "canonical_name": "Algorithms", "category": "Technical"},
        {"name": "System Architecture", "canonical_name": "System Architecture", "category": "Technical"},
        {"name": "Distributed Systems", "canonical_name": "Distributed Systems", "category": "Technical"},
        {"name": "Concurrency & Multithreading", "canonical_name": "Concurrency & Multithreading", "category": "Technical"},
        {"name": "REST APIs", "canonical_name": "REST APIs", "category": "Technical"},
        {"name": "GraphQL", "canonical_name": "GraphQL", "category": "Technical"},
        {"name": "React", "canonical_name": "React", "category": "Framework"},
        {"name": "Next.js", "canonical_name": "Next.js", "category": "Framework"},
        {"name": "Node.js", "canonical_name": "Node.js", "category": "Framework"},
        {"name": "FastAPI", "canonical_name": "FastAPI", "category": "Framework"},
        {"name": "Spring Boot", "canonical_name": "Spring Boot", "category": "Framework"},
        {"name": "HTML/CSS", "canonical_name": "HTML/CSS", "category": "Frontend"},
        {"name": "Flutter & React Native", "canonical_name": "Flutter & React Native", "category": "Mobile"},
        {"name": "Swift / iOS Development", "canonical_name": "Swift / iOS Development", "category": "Mobile"},
        {"name": "Kotlin / Android Development", "canonical_name": "Kotlin / Android Development", "category": "Mobile"},
        {"name": "Git", "canonical_name": "Git", "category": "DevOps"},

        # AI, Data Science & Machine Learning
        {"name": "Machine Learning", "canonical_name": "Machine Learning", "category": "AI/ML"},
        {"name": "Deep Learning", "canonical_name": "Deep Learning", "category": "AI/ML"},
        {"name": "PyTorch", "canonical_name": "PyTorch", "category": "AI/ML"},
        {"name": "TensorFlow", "canonical_name": "TensorFlow", "category": "AI/ML"},
        {"name": "Large Language Models (LLMs)", "canonical_name": "Large Language Models (LLMs)", "category": "AI/ML"},
        {"name": "Natural Language Processing (NLP)", "canonical_name": "Natural Language Processing (NLP)", "category": "AI/ML"},
        {"name": "Computer Vision", "canonical_name": "Computer Vision", "category": "AI/ML"},
        {"name": "Vector Databases & RAG", "canonical_name": "Vector Databases & RAG", "category": "AI/ML"},
        {"name": "Data Pipelines & ETL", "canonical_name": "Data Pipelines & ETL", "category": "Data"},
        {"name": "Apache Spark & Big Data", "canonical_name": "Apache Spark & Big Data", "category": "Data"},
        {"name": "Statistical Modeling & A/B Testing", "canonical_name": "Statistical Modeling & A/B Testing", "category": "Data"},
        {"name": "MLOps & Model Serving", "canonical_name": "MLOps & Model Serving", "category": "AI/ML"},

        # Cloud, DevOps, Security & SRE
        {"name": "Docker", "canonical_name": "Docker", "category": "DevOps"},
        {"name": "Kubernetes", "canonical_name": "Kubernetes", "category": "DevOps"},
        {"name": "Terraform & IaC", "canonical_name": "Terraform & IaC", "category": "DevOps"},
        {"name": "CI/CD Pipelines", "canonical_name": "CI/CD Pipelines", "category": "DevOps"},
        {"name": "AWS Cloud Architecture", "canonical_name": "AWS Cloud Architecture", "category": "Cloud"},
        {"name": "GCP / Azure Cloud", "canonical_name": "GCP / Azure Cloud", "category": "Cloud"},
        {"name": "Linux Internals & Bash", "canonical_name": "Linux Internals & Bash", "category": "Systems"},
        {"name": "Cybersecurity & Threat Modeling", "canonical_name": "Cybersecurity & Threat Modeling", "category": "Security"},
        {"name": "Network Protocols & TCP/IP", "canonical_name": "Network Protocols & TCP/IP", "category": "Systems"},
        {"name": "Prometheus, Grafana & Observability", "canonical_name": "Prometheus, Grafana & Observability", "category": "DevOps"},
        {"name": "Automated Testing & QA", "canonical_name": "Automated Testing & QA", "category": "QA"},

        # Hardware, VLSI, Embedded & Electronics
        {"name": "Embedded C/C++", "canonical_name": "Embedded C/C++", "category": "Hardware"},
        {"name": "RTOS (FreeRTOS/Zephyr)", "canonical_name": "RTOS (FreeRTOS/Zephyr)", "category": "Hardware"},
        {"name": "ARM Cortex & Microcontrollers", "canonical_name": "ARM Cortex & Microcontrollers", "category": "Hardware"},
        {"name": "Verilog & SystemVerilog", "canonical_name": "Verilog & SystemVerilog", "category": "VLSI"},
        {"name": "VHDL & FPGA Design", "canonical_name": "VHDL & FPGA Design", "category": "VLSI"},
        {"name": "Static Timing Analysis (STA)", "canonical_name": "Static Timing Analysis (STA)", "category": "VLSI"},
        {"name": "ASIC Synthesis & Layout", "canonical_name": "ASIC Synthesis & Layout", "category": "VLSI"},
        {"name": "Computer Architecture", "canonical_name": "Computer Architecture", "category": "Hardware"},
        {"name": "PCB Design & Altium", "canonical_name": "PCB Design & Altium", "category": "Hardware"},
        {"name": "Digital Signal Processing (DSP)", "canonical_name": "Digital Signal Processing (DSP)", "category": "Hardware"},
        {"name": "Circuit Simulation (SPICE)", "canonical_name": "Circuit Simulation (SPICE)", "category": "Hardware"},
        {"name": "Bus Protocols (I2C/SPI/UART/CAN)", "canonical_name": "Bus Protocols (I2C/SPI/UART/CAN)", "category": "Hardware"},

        # Robotics, IoT & Autonomous Systems
        {"name": "ROS & ROS2", "canonical_name": "ROS & ROS2", "category": "Robotics"},
        {"name": "SLAM & Sensor Fusion", "canonical_name": "SLAM & Sensor Fusion", "category": "Robotics"},
        {"name": "Control Systems & PID", "canonical_name": "Control Systems & PID", "category": "Robotics"},
        {"name": "Kinematics & Dynamics", "canonical_name": "Kinematics & Dynamics", "category": "Robotics"},
        {"name": "Motion Planning & Pathfinding", "canonical_name": "Motion Planning & Pathfinding", "category": "Robotics"},
        {"name": "IoT Protocols (MQTT/CoAP)", "canonical_name": "IoT Protocols (MQTT/CoAP)", "category": "IoT"},
        {"name": "MATLAB & Simulink", "canonical_name": "MATLAB & Simulink", "category": "Engineering"},

        # Core Mechanical, Aerospace, Civil, Chemical, Biomedical
        {"name": "SolidWorks & 3D CAD Modeling", "canonical_name": "SolidWorks & 3D CAD Modeling", "category": "Mechanical"},
        {"name": "Finite Element Analysis (FEA / Ansys)", "canonical_name": "Finite Element Analysis (FEA / Ansys)", "category": "Mechanical"},
        {"name": "Computational Fluid Dynamics (CFD)", "canonical_name": "Computational Fluid Dynamics (CFD)", "category": "Mechanical"},
        {"name": "Thermodynamics & Heat Transfer", "canonical_name": "Thermodynamics & Heat Transfer", "category": "Mechanical"},
        {"name": "GD&T & Mechanical Tolerance Analysis", "canonical_name": "GD&T & Mechanical Tolerance Analysis", "category": "Mechanical"},
        {"name": "Materials Science & Metallurgy", "canonical_name": "Materials Science & Metallurgy", "category": "Mechanical"},
        {"name": "Aerodynamics & Propulsion Systems", "canonical_name": "Aerodynamics & Propulsion Systems", "category": "Aerospace"},
        {"name": "Flight Dynamics & Orbital Mechanics", "canonical_name": "Flight Dynamics & Orbital Mechanics", "category": "Aerospace"},
        {"name": "Structural Analysis & AutoCAD", "canonical_name": "Structural Analysis & AutoCAD", "category": "Civil"},
        {"name": "Geotechnical & Soil Mechanics", "canonical_name": "Geotechnical & Soil Mechanics", "category": "Civil"},
        {"name": "Reinforced Concrete & Steel Design", "canonical_name": "Reinforced Concrete & Steel Design", "category": "Civil"},
        {"name": "Chemical Process Simulation (Aspen Plus)", "canonical_name": "Chemical Process Simulation (Aspen Plus)", "category": "Chemical"},
        {"name": "Mass & Heat Transfer Operations", "canonical_name": "Mass & Heat Transfer Operations", "category": "Chemical"},
        {"name": "Reaction Kinetics & Reactor Design", "canonical_name": "Reaction Kinetics & Reactor Design", "category": "Chemical"},
        {"name": "Biomedical Signal & Image Processing", "canonical_name": "Biomedical Signal & Image Processing", "category": "Biomedical"},
        {"name": "Medical Device Regulatory Standards (FDA/ISO)", "canonical_name": "Medical Device Regulatory Standards (FDA/ISO)", "category": "Biomedical"},
        {"name": "Biomechanics & Biomaterials", "canonical_name": "Biomechanics & Biomaterials", "category": "Biomedical"},
        {"name": "EV Powertrain & Battery Systems (BMS)", "canonical_name": "EV Powertrain & Battery Systems (BMS)", "category": "Automotive"},
        {"name": "Power Electronics & Inverters", "canonical_name": "Power Electronics & Inverters", "category": "Electrical"},
        {"name": "High Voltage Grid & Power Systems", "canonical_name": "High Voltage Grid & Power Systems", "category": "Electrical"},
        {"name": "Physics & Geometry", "canonical_name": "Physics & Geometry", "category": "Mathematics"}
    ]

    skill_objects = {}
    for sk in skills_data:
        existing = db.query(models.Skill).filter(models.Skill.canonical_name == sk["canonical_name"]).first()
        if not existing:
            skill = models.Skill(name=sk["name"], canonical_name=sk["canonical_name"], category=sk["category"])
            db.add(skill)
            db.flush()
            skill_objects[sk["canonical_name"]] = skill
        else:
            skill_objects[sk["canonical_name"]] = existing

    # 2. Universal Engineering Roles Catalog (35+ Roles across ALL Engineering Disciplines)
    roles_data = [
        # === 1. SOFTWARE & WEB ENGINEERING ===
        {
            "name": "Software Development Engineer (SDE)",
            "category": "Software & Web",
            "description": "Full-stack software engineering role focused on distributed computing, scalable algorithms, database design, and end-to-end software architecture.",
            "skills": [("Python", 1.5), ("Data Structures", 2.0), ("Algorithms", 2.0), ("PostgreSQL", 1.5), ("System Architecture", 1.5), ("Git", 1.0), ("Distributed Systems", 1.5)]
        },
        {
            "name": "Frontend Engineer",
            "category": "Software & Web",
            "description": "User interface and web applications specialist focusing on React, modern TypeScript/JavaScript, state machines, web performance, and responsive UI architecture.",
            "skills": [("JavaScript", 2.0), ("TypeScript", 2.0), ("React", 2.0), ("HTML/CSS", 1.5), ("REST APIs", 1.5), ("Next.js", 1.5), ("Git", 1.0)]
        },
        {
            "name": "Backend Engineer",
            "category": "Software & Web",
            "description": "Server-side and distributed systems specialist building resilient microservices, high-throughput APIs, cache hierarchies, and database schemas.",
            "skills": [("Python", 1.5), ("FastAPI", 1.5), ("Go", 1.5), ("PostgreSQL", 2.0), ("Distributed Systems", 2.0), ("REST APIs", 1.5), ("Docker", 1.0)]
        },
        {
            "name": "Mobile App Engineer (iOS & Android)",
            "category": "Software & Web",
            "description": "Cross-platform and native mobile software engineer building fluid mobile experiences with Swift, Kotlin, React Native, and local SQLite/device APIs.",
            "skills": [("Swift / iOS Development", 2.0), ("Kotlin / Android Development", 2.0), ("Flutter & React Native", 1.5), ("REST APIs", 1.5), ("Data Structures", 1.5), ("Git", 1.0)]
        },
        {
            "name": "Systems & OS Kernel Engineer",
            "category": "Software & Web",
            "description": "Low-level systems engineer designing OS kernels, device drivers, custom memory allocators, concurrent runtimes, and high-performance C/C++/Rust code.",
            "skills": [("C", 2.0), ("C++", 2.0), ("Rust", 1.5), ("Linux Internals & Bash", 2.0), ("Concurrency & Multithreading", 2.0), ("Computer Architecture", 1.5)]
        },
        {
            "name": "Cybersecurity & Security Engineer",
            "category": "Software & Web",
            "description": "Security architect conducting penetration testing, vulnerability assessments, threat modeling, cryptography implementation, and identity infrastructure defense.",
            "skills": [("Cybersecurity & Threat Modeling", 2.0), ("Network Protocols & TCP/IP", 2.0), ("Linux Internals & Bash", 1.5), ("Python", 1.5), ("System Architecture", 1.5), ("Docker", 1.0)]
        },
        {
            "name": "QA & Test Automation Engineer",
            "category": "Software & Web",
            "description": "Quality engineering lead creating end-to-end automated test harnesses, performance stress suites, integration verification pipelines, and CI quality gates.",
            "skills": [("Automated Testing & QA", 2.0), ("Python", 1.5), ("JavaScript", 1.5), ("CI/CD Pipelines", 1.5), ("REST APIs", 1.5), ("Git", 1.0)]
        },
        {
            "name": "Game Engine & Graphics Developer",
            "category": "Software & Web",
            "description": "Interactive simulation and game engine engineer building real-time graphics rendering pipelines, physics engines, shader programs, and low-latency C++ game loops.",
            "skills": [("C++", 2.0), ("Computer Architecture", 1.5), ("Algorithms", 2.0), ("Data Structures", 2.0), ("Physics & Geometry", 1.5), ("Git", 1.0)]
        },

        # === 2. AI, DATA SCIENCE & MACHINE LEARNING ===
        {
            "name": "Machine Learning Engineer (MLE)",
            "category": "AI & Data",
            "description": "Specialist in production ML pipelines, deep learning architectures, tensor operations, feature stores, and high-throughput model inference serving.",
            "skills": [("Python", 2.0), ("Machine Learning", 2.0), ("Deep Learning", 2.0), ("PyTorch", 2.0), ("Data Structures", 1.5), ("Docker", 1.0), ("MLOps & Model Serving", 1.5)]
        },
        {
            "name": "AI Research & LLM Engineer",
            "category": "AI & Data",
            "description": "Frontier AI engineer building foundation models, transformer architectures, fine-tuning pipelines, RLHF, and Retrieval-Augmented Generation (RAG) systems.",
            "skills": [("Python", 2.0), ("PyTorch", 2.0), ("Large Language Models (LLMs)", 2.0), ("Natural Language Processing (NLP)", 2.0), ("Vector Databases & RAG", 1.5), ("Distributed Systems", 1.5)]
        },
        {
            "name": "Data Scientist & Analytics Engineer",
            "category": "AI & Data",
            "description": "Quantitative analyst and statistical modeler deriving predictive intelligence, designing causal experiments, building regression/classification models, and metric engines.",
            "skills": [("Python", 2.0), ("SQL", 2.0), ("Statistical Modeling & A/B Testing", 2.0), ("Machine Learning", 1.5), ("Data Pipelines & ETL", 1.5), ("Git", 1.0)]
        },
        {
            "name": "Data Platform & Big Data Engineer",
            "category": "AI & Data",
            "description": "Large-scale data infrastructure engineer managing petabyte-scale data lakes, real-time streaming pipelines, Kafka/Spark topologies, and distributed warehouses.",
            "skills": [("SQL", 2.0), ("Python", 1.5), ("Data Pipelines & ETL", 2.0), ("Apache Spark & Big Data", 2.0), ("PostgreSQL", 1.5), ("Distributed Systems", 1.5), ("Docker", 1.0)]
        },
        {
            "name": "Computer Vision Engineer",
            "category": "AI & Data",
            "description": "Visual intelligence expert implementing image segmentation, object detection, 3D point cloud reconstruction, optical flow, and convolutional neural networks.",
            "skills": [("Python", 2.0), ("C++", 1.5), ("Computer Vision", 2.0), ("Deep Learning", 2.0), ("PyTorch", 1.5)]
        },
        {
            "name": "MLOps & Model Platform Engineer",
            "category": "AI & Data",
            "description": "Infrastructure engineer focused on automated model retraining, drift monitoring, GPU cluster scheduling, model quantization, and low-latency API serving.",
            "skills": [("Python", 1.5), ("MLOps & Model Serving", 2.0), ("Docker", 2.0), ("Kubernetes", 2.0), ("CI/CD Pipelines", 1.5), ("Terraform & IaC", 1.5)]
        },

        # === 3. CLOUD, DEVOPS & INFRASTRUCTURE ===
        {
            "name": "DevOps & Platform Engineer",
            "category": "Cloud & DevOps",
            "description": "Continuous delivery architect automating cloud infrastructure with Terraform, orchestrating Kubernetes pods, managing CI/CD runners, and developer platforms.",
            "skills": [("Docker", 2.0), ("Kubernetes", 2.0), ("Terraform & IaC", 2.0), ("CI/CD Pipelines", 1.5), ("AWS Cloud Architecture", 1.5), ("Linux Internals & Bash", 1.5)]
        },
        {
            "name": "Site Reliability Engineer (SRE)",
            "category": "Cloud & DevOps",
            "description": "Reliability specialist optimizing multi-region service availability, error budgets, automated incident remediation, distributed tracing, and chaos engineering.",
            "skills": [("Linux Internals & Bash", 2.0), ("Kubernetes", 1.5), ("Prometheus, Grafana & Observability", 2.0), ("Python", 1.5), ("Distributed Systems", 1.5), ("Network Protocols & TCP/IP", 1.5)]
        },
        {
            "name": "Cloud Solutions Architect",
            "category": "Cloud & DevOps",
            "description": "Enterprise cloud designer structuring high-availability VPC networks, disaster recovery topologies, IAM security policies, and cost-effective multi-cloud infrastructure.",
            "skills": [("AWS Cloud Architecture", 2.0), ("GCP / Azure Cloud", 1.5), ("Terraform & IaC", 1.5), ("System Architecture", 2.0), ("Cybersecurity & Threat Modeling", 1.5), ("Docker", 1.0)]
        },

        # === 4. HARDWARE, VLSI & EMBEDDED ELECTRONICS ===
        {
            "name": "Embedded Systems & Firmware Engineer",
            "category": "Hardware & VLSI",
            "description": "Hardware-software integration specialist programming bare-metal microcontrollers, writing real-time OS tasks, interrupt handlers, and low-level sensor drivers.",
            "skills": [("C", 2.0), ("Embedded C/C++", 2.0), ("RTOS (FreeRTOS/Zephyr)", 2.0), ("ARM Cortex & Microcontrollers", 2.0), ("Bus Protocols (I2C/SPI/UART/CAN)", 1.5), ("Git", 1.0)]
        },
        {
            "name": "VLSI & ASIC Chip Design Engineer",
            "category": "Hardware & VLSI",
            "description": "Silicon hardware architect designing digital logic circuits, register transfer level (RTL) Verilog models, clock tree synthesis, and static timing constraints.",
            "skills": [("Verilog & SystemVerilog", 2.0), ("Static Timing Analysis (STA)", 2.0), ("ASIC Synthesis & Layout", 2.0), ("Computer Architecture", 2.0), ("Circuit Simulation (SPICE)", 1.5)]
        },
        {
            "name": "FPGA & Hardware Acceleration Engineer",
            "category": "Hardware & VLSI",
            "description": "High-speed digital designer implementing custom hardware accelerators for HFT, video encoding, or AI inference using VHDL, Verilog, and Vivado/Quartus toolchains.",
            "skills": [("VHDL & FPGA Design", 2.0), ("Verilog & SystemVerilog", 2.0), ("C++", 1.5), ("Computer Architecture", 2.0), ("Digital Signal Processing (DSP)", 1.5)]
        },
        {
            "name": "Electronics & PCB Hardware Engineer",
            "category": "Hardware & VLSI",
            "description": "Electronic circuit designer architecting schematic designs, multi-layer high-speed PCB layouts, power delivery networks, EMC compliance, and component selection.",
            "skills": [("PCB Design & Altium", 2.0), ("Circuit Simulation (SPICE)", 2.0), ("Bus Protocols (I2C/SPI/UART/CAN)", 1.5), ("Power Electronics & Inverters", 1.5)]
        },
        {
            "name": "Digital Signal Processing (DSP) Engineer",
            "category": "Hardware & VLSI",
            "description": "Signal computation expert implementing FIR/IIR digital filters, Fourier transforms, radar/audio signal conditioning, and fixed-point mathematical algorithms on DSP chips.",
            "skills": [("Digital Signal Processing (DSP)", 2.0), ("C", 2.0), ("MATLAB & Simulink", 2.0), ("C++", 1.5), ("Computer Architecture", 1.5)]
        },

        # === 5. ROBOTICS, AUTOMATION & MECHATRONICS ===
        {
            "name": "Robotics Software & Autonomous Systems Engineer",
            "category": "Robotics & Automation",
            "description": "Autonomy engineer developing real-time ROS2 nodes, trajectory generators, 3D SLAM mapping algorithms, and obstacle avoidance for self-driving vehicles and robots.",
            "skills": [("C++", 2.0), ("Python", 1.5), ("ROS & ROS2", 2.0), ("SLAM & Sensor Fusion", 2.0), ("Motion Planning & Pathfinding", 2.0), ("Control Systems & PID", 1.5)]
        },
        {
            "name": "Control Systems & Automation Engineer",
            "category": "Robotics & Automation",
            "description": "Control theorist designing state-space models, PID feedback controllers, Kalman filters, PLC automation ladders, and SCADA industrial automation systems.",
            "skills": [("Control Systems & PID", 2.0), ("MATLAB & Simulink", 2.0), ("C++", 1.5), ("Kinematics & Dynamics", 1.5), ("Bus Protocols (I2C/SPI/UART/CAN)", 1.5)]
        },
        {
            "name": "IoT & Connected Devices Engineer",
            "category": "Robotics & Automation",
            "description": "Smart devices developer architecting low-power wireless mesh networks, MQTT telemetry brokers, OTA firmware update protocols, and cloud edge gateways.",
            "skills": [("Embedded C/C++", 2.0), ("IoT Protocols (MQTT/CoAP)", 2.0), ("ARM Cortex & Microcontrollers", 1.5), ("Python", 1.5), ("REST APIs", 1.5), ("Docker", 1.0)]
        },
        {
            "name": "Mechatronics Systems Engineer",
            "category": "Robotics & Automation",
            "description": "Multi-disciplinary engineer integrating precision actuators, microcontrollers, mechanical linkages, sensors, and feedback control loops into electromechanical products.",
            "skills": [("Kinematics & Dynamics", 2.0), ("Control Systems & PID", 1.5), ("SolidWorks & 3D CAD Modeling", 1.5), ("Embedded C/C++", 1.5), ("MATLAB & Simulink", 1.5)]
        },

        # === 6. CORE ENGINEERING (MECHANICAL, AEROSPACE, CIVIL, CHEMICAL, BIOMEDICAL) ===
        {
            "name": "Mechanical Design & CAD/CAE Engineer",
            "category": "Core Engineering",
            "description": "Product engineering specialist performing 3D parametric CAD solid modeling, finite element structural stress analysis (FEA), GD&T, and DFM injection molding design.",
            "skills": [("SolidWorks & 3D CAD Modeling", 2.0), ("Finite Element Analysis (FEA / Ansys)", 2.0), ("GD&T & Mechanical Tolerance Analysis", 2.0), ("Materials Science & Metallurgy", 1.5), ("Thermodynamics & Heat Transfer", 1.5)]
        },
        {
            "name": "Thermal & Fluids (CFD) Engineer",
            "category": "Core Engineering",
            "description": "Thermodynamics and fluid dynamics specialist modeling conjugate heat transfer, airflow velocity profiles, aerodynamic drag, and electronic cooling systems using CFD.",
            "skills": [("Computational Fluid Dynamics (CFD)", 2.0), ("Thermodynamics & Heat Transfer", 2.0), ("Finite Element Analysis (FEA / Ansys)", 1.5), ("MATLAB & Simulink", 1.5), ("Materials Science & Metallurgy", 1.0)]
        },
        {
            "name": "Aerospace & Flight Dynamics Engineer",
            "category": "Core Engineering",
            "description": "Aerospace flight systems engineer calculating aerodynamic lift/drag polar curves, rocket propulsion combustion dynamics, orbital trajectories, and flight guidance control.",
            "skills": [("Aerodynamics & Propulsion Systems", 2.0), ("Flight Dynamics & Orbital Mechanics", 2.0), ("Control Systems & PID", 1.5), ("Computational Fluid Dynamics (CFD)", 1.5), ("MATLAB & Simulink", 1.5)]
        },
        {
            "name": "Civil & Structural Analysis Engineer",
            "category": "Core Engineering",
            "description": "Structural engineer analyzing load distributions, shear force and bending moments, seismic resistance, reinforced concrete framing, and foundation soil mechanics.",
            "skills": [("Structural Analysis & AutoCAD", 2.0), ("Reinforced Concrete & Steel Design", 2.0), ("Geotechnical & Soil Mechanics", 1.5), ("Finite Element Analysis (FEA / Ansys)", 1.5), ("Materials Science & Metallurgy", 1.0)]
        },
        {
            "name": "Chemical & Process Systems Engineer",
            "category": "Core Engineering",
            "description": "Process engineering lead designing mass and energy balance flowsheets, continuous distillation columns, chemical reaction kinetic models, and Aspen Plus simulations.",
            "skills": [("Chemical Process Simulation (Aspen Plus)", 2.0), ("Mass & Heat Transfer Operations", 2.0), ("Reaction Kinetics & Reactor Design", 2.0), ("Thermodynamics & Heat Transfer", 1.5)]
        },
        {
            "name": "Biomedical & Medical Device Engineer",
            "category": "Core Engineering",
            "description": "Healthcare technology engineer designing implantable biocompatible devices, physiological biosignal filters, prosthetics kinematics, and ISO 13485/FDA medical compliance.",
            "skills": [("Medical Device Regulatory Standards (FDA/ISO)", 2.0), ("Biomedical Signal & Image Processing", 2.0), ("Biomechanics & Biomaterials", 1.5), ("SolidWorks & 3D CAD Modeling", 1.5), ("MATLAB & Simulink", 1.5)]
        },
        {
            "name": "Electric Vehicle (EV) Powertrain Engineer",
            "category": "Core Engineering",
            "description": "Electric mobility engineer designing high-voltage lithium battery management systems (BMS), permanent magnet motor inverters, regenerative braking, and thermal cooling loops.",
            "skills": [("EV Powertrain & Battery Systems (BMS)", 2.0), ("Power Electronics & Inverters", 2.0), ("Thermodynamics & Heat Transfer", 1.5), ("Control Systems & PID", 1.5), ("MATLAB & Simulink", 1.5)]
        },
        {
            "name": "Power Systems & Electrical Grid Engineer",
            "category": "Core Engineering",
            "description": "High-voltage grid engineer modeling three-phase AC transmission networks, substation protection relays, renewable solar/wind grid tie-in, and power factor correction.",
            "skills": [("High Voltage Grid & Power Systems", 2.0), ("Power Electronics & Inverters", 2.0), ("Circuit Simulation (SPICE)", 1.5), ("Control Systems & PID", 1.5), ("MATLAB & Simulink", 1.5)]
        }
    ]

    # Update roles in place so their ids stay stable: interviews reference roles by id, and
    # deleting/re-inserting them would break history (and violates foreign keys on PostgreSQL).
    existing_roles = {r.name: r for r in db.query(models.Role).all()}
    for r in roles_data:
        role = existing_roles.get(r["name"])
        if role is None:
            role = models.Role(name=r["name"])
            db.add(role)
        role.category = r["category"]
        role.description = r["description"]
        db.flush()

        wanted = {}
        for sk_name, weight in r["skills"]:
            if sk_name not in skill_objects:
                raise ValueError(f"Role {r['name']!r} references unknown skill {sk_name!r}; add it to skills_data")
            wanted[skill_objects[sk_name].id] = weight

        current = {rs.skill_id: rs for rs in role.role_skills}
        for skill_id, rs in current.items():
            if skill_id not in wanted:
                db.delete(rs)
        for skill_id, weight in wanted.items():
            if skill_id in current:
                current[skill_id].importance_weight = weight
            else:
                db.add(models.RoleSkill(role_id=role.id, skill_id=skill_id, importance_weight=weight))

    db.commit()
    logger.info("Role catalog up to date: %d engineering roles", len(roles_data))

    # Seed companies (350+ companies)
    from .company_data import seed_companies
    seed_companies(db)
