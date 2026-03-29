"""Skill assessment quizzes and verification badges."""

import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from database import db, get_current_user

router = APIRouter(tags=["skills"])


# ==================== MODELS ====================

class QuizQuestion(BaseModel):
    question: str
    options: List[str]
    correct_index: int


class QuizSubmission(BaseModel):
    answers: List[int]  # indices of selected options


# ==================== SEED DATA ====================

SEED_QUIZZES = [
    {
        "id": "quiz_javascript",
        "skill_name": "JavaScript",
        "category": "technology",
        "time_limit_seconds": 120,
        "questions": [
            {
                "question": "What does 'typeof null' return in JavaScript?",
                "options": ["'null'", "'undefined'", "'object'", "'boolean'"],
                "correct_index": 2,
            },
            {
                "question": "Which method creates a new array with the results of calling a function on every element?",
                "options": [".forEach()", ".map()", ".filter()", ".reduce()"],
                "correct_index": 1,
            },
            {
                "question": "What is the output of: console.log(0.1 + 0.2 === 0.3)?",
                "options": ["true", "false", "undefined", "TypeError"],
                "correct_index": 1,
            },
            {
                "question": "Which keyword declares a block-scoped variable that can be reassigned?",
                "options": ["var", "let", "const", "static"],
                "correct_index": 1,
            },
            {
                "question": "What does the 'await' keyword do?",
                "options": [
                    "Pauses execution until a Promise settles",
                    "Creates a new thread",
                    "Delays execution by a set time",
                    "Catches errors in async code",
                ],
                "correct_index": 0,
            },
        ],
    },
    {
        "id": "quiz_python",
        "skill_name": "Python",
        "category": "technology",
        "time_limit_seconds": 120,
        "questions": [
            {
                "question": "What is the output of: print(type([]))?",
                "options": ["<class 'tuple'>", "<class 'list'>", "<class 'array'>", "<class 'set'>"],
                "correct_index": 1,
            },
            {
                "question": "Which of these is NOT a valid Python data structure?",
                "options": ["dict", "set", "array", "tuple"],
                "correct_index": 2,
            },
            {
                "question": "What does 'self' refer to in a Python class method?",
                "options": [
                    "The class itself",
                    "The current instance of the class",
                    "The parent class",
                    "A global variable",
                ],
                "correct_index": 1,
            },
            {
                "question": "Which statement is used for exception handling in Python?",
                "options": ["catch/throw", "try/except", "if/else", "do/while"],
                "correct_index": 1,
            },
            {
                "question": "What is a list comprehension?",
                "options": [
                    "A way to sort lists",
                    "A concise way to create lists from iterables",
                    "A method to delete list items",
                    "A way to merge two lists",
                ],
                "correct_index": 1,
            },
        ],
    },
    {
        "id": "quiz_react",
        "skill_name": "React",
        "category": "technology",
        "time_limit_seconds": 120,
        "questions": [
            {
                "question": "What hook is used to manage state in a functional component?",
                "options": ["useEffect", "useState", "useContext", "useReducer"],
                "correct_index": 1,
            },
            {
                "question": "What is the virtual DOM?",
                "options": [
                    "A direct copy of the browser DOM",
                    "A lightweight JavaScript representation of the real DOM",
                    "A CSS framework",
                    "A server-side rendering technique",
                ],
                "correct_index": 1,
            },
            {
                "question": "Which hook runs side effects after render?",
                "options": ["useState", "useMemo", "useEffect", "useCallback"],
                "correct_index": 2,
            },
            {
                "question": "What is the purpose of 'key' prop in lists?",
                "options": [
                    "To style list items",
                    "To help React identify which items changed",
                    "To sort list items",
                    "To filter list items",
                ],
                "correct_index": 1,
            },
            {
                "question": "What does JSX stand for?",
                "options": [
                    "JavaScript XML",
                    "Java Syntax Extension",
                    "JSON Extra",
                    "JavaScript Extension",
                ],
                "correct_index": 0,
            },
        ],
    },
    {
        "id": "quiz_sql",
        "skill_name": "SQL",
        "category": "technology",
        "time_limit_seconds": 120,
        "questions": [
            {
                "question": "Which SQL clause is used to filter rows?",
                "options": ["SELECT", "FROM", "WHERE", "ORDER BY"],
                "correct_index": 2,
            },
            {
                "question": "What type of JOIN returns all rows from both tables?",
                "options": ["INNER JOIN", "LEFT JOIN", "RIGHT JOIN", "FULL OUTER JOIN"],
                "correct_index": 3,
            },
            {
                "question": "Which function counts the number of rows?",
                "options": ["SUM()", "COUNT()", "TOTAL()", "NUM()"],
                "correct_index": 1,
            },
            {
                "question": "What does 'GROUP BY' do?",
                "options": [
                    "Sorts results",
                    "Filters results",
                    "Groups rows sharing a property for aggregate functions",
                    "Joins two tables",
                ],
                "correct_index": 2,
            },
            {
                "question": "Which keyword removes duplicate rows from results?",
                "options": ["UNIQUE", "DISTINCT", "DIFFERENT", "SINGLE"],
                "correct_index": 1,
            },
        ],
    },
    {
        "id": "quiz_marketing",
        "skill_name": "Digital Marketing",
        "category": "marketing",
        "time_limit_seconds": 120,
        "questions": [
            {
                "question": "What does SEO stand for?",
                "options": [
                    "Social Engagement Optimization",
                    "Search Engine Optimization",
                    "Site Experience Optimization",
                    "Search Email Outreach",
                ],
                "correct_index": 1,
            },
            {
                "question": "What is a 'conversion rate'?",
                "options": [
                    "The rate at which visitors leave a site",
                    "The percentage of visitors who complete a desired action",
                    "The speed of page loading",
                    "The number of social media shares",
                ],
                "correct_index": 1,
            },
            {
                "question": "What does CPC stand for in advertising?",
                "options": [
                    "Cost Per Conversion",
                    "Click Per Customer",
                    "Cost Per Click",
                    "Customer Purchase Cost",
                ],
                "correct_index": 2,
            },
            {
                "question": "Which metric measures email campaign effectiveness?",
                "options": [
                    "Bounce rate",
                    "Open rate",
                    "Page views",
                    "Domain authority",
                ],
                "correct_index": 1,
            },
            {
                "question": "What is A/B testing?",
                "options": [
                    "Testing site security",
                    "Comparing two versions to see which performs better",
                    "Testing across different browsers",
                    "Testing API endpoints",
                ],
                "correct_index": 1,
            },
        ],
    },
    {
        "id": "quiz_design",
        "skill_name": "UI/UX Design",
        "category": "design",
        "time_limit_seconds": 120,
        "questions": [
            {
                "question": "What does UX stand for?",
                "options": [
                    "User Experience",
                    "Universal Exchange",
                    "User Extension",
                    "Unified Experience",
                ],
                "correct_index": 0,
            },
            {
                "question": "What is a wireframe?",
                "options": [
                    "A final design mockup",
                    "A basic structural layout of a page",
                    "A coded prototype",
                    "A brand style guide",
                ],
                "correct_index": 1,
            },
            {
                "question": "What principle suggests related items should be grouped together?",
                "options": ["Contrast", "Proximity", "Alignment", "Repetition"],
                "correct_index": 1,
            },
            {
                "question": "What is the purpose of a design system?",
                "options": [
                    "To write code faster",
                    "To ensure consistent UI components and patterns",
                    "To manage databases",
                    "To test user flows",
                ],
                "correct_index": 1,
            },
            {
                "question": "What is 'responsive design'?",
                "options": [
                    "Design that responds to user feedback",
                    "Design that adapts to different screen sizes",
                    "Design that loads quickly",
                    "Design with animations",
                ],
                "correct_index": 1,
            },
        ],
    },
    {
        "id": "quiz_data_analysis",
        "skill_name": "Data Analysis",
        "category": "technology",
        "time_limit_seconds": 120,
        "questions": [
            {
                "question": "What is the median of the set {3, 7, 1, 9, 5}?",
                "options": ["3", "5", "7", "9"],
                "correct_index": 1,
            },
            {
                "question": "What does a histogram display?",
                "options": [
                    "Relationship between two variables",
                    "Distribution of a single variable",
                    "Trends over time",
                    "Proportions of a whole",
                ],
                "correct_index": 1,
            },
            {
                "question": "What is a p-value in statistics?",
                "options": [
                    "The probability of the sample mean",
                    "The probability of observing results as extreme as the data, given the null hypothesis is true",
                    "The percentage of data points above the mean",
                    "The power of the test",
                ],
                "correct_index": 1,
            },
            {
                "question": "What does ETL stand for?",
                "options": [
                    "Extract, Transform, Load",
                    "Evaluate, Test, Launch",
                    "Export, Transfer, Link",
                    "Edit, Track, Log",
                ],
                "correct_index": 0,
            },
            {
                "question": "Which chart best shows proportions of a whole?",
                "options": ["Line chart", "Bar chart", "Pie chart", "Scatter plot"],
                "correct_index": 2,
            },
        ],
    },
    {
        "id": "quiz_project_management",
        "skill_name": "Project Management",
        "category": "management",
        "time_limit_seconds": 120,
        "questions": [
            {
                "question": "What does 'Agile' emphasize?",
                "options": [
                    "Rigid planning and documentation",
                    "Iterative development and flexibility",
                    "Individual work over collaboration",
                    "Long release cycles",
                ],
                "correct_index": 1,
            },
            {
                "question": "What is a 'sprint' in Scrum?",
                "options": [
                    "A long-term project goal",
                    "A time-boxed iteration (usually 1-4 weeks)",
                    "A post-mortem meeting",
                    "A type of user story",
                ],
                "correct_index": 1,
            },
            {
                "question": "What does a Gantt chart show?",
                "options": [
                    "Budget allocation",
                    "Task dependencies and timelines",
                    "Team hierarchy",
                    "Risk assessment",
                ],
                "correct_index": 1,
            },
            {
                "question": "What is 'scope creep'?",
                "options": [
                    "Reducing project scope",
                    "Uncontrolled expansion of project scope",
                    "A testing methodology",
                    "Budget overrun",
                ],
                "correct_index": 1,
            },
            {
                "question": "What is the critical path in project management?",
                "options": [
                    "The shortest sequence of tasks",
                    "The longest sequence of dependent tasks determining project duration",
                    "The most expensive tasks",
                    "Tasks assigned to the project manager",
                ],
                "correct_index": 1,
            },
        ],
    },
    {
        "id": "quiz_sales",
        "skill_name": "Sales",
        "category": "sales",
        "time_limit_seconds": 120,
        "questions": [
            {
                "question": "What does CRM stand for?",
                "options": [
                    "Customer Revenue Model",
                    "Customer Relationship Management",
                    "Client Retention Method",
                    "Customer Response Metric",
                ],
                "correct_index": 1,
            },
            {
                "question": "What is a 'sales funnel'?",
                "options": [
                    "A marketing budget tool",
                    "The journey from prospect to customer",
                    "A type of sales report",
                    "A team structure",
                ],
                "correct_index": 1,
            },
            {
                "question": "What does 'cold calling' mean?",
                "options": [
                    "Following up with existing customers",
                    "Contacting potential customers with no prior relationship",
                    "Calling during off-hours",
                    "Automated phone outreach",
                ],
                "correct_index": 1,
            },
            {
                "question": "What is 'upselling'?",
                "options": [
                    "Selling to a new market",
                    "Encouraging a customer to purchase a higher-end product",
                    "Selling below cost",
                    "Selling through partners",
                ],
                "correct_index": 1,
            },
            {
                "question": "What is the purpose of a 'discovery call'?",
                "options": [
                    "To close the deal",
                    "To understand the prospect's needs and pain points",
                    "To negotiate pricing",
                    "To onboard the customer",
                ],
                "correct_index": 1,
            },
        ],
    },
    {
        "id": "quiz_customer_service",
        "skill_name": "Customer Service",
        "category": "service",
        "time_limit_seconds": 120,
        "questions": [
            {
                "question": "What is the most important skill in customer service?",
                "options": [
                    "Technical knowledge",
                    "Active listening",
                    "Speed",
                    "Sales ability",
                ],
                "correct_index": 1,
            },
            {
                "question": "What does CSAT measure?",
                "options": [
                    "Customer Sales Activity Total",
                    "Customer Satisfaction",
                    "Customer Service Audit Time",
                    "Customer Support Access Token",
                ],
                "correct_index": 1,
            },
            {
                "question": "What is the best approach when a customer is angry?",
                "options": [
                    "Argue your point",
                    "Transfer them immediately",
                    "Acknowledge their frustration and empathize",
                    "Offer a discount right away",
                ],
                "correct_index": 2,
            },
            {
                "question": "What does NPS stand for?",
                "options": [
                    "Net Promoter Score",
                    "New Product Strategy",
                    "National Priority Service",
                    "Network Performance Standard",
                ],
                "correct_index": 0,
            },
            {
                "question": "What is 'first contact resolution'?",
                "options": [
                    "The first call of the day",
                    "Resolving a customer's issue in a single interaction",
                    "The initial onboarding call",
                    "A welcome email",
                ],
                "correct_index": 1,
            },
        ],
    },
]

