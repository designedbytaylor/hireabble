"""
Content moderation utility for Hireabble API.

Provides text filtering for profanity, sexual content, drugs, alcohol,
violence, and other inappropriate content. Used across all user-generated
text fields (profiles, jobs, messages).
"""
import re
import unicodedata
from typing import List, Tuple

# Categories of banned content
BANNED_WORDS = {
    "sexual": [
        "porn", "pornography", "xxx", "nude", "nudes", "naked", "sex work",
        "escort", "escorting", "onlyfans", "camgirl", "camboy", "stripper",
        "stripping", "prostitut", "brothel", "erotic", "fetish", "bdsm",
        "hookup", "hook up", "booty call", "sugardaddy", "sugar daddy",
        "sugarmommy", "sugar mommy", "sugarbaby", "sugar baby", "nsfw",
        "adult content", "adult entertainment", "sexting", "lingerie model",
    ],
    "drugs": [
        "cocaine", "heroin", "methamphetamine", "meth dealer", "drug deal",
        "weed dealer", "marijuana dealer", "fentanyl", "crack cocaine",
        "drug trafficking", "narcotics", "opioid dealer", "pill mill",
        "drug lord", "cartel", "mdma dealer", "ecstasy dealer", "lsd dealer",
        "mushroom dealer", "ketamine dealer", "drug smuggl",
    ],
    "alcohol_illegal": [
        "moonshine dealer", "bootleg liquor", "illegal distill",
        "underage drinking", "sell alcohol to minors",
    ],
    "violence": [
        "hitman", "hit man", "assassin", "murder for hire", "gun for hire",
        "mercenary", "contract kill", "bomb threat", "terroris",
        "extremis", "white supremac", "hate group", "ethnic cleansing",
        "genocide", "mass shooting",
    ],
    "fraud": [
        "money laundering", "ponzi scheme", "pyramid scheme", "scam",
        "fraud", "counterfeit", "identity theft", "phishing",
        "catfish", "fake identit",
    ],
    "profanity": [
        "fuck", "shit", "asshole", "bitch", "bastard", "damn", "cunt",
        "dick", "cock", "pussy", "whore", "slut", "fag", "faggot",
        "retard", "nigger", "nigga", "chink", "spic", "kike", "wetback",
    ],
}

# Words that should NOT be filtered even if they partially match banned words
WHITELIST = [
    "cocktail hour", "assassin's creed", "mass", "shooting range",
    "therapeutic", "pharmacy", "pharmacist", "pharmaceutical",
    "bartlett", "therapist", "analytics", "assess", "assessment",
    "class", "classic", "assistant", "passionate", "compassion",
    "bypass", "dickens", "cocktail party", "scunthorpe",
    "arsenal", "essex", "sussex", "middlesex", "hancock",
    "peacock", "hitchcock", "babysitter", "babysit",
]

# Severe violations that should be auto-rejected (not just flagged)
SEVERE_PATTERNS = [
    r"hitman|hit\s*man|murder\s*for\s*hire|contract\s*kill",
    r"drug\s*traffick|drug\s*smuggl|drug\s*deal",
    r"terroris|bomb\s*threat|mass\s*shoot",
    r"child\s*(porn|abuse|exploit)",
    r"human\s*traffick",
    r"white\s*supremac|ethnic\s*cleans",
]


def _normalize(text: str) -> str:
    """Normalize text for matching: lowercase, collapse whitespace, strip homoglyphs and zero-width chars."""
    # Remove zero-width characters (U+200B, U+200C, U+200D, U+FEFF, U+00AD, etc.)
    text = re.sub(r'[\u200b\u200c\u200d\ufeff\u00ad\u2060\u180e]', '', text)
    # NFKD normalization converts lookalike chars (Cyrillic а→a, etc.) to base forms
    text = unicodedata.normalize('NFKD', text)
    # Remove combining marks (accents, diacritics) to get base characters
    text = ''.join(c for c in text if unicodedata.category(c) != 'Mn')
    # Collapse whitespace and lowercase
    return re.sub(r'\s+', ' ', text.lower().strip())


def _contains_whitelisted(text: str, match_pos: int, match_word: str) -> bool:
    """Check if the matched word is part of a whitelisted phrase."""
    text_lower = text.lower()
    for safe in WHITELIST:
        if safe in text_lower:
            safe_start = text_lower.find(safe)
            safe_end = safe_start + len(safe)
            if safe_start <= match_pos < safe_end:
                return True
    return False


def check_text(text: str) -> Tuple[bool, List[dict]]:
    """
    Check text for inappropriate content.

    Returns:
        (is_clean, violations) where:
        - is_clean: True if no violations found
        - violations: list of {"category": str, "word": str, "severity": str}
    """
    if not text or not text.strip():
        return True, []

    normalized = _normalize(text)
    violations = []

    # Check severe patterns first
    for pattern in SEVERE_PATTERNS:
        match = re.search(pattern, normalized)
        if match:
            violations.append({
                "category": "severe",
                "word": match.group(),
                "severity": "critical",
            })

    # Check each category
    for category, words in BANNED_WORDS.items():
        for word in words:
            word_lower = word.lower()
            # Use word boundary matching for short words to avoid false positives
            if len(word_lower) <= 4:
                pattern = r'\b' + re.escape(word_lower) + r'\b'
                match = re.search(pattern, normalized)
                if match and not _contains_whitelisted(normalized, match.start(), word_lower):
                    violations.append({
                        "category": category,
                        "word": word,
                        "severity": "critical" if category in ("violence", "fraud") else "high",
                    })
            else:
                idx = normalized.find(word_lower)
                if idx != -1 and not _contains_whitelisted(normalized, idx, word_lower):
                    violations.append({
                        "category": category,
                        "word": word,
                        "severity": "critical" if category in ("violence", "fraud") else "high",
                    })

    # Deduplicate
    seen = set()
    unique = []
    for v in violations:
        key = (v["category"], v["word"])
        if key not in seen:
            seen.add(key)
            unique.append(v)

    return len(unique) == 0, unique


def check_fields(fields: dict) -> Tuple[bool, List[dict]]:
    """
    Check multiple text fields at once.

    Args:
        fields: dict of {field_name: text_value}

    Returns:
        (is_clean, violations) where violations include the field name
    """
    all_violations = []
    for field_name, value in fields.items():
        if isinstance(value, str):
            _, violations = check_text(value)
            for v in violations:
                v["field"] = field_name
                all_violations.append(v)
        elif isinstance(value, list):
            for item in value:
                if isinstance(item, str):
                    _, violations = check_text(item)
                    for v in violations:
                        v["field"] = field_name
                        all_violations.append(v)

    return len(all_violations) == 0, all_violations


def is_severe(violations: List[dict]) -> bool:
    """Check if any violation is severe enough to auto-reject."""
    return any(v.get("severity") == "critical" and v.get("category") == "severe" for v in violations)
