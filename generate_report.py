import os
import subprocess
import time

CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
OUTPUT_DIR = r"c:\Users\kshit\OneDrive\Desktop\claude folder"
HTML_FILE = os.path.join(OUTPUT_DIR, "PrepAI_Features_and_Workflow.html")
PDF_FILE_1 = os.path.join(OUTPUT_DIR, "PrepAI_Platform_Architecture_and_Features_Report.pdf")
PDF_FILE_2 = os.path.join(OUTPUT_DIR, "PrepAI_Platform_Features_and_Workflow.pdf")

html_content = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>PrepAI — Simple Guide: Features & How It Works</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Outfit:wght@500;600;700;800;900&display=swap');

  @page {
    size: A4;
    margin: 12mm 14mm 12mm 14mm;
    @bottom-right {
      content: counter(page);
      font-family: 'Inter', sans-serif;
      font-size: 8.5pt;
      color: #94a3b8;
    }
  }

  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  body {
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    color: #1e293b;
    background: #ffffff;
    line-height: 1.5;
    font-size: 9.3pt;
  }

  .page-break {
    page-break-before: always;
  }

  .avoid-break {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  /* Cover Page */
  .cover-page {
    height: 100vh;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 30px 12px 36px;
    page-break-after: always;
  }

  .cover-header {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .brand-badge {
    background: linear-gradient(135deg, #2563eb, #1d4ed8);
    color: white;
    width: 44px;
    height: 44px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Outfit', sans-serif;
    font-weight: 900;
    font-size: 22pt;
    box-shadow: 0 8px 20px rgba(37, 99, 235, 0.25);
  }

  .brand-meta h2 {
    font-family: 'Outfit', sans-serif;
    font-size: 20pt;
    color: #0f172a;
    font-weight: 800;
    letter-spacing: -0.5px;
  }

  .brand-meta p {
    font-size: 9pt;
    color: #64748b;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .cover-body {
    margin: 40px 0;
  }

  .report-tag {
    display: inline-block;
    padding: 5px 14px;
    background: #eff6ff;
    color: #2563eb;
    border: 1px solid #bfdbfe;
    border-radius: 30px;
    font-size: 8.5pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    margin-bottom: 16px;
  }

  .cover-title {
    font-family: 'Outfit', sans-serif;
    font-size: 32pt;
    font-weight: 900;
    color: #0f172a;
    line-height: 1.15;
    letter-spacing: -0.8px;
    margin-bottom: 14px;
  }

  .cover-title span {
    color: #2563eb;
  }

  .cover-subtitle {
    font-size: 11.5pt;
    color: #475569;
    max-width: 660px;
    line-height: 1.6;
    margin-bottom: 34px;
  }

  .cover-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
    padding: 20px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
  }

  .cover-stat h4 {
    font-size: 8pt;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 4px;
    font-weight: 700;
  }

  .cover-stat p {
    font-family: 'Outfit', sans-serif;
    font-size: 14pt;
    font-weight: 800;
    color: #0f172a;
  }

  .cover-footer {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    padding-top: 18px;
    border-top: 1px solid #e2e8f0;
    font-size: 8.5pt;
    color: #64748b;
  }

  .author-info strong {
    color: #0f172a;
    display: block;
    font-size: 9.5pt;
    margin-bottom: 2px;
  }

  /* Section Headings */
  h1.section-title {
    font-family: 'Outfit', sans-serif;
    font-size: 16pt;
    font-weight: 800;
    color: #0f172a;
    margin-bottom: 4px;
    letter-spacing: -0.3px;
    padding-bottom: 6px;
    border-bottom: 2px solid #e2e8f0;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .section-subtitle {
    font-size: 9.2pt;
    color: #64748b;
    margin-bottom: 14px;
    font-weight: 500;
  }

  h2.sub-title {
    font-family: 'Outfit', sans-serif;
    font-size: 12pt;
    font-weight: 700;
    color: #1e293b;
    margin: 14px 0 8px;
  }

  p {
    margin-bottom: 10px;
    color: #334155;
    line-height: 1.5;
  }

  /* Simple Callouts */
  .info-box {
    background: #eff6ff;
    border-left: 4px solid #2563eb;
    padding: 12px 16px;
    border-radius: 0 8px 8px 0;
    margin: 12px 0;
    font-size: 9pt;
  }

  .info-box strong {
    color: #1e40af;
  }

  .highlight-dark {
    background: #0f172a;
    color: #e2e8f0;
    border-left: 4px solid #38bdf8;
    padding: 12px 16px;
    border-radius: 0 8px 8px 0;
    margin: 12px 0;
    font-size: 8.8pt;
  }

  .highlight-dark strong {
    color: #38bdf8;
  }

  /* Grids */
  .grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin: 10px 0;
  }

  .grid-3 {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 10px;
    margin: 10px 0;
  }

  /* Simple Feature Card */
  .feature-card {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 12px 14px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
  }

  .feature-card h4 {
    font-size: 9.8pt;
    font-weight: 700;
    color: #0f172a;
    margin-bottom: 5px;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .feature-card p {
    font-size: 8.5pt;
    color: #475569;
    margin-bottom: 0;
    line-height: 1.45;
  }

  .pill {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 6px;
    font-size: 7.5pt;
    font-weight: 700;
  }

  .pill-blue { background: #dbeafe; color: #1e40af; }
  .pill-green { background: #d1fae5; color: #065f46; }
  .pill-amber { background: #fef3c7; color: #92400e; }
  .pill-red { background: #fee2e2; color: #991b1b; }

  /* Tables */
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 10px 0 14px;
    font-size: 8.5pt;
  }

  th {
    background: #f8fafc;
    color: #0f172a;
    font-weight: 700;
    text-align: left;
    padding: 7px 10px;
    border: 1px solid #cbd5e1;
    font-family: 'Outfit', sans-serif;
  }

  td {
    padding: 7px 10px;
    border: 1px solid #e2e8f0;
    color: #334155;
    vertical-align: top;
  }

  tr:nth-child(even) td {
    background: #f8fafc;
  }

  /* Step Card */
  .step-box {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-left: 5px solid #2563eb;
    border-radius: 10px;
    padding: 12px 14px;
    margin-bottom: 12px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
  }

  .step-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
  }

  .step-title {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .step-number {
    width: 24px;
    height: 24px;
    background: #2563eb;
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 9.5pt;
    font-weight: 800;
    font-family: 'Outfit', sans-serif;
  }

  .step-header h3 {
    font-family: 'Outfit', sans-serif;
    font-size: 11pt;
    font-weight: 800;
    color: #0f172a;
  }

  .step-columns {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 8px;
    background: #f8fafc;
    border: 1px solid #f1f5f9;
    border-radius: 8px;
    padding: 8px 10px;
    margin-top: 6px;
  }

  .step-col h5 {
    font-size: 7.8pt;
    font-weight: 700;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 3px;
  }

  .step-col p {
    font-size: 8.2pt;
    color: #334155;
    margin-bottom: 0;
    line-height: 1.4;
  }

  .doc-footer {
    text-align: center;
    font-size: 8pt;
    color: #94a3b8;
    margin-top: 14px;
    padding-top: 8px;
    border-top: 1px solid #e2e8f0;
  }
</style>
</head>
<body>

<!-- COVER PAGE -->
<div class="cover-page">
  <div class="cover-header">
    <div class="brand-badge">P</div>
    <div class="brand-meta">
      <h2>PrepAI</h2>
      <p>AI Interview Practice & Skill Assessment</p>
    </div>
  </div>

  <div class="cover-body">
    <div class="report-tag">Complete Product Guide</div>
    <h1 class="cover-title">What PrepAI Does, <span>All Features</span> & How It Works</h1>
    <p class="cover-subtitle">
      A simple, plain-English guide explaining the main features of the PrepAI platform, what it actually does to help candidates prepare for job interviews, and the exact step-by-step workflow of how to use it from start to finish.
    </p>

    <div class="cover-grid">
      <div class="cover-stat">
        <h4>Job Roles</h4>
        <p>34+ Tracks</p>
      </div>
      <div class="cover-stat">
        <h4>Companies</h4>
        <p>400+ Guides</p>
      </div>
      <div class="cover-stat">
        <h4>Process</h4>
        <p>6 Simple Steps</p>
      </div>
      <div class="cover-stat">
        <h4>Study Plan</h4>
        <p>7-Day Custom</p>
      </div>
    </div>
  </div>

  <div class="cover-footer">
    <div class="author-info">
      <strong>PrepAI Product & Feature Overview</strong>
      <span>Simple English Edition • Clear & Easy to Understand</span>
    </div>
    <div style="text-align: right;">
      <strong>Updated: September 2026</strong>
      <span>Version 3.5</span>
    </div>
  </div>
</div>

<!-- SECTION 1: WHAT IS PREPAI IN SIMPLE WORDS -->
<div class="avoid-break">
  <h1 class="section-title">1. What is PrepAI? (The Quick Summary)</h1>
  <p class="section-subtitle">Why this exists and what problem it solves for job seekers.</p>

  <p>
    Most interview preparation websites just give you a static list of 100 questions to memorize. But real job interviews are never like that. In a real interview, the interviewer checks your resume, asks about the exact company and role you applied for, and asks follow-up questions when you say something interesting or miss something important.
  </p>

  <div class="info-box avoid-break">
    <strong>In simple terms:</strong> PrepAI is an intelligent interview simulator that acts like a real hiring manager. It reads your resume, researches the company you want to join, tests you with realistic questions, and gives you a step-by-step plan to fix your weak areas before your actual interview.
  </div>

  <h2 class="sub-title">The 4 Main Things PrepAI Does For You:</h2>
  <div class="grid-2 avoid-break">
    <div class="feature-card">
      <h4>🔍 1. Researches the Exact Company</h4>
      <p>Whether you're interviewing at Google, Amazon, Stripe, or an early-stage startup, PrepAI pulls up what rounds they have, what their interview difficulty is, and what values they care about most.</p>
    </div>
    <div class="feature-card">
      <h4>📄 2. Spots What's Missing on Your Resume</h4>
      <p>You upload your resume, and PrepAI checks it against the job you want. It gives you a match score (0 to 100%) and tells you clearly: "Here is what you know well, and here is what you are missing."</p>
    </div>
    <div class="feature-card">
      <h4>🎙️ 3. Gives You a Real Mock Interview</h4>
      <p>It doesn't give you random trivia questions. It asks 5 realistic questions tailored to your background. If you give a half-answer, the AI will ask a follow-up question to probe deeper, just like a real interviewer.</p>
    </div>
    <div class="feature-card">
      <h4>📅 4. Gives You a 7-Day Study Roadmap</h4>
      <p>After the interview, it doesn't just say "Pass" or "Fail." It scores your answers out of 10, shows you what great answers look like, and creates a customized 7-day study plan so you know what to review each day.</p>
    </div>
  </div>
</div>

<div class="page-break"></div>

<!-- SECTION 2: ALL FEATURES IN PLAIN ENGLISH -->
<h1 class="section-title">2. All Features of PrepAI (What It Can Do)</h1>
<p class="section-subtitle">A simple list of every feature built into the platform and why it matters.</p>

<div class="grid-2 avoid-break">
  <div class="feature-card">
    <h4>🎯 34+ Career Tracks</h4>
    <p>Supports Software Engineering, Machine Learning, Cloud & DevOps, Hardware/VLSI, Robotics, Data Science, and more. It doesn't force a hardware engineer to answer web developer questions.</p>
  </div>
  <div class="feature-card">
    <h4>🎖️ Junior, Mid, and Senior Levels</h4>
    <p>Select your experience level (0–2 yrs, 3–5 yrs, or 5+ yrs). A junior gets questions on fundamentals, while a senior gets tested on system design, trade-offs, and scalability.</p>
  </div>
  <div class="feature-card">
    <h4>🏢 400+ Company Interview Profiles</h4>
    <p>Pre-loaded with interview guides for hundreds of top tech companies and finance firms. You see the exact interview rounds (e.g. Screening &rarr; Coding &rarr; System Design &rarr; Culture Fit).</p>
  </div>
  <div class="feature-card">
    <h4>🌐 Automatic Web Search for New Companies</h4>
    <p>If you're interviewing at a startup that isn't in our database, our AI searches the web in 2 seconds to find their tech stack, interview style, and company mission so you're still prepared.</p>
  </div>
  <div class="feature-card">
    <h4>📋 Paste Any Job Description</h4>
    <p>Have a specific job link or description? Paste it in, and the AI will analyze the job post and test you on the exact skills that hiring manager asked for.</p>
  </div>
  <div class="feature-card">
    <h4>📎 Easy Resume Upload (PDF)</h4>
    <p>Upload your resume in PDF format. The system automatically reads your work experience, projects, and skills in seconds with zero manual typing needed.</p>
  </div>
  <div class="feature-card">
    <h4>💾 Saved Resumes Library</h4>
    <p>Have different resumes for different jobs? Save them to your profile and switch between them anytime with a single click—no need to keep uploading the file every time.</p>
  </div>
  <div class="feature-card">
    <h4>📊 Match Score & Skill Gap Checker</h4>
    <p>Before the interview starts, you get a Match Score (0–100%). It sorts your skills into 4 clear groups: <strong>Strong</strong>, <strong>Developing</strong>, <strong>Weak</strong>, and <strong>Missing</strong>.</p>
  </div>
  <div class="feature-card">
    <h4>🎭 Two Different AI Interviewer Personalities</h4>
    <p>Choose who interviews you: <strong>Adinath</strong> (tough technical questions, code efficiency, edge cases) or <strong>Veda</strong> (behavioral fit, communication, and how you handle pressure).</p>
  </div>
  <div class="feature-card">
    <h4>💡 Key Concept Helper Hints</h4>
    <p>If you're stuck on a question, click the "Expected Concepts" button. It shows you the key technical terms the interviewer is looking for, and you can click any term to insert it into your answer.</p>
  </div>
  <div class="feature-card">
    <h4>⚡ Live Typing Utilities</h4>
    <p>Includes a live word counter so you know if your answer is too short or too long, and a quick keyboard shortcut (<code>Ctrl + Enter</code>) to submit answers instantly.</p>
  </div>
  <div class="feature-card">
    <h4>🏆 Scorecard with Example Good Answers</h4>
    <p>After finishing, you get a score out of 10 for technical accuracy, logic, and clarity. It also shows you "Ideal Answers" so you can learn how top engineers would answer the same question.</p>
  </div>
  <div class="feature-card">
    <h4>📅 Custom 7-Day Recovery Plan</h4>
    <p>Gives you a customized checklist for the week: Days 1–2 focus on your biggest missing skills, Days 3–4 cover tricky edge cases, Day 5 covers culture, and Days 6–7 give you a final practice run.</p>
  </div>
  <div class="feature-card">
    <h4>🚀 1-Click Instant Demo Login</h4>
    <p>Want to test the app right away? Click the "1-Click Demo Login" button to start immediately without having to type in a password or wait for a verification email.</p>
  </div>
</div>

<div class="page-break"></div>

<!-- SECTION 3: HOW IT WORKS (STEP-BY-STEP WORKFLOW) -->
<h1 class="section-title">3. How It Works: The 6-Step Workflow</h1>
<p class="section-subtitle">Here is the exact journey every candidate follows from start to finish.</p>

<!-- STEP 1 -->
<div class="step-box avoid-break">
  <div class="step-header">
    <div class="step-title">
      <div class="step-number">1</div>
      <h3>Step 1: Pick Your Role and Experience Level</h3>
    </div>
    <span class="pill pill-blue">Choose Job</span>
  </div>
  <p>
    You pick the career track you want to practice for (like Full-Stack Developer, DevOps Engineer, or Data Scientist) and choose your seniority level (Junior, Mid-Level, or Senior).
  </p>
  <div class="step-columns">
    <div class="step-col">
      <h5>What You Do</h5>
      <p>Click your target job title and select your years of experience.</p>
    </div>
    <div class="step-col">
      <h5>What the System Does</h5>
      <p>Loads the exact list of skills needed for that job and sets the question difficulty.</p>
    </div>
    <div class="step-col">
      <h5>What You See</h5>
      <p>A clear list of primary and secondary skills that companies test for that role.</p>
    </div>
  </div>
</div>

<!-- STEP 2 -->
<div class="step-box avoid-break">
  <div class="step-header">
    <div class="step-title">
      <div class="step-number">2</div>
      <h3>Step 2: Pick the Company You're Interviewing With</h3>
    </div>
    <span class="pill pill-green">Company Intel</span>
  </div>
  <p>
    Type the name of the company or click one of the popular company badges (Google, Amazon, Stripe, Meta, etc.). If it's a new startup, just type their name or paste the job description.
  </p>
  <div class="step-columns">
    <div class="step-col">
      <h5>What You Do</h5>
      <p>Search for a company or paste in the job description.</p>
    </div>
    <div class="step-col">
      <h5>What the System Does</h5>
      <p>Pulls company interview rounds from database or uses web agents to find their interview process.</p>
    </div>
    <div class="step-col">
      <h5>What You See</h5>
      <p>A "Company Dossier" showing all interview rounds and what traits they value most.</p>
    </div>
  </div>
</div>

<!-- STEP 3 -->
<div class="step-box avoid-break">
  <div class="step-header">
    <div class="step-title">
      <div class="step-number">3</div>
      <h3>Step 3: Upload Your Resume</h3>
    </div>
    <span class="pill pill-blue">Read Resume</span>
  </div>
  <p>
    Upload your PDF resume with a simple drag-and-drop, or choose one you previously saved in your account library.
  </p>
  <div class="step-columns">
    <div class="step-col">
      <h5>What You Do</h5>
      <p>Drop your resume PDF into the upload box.</p>
    </div>
    <div class="step-col">
      <h5>What the System Does</h5>
      <p>Scans the text, identifies your technical skills and past projects, and saves it to your account.</p>
    </div>
    <div class="step-col">
      <h5>What You See</h5>
      <p>Confirmation that your resume is parsed and ready for the gap analysis.</p>
    </div>
  </div>
</div>

<!-- STEP 4 -->
<div class="step-box avoid-break">
  <div class="step-header">
    <div class="step-title">
      <div class="step-number">4</div>
      <h3>Step 4: Check Your Match Score & Skill Gaps</h3>
    </div>
    <span class="pill pill-amber">Gap Analysis</span>
  </div>
  <p>
    Before starting the interview, PrepAI compares what's on your resume against what the company actually expects. This gives you total transparency on your chances before you start.
  </p>
  <div class="step-columns">
    <div class="step-col">
      <h5>What You Do</h5>
      <p>Review your score and click "Start Interview".</p>
    </div>
    <div class="step-col">
      <h5>What the System Does</h5>
      <p>Calculates your Match Score (0–100%) and groups skills into Strong, Developing, and Missing.</p>
    </div>
    <div class="step-col">
      <h5>What You See</h5>
      <p>A color-coded visual breakdown showing exactly where your resume is strong and where it has gaps.</p>
    </div>
  </div>
</div>

<!-- STEP 5 -->
<div class="step-box avoid-break">
  <div class="step-header">
    <div class="step-title">
      <div class="step-number">5</div>
      <h3>Step 5: Take the Realistic Mock Interview</h3>
    </div>
    <span class="pill pill-blue">Live Practice</span>
  </div>
  <p>
    You enter the interview room and answer 5 tailored questions. The AI adapts to your answers: if you miss an important concept, it will ask a targeted follow-up question.
  </p>
  <div class="step-columns">
    <div class="step-col">
      <h5>What You Do</h5>
      <p>Type your answer in the box. Use hints if needed. Submit with <code>Ctrl + Enter</code>.</p>
    </div>
    <div class="step-col">
      <h5>What the System Does</h5>
      <p>Evaluates your answer, updates its internal notes, and creates the next question based on how you did.</p>
    </div>
    <div class="step-col">
      <h5>What You See</h5>
      <p>Questions tailored to your resume, concept hint chips, and instant feedback after each answer.</p>
    </div>
  </div>
</div>

<!-- STEP 6 -->
<div class="step-box avoid-break">
  <div class="step-header">
    <div class="step-title">
      <div class="step-number">6</div>
      <h3>Step 6: Review Your Score and 7-Day Study Plan</h3>
    </div>
    <span class="pill pill-green">Results & Plan</span>
  </div>
  <p>
    After the 5th question, you get your final report. You see your overall score, detailed feedback for each question, example good answers, and a day-by-day 7-day study plan.
  </p>
  <div class="step-columns">
    <div class="step-col">
      <h5>What You Do</h5>
      <p>Read your score, see what you got wrong, and check your study checklist.</p>
    </div>
    <div class="step-col">
      <h5>What the System Does</h5>
      <p>Combines your scores across accuracy, logic, and clarity; generates custom study topics for Days 1–7.</p>
    </div>
    <div class="step-col">
      <h5>What You See</h5>
      <p>Score out of 10, breakdown of mistakes, exemplary answers, and the 7-day study roadmap.</p>
    </div>
  </div>
</div>

<div class="page-break"></div>

<!-- SECTION 4: QUICK SUMMARY TABLE & FUTURE FEATURES -->
<h1 class="section-title">4. Summary Table & What's Coming Next</h1>
<p class="section-subtitle">Quick overview of the 6 steps and the new features planned for future updates.</p>

<h2 class="sub-title">Quick Workflow Reference Table</h2>
<table>
  <thead>
    <tr>
      <th style="width: 12%;">Step</th>
      <th style="width: 25%;">Step Name</th>
      <th style="width: 30%;">What You Provide</th>
      <th style="width: 33%;">What You Get Back</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Step 1</strong></td>
      <td>Role & Seniority</td>
      <td>Pick job title & experience level</td>
      <td>List of essential skills needed for that job</td>
    </tr>
    <tr>
      <td><strong>Step 2</strong></td>
      <td>Company Selection</td>
      <td>Select company name or paste job post</td>
      <td>Company interview rounds and culture values</td>
    </tr>
    <tr>
      <td><strong>Step 3</strong></td>
      <td>Resume Upload</td>
      <td>Upload your PDF resume</td>
      <td>All your skills automatically extracted and saved</td>
    </tr>
    <tr>
      <td><strong>Step 4</strong></td>
      <td>Skill Gap Check</td>
      <td>Review your compatibility</td>
      <td>Match Score (0–100%) and missing skill checklist</td>
    </tr>
    <tr>
      <td><strong>Step 5</strong></td>
      <td>Mock Interview</td>
      <td>Answer 5 realistic questions</td>
      <td>Adaptive follow-ups and instant feedback</td>
    </tr>
    <tr>
      <td><strong>Step 6</strong></td>
      <td>Score & Study Plan</td>
      <td>Finish the interview</td>
      <td>Score out of 10, ideal answers & 7-day study plan</td>
    </tr>
  </tbody>
</table>

<h2 class="sub-title">What We Are Adding Next (Future Roadmap)</h2>
<div class="grid-3 avoid-break">
  <div class="feature-card">
    <h4>🎙️ Live Voice Interview</h4>
    <p>Speak out loud to the AI like a real phone call instead of typing. Hear the interviewer speak back with realistic voices.</p>
  </div>
  <div class="feature-card">
    <h4>💻 In-Browser Code Editor</h4>
    <p>Write and run real code in Python, JavaScript, C++, or Java with automated test cases right inside the practice screen.</p>
  </div>
  <div class="feature-card">
    <h4>📹 Eye-Contact & Body Language</h4>
    <p>Optional webcam feedback showing your speaking speed, eye contact, and how often you say "um" or "uh".</p>
  </div>
</div>

<div class="highlight-dark avoid-break">
  <strong>Why This Helps You Land the Job:</strong> Most candidates fail interviews because they don't know what they did wrong. PrepAI shows you your exact mistakes, gives you realistic practice that adapts to your answers, and hands you a personalized 7-day checklist so you walk into the real interview confident and fully prepared.
</div>

<div class="doc-footer">
  PrepAI Platform Features & Workflow Guide • Simple English Edition • © 2026 PrepAI
</div>

</body>
</html>
"""

with open(HTML_FILE, "w", encoding="utf-8") as f:
    f.write(html_content)

print(f"Generated HTML at: {HTML_FILE}")

# Render to PDF using Chrome Headless for both target filenames
for pdf_path in [PDF_FILE_1, PDF_FILE_2]:
    chrome_cmd = [
        CHROME_PATH,
        "--headless",
        "--disable-gpu",
        f"--print-to-pdf={pdf_path}",
        "--no-pdf-header-footer",
        HTML_FILE
    ]
    print(f"Invoking Chrome to render {os.path.basename(pdf_path)}...")
    proc = subprocess.run(chrome_cmd, capture_output=True, text=True, timeout=25)
    time.sleep(1)

    if os.path.exists(pdf_path) and os.path.getsize(pdf_path) > 0:
        print(f"SUCCESS: Created {os.path.basename(pdf_path)} ({os.path.getsize(pdf_path):,} bytes)")
    else:
        print(f"ERROR on {os.path.basename(pdf_path)}: {proc.stderr}")