PASS_THRESHOLD = 0.8  # 4/5 correct
COOLDOWN_HOURS = 24


# ==================== ENDPOINTS ====================

@router.get("/skills/quizzes")
async def list_quizzes(current_user: dict = Depends(get_current_user)):
    """List all available skill quizzes with user's completion status."""
    if current_user.get("role") != "seeker":
        raise HTTPException(status_code=403, detail="Only job seekers can take skill quizzes")

    uid = current_user["id"]

    # Get user's quiz results
    results = await db.skill_results.find(
        {"user_id": uid}, {"_id": 0}
    ).to_list(100)
    results_map = {}
    for r in results:
        skill = r["skill_name"]
        if skill not in results_map or r.get("passed"):
            results_map[skill] = r

    quizzes = []
    for q in SEED_QUIZZES:
        result = results_map.get(q["skill_name"])
        quizzes.append({
            "id": q["id"],
            "skill_name": q["skill_name"],
            "category": q["category"],
            "question_count": len(q["questions"]),
            "time_limit_seconds": q["time_limit_seconds"],
            "status": "passed" if result and result.get("passed") else (
                "attempted" if result else "available"
            ),
            "last_score": result.get("score") if result else None,
            "last_attempted": result.get("completed_at") if result else None,
        })

    return {"quizzes": quizzes}


