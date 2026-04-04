"""
Blog/SEO batch generation routes for Hireabble admin panel.

Generates programmatic SEO blog posts targeting city+role combinations
across 40 cities and 30 roles using Claude API.
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from typing import Optional, List
from datetime import datetime, timezone
import uuid
import asyncio
import random
import re
import os

from database import db, logger, get_current_admin
from slowapi import Limiter
from slowapi.util import get_remote_address
import anthropic

limiter = Limiter(key_func=get_remote_address)

router = APIRouter(tags=["Admin"])

# ==================== CONSTANTS ====================

CITIES_CANADA = [
    "Toronto", "Vancouver", "Montreal", "Calgary", "Ottawa", "Edmonton",
    "Winnipeg", "Quebec City", "Hamilton", "Kitchener", "London", "Halifax",
    "Victoria", "Saskatoon", "Regina", "St. John's", "Kelowna", "Barrie",
    "Windsor", "Mississauga",
]

CITIES_US = [
    "New York", "San Francisco", "Los Angeles", "Chicago", "Seattle",
    "Austin", "Boston", "Denver", "Miami", "Dallas", "Atlanta", "Phoenix",
    "Minneapolis", "Portland", "San Diego", "Washington DC", "Philadelphia",
    "Nashville", "Raleigh", "Charlotte",
]

ALL_CITIES = CITIES_CANADA + CITIES_US

ROLES = [
    "Software Developer", "Data Analyst", "Project Manager", "Registered Nurse",
    "Marketing Manager", "Accountant", "Graphic Designer", "Sales Representative",
    "HR Manager", "Electrician", "Mechanical Engineer", "Teacher", "Pharmacist",
    "Financial Analyst", "UX Designer", "DevOps Engineer", "Business Analyst",
    "Civil Engineer", "Dental Hygienist", "Social Worker", "Construction Manager",
    "Plumber", "Welder", "Truck Driver", "Administrative Assistant",
    "Customer Service Rep", "Retail Manager", "Chef", "Physiotherapist", "Paramedic",
]

PAGE_TYPES = [
    # Tier 1 — city × role (1,200 posts each)
    "jobs_in_city", "salary_guide", "career_guide", "interview_prep",
    "resume_tips", "cover_letter_guide", "cost_of_living",
    "skills_guide", "day_in_life", "salary_negotiation",
    # Tier 2 — city × role (1,200 posts each)
    "remote_work_guide", "entry_level_guide", "freelance_guide",
    "certification_guide", "company_size_guide",
    # Tier 2 — multi-dimension
    "role_comparison",    # city × role × role2
    "industry_guide",     # city × role × industry
    # Tier 3 — city × role (1,200 posts each)
    "neighborhood_guide", "company_hiring", "visa_immigration",
    # Tier 3 — multi-dimension
    "career_transition",  # city × role × role2
    "technology_stack",   # city × technology (no role)
    "city_comparison",    # city × city2 × role
    "annual_job_market",  # city only (no role)
]

# Page types that use extra dimensions beyond city × role
MULTI_DIM_PAGE_TYPES = {
    "role_comparison": "role2",
    "career_transition": "role2",
    "industry_guide": "industry",
    "technology_stack": "technology",
    "city_comparison": "city2",
    "annual_job_market": "city_only",
}

# ==================== MULTI-DIMENSION DATA ====================

INDUSTRIES = [
    "Technology", "Healthcare", "Finance", "Retail", "Manufacturing",
    "Education", "Government", "Construction", "Energy", "Hospitality",
]

TECHNOLOGIES = [
    "Python", "JavaScript", "React", "Node.js", "TypeScript", "Java",
    "AWS", "Docker", "Kubernetes", "SQL", "PostgreSQL", "MongoDB",
    "Go", "Rust", "C#", ".NET", "Ruby", "PHP", "Swift", "Kotlin",
    "Terraform", "GraphQL", "Redis", "Tableau", "Salesforce",
    "SAP", "Power BI", "Figma", "AutoCAD", "MATLAB",
]

# Curated role comparison pairs (most-searched combinations)
ROLE_COMPARISON_PAIRS = [
    ("Software Developer", "Data Analyst"), ("Software Developer", "DevOps Engineer"),
    ("Software Developer", "UX Designer"), ("Software Developer", "Project Manager"),
    ("Data Analyst", "Business Analyst"), ("Data Analyst", "Financial Analyst"),
    ("Project Manager", "Business Analyst"), ("Project Manager", "Construction Manager"),
    ("Registered Nurse", "Paramedic"), ("Registered Nurse", "Pharmacist"),
    ("Registered Nurse", "Physiotherapist"), ("Marketing Manager", "Sales Representative"),
    ("Graphic Designer", "UX Designer"), ("Accountant", "Financial Analyst"),
    ("HR Manager", "Retail Manager"), ("Electrician", "Plumber"),
    ("Mechanical Engineer", "Civil Engineer"), ("Teacher", "Social Worker"),
    ("DevOps Engineer", "Data Analyst"), ("Chef", "Retail Manager"),
    ("Administrative Assistant", "Customer Service Rep"),
    ("Welder", "Plumber"), ("Truck Driver", "Construction Manager"),
    ("Dental Hygienist", "Pharmacist"), ("Paramedic", "Physiotherapist"),
]

# Curated career transition pairs (realistic direction)
CAREER_TRANSITION_PAIRS = [
    ("Teacher", "HR Manager"), ("Teacher", "Project Manager"),
    ("Teacher", "Marketing Manager"), ("Registered Nurse", "Pharmacist"),
    ("Registered Nurse", "Social Worker"), ("Sales Representative", "Marketing Manager"),
    ("Sales Representative", "Business Analyst"), ("Customer Service Rep", "HR Manager"),
    ("Customer Service Rep", "Administrative Assistant"),
    ("Retail Manager", "HR Manager"), ("Retail Manager", "Marketing Manager"),
    ("Administrative Assistant", "Business Analyst"),
    ("Administrative Assistant", "Project Manager"),
    ("Graphic Designer", "UX Designer"), ("Graphic Designer", "Marketing Manager"),
    ("Financial Analyst", "Data Analyst"), ("Financial Analyst", "Business Analyst"),
    ("Accountant", "Financial Analyst"), ("Accountant", "Business Analyst"),
    ("Mechanical Engineer", "Project Manager"), ("Civil Engineer", "Construction Manager"),
    ("Electrician", "Construction Manager"), ("Plumber", "Construction Manager"),
    ("Chef", "Retail Manager"), ("Paramedic", "Registered Nurse"),
    ("Data Analyst", "Software Developer"), ("Software Developer", "DevOps Engineer"),
    ("Software Developer", "Project Manager"), ("Software Developer", "UX Designer"),
    ("Welder", "Mechanical Engineer"), ("Truck Driver", "Construction Manager"),
]

# City comparison pairs (most common relocation/comparison searches)
CITY_COMPARISON_PAIRS = [
    ("Toronto", "Vancouver"), ("Toronto", "Montreal"), ("Toronto", "Calgary"),
    ("Toronto", "Ottawa"), ("Vancouver", "Calgary"), ("Vancouver", "Victoria"),
    ("Montreal", "Quebec City"), ("Calgary", "Edmonton"),
    ("New York", "San Francisco"), ("New York", "Los Angeles"), ("New York", "Chicago"),
    ("New York", "Boston"), ("San Francisco", "Seattle"), ("San Francisco", "Austin"),
    ("Los Angeles", "San Diego"), ("Chicago", "Minneapolis"),
    ("Seattle", "Portland"), ("Austin", "Dallas"), ("Miami", "Atlanta"),
    ("Denver", "Austin"), ("Boston", "Philadelphia"), ("Nashville", "Charlotte"),
    ("Raleigh", "Charlotte"), ("Washington DC", "Philadelphia"),
    ("Toronto", "New York"), ("Vancouver", "Seattle"), ("Montreal", "Boston"),
    ("Calgary", "Denver"), ("Toronto", "Chicago"),
]

# Salary data (CAD baseline for Canada, multiply ~1.1x for US/USD)
# Format: { role: { "junior": (low, high), "mid": (low, high), "senior": (low, high) } }
SALARY_DATA_CAD = {
    "Software Developer":      {"junior": (60000, 78000),  "mid": (82000, 110000),  "senior": (115000, 155000)},
    "Data Analyst":            {"junior": (50000, 62000),  "mid": (65000, 85000),   "senior": (88000, 120000)},
    "Project Manager":         {"junior": (55000, 70000),  "mid": (72000, 95000),   "senior": (98000, 135000)},
    "Registered Nurse":        {"junior": (62000, 72000),  "mid": (74000, 90000),   "senior": (92000, 110000)},
    "Marketing Manager":       {"junior": (48000, 62000),  "mid": (65000, 88000),   "senior": (90000, 125000)},
    "Accountant":              {"junior": (48000, 60000),  "mid": (62000, 82000),   "senior": (85000, 115000)},
    "Graphic Designer":        {"junior": (40000, 52000),  "mid": (54000, 72000),   "senior": (75000, 100000)},
    "Sales Representative":    {"junior": (42000, 55000),  "mid": (58000, 78000),   "senior": (80000, 120000)},
    "HR Manager":              {"junior": (52000, 65000),  "mid": (68000, 88000),   "senior": (90000, 120000)},
    "Electrician":             {"junior": (45000, 58000),  "mid": (60000, 78000),   "senior": (80000, 105000)},
    "Mechanical Engineer":     {"junior": (55000, 70000),  "mid": (72000, 95000),   "senior": (98000, 130000)},
    "Teacher":                 {"junior": (45000, 55000),  "mid": (58000, 75000),   "senior": (78000, 98000)},
    "Pharmacist":              {"junior": (75000, 88000),  "mid": (90000, 110000),  "senior": (112000, 140000)},
    "Financial Analyst":       {"junior": (52000, 65000),  "mid": (68000, 90000),   "senior": (92000, 130000)},
    "UX Designer":             {"junior": (52000, 68000),  "mid": (70000, 92000),   "senior": (95000, 130000)},
    "DevOps Engineer":         {"junior": (62000, 80000),  "mid": (82000, 110000),  "senior": (112000, 150000)},
    "Business Analyst":        {"junior": (52000, 65000),  "mid": (68000, 88000),   "senior": (90000, 120000)},
    "Civil Engineer":          {"junior": (55000, 68000),  "mid": (70000, 92000),   "senior": (95000, 125000)},
    "Dental Hygienist":        {"junior": (55000, 68000),  "mid": (70000, 85000),   "senior": (87000, 105000)},
    "Social Worker":           {"junior": (42000, 52000),  "mid": (54000, 68000),   "senior": (70000, 90000)},
    "Construction Manager":    {"junior": (55000, 70000),  "mid": (72000, 95000),   "senior": (98000, 135000)},
    "Plumber":                 {"junior": (42000, 55000),  "mid": (58000, 75000),   "senior": (78000, 100000)},
    "Welder":                  {"junior": (40000, 52000),  "mid": (54000, 70000),   "senior": (72000, 95000)},
    "Truck Driver":            {"junior": (40000, 52000),  "mid": (55000, 70000),   "senior": (72000, 92000)},
    "Administrative Assistant": {"junior": (35000, 42000), "mid": (44000, 55000),   "senior": (58000, 72000)},
    "Customer Service Rep":    {"junior": (32000, 40000),  "mid": (42000, 52000),   "senior": (54000, 68000)},
    "Retail Manager":          {"junior": (38000, 48000),  "mid": (50000, 65000),   "senior": (68000, 88000)},
    "Chef":                    {"junior": (35000, 45000),  "mid": (48000, 62000),   "senior": (65000, 88000)},
    "Physiotherapist":         {"junior": (58000, 70000),  "mid": (72000, 88000),   "senior": (90000, 115000)},
    "Paramedic":               {"junior": (50000, 62000),  "mid": (64000, 78000),   "senior": (80000, 100000)},
}

# Track running generation jobs for cancellation
_running_jobs: dict[str, bool] = {}

# ==================== PROMPT VARIETY ====================

VOICE_VARIATIONS = [
    "Write as an experienced career coach talking to a friend.",
    "Write from the perspective of a hiring manager who's reviewed thousands of applications.",
    "Write as a local recruiter who knows the {city} market inside out.",
    "Write as a career journalist covering the job market.",
    "Write as someone who's worked as a {role} and switched careers, giving honest insider advice.",
]

STRUCTURE_VARIATIONS = [
    "Start with a compelling question, then dive into the data.",
    "Lead with the most surprising statistic, then explain why it matters.",
    "Tell a brief story about someone in this exact situation, then transition to practical advice.",
    "Start with a quick summary of key numbers, then go deeper into each one.",
    "Open with a common misconception about this topic, then set the record straight.",
]

ANGLE_VARIATIONS = {
    "jobs_in_city": [
        "Focus on the hidden job market and networking strategies specific to {city}.",
        "Emphasize remote vs. in-office trends for {role} positions in {city}.",
        "Highlight the fastest-growing companies hiring {role}s in {city} right now.",
        "Compare the {role} job market in {city} to similar-sized cities.",
        "Focus on what makes {city} uniquely attractive for {role} professionals.",
    ],
    "salary_guide": [
        "Emphasize negotiation strategies that work specifically in {city}'s market.",
        "Focus on the total compensation picture beyond base salary.",
        "Highlight how {role} salaries in {city} have changed over the past few years.",
        "Compare what startups vs. established companies pay for {role}s in {city}.",
        "Focus on the cost-of-living-adjusted value of {role} salaries in {city}.",
    ],
    "career_guide": [
        "Focus on non-traditional paths into the {role} career.",
        "Emphasize the most in-demand specializations within {role} in {city}.",
        "Highlight mentorship and community resources in {city} for aspiring {role}s.",
        "Focus on the step-by-step certification and licensing process.",
        "Emphasize real career progression timelines and what to expect each year.",
    ],
    "interview_prep": [
        "Focus on behavioral questions and the STAR method with {role}-specific examples.",
        "Emphasize technical skills assessment and how to demonstrate competence.",
        "Highlight cultural fit questions and what {city} employers value most.",
        "Focus on questions candidates should ask the interviewer.",
        "Emphasize common mistakes {role} candidates make in interviews and how to avoid them.",
    ],
    "resume_tips": [
        "Focus on ATS optimization and keywords that {city} recruiters actually search for.",
        "Emphasize quantifiable achievements and metrics that matter for {role} positions.",
        "Highlight the resume format debate (chronological vs. functional) for {role}s in {city}.",
        "Focus on what {city} hiring managers scan for in the first 6 seconds.",
        "Emphasize how to tailor your {role} resume for different company sizes in {city}.",
    ],
    "cover_letter_guide": [
        "Focus on opening hooks that grab attention for {role} applications in {city}.",
        "Emphasize storytelling techniques that connect your experience to the {role} position.",
        "Highlight how to research {city} companies and personalize each cover letter.",
        "Focus on the right tone — formal vs. conversational — for {role} jobs in {city}.",
        "Emphasize what NOT to include and common cover letter mistakes for {role} applicants.",
    ],
    "cost_of_living": [
        "Focus on neighborhood-by-neighborhood rent comparison for {role}s in {city}.",
        "Emphasize the salary-to-rent ratio and what percentage of income goes to housing.",
        "Highlight hidden costs that {role}s moving to {city} often overlook.",
        "Focus on how {role} salaries in {city} compare to the actual cost of a comfortable life.",
        "Emphasize money-saving tips specific to living in {city} as a {role}.",
    ],
    "skills_guide": [
        "Focus on skills that {city} employers value most — based on local job postings.",
        "Emphasize the gap between university training and what {role} employers actually need.",
        "Highlight emerging skills that will define {role} hiring in {city} over the next 2 years.",
        "Focus on free and affordable ways to learn the top {role} skills in {city}.",
        "Emphasize soft skills vs. hard skills and which matter more for {role}s in {city}.",
    ],
    "day_in_life": [
        "Focus on the morning routine and commute experience of a {role} in {city}.",
        "Emphasize the surprising parts of the job that outsiders don't see.",
        "Highlight work-life balance realities for {role}s in {city} — the honest version.",
        "Focus on how the daily routine differs by seniority level for {role}s.",
        "Emphasize the social and team dynamics of working as a {role} in {city}.",
    ],
    "salary_negotiation": [
        "Focus on exact scripts and phrases to use when negotiating {role} salary in {city}.",
        "Emphasize the best timing and leverage points for salary negotiation.",
        "Highlight non-salary perks that {role}s in {city} should negotiate for.",
        "Focus on counter-offer strategies specific to the {city} market.",
        "Emphasize how to negotiate as a {role} when switching jobs vs. asking for a raise.",
    ],
    # Tier 2
    "remote_work_guide": [
        "Focus on which {city} employers are offering remote {role} positions right now.",
        "Emphasize the salary impact of going remote vs. staying in-office in {city}.",
        "Highlight the tools and home office setup that remote {role}s need.",
        "Focus on the tax implications of working remotely from {city}.",
        "Emphasize how to stand out in remote {role} interviews.",
    ],
    "entry_level_guide": [
        "Focus on what {city} employers actually expect from entry-level {role} candidates.",
        "Emphasize internship and apprenticeship pathways in {city}.",
        "Highlight the first-year experience and what surprises new {role}s.",
        "Focus on the education vs. experience debate for entry-level {role}s.",
        "Emphasize networking strategies for new graduates in {city}.",
    ],
    "freelance_guide": [
        "Focus on setting freelance rates as a {role} in {city}'s market.",
        "Emphasize finding your first freelance clients in {city}.",
        "Highlight the legal and tax setup for freelance {role}s.",
        "Focus on building a portfolio that wins freelance {role} contracts.",
        "Emphasize the feast-or-famine cycle and how to stabilize income.",
    ],
    "certification_guide": [
        "Focus on which certifications {city} employers actually value for {role}s.",
        "Emphasize the ROI calculation — cost vs. salary bump for each certification.",
        "Highlight accelerated certification paths for working {role}s.",
        "Focus on free or employer-sponsored certification options in {city}.",
        "Emphasize how certifications impact hiring decisions for {role}s.",
    ],
    "company_size_guide": [
        "Focus on the day-to-day reality of {role} work at a 10-person startup vs. 10,000-person company.",
        "Emphasize equity and stock options vs. salary stability for {role}s in {city}.",
        "Highlight career growth speed differences between startup and corporate {role}s.",
        "Focus on interview process differences — startup vs. enterprise for {role}s.",
        "Emphasize which company size best fits different personality types.",
    ],
    "role_comparison": [
        "Focus on which role offers better long-term career prospects in {city}.",
        "Emphasize the lifestyle and work-life balance differences between these roles.",
        "Highlight transferable skills and how easy it is to switch between them.",
        "Focus on the salary trajectory over 10 years for each role in {city}.",
        "Emphasize which role has stronger job security in {city}'s market.",
    ],
    "industry_guide": [
        "Focus on how the industry context changes the daily work of a {role}.",
        "Emphasize salary premiums and penalties by industry for {role}s in {city}.",
        "Highlight the top employers in this industry in {city}.",
        "Focus on industry-specific skills that {role}s need beyond their core competency.",
        "Emphasize career growth differences across industries for {role}s.",
    ],
    # Tier 3
    "neighborhood_guide": [
        "Focus on rent-to-salary ratios in different {city} neighborhoods for {role}s.",
        "Emphasize commute times and transit access to major {role} employment hubs.",
        "Highlight up-and-coming neighborhoods that {role}s are moving to.",
        "Focus on lifestyle amenities that matter most to {role} professionals.",
        "Emphasize safety, walkability, and family-friendliness for each neighborhood.",
    ],
    "company_hiring": [
        "Focus on the interview processes and culture at top {city} employers hiring {role}s.",
        "Emphasize which companies offer the best total compensation packages.",
        "Highlight companies with strong growth that are actively expanding {role} teams.",
        "Focus on company culture and work-life balance ratings for {role}s.",
        "Emphasize lesser-known companies in {city} that are great places to work as a {role}.",
    ],
    "visa_immigration": [
        "Focus on the step-by-step visa process for {role}s moving to {city}.",
        "Emphasize credential recognition and equivalency for international {role}s.",
        "Highlight employers in {city} that sponsor visas for {role} positions.",
        "Focus on settlement resources and community support for immigrant {role}s.",
        "Emphasize the timeline and costs involved in immigrating as a {role}.",
    ],
    "career_transition": [
        "Focus on the transferable skills that make this career switch realistic.",
        "Emphasize the retraining timeline and most efficient learning path.",
        "Highlight real success stories of people who made this exact transition.",
        "Focus on the salary impact during and after the career change.",
        "Emphasize how to position your experience on your resume for the new field.",
    ],
    "technology_stack": [
        "Focus on which {city} companies are actively hiring for this technology.",
        "Emphasize the salary premium for professionals skilled in this technology.",
        "Highlight the learning path from beginner to job-ready for this technology.",
        "Focus on how this technology fits into the broader tech ecosystem in {city}.",
        "Emphasize project ideas and portfolio pieces that showcase this technology skill.",
    ],
    "city_comparison": [
        "Focus on the quality of life differences that matter most to {role}s.",
        "Emphasize the after-tax, after-rent salary comparison between the two cities.",
        "Highlight career growth opportunities in each city for {role}s.",
        "Focus on the relocation process and what to expect when moving.",
        "Emphasize which city is better at different career stages (early vs. mid vs. senior).",
    ],
    "annual_job_market": [
        "Focus on which industries and roles are growing fastest in {city}.",
        "Emphasize salary trends and how they've shifted over the past year.",
        "Highlight the impact of remote work on {city}'s local job market.",
        "Focus on unemployment trends and what they mean for job seekers.",
        "Emphasize emerging sectors and new employers setting up in {city}.",
    ],
}


# ==================== HELPERS ====================

def _get_country(city: str) -> str:
    return "Canada" if city in CITIES_CANADA else "US"


def _get_salary_range(role: str, city: str) -> dict:
    """Get salary data for a role in a given city, adjusted for country."""
    base = SALARY_DATA_CAD.get(role, {"junior": (45000, 58000), "mid": (60000, 80000), "senior": (82000, 110000)})
    multiplier = 1.1 if city in CITIES_US else 1.0
    currency = "USD" if city in CITIES_US else "CAD"
    return {
        "currency": currency,
        "junior": f"{int(base['junior'][0] * multiplier / 1000)}K-{int(base['junior'][1] * multiplier / 1000)}K",
        "mid": f"{int(base['mid'][0] * multiplier / 1000)}K-{int(base['mid'][1] * multiplier / 1000)}K",
        "senior": f"{int(base['senior'][0] * multiplier / 1000)}K-{int(base['senior'][1] * multiplier / 1000)}K",
    }


def _slugify(title: str) -> str:
    """Generate URL-friendly slug from title."""
    slug = title.lower().strip()
    slug = re.sub(r'[^a-z0-9\s-]', '', slug)
    slug = re.sub(r'[\s-]+', '-', slug)
    return slug.strip('-')


def _build_prompt(page_type: str, city: str, role: str, extra: dict = None) -> tuple[str, str]:
    """Build Claude prompt and title for a given page type, city, and role.

    Each call randomly selects a voice, structure, and angle variation
    so that posts for the same page_type don't all sound identical.

    `extra` may contain: role2, industry, technology, city2 for multi-dimension types.
    """
    extra = extra or {}
    # Some page types don't use role — use a placeholder for voice/angle formatting
    effective_role = role or "professional"
    salary = _get_salary_range(effective_role, city) if effective_role != "professional" else {
        "currency": "USD" if city in CITIES_US else "CAD",
        "junior": "varies", "mid": "varies", "senior": "varies",
    }
    country = _get_country(city)
    currency = salary["currency"]

    # Randomly select variety elements
    voice = random.choice(VOICE_VARIATIONS).format(city=city, role=effective_role)
    structure = random.choice(STRUCTURE_VARIATIONS)
    angle = random.choice(ANGLE_VARIATIONS.get(page_type, [""])).format(city=city, role=effective_role)

    style_instructions = (
        f"{voice} "
        f"{structure} "
        "Use contractions (you'll, it's, don't, we've). "
        "Vary sentence length — mix short punchy sentences with longer flowing ones. "
        "Format with markdown H2/H3 headings and bullet lists. "
        "Target 800-1200 words. "
        "Include a 'Key Takeaways' section at the end with 4-6 bullet points. "
        "NEVER use these phrases: 'In today's fast-paced world', 'It's important to note', "
        "'In conclusion', 'Let's dive in', 'without further ado', 'game-changer', "
        "'navigating the landscape', 'look no further', 'comprehensive guide'. "
        "Reference the specific city with local context where relevant. "
        f"{angle}"
    )

    if page_type == "jobs_in_city":
        title = f"Finding {role} Jobs in {city}: 2026 Guide"
        prompt = (
            f"Write a comprehensive guide about finding {role} jobs in {city}, {country}. "
            f"Cover the local job market, top employers, neighborhoods where these jobs cluster, "
            f"and practical tips for job seekers. "
            f"Include salary expectations: junior {salary['junior']} {currency}, "
            f"mid-level {salary['mid']} {currency}, senior {salary['senior']} {currency}. "
            f"Mention how platforms like Hireabble can streamline the job search with swipe-based matching. "
            f"{style_instructions}"
        )
    elif page_type == "salary_guide":
        title = f"{role} Salary in {city} (2025-2026)"
        prompt = (
            f"Write a detailed salary guide for {role} positions in {city}, {country}. "
            f"Break down compensation by experience level: "
            f"junior/entry-level {salary['junior']} {currency}, "
            f"mid-level {salary['mid']} {currency}, senior {salary['senior']} {currency}. "
            f"Cover factors that affect pay (company size, industry, certifications), "
            f"cost of living considerations in {city}, benefits packages, and negotiation tips. "
            f"Compare briefly with nearby cities. "
            f"{style_instructions}"
        )
    elif page_type == "career_guide":
        title = f"How to Become a {role} in {city}"
        prompt = (
            f"Write a practical career guide on becoming a {role} in {city}, {country}. "
            f"Cover required education and certifications, typical career path, "
            f"local schools or training programs, licensing requirements specific to "
            f"{'the province' if country == 'Canada' else 'the state'}, "
            f"and expected salary progression: junior {salary['junior']} {currency}, "
            f"mid-level {salary['mid']} {currency}, senior {salary['senior']} {currency}. "
            f"Include networking tips and local professional associations. "
            f"Mention how Hireabble connects job seekers with employers through swipe-based matching. "
            f"{style_instructions}"
        )
    elif page_type == "interview_prep":
        title = f"{role} Interview Questions & Tips"
        prompt = (
            f"Write an interview preparation guide for {role} positions, "
            f"tailored to the {city}, {country} job market. "
            f"Include 8-10 common interview questions with guidance on strong answers. "
            f"Cover both technical and behavioral questions. "
            f"Add tips on researching {city}-based employers, salary negotiation "
            f"(typical range: {salary['mid']} {currency} mid-level), "
            f"and what hiring managers in {city} specifically look for. "
            f"{style_instructions}"
        )
    elif page_type == "resume_tips":
        title = f"How to Write a {role} Resume in {city} (2025-2026)"
        prompt = (
            f"Write a practical resume writing guide for {role} positions in {city}, {country}. "
            f"Cover the best resume format, must-include sections, and keywords that ATS systems "
            f"and {city} recruiters look for. Include specific skills to highlight, "
            f"how to quantify achievements, and common resume mistakes. "
            f"Reference the salary range (mid-level {salary['mid']} {currency}) so readers "
            f"understand the caliber of resume needed. "
            f"Mention how Hireabble's swipe-based job matching removes some resume friction. "
            f"{style_instructions}"
        )
    elif page_type == "cover_letter_guide":
        title = f"{role} Cover Letter Template for {city} Jobs"
        prompt = (
            f"Write a cover letter guide for {role} job applications in {city}, {country}. "
            f"Include 2-3 sample opening paragraphs, body paragraph frameworks, and closings. "
            f"Cover the right tone for {city}'s job market, how to research the company, "
            f"and what hiring managers look for in {role} cover letters. "
            f"Explain when a cover letter matters and when it doesn't. "
            f"Include tips on customization and common mistakes to avoid. "
            f"{style_instructions}"
        )
    elif page_type == "cost_of_living":
        title = f"Can You Afford to Live in {city} as a {role}? (2025-2026)"
        prompt = (
            f"Write a cost of living analysis for {role} professionals in {city}, {country}. "
            f"Break down major expenses: rent/housing, transportation, food, taxes, and utilities. "
            f"Compare the {role} salary range (junior {salary['junior']}, mid {salary['mid']}, "
            f"senior {salary['senior']} {currency}) against these costs. "
            f"Cover affordable neighborhoods, commute trade-offs, and savings potential "
            f"at each career stage. Compare {city}'s affordability to similar cities. "
            f"Be honest about the financial reality — don't sugarcoat it. "
            f"{style_instructions}"
        )
    elif page_type == "skills_guide":
        title = f"Top Skills You Need as a {role} in {city} (2025-2026)"
        prompt = (
            f"Write a skills guide for {role} professionals in {city}, {country}. "
            f"Break down the must-have technical skills, nice-to-have skills, and soft skills "
            f"that {city} employers are hiring for right now. "
            f"Cover where to learn each skill (courses, bootcamps, certifications), "
            f"how long it takes to become proficient, and which skills command the highest "
            f"salary premium (senior range: {salary['senior']} {currency}). "
            f"Include emerging skills and trends specific to the {city} market. "
            f"{style_instructions}"
        )
    elif page_type == "day_in_life":
        title = f"A Day in the Life of a {role} in {city}"
        prompt = (
            f"Write a narrative 'day in the life' article about working as a {role} in {city}, {country}. "
            f"Walk through a typical workday: morning routine, commute, key tasks, meetings, "
            f"lunch, afternoon work, and end of day. Include realistic details about the {city} "
            f"lifestyle — neighborhoods, transit, weather, work culture. "
            f"Cover how the day differs for junior vs. senior {role}s. "
            f"Be authentic and specific — include both the rewarding parts and the challenges. "
            f"Mention typical compensation ({salary['mid']} {currency} mid-level) for context. "
            f"{style_instructions}"
        )
    elif page_type == "salary_negotiation":
        title = f"How to Negotiate Your {role} Salary in {city}"
        prompt = (
            f"Write a salary negotiation guide for {role} professionals in {city}, {country}. "
            f"Include specific negotiation scripts and phrases. Cover when to negotiate "
            f"(new offer vs. annual review), how to research market rates, and what leverage "
            f"points work best in {city}'s job market. "
            f"Reference the salary range: junior {salary['junior']}, mid {salary['mid']}, "
            f"senior {salary['senior']} {currency}. "
            f"Cover non-salary negotiation items (remote work, signing bonus, equity, PTO). "
            f"Include what to do if they say 'the salary is non-negotiable.' "
            f"Mention how knowing your market value on platforms like Hireabble helps negotiation. "
            f"{style_instructions}"
        )
    # ==================== TIER 2 ====================
    elif page_type == "remote_work_guide":
        title = f"Remote {role} Jobs: A Guide for {city} Professionals"
        prompt = (
            f"Write a guide about remote {role} jobs for professionals based in {city}, {country}. "
            f"Cover remote job availability, which {city} employers offer remote {role} positions, "
            f"salary adjustments for remote work (base range: {salary['mid']} {currency} mid-level), "
            f"home office setup tips, and tax implications of working remotely. "
            f"Discuss the pros and cons of remote vs. hybrid vs. in-office for {role}s in {city}. "
            f"Mention how Hireabble helps find remote-friendly positions. "
            f"{style_instructions}"
        )
    elif page_type == "entry_level_guide":
        title = f"Entry-Level {role} Jobs in {city}: How to Get Started"
        prompt = (
            f"Write a guide for getting an entry-level {role} job in {city}, {country}. "
            f"Cover what employers expect from new {role}s, required education and training, "
            f"internship and apprenticeship pathways, and realistic first-year salary expectations "
            f"({salary['junior']} {currency} entry-level). "
            f"Include tips on building a portfolio or getting experience without a job, "
            f"local training programs and bootcamps in {city}, and networking advice. "
            f"Be encouraging but honest about the competitive landscape. "
            f"{style_instructions}"
        )
    elif page_type == "freelance_guide":
        title = f"Freelance {role} in {city}: Rates, Clients & Getting Started"
        prompt = (
            f"Write a freelance guide for {role} professionals in {city}, {country}. "
            f"Cover setting hourly/project rates (derive from annual salary: "
            f"mid-level {salary['mid']} {currency} ÷ 2080 hours × 1.3 freelance premium), "
            f"finding clients in {city}, legal structure (sole proprietor vs. corporation), "
            f"tax obligations, invoicing, and managing feast-or-famine income cycles. "
            f"Include where to find freelance work and local coworking spaces. "
            f"{style_instructions}"
        )
    elif page_type == "certification_guide":
        title = f"Best Certifications for {role} in {country} (2025-2026)"
        prompt = (
            f"Write a certification guide for {role} professionals in {country}. "
            f"List the most valuable certifications, their costs, study time required, "
            f"pass rates, and the salary impact of each (senior {role}s earn {salary['senior']} {currency}). "
            f"Cover which certifications are required vs. nice-to-have, "
            f"where to take exams in or near {city}, employer-sponsored options, "
            f"and whether certifications actually matter for {role} hiring in {country}. "
            f"{style_instructions}"
        )
    elif page_type == "company_size_guide":
        title = f"{role} at a Startup vs Corporate in {city}: Pros, Cons & Salary"
        prompt = (
            f"Write a comparison of working as a {role} at a startup vs. a large corporation "
            f"in {city}, {country}. Cover salary differences (startups may pay less base but offer "
            f"equity; corporate range: {salary['mid']}-{salary['senior']} {currency}), "
            f"work culture, career growth speed, job security, benefits, interview processes, "
            f"and which is better at different career stages. "
            f"Include examples of startups and large employers in {city} that hire {role}s. "
            f"{style_instructions}"
        )
    elif page_type == "role_comparison":
        role2 = extra.get("role2", "Data Analyst")
        salary2 = _get_salary_range(role2, city)
        title = f"{role} vs {role2} in {city}: Salary, Skills & Career Path"
        prompt = (
            f"Write a detailed comparison of {role} vs {role2} careers in {city}, {country}. "
            f"Compare salaries: {role} earns {salary['junior']}-{salary['senior']} {currency} "
            f"while {role2} earns {salary2['junior']}-{salary2['senior']} {currency}. "
            f"Cover required skills for each, career progression, day-to-day work differences, "
            f"job availability in {city}, and which role is better for different personality types. "
            f"Include advice for someone deciding between the two paths. "
            f"{style_instructions}"
        )
    elif page_type == "industry_guide":
        industry = extra.get("industry", "Technology")
        title = f"{role} Jobs in {industry} in {city}: What to Expect"
        prompt = (
            f"Write a guide about working as a {role} in the {industry} industry in {city}, {country}. "
            f"Cover how {industry} affects the {role} role: salary premiums or adjustments "
            f"(base range: {salary['mid']} {currency}), domain-specific skills needed, "
            f"top {industry} employers in {city}, company culture, career growth paths, "
            f"and what makes {industry} different from other sectors for {role}s. "
            f"Mention how Hireabble can help find industry-specific positions. "
            f"{style_instructions}"
        )
    # ==================== TIER 3 ====================
    elif page_type == "neighborhood_guide":
        title = f"Best Neighborhoods in {city} for {role} Professionals"
        prompt = (
            f"Write a neighborhood guide for {role} professionals in {city}, {country}. "
            f"Cover 5-7 neighborhoods: rent ranges, commute times to major employment areas, "
            f"lifestyle amenities, transit access, safety, and walkability. "
            f"Factor in the {role} salary range ({salary['junior']}-{salary['senior']} {currency}) "
            f"when discussing affordability. Recommend the best neighborhood for different budgets. "
            f"Include up-and-coming areas and neighborhoods to avoid. "
            f"{style_instructions}"
        )
    elif page_type == "company_hiring":
        title = f"Top Companies Hiring {role}s in {city} (2025-2026)"
        prompt = (
            f"Write about the top 10-15 companies actively hiring {role}s in {city}, {country}. "
            f"For each, cover: what they do, typical {role} salary range, company culture, "
            f"interview process, benefits, and growth opportunities. "
            f"Include a mix of large corporations, mid-size companies, and fast-growing startups. "
            f"Salary context: {role}s in {city} earn {salary['junior']}-{salary['senior']} {currency}. "
            f"Mention how Hireabble's swipe-based matching can connect you with these employers. "
            f"{style_instructions}"
        )
    elif page_type == "visa_immigration":
        title = f"How to Get a {role} Job in {city} as an Immigrant"
        visa_type = "Express Entry, Provincial Nominee Program (PNP), and LMIA" if country == "Canada" else "H-1B, O-1, TN, and EB visa categories"
        title_code = "NOC" if country == "Canada" else "SOC"
        prompt = (
            f"Write an immigration guide for {role} professionals moving to {city}, {country}. "
            f"Cover the visa process ({visa_type}), {title_code} classification codes, "
            f"credential recognition and equivalency, processing times and costs, "
            f"employers in {city} that sponsor {role} visas, salary expectations "
            f"({salary['mid']} {currency} mid-level), settlement resources, "
            f"and community organizations for newcomers. "
            f"Be practical and specific about the step-by-step process. "
            f"{style_instructions}"
        )
    elif page_type == "career_transition":
        role2 = extra.get("role2", "Project Manager")
        salary2 = _get_salary_range(role2, city)
        title = f"Career Change: From {role} to {role2} in {city}"
        prompt = (
            f"Write a career transition guide for {role}s switching to {role2} in {city}, {country}. "
            f"Cover transferable skills, skill gaps to fill, retraining options and timeline, "
            f"salary impact ({role}: {salary['mid']} → {role2}: {salary2['mid']} {currency}), "
            f"how to position your {role} experience on a {role2} resume, "
            f"local training programs in {city}, and realistic timeline expectations. "
            f"Include networking strategies and bridge roles that ease the transition. "
            f"{style_instructions}"
        )
    elif page_type == "technology_stack":
        technology = extra.get("technology", "Python")
        title = f"{technology} Jobs in {city}: Salary & Demand (2025-2026)"
        prompt = (
            f"Write a guide about {technology} jobs in {city}, {country}. "
            f"Cover demand for {technology} skills, which roles use it most, "
            f"salary premiums for {technology} expertise, top employers in {city} "
            f"that use {technology}, learning resources (courses, bootcamps, communities), "
            f"and career paths for {technology} specialists. "
            f"Include both junior and senior salary expectations. "
            f"Mention how Hireabble can help find {technology}-focused positions. "
            f"{style_instructions}"
        )
    elif page_type == "city_comparison":
        city2 = extra.get("city2", "Vancouver")
        country2 = _get_country(city2)
        salary2 = _get_salary_range(role, city2)
        title = f"{role} in {city} vs {city2}: Salary, Cost of Living & Career"
        prompt = (
            f"Write a comparison of working as a {role} in {city} ({country}) vs {city2} ({country2}). "
            f"Compare salaries: {city} {salary['junior']}-{salary['senior']} {currency} vs "
            f"{city2} {salary2['junior']}-{salary2['senior']} {salary2['currency']}. "
            f"Cover cost of living (rent, transit, food, taxes), job market strength, "
            f"career growth opportunities, lifestyle and culture, weather, and immigration factors. "
            f"Give a clear recommendation for different career stages and priorities. "
            f"{style_instructions}"
        )
    elif page_type == "annual_job_market":
        title = f"{city} Job Market Report 2026: Hiring Trends, Salaries & Top Industries"
        prompt = (
            f"Write a comprehensive job market report for {city}, {country} for 2026. "
            f"Cover top hiring industries, unemployment trends, salary growth across major roles, "
            f"which sectors are booming and which are contracting, remote work trends, "
            f"major employers expanding or downsizing, impact of AI and automation, "
            f"and advice for job seekers in {city}'s current market. "
            f"Include specific numbers and data points where possible. "
            f"Mention how Hireabble helps job seekers navigate the {city} market. "
            f"{style_instructions}"
        )
    else:
        raise ValueError(f"Unknown page_type: {page_type}")

    return title, prompt


async def _call_claude(prompt: str) -> str:
    """Call Claude API with model fallback chain."""
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY not configured")

    client = anthropic.Anthropic(api_key=api_key)
    models = [
        "claude-sonnet-4-20250514",
        "claude-3-5-sonnet-20241022",
        "claude-3-haiku-20240307",
    ]

    last_error = None
    for model in models:
        try:
            response = await asyncio.to_thread(
                client.messages.create,
                model=model,
                max_tokens=2000,
                messages=[{"role": "user", "content": prompt}],
            )
            return response.content[0].text
        except Exception as e:
            last_error = e
            logger.warning(f"Claude model {model} failed: {e}, trying next...")
            continue

    raise RuntimeError(f"All Claude models failed. Last error: {last_error}")


def _generate_combinations(page_type: str, cities: list, roles: list, extras: dict = None) -> list:
    """Generate all (city, role, extra_dims) tuples for a page type.

    Returns a list of tuples: (city, role, extra_dict).
    For multi-dimension types, the extra_dict contains the additional field(s).
    """
    extras = extras or {}
    dim_type = MULTI_DIM_PAGE_TYPES.get(page_type)

    if dim_type == "role2":
        # Use curated pairs for role_comparison or career_transition
        pairs = ROLE_COMPARISON_PAIRS if page_type == "role_comparison" else CAREER_TRANSITION_PAIRS
        # Filter to selected roles if any
        role_set = set(roles) if roles else set(ROLES)
        combos = []
        for city in cities:
            for r1, r2 in pairs:
                if r1 in role_set or r2 in role_set:
                    combos.append((city, r1, {"role2": r2}))
        return combos

    elif dim_type == "industry":
        industries = extras.get("industries", INDUSTRIES)
        combos = []
        for city in cities:
            for role in roles:
                for industry in industries:
                    combos.append((city, role, {"industry": industry}))
        return combos

    elif dim_type == "technology":
        technologies = extras.get("technologies", TECHNOLOGIES)
        combos = []
        for city in cities:
            for tech in technologies:
                combos.append((city, None, {"technology": tech}))
        return combos

    elif dim_type == "city2":
        # Use curated city pairs, filtered to selected cities
        city_set = set(cities) if cities else set(ALL_CITIES)
        combos = []
        for c1, c2 in CITY_COMPARISON_PAIRS:
            if c1 in city_set or c2 in city_set:
                for role in roles:
                    combos.append((c1, role, {"city2": c2}))
        return combos

    elif dim_type == "city_only":
        # annual_job_market: city only, no role
        return [(city, None, {}) for city in cities]

    else:
        # Standard city × role
        return [(city, role, {}) for city in cities for role in roles]


def _build_dedup_query(page_type: str, city: str, role: str, extra: dict = None) -> dict:
    """Build the MongoDB dedup query for a given combination."""
    extra = extra or {}
    query = {"page_type": page_type, "city": city}
    if role:
        query["role"] = role
    for key in ("role2", "industry", "technology", "city2"):
        if key in extra:
            query[key] = extra[key]
    return query


async def run_generation_job(job_id: str):
    """Background task that generates blog posts for a job."""
    _running_jobs[job_id] = True
    try:
        job = await db.blog_jobs.find_one({"id": job_id})
        if not job:
            logger.error(f"Blog generation job {job_id} not found")
            return

        page_type = job["page_type"]
        cities = job["cities"]
        roles = job.get("roles", [])
        extras = job.get("extras", {})
        error_log = []

        await db.blog_jobs.update_one(
            {"id": job_id},
            {"$set": {"status": "running", "started_at": datetime.now(timezone.utc).isoformat()}}
        )

        combos = _generate_combinations(page_type, cities, roles, extras)

        # Update total to reflect actual combos (may differ from initial estimate)
        await db.blog_jobs.update_one(
            {"id": job_id},
            {"$set": {"total": len(combos)}}
        )

        completed = 0
        failed = 0
        skipped = 0

        for city, role, extra in combos:
            # Check for cancellation
            if not _running_jobs.get(job_id, False):
                await db.blog_jobs.update_one(
                    {"id": job_id},
                    {"$set": {
                        "status": "cancelled",
                        "completed": completed,
                        "failed": failed,
                        "skipped": skipped,
                        "error_log": error_log,
                        "completed_at": datetime.now(timezone.utc).isoformat(),
                    }}
                )
                logger.info(f"Blog generation job {job_id} cancelled")
                return

            # Duplicate prevention
            dedup_query = _build_dedup_query(page_type, city, role, extra)
            existing_post = await db.blog_posts.find_one(dedup_query)
            if existing_post:
                skipped += 1
                await db.blog_jobs.update_one(
                    {"id": job_id},
                    {"$set": {"completed": completed, "failed": failed, "skipped": skipped}}
                )
                continue

            try:
                title, prompt = _build_prompt(page_type, city, role, extra)
                content = await _call_claude(prompt)
                slug = _slugify(title)

                # Check for duplicate slug, append uuid fragment if needed
                existing_slug = await db.blog_posts.find_one({"slug": slug})
                if existing_slug:
                    slug = f"{slug}-{uuid.uuid4().hex[:6]}"

                # Extract first paragraph as excerpt
                lines = [l.strip() for l in content.split('\n') if l.strip() and not l.strip().startswith('#')]
                excerpt = lines[0][:200] if lines else title

                word_count = len(content.split())

                post_doc = {
                    "id": str(uuid.uuid4()),
                    "slug": slug,
                    "title": title,
                    "content": content,
                    "excerpt": excerpt,
                    "page_type": page_type,
                    "city": city,
                    "role": role,
                    "country": _get_country(city),
                    "status": "draft",
                    "meta_title": title,
                    "meta_description": excerpt,
                    "word_count": word_count,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                    "published_at": None,
                    "generation_job_id": job_id,
                }
                # Add extra dimension fields to the document
                for key in ("role2", "industry", "technology", "city2"):
                    if key in extra:
                        post_doc[key] = extra[key]

                await db.blog_posts.insert_one(post_doc)
                completed += 1

            except Exception as e:
                failed += 1
                label = f"{city}/{role or 'N/A'}"
                if extra:
                    label += f"/{'/'.join(str(v) for v in extra.values())}"
                error_msg = f"{label}: {str(e)}"
                error_log.append(error_msg)
                logger.error(f"Blog generation error in job {job_id}: {error_msg}")

            # Update job progress
            await db.blog_jobs.update_one(
                {"id": job_id},
                {"$set": {"completed": completed, "failed": failed, "skipped": skipped, "error_log": error_log}}
            )

            # Rate limit between API calls
            await asyncio.sleep(0.5)

        # Job finished
        final_status = "completed" if failed == 0 else "completed_with_errors"
        await db.blog_jobs.update_one(
            {"id": job_id},
            {"$set": {
                "status": final_status,
                "completed": completed,
                "failed": failed,
                "skipped": skipped,
                "error_log": error_log,
                "completed_at": datetime.now(timezone.utc).isoformat(),
            }}
        )
        logger.info(f"Blog generation job {job_id} finished: {completed} completed, {failed} failed, {skipped} skipped")

    except Exception as e:
        logger.error(f"Blog generation job {job_id} crashed: {e}")
        await db.blog_jobs.update_one(
            {"id": job_id},
            {"$set": {
                "status": "failed",
                "error_log": [str(e)],
                "completed_at": datetime.now(timezone.utc).isoformat(),
            }}
        )
    finally:
        _running_jobs.pop(job_id, None)


# ==================== ENDPOINTS ====================

@router.get("/admin/blog/stats")
async def blog_stats(admin=Depends(get_current_admin)):
    """Return blog post counts and running job info."""
    total = await db.blog_posts.count_documents({})
    published = await db.blog_posts.count_documents({"status": "published"})
    draft = await db.blog_posts.count_documents({"status": "draft"})
    failed = await db.blog_posts.count_documents({"status": "failed"})
    running_jobs = await db.blog_jobs.count_documents({"status": "running"})

    return {
        "total": total,
        "published": published,
        "draft": draft,
        "failed": failed,
        "running_jobs": running_jobs,
        "available_cities": len(ALL_CITIES),
        "available_roles": len(ROLES),
        "page_types": PAGE_TYPES,
        "industries": INDUSTRIES,
        "technologies": TECHNOLOGIES,
    }


@router.get("/admin/blog/posts")
async def list_blog_posts(
    request: Request,
    page: int = 1,
    limit: int = 20,
    q: Optional[str] = None,
    status: Optional[str] = None,
    page_type: Optional[str] = None,
    city: Optional[str] = None,
    role: Optional[str] = None,
    admin=Depends(get_current_admin),
):
    """List blog posts with pagination, search, and filters."""
    query = {}

    if q:
        query["$or"] = [
            {"title": {"$regex": q, "$options": "i"}},
            {"slug": {"$regex": q, "$options": "i"}},
            {"city": {"$regex": q, "$options": "i"}},
            {"role": {"$regex": q, "$options": "i"}},
        ]
    if status:
        query["status"] = status
    if page_type:
        query["page_type"] = page_type
    if city:
        query["city"] = city
    if role:
        query["role"] = role

    skip = (page - 1) * limit
    total = await db.blog_posts.count_documents(query)
    posts = await db.blog_posts.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(length=limit)

    return {
        "posts": posts,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit if limit > 0 else 0,
    }


@router.get("/admin/blog/posts/{post_id}")
async def get_blog_post(post_id: str, admin=Depends(get_current_admin)):
    """Get a single blog post by ID."""
    post = await db.blog_posts.find_one({"id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Blog post not found")
    return post


@router.put("/admin/blog/posts/{post_id}")
async def update_blog_post(post_id: str, request: Request, admin=Depends(get_current_admin)):
    """Update a blog post's editable fields."""
    post = await db.blog_posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Blog post not found")

    body = await request.json()
    allowed_fields = {"title", "content", "slug", "status", "meta_title", "meta_description", "excerpt"}
    updates = {k: v for k, v in body.items() if k in allowed_fields}

    if not updates:
        raise HTTPException(status_code=400, detail="No valid fields to update")

    if "content" in updates:
        updates["word_count"] = len(updates["content"].split())

    updates["updated_at"] = datetime.now(timezone.utc).isoformat()

    await db.blog_posts.update_one({"id": post_id}, {"$set": updates})
    updated = await db.blog_posts.find_one({"id": post_id}, {"_id": 0})
    return updated


