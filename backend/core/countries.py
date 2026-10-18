"""ISO 3166-1 alpha-2 country codes and English names, plus matching a resume's free-text location."""
import re
from typing import Optional

COUNTRIES = {
    "AF": "Afghanistan", "AL": "Albania", "DZ": "Algeria", "AD": "Andorra", "AO": "Angola",
    "AG": "Antigua and Barbuda", "AR": "Argentina", "AM": "Armenia", "AU": "Australia", "AT": "Austria",
    "AZ": "Azerbaijan", "BS": "Bahamas", "BH": "Bahrain", "BD": "Bangladesh", "BB": "Barbados",
    "BY": "Belarus", "BE": "Belgium", "BZ": "Belize", "BJ": "Benin", "BT": "Bhutan",
    "BO": "Bolivia", "BA": "Bosnia and Herzegovina", "BW": "Botswana", "BR": "Brazil", "BN": "Brunei",
    "BG": "Bulgaria", "BF": "Burkina Faso", "BI": "Burundi", "CV": "Cabo Verde", "KH": "Cambodia",
    "CM": "Cameroon", "CA": "Canada", "CF": "Central African Republic", "TD": "Chad", "CL": "Chile",
    "CN": "China", "CO": "Colombia", "KM": "Comoros", "CG": "Congo", "CD": "Congo (DRC)",
    "CR": "Costa Rica", "CI": "Côte d'Ivoire", "HR": "Croatia", "CU": "Cuba", "CY": "Cyprus",
    "CZ": "Czechia", "DK": "Denmark", "DJ": "Djibouti", "DM": "Dominica", "DO": "Dominican Republic",
    "EC": "Ecuador", "EG": "Egypt", "SV": "El Salvador", "GQ": "Equatorial Guinea", "ER": "Eritrea",
    "EE": "Estonia", "SZ": "Eswatini", "ET": "Ethiopia", "FJ": "Fiji", "FI": "Finland",
    "FR": "France", "GA": "Gabon", "GM": "Gambia", "GE": "Georgia", "DE": "Germany",
    "GH": "Ghana", "GR": "Greece", "GD": "Grenada", "GT": "Guatemala", "GN": "Guinea",
    "GW": "Guinea-Bissau", "GY": "Guyana", "HT": "Haiti", "HN": "Honduras", "HK": "Hong Kong",
    "HU": "Hungary", "IS": "Iceland", "IN": "India", "ID": "Indonesia", "IR": "Iran",
    "IQ": "Iraq", "IE": "Ireland", "IL": "Israel", "IT": "Italy", "JM": "Jamaica",
    "JP": "Japan", "JO": "Jordan", "KZ": "Kazakhstan", "KE": "Kenya", "KI": "Kiribati",
    "KW": "Kuwait", "KG": "Kyrgyzstan", "LA": "Laos", "LV": "Latvia", "LB": "Lebanon",
    "LS": "Lesotho", "LR": "Liberia", "LY": "Libya", "LI": "Liechtenstein", "LT": "Lithuania",
    "LU": "Luxembourg", "MO": "Macao", "MG": "Madagascar", "MW": "Malawi", "MY": "Malaysia",
    "MV": "Maldives", "ML": "Mali", "MT": "Malta", "MH": "Marshall Islands", "MR": "Mauritania",
    "MU": "Mauritius", "MX": "Mexico", "FM": "Micronesia", "MD": "Moldova", "MC": "Monaco",
    "MN": "Mongolia", "ME": "Montenegro", "MA": "Morocco", "MZ": "Mozambique", "MM": "Myanmar",
    "NA": "Namibia", "NR": "Nauru", "NP": "Nepal", "NL": "Netherlands", "NZ": "New Zealand",
    "NI": "Nicaragua", "NE": "Niger", "NG": "Nigeria", "KP": "North Korea", "MK": "North Macedonia",
    "NO": "Norway", "OM": "Oman", "PK": "Pakistan", "PW": "Palau", "PS": "Palestine",
    "PA": "Panama", "PG": "Papua New Guinea", "PY": "Paraguay", "PE": "Peru", "PH": "Philippines",
    "PL": "Poland", "PT": "Portugal", "PR": "Puerto Rico", "QA": "Qatar", "RO": "Romania",
    "RU": "Russia", "RW": "Rwanda", "KN": "Saint Kitts and Nevis", "LC": "Saint Lucia",
    "VC": "Saint Vincent and the Grenadines", "WS": "Samoa", "SM": "San Marino", "ST": "São Tomé and Príncipe",
    "SA": "Saudi Arabia", "SN": "Senegal", "RS": "Serbia", "SC": "Seychelles", "SL": "Sierra Leone",
    "SG": "Singapore", "SK": "Slovakia", "SI": "Slovenia", "SB": "Solomon Islands", "SO": "Somalia",
    "ZA": "South Africa", "KR": "South Korea", "SS": "South Sudan", "ES": "Spain", "LK": "Sri Lanka",
    "SD": "Sudan", "SR": "Suriname", "SE": "Sweden", "CH": "Switzerland", "SY": "Syria",
    "TW": "Taiwan", "TJ": "Tajikistan", "TZ": "Tanzania", "TH": "Thailand", "TL": "Timor-Leste",
    "TG": "Togo", "TO": "Tonga", "TT": "Trinidad and Tobago", "TN": "Tunisia", "TR": "Türkiye",
    "TM": "Turkmenistan", "TV": "Tuvalu", "UG": "Uganda", "UA": "Ukraine", "AE": "United Arab Emirates",
    "GB": "United Kingdom", "US": "United States", "UY": "Uruguay", "UZ": "Uzbekistan", "VU": "Vanuatu",
    "VA": "Vatican City", "VE": "Venezuela", "VN": "Vietnam", "YE": "Yemen", "ZM": "Zambia",
    "ZW": "Zimbabwe",
}