@router.get("/skills/quizzes/{quiz_id}")
async def get_quiz(quiz_id: str, current_user: dict = Depends(get_current_user)):
    """Get quiz questions (without correct answers) for taking."""
    if current_user.get("role") != "seeker":
        raise HTTPException(status_code=403, detail="Only job seekers can take skill quizzes")

    quiz = next((q for q in SEED_QUIZZES if q["id"] == quiz_id), None)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    # Check cooldown
    uid = current_user["id"]
    last_attempt = await db.skill_results.find_one(
        {"user_id": uid, "skill_name": quiz["skill_name"], "passed": {"$ne": True}},
        sort=[("completed_at", -1)],
    )
    if last_attempt:
        last_time = last_attempt.get("completed_at", "")
        try:
            last_dt = datetime.fromisoformat(last_time.replace("Z", "+00:00"))
            cooldown_end = last_dt + timedelta(hours=COOLDOWN_HOURS)
            if datetime.now(timezone.utc) < cooldown_end:
                raise HTTPException(
                    status_code=429,
                    detail=f"Please wait before retaking. Available after {cooldown_end.isoformat()}",
                )
        except (ValueError, TypeError):
            pass

    # Return questions without correct answers
    questions = []
    for q in quiz["questions"]:
        questions.append({
            "question": q["question"],
            "options": q["options"],
        })

    return {
        "id": quiz["id"],
        "skill_name": quiz["skill_name"],
        "category": quiz["category"],
        "time_limit_seconds": quiz["time_limit_seconds"],
        "questions": questions,
    }


