TEMPLATES = [
    {
        "id": "blog-spark-ten",
        "title": "10 Blog Sparks",
        "doc_type": "blog",
        "blurb": "Fill a page with hooks you can ship this week.",
        "content": """# 10 Blog Sparks — {title}

For each idea: one-line hook, who it's for, and the promise.

1. The mistake everyone makes about…
   - Hook:
   - Reader:
   - Promise:

2. A tiny habit that quietly changed my…
   - Hook:
   - Reader:
   - Promise:

3. What I wish I knew before…
   - Hook:
   - Reader:
   - Promise:

4. A contrarian take on…
   - Hook:
   - Reader:
   - Promise:

5. Behind the scenes of…
   - Hook:
   - Reader:
   - Promise:

6. A field guide to…
   - Hook:
   - Reader:
   - Promise:

7. The story of the time I…
   - Hook:
   - Reader:
   - Promise:

8. How to start when you feel…
   - Hook:
   - Reader:
   - Promise:

9. Lessons from failing at…
   - Hook:
   - Reader:
   - Promise:

10. A letter to someone about to…
    - Hook:
    - Reader:
    - Promise:

## Pick one
Ship this week: #____
First sentence:
""",
    },
    {
        "id": "blog-arc",
        "title": "Story Arc Post",
        "doc_type": "blog",
        "blurb": "Scene, tension, turn, takeaway — built for a publishable post.",
        "content": """# {title}

## The opening scene
Where are we? What can the reader see, hear, feel?

## The itch
What problem, question, or restlessness won't leave you alone?

## The turn
What changed — a conversation, a failure, a small experiment?

## The insight
Say it in one clean sentence.

## The gift
What can the reader try in the next 24 hours?

## Soft close
Leave them with an image, not a lecture.
""",
    },
    {
        "id": "essay-braid",
        "title": "Braided Essay",
        "doc_type": "essay",
        "blurb": "Weave memory, research, and present tense into one personal essay.",
        "content": """# {title}

Strand A — Memory (present-tense scene):


Strand B — The question you still carry:


Strand C — A fact, quote, or object that won't fit neatly:


## Braid
Alternate short sections. Let the seams show.

A1.

B1.

C1.

A2.

B2.

C2.

## Landing
What is true now that wasn't true at the start?
""",
    },
    {
        "id": "essay-letter",
        "title": "Letter to Past Self",
        "doc_type": "essay",
        "blurb": "A tender, specific letter — not advice-column generic.",
        "content": """# Letter to you, {title}

Date I'm writing from:

You are in: (place, season, age)

What you think matters most right now:

What you are afraid to admit:

Three things I would put in your coat pocket:
1.
2.
3.

One apology:

One permission:

The sentence I want you to keep:
""",
    },
    {
        "id": "map-life-design",
        "title": "Life Design Map",
        "doc_type": "mindmap",
        "blurb": "A radial map for work, craft, rest, and people.",
        "content": """{"nodes":[{"id":"root","x":360,"y":240,"text":"Life design","color":"#0ea5e9"},{"id":"craft","x":160,"y":120,"text":"Craft","color":"#8b5cf6"},{"id":"work","x":560,"y":120,"text":"Work","color":"#f59e0b"},{"id":"rest","x":160,"y":360,"text":"Rest","color":"#10b981"},{"id":"people","x":560,"y":360,"text":"People","color":"#f43f5e"}],"edges":[{"from":"root","to":"craft"},{"from":"root","to":"work"},{"from":"root","to":"rest"},{"from":"root","to":"people"}]}""",
    },
    {
        "id": "map-book",
        "title": "Book / Series Outline",
        "doc_type": "mindmap",
        "blurb": "Chapters as satellites around a core argument.",
        "content": """{"nodes":[{"id":"root","x":360,"y":220,"text":"Core argument","color":"#0ea5e9"},{"id":"c1","x":120,"y":80,"text":"Ch 1 — Hook","color":"#6366f1"},{"id":"c2","x":360,"y":40,"text":"Ch 2 — World","color":"#6366f1"},{"id":"c3","x":600,"y":80,"text":"Ch 3 — Trouble","color":"#6366f1"},{"id":"c4","x":120,"y":360,"text":"Ch 4 — Turn","color":"#6366f1"},{"id":"c5","x":360,"y":400,"text":"Ch 5 — Cost","color":"#6366f1"},{"id":"c6","x":600,"y":360,"text":"Ch 6 — Gift","color":"#6366f1"}],"edges":[{"from":"root","to":"c1"},{"from":"root","to":"c2"},{"from":"root","to":"c3"},{"from":"root","to":"c4"},{"from":"root","to":"c5"},{"from":"root","to":"c6"}]}""",
    },
    {
        "id": "finance-story",
        "title": "Monthly Money Story",
        "doc_type": "finance",
        "blurb": "Narrate the month before you judge the numbers.",
        "content": """# Money story — this month

Mood of the month in one word:

## Opening balance (feelings, not just cash)
What did money represent this month? Safety, status, freedom, fear?

## The plot
Three scenes where money showed up (a purchase, a pause, a conversation):
1.
2.
3.

## What I funded on purpose
-

## What leaked without a story
-

## Next month's one sentence budget
I will spend toward ______ and starve ______.
""",
    },
    {
        "id": "finance-values",
        "title": "Values-Based Budget",
        "doc_type": "finance",
        "blurb": "Map spending to the life you say you want.",
        "content": """# Values-based budget

Top 5 values (rank them):
1.
2.
3.
4.
5.

| Category | Last month | Does it serve a value? | Keep / cut / reshape |
| --- | --- | --- | --- |
| Housing |  |  |  |
| Food |  |  |  |
| Craft / learning |  |  |  |
| People |  |  |  |
| Numbing |  |  |  |
| Future self |  |  |  |

## One experiment for 30 days
""",
    },
]