# Other ways resumes name a country, and well-known cities that are often written without one.
_ALIASES = {
    "usa": "US", "u.s.a.": "US", "u.s.": "US", "united states of america": "US", "america": "US",
    "uk": "GB", "u.k.": "GB", "england": "GB", "scotland": "GB", "wales": "GB", "great britain": "GB",
    "uae": "AE", "dubai": "AE", "abu dhabi": "AE", "turkey": "TR", "czech republic": "CZ",
    "korea": "KR", "republic of korea": "KR", "the netherlands": "NL", "holland": "NL",
    "bengaluru": "IN", "bangalore": "IN", "mumbai": "IN", "delhi": "IN", "new delhi": "IN",
    "hyderabad": "IN", "pune": "IN", "chennai": "IN", "kolkata": "IN", "noida": "IN", "gurgaon": "IN",
    "gurugram": "IN", "ahmedabad": "IN", "london": "GB", "new york": "US", "san francisco": "US",
    "seattle": "US", "toronto": "CA", "vancouver": "CA", "berlin": "DE", "munich": "DE",
    "paris": "FR", "sydney": "AU", "melbourne": "AU", "tokyo": "JP", "lagos": "NG", "nairobi": "KE",
    "karachi": "PK", "lahore": "PK", "dhaka": "BD", "kathmandu": "NP", "colombo": "LK",
}
_BY_NAME = {name.lower(): code for code, name in COUNTRIES.items()}


def country_name(code: Optional[str]) -> Optional[str]:
    return COUNTRIES.get(code or "")


def country_payload(code: Optional[str]) -> Optional[dict]:
    name = country_name(code)
    return {"code": code, "name": name} if name else None


def normalize_country(value: Optional[str]) -> Optional[str]:
    """Returns the ISO code for a code entered in any case, or None when it is not a known country."""
    code = (value or "").strip().upper()
    return code if code in COUNTRIES else None


def guess_country(location: Optional[str], fuzzy: bool = True) -> Optional[str]:
    """Best guess at the country in a resume location such as "Pune, Maharashtra, India".
    With fuzzy=False only a whole comma-separated part counts, so "Jordan Smith" is not Jordan."""
    text = (location or "").strip().lower()
    if not text:
        return None
    parts = [p.strip(" .") for p in re.split(r"[,/|•·]", text) if p.strip(" .")]
    for part in reversed(parts):
        if part in _BY_NAME:
            return _BY_NAME[part]
        if part in _ALIASES:
            return _ALIASES[part]
    if fuzzy:
        for word, code in {**_BY_NAME, **_ALIASES}.items():
            if re.search(rf"(?<![a-z]){re.escape(word)}(?![a-z])", text):
                return code
    return None


_LOCATION_LABEL = re.compile(r"^\s*(?:location|address|based in|city)\s*[:\-]\s*", re.IGNORECASE)


def guess_resume_country(location: Optional[str], raw_text: Optional[str]) -> Optional[str]:
    """The parsed location if there is one, else a "City, Country" or "Location: ..." in the resume header."""
    code = guess_country(location)
    if code:
        return code
    for line in (raw_text or "").splitlines()[:8]:
        for segment in re.split(r"[|•·]", line):
            labelled = _LOCATION_LABEL.match(segment)
            text = segment[labelled.end():] if labelled else segment
            if labelled or "," in text:
                code = guess_country(text, fuzzy=bool(labelled))
                if code:
                    return code
    return None