@router.post("/skills/quizzes/{quiz_id}/submit")
async def submit_quiz(quiz_id: str, submission: QuizSubmission, current_user: dict = Depends(get_current_user)):
    """Submit quiz answers and get results."""
    if current_user.get("role") != "seeker":
        raise HTTPException(status_code=403, detail="Only job seekers can take skill quizzes")

    quiz = next((q for q in SEED_QUIZZES if q["id"] == quiz_id), None)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    if len(submission.answers) != len(quiz["questions"]):
        raise HTTPException(status_code=400, detail=f"Expected {len(quiz['questions'])} answers")

    # Score the quiz
    correct = sum(
        1 for i, q in enumerate(quiz["questions"])
        if i < len(submission.answers) and submission.answers[i] == q["correct_index"]
    )
    total = len(quiz["questions"])
    score = correct / total
    passed = score >= PASS_THRESHOLD

    uid = current_user["id"]
    now = datetime.now(timezone.utc).isoformat()

    # Save result
    result_doc = {
        "id": str(uuid.uuid4()),
        "user_id": uid,
        "skill_name": quiz["skill_name"],
        "quiz_id": quiz_id,
        "score": round(score * 100),
        "correct": correct,
        "total": total,
        "passed": passed,
        "completed_at": now,
    }
    await db.skill_results.insert_one(result_doc)

    # If passed, add to user's verified skills
    if passed:
        await db.users.update_one(
            {"id": uid},
            {"$addToSet": {"verified_skills": quiz["skill_name"]}},
        )

    return {
        "passed": passed,
        "score": round(score * 100),
        "correct": correct,
        "total": total,
        "skill_name": quiz["skill_name"],
        "message": f"You scored {correct}/{total}." + (
            " Skill verified!" if passed else f" You need {int(PASS_THRESHOLD * total)}/{total} to pass."
        ),
    }


@router.get("/skills/badges/{user_id}")
async def get_user_badges(user_id: str):
    """Get a user's verified skill badges (public endpoint)."""
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "verified_skills": 1})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    verified_skills = user.get("verified_skills", [])

    # Get best scores for verified skills
    badges = []
    if verified_skills:
        results = await db.skill_results.find(
            {"user_id": user_id, "passed": True, "skill_name": {"$in": verified_skills}},
            {"_id": 0},
        ).sort("completed_at", -1).to_list(50)

        seen = set()
        for r in results:
            if r["skill_name"] not in seen:
                seen.add(r["skill_name"])
                badges.append({
                    "skill_name": r["skill_name"],
                    "score": r["score"],
                    "verified_at": r["completed_at"],
                })

    return {"badges": badges, "verified_skills": verified_skills}
