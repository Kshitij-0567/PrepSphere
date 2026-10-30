import React from 'react';
import {
    Activity, Binary, Building, Compass, Cpu, Database, FileCode, Layers, Layout,
    ShieldCheck, Sparkles, Target, Terminal, Zap
} from 'lucide-react';

// Comprehensive role icon mapping for all engineering disciplines
const RoleIcon = ({ name = '', category = '' }) => {
    const n = name.toLowerCase();
    const c = (category || '').toLowerCase();
    const props = { size: 20, className: "role-icon-svg" };

    // AI & Data
    if (n.includes('ai') || n.includes('machine learning') || n.includes('ml') || n.includes('data') || n.includes('vision') || c.includes('ai')) {
        return <Sparkles {...props} />;
    }
    // Cloud & DevOps
    if (n.includes('cloud') || n.includes('devops') || n.includes('sre') || n.includes('site reliability') || c.includes('cloud')) {
        return <Layers {...props} />;
    }
    // Hardware & VLSI
    if (n.includes('hardware') || n.includes('vlsi') || n.includes('asic') || n.includes('fpga') || n.includes('embedded') || n.includes('dsp') || c.includes('hardware')) {
        return <Cpu {...props} />;
    }
    // Robotics & Automation
    if (n.includes('robot') || n.includes('automation') || n.includes('control') || n.includes('mechatronics') || n.includes('iot') || c.includes('robotics')) {
        return <Binary {...props} />;
    }
    // Core Engineering - Aerospace
    if (n.includes('aerospace') || n.includes('aero') || n.includes('propulsion') || n.includes('flight')) {
        return <Compass {...props} />;
    }
    // Core Engineering - Civil
    if (n.includes('civil') || n.includes('structural') || n.includes('infrastructure')) {
        return <Building {...props} />;
    }
    // Core Engineering - Biomedical
    if (n.includes('biomedical') || n.includes('medical') || n.includes('biomech')) {
        return <Activity {...props} />;
    }
    // Core Engineering - Chemical / Process
    if (n.includes('chemical') || n.includes('process') || n.includes('refinery')) {
        return <Target {...props} />;
    }
    // Core Engineering - Mechanical / EV / Power
    if (n.includes('mechanical') || n.includes('thermal') || n.includes('fluid') || n.includes('ev') || n.includes('power') || n.includes('grid')) {
        return <Zap {...props} />;
    }
    // Software & Web
    if (n.includes('frontend') || n.includes('ui') || n.includes('web')) {
        return <Layout {...props} />;
    }
    if (n.includes('backend') || n.includes('database')) {
        return <Database {...props} />;
    }
    if (n.includes('security') || n.includes('cyber')) {
        return <ShieldCheck {...props} />;
    }
    if (n.includes('game') || n.includes('graphics')) {
        return <FileCode {...props} />;
    }
    return <Terminal {...props} />;
};

export default RoleIcon;
