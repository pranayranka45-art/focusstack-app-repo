from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db

router = APIRouter(prefix="/api/focus", tags=["focus"])


@router.get("/sessions", response_model=list[schemas.FocusSessionOut])
def list_sessions(limit: int = 50, db: Session = Depends(get_db)):
    return (
        db.query(models.FocusSession)
        .order_by(models.FocusSession.started_at.desc())
        .limit(limit)
        .all()
    )


@router.post("/sessions", response_model=schemas.FocusSessionOut, status_code=201)
def start_session(payload: schemas.FocusSessionCreate, db: Session = Depends(get_db)):
    session = models.FocusSession(**payload.model_dump())
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.post("/sessions/{session_id}/complete", response_model=schemas.FocusSessionOut)
def complete_session(
    session_id: int,
    payload: schemas.FocusSessionComplete,
    db: Session = Depends(get_db),
):
    session = db.query(models.FocusSession).filter(models.FocusSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.completed:
        raise HTTPException(status_code=400, detail="Session already completed")

    session.completed = True
    session.ended_at = datetime.utcnow()
    session.notes = payload.notes

    if session.task_id and session.session_type == "focus":
        task = db.query(models.Task).filter(models.Task.id == session.task_id).first()
        if task:
            task.completed_pomodoros += 1
            if task.status == "todo":
                task.status = "in_progress"

    db.commit()
    db.refresh(session)
    return session