@router.delete("/admin/blog/posts/{post_id}")
async def delete_blog_post(post_id: str, admin=Depends(get_current_admin)):
    """Delete a blog post."""
    result = await db.blog_posts.delete_one({"id": post_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Blog post not found")
    return {"deleted": True}


@router.post("/admin/blog/generate")
@limiter.limit("5/hour")
async def start_generation(request: Request, admin=Depends(get_current_admin)):
    """Start a batch blog post generation job."""
    body = await request.json()
    page_type = body.get("page_type")
    cities = body.get("cities", [])
    roles = body.get("roles", [])
    extras = body.get("extras", {})  # Optional: {industries: [], technologies: []}

    if not page_type or page_type not in PAGE_TYPES:
        raise HTTPException(status_code=400, detail=f"page_type must be one of: {PAGE_TYPES}")
    if not cities:
        raise HTTPException(status_code=400, detail="At least one city is required")

    dim_type = MULTI_DIM_PAGE_TYPES.get(page_type)

    # Roles not required for city-only or technology page types
    if dim_type not in ("city_only", "technology") and not roles:
        raise HTTPException(status_code=400, detail="At least one role is required")

    # Validate cities and roles
    invalid_cities = [c for c in cities if c not in ALL_CITIES]
    if invalid_cities:
        raise HTTPException(status_code=400, detail=f"Invalid cities: {invalid_cities}")
    if roles:
        invalid_roles = [r for r in roles if r not in ROLES]
        if invalid_roles:
            raise HTTPException(status_code=400, detail=f"Invalid roles: {invalid_roles}")

    # Calculate total based on page type
    combos = _generate_combinations(page_type, cities, roles, extras)
    total = len(combos)
    job_id = str(uuid.uuid4())

    job_doc = {
        "id": job_id,
        "page_type": page_type,
        "cities": cities,
        "roles": roles,
        "extras": extras,
        "total": total,
        "completed": 0,
        "failed": 0,
        "skipped": 0,
        "status": "pending",
        "started_at": None,
        "completed_at": None,
        "error_log": [],
    }
    await db.blog_jobs.insert_one(job_doc)

    # Spawn background task
    asyncio.create_task(run_generation_job(job_id))

    return {"job_id": job_id, "total": total, "status": "pending"}


@router.get("/admin/blog/jobs")
async def list_generation_jobs(admin=Depends(get_current_admin)):
    """List all generation jobs, most recent first."""
    jobs = await db.blog_jobs.find({}, {"_id": 0}).sort("started_at", -1).to_list(length=100)
    return {"jobs": jobs}


@router.post("/admin/blog/jobs/{job_id}/cancel")
async def cancel_generation_job(job_id: str, admin=Depends(get_current_admin)):
    """Cancel a running generation job."""
    job = await db.blog_jobs.find_one({"id": job_id})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job["status"] not in ("pending", "running"):
        raise HTTPException(status_code=400, detail=f"Cannot cancel job with status '{job['status']}'")

    # Signal the background task to stop
    _running_jobs[job_id] = False

    return {"cancelled": True, "job_id": job_id}


@router.post("/admin/blog/posts/{post_id}/publish")
async def publish_post(post_id: str, admin=Depends(get_current_admin)):
    """Publish a single blog post."""
    post = await db.blog_posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Blog post not found")

    now = datetime.now(timezone.utc).isoformat()
    await db.blog_posts.update_one(
        {"id": post_id},
        {"$set": {"status": "published", "published_at": now, "updated_at": now}}
    )

    return {"published": True, "post_id": post_id, "published_at": now}


@router.post("/admin/blog/bulk-publish")
async def bulk_publish(request: Request, admin=Depends(get_current_admin)):
    """Publish multiple blog posts at once."""
    body = await request.json()
    post_ids = body.get("post_ids", [])

    if not post_ids:
        raise HTTPException(status_code=400, detail="post_ids is required and cannot be empty")

    now = datetime.now(timezone.utc).isoformat()
    result = await db.blog_posts.update_many(
        {"id": {"$in": post_ids}, "status": {"$ne": "published"}},
        {"$set": {"status": "published", "published_at": now, "updated_at": now}}
    )

    return {"published_count": result.modified_count, "post_ids": post_ids}


# ==================== PUBLIC BLOG ENDPOINTS ====================

@router.get("/blog/posts")
@limiter.limit("30/minute")
async def public_list_posts(
    request: Request,
    page: int = 1,
    limit: int = 12,
    page_type: Optional[str] = None,
    city: Optional[str] = None,
    role: Optional[str] = None,
):
    """Public: list published blog posts with pagination and filters."""
    query = {"status": "published"}
    if page_type:
        query["page_type"] = page_type
    if city:
        query["city"] = city
    if role:
        query["role"] = role

    limit = min(limit, 50)  # Cap at 50 per page
    skip = (page - 1) * limit
    total = await db.blog_posts.count_documents(query)
    posts = await db.blog_posts.find(
        query,
        {"_id": 0, "content": 0, "generation_job_id": 0}  # Exclude full content from list
    ).sort("published_at", -1).skip(skip).limit(limit).to_list(length=limit)

    return {
        "posts": posts,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit if limit > 0 else 0,
    }


@router.get("/blog/posts/{slug}")
@limiter.limit("60/minute")
async def public_get_post(slug: str, request: Request):
    """Public: get a single published blog post by slug."""
    post = await db.blog_posts.find_one(
        {"slug": slug, "status": "published"},
        {"_id": 0, "generation_job_id": 0}
    )
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    # Fetch related posts (same city or same role, max 3)
    related_query = {
        "status": "published",
        "slug": {"$ne": slug},
        "$or": [
            {"city": post.get("city"), "page_type": post.get("page_type")},
            {"role": post.get("role"), "page_type": post.get("page_type")},
        ]
    }
    related = await db.blog_posts.find(
        related_query,
        {"_id": 0, "content": 0, "generation_job_id": 0}
    ).limit(3).to_list(length=3)

    post["related_posts"] = related
    return post
