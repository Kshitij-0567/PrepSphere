import React, { useState } from 'react';
import { Building2 } from 'lucide-react';

// Professional Company Logo Component with Favicon CDN and Monogram Fallback
const CompanyLogo = ({ company, size = 36, className = "" }) => {
    const [imgError, setImgError] = useState(false);

    if (!company) {
        return (
            <div className={`company-logo-fallback ${className}`} style={{ width: size, height: size }}>
                <Building2 size={Math.round(size * 0.55)} color="#94a3b8" />
            </div>
        );
    }

    if (imgError || !company.logo_url) {
        const initials = company.name ? company.name.slice(0, 2).toUpperCase() : 'CO';
        return (
            <div className={`company-logo-fallback ${className}`} style={{ width: size, height: size, fontSize: `${Math.round(size * 0.38)}px` }}>
                {initials}
            </div>
        );
    }

    return (
        <img
            src={company.logo_url}
            alt={company.name}
            className={`company-logo-img ${className}`}
            style={{ width: size, height: size }}
            onError={() => setImgError(true)}
            loading="lazy"
        />
    );
};

export default CompanyLogo;
