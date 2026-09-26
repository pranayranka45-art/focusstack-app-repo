import shutil

PLAYLIST_TRACKS = [
    {
        "id": "lofi",
        "title": "Loft Hour",
        "artist": "FocusStack Radio",
        "hint": "Warm keys, slow pulse",
    },
    {
        "id": "rain",
        "title": "Window Rain",
        "artist": "Weather Desk",
        "hint": "Soft storm for long drafts",
    },
    {
        "id": "cafe",
        "title": "Corner Table",
        "artist": "Night Shift Café",
        "hint": "Cups, chairs, distant talk",
    },
    {
        "id": "forest",
        "title": "Early Trail",
        "artist": "Field Notes",
        "hint": "Birds and low wind",
    },
    {
        "id": "piano",
        "title": "Unfinished Prelude",
        "artist": "Practice Room",
        "hint": "Sparse piano",
    },
    {
        "id": "train",
        "title": "Night Express",
        "artist": "Carriage 4",
        "hint": "Rumble and rails",
    },
]


def lab_runtimes() -> list[dict]:
    java_ok = bool(shutil.which("javac") and shutil.which("java"))
    node_ok = bool(shutil.which("node"))
    return [
        {
            "id": "python",
            "label": "Python",
            "available": True,
            "hint": "Runs with the API interpreter",
        },
        {
            "id": "javascript",
            "label": "JavaScript",
            "available": node_ok,
            "hint": "Requires Node.js on PATH" if not node_ok else "Node.js is ready",
        },
        {
            "id": "java",
            "label": "Java",
            "available": java_ok,
            "hint": "Requires a JDK (javac + java)" if not java_ok else "JDK is ready",
        },
    ]
