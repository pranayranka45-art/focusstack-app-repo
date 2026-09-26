from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=schemas.DashboardStats)
def get_stats(db: Session = Depends(get_db)):
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    tasks_todo = db.query(models.Task).filter(models.Task.status == "todo").count()
    tasks_in_progress = db.query(models.Task).filter(models.Task.status == "in_progress").count()
    tasks_done = db.query(models.Task).filter(models.Task.status == "done").count()

    today_sessions = (
        db.query(models.FocusSession)
        .filter(
            models.FocusSession.completed == True,
            models.FocusSession.session_type == "focus",
            models.FocusSession.ended_at >= today_start,
        )
        .all()
    )
    focus_minutes_today = sum(s.duration_minutes for s in today_sessions)
    focus_sessions_today = len(today_sessions)

    automations_active = (
        db.query(models.Automation).filter(models.Automation.is_active == True).count()
    )
    automations_run_today = (
        db.query(models.Automation)
        .filter(models.Automation.last_run_at >= today_start)
        .count()
    )

    # Simple productivity score: focus time + completed tasks + automation runs
    productivity_score = min(
        100,
        focus_minutes_today + (tasks_done * 5) + (automations_run_today * 3),
    )

    return schemas.DashboardStats(
        tasks_todo=tasks_todo,
        tasks_in_progress=tasks_in_progress,
        tasks_done=tasks_done,
        focus_minutes_today=focus_minutes_today,
        focus_sessions_today=focus_sessions_today,
        automations_active=automations_active,
        automations_run_today=automations_run_today,
        productivity_score=productivity_score,
    )
