from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from file_processor import delete_file, extract_text_from_file, save_upload

router = APIRouter(prefix="/api/automations", tags=["automations"])


def run_template(template: str, automation: models.Automation) -> str:
    now = datetime.utcnow()
    variables = {
        "{date}": now.strftime("%Y-%m-%d"),
        "{time}": now.strftime("%H:%M"),
        "{datetime}": now.strftime("%Y-%m-%d %H:%M"),
        "{name}": automation.name,
        "{run_count}": str(automation.run_count + 1),
        "{day}": now.strftime("%A"),
        "{filename}": automation.original_filename or "",
    }
    output = template
    for key, value in variables.items():
        output = output.replace(key, value)
    return output.strip()


def run_automation_logic(automation: models.Automation) -> str:
    if automation.source_type == "file" and automation.file_path:
        content = extract_text_from_file(automation.file_path, automation.original_filename or "")
        header = (
            f"Processed: {automation.original_filename}\n"
            f"Run #{automation.run_count + 1} · {datetime.utcnow().strftime('%Y-%m-%d %H:%M')}\n"
            f"{'=' * 40}\n\n"
        )
        return header + content

    return run_template(automation.template or "", automation)


@router.get("", response_model=list[schemas.AutomationOut])
def list_automations(db: Session = Depends(get_db)):
    return db.query(models.Automation).order_by(models.Automation.created_at.desc()).all()


@router.post("", response_model=schemas.AutomationOut, status_code=201)
def create_automation(payload: schemas.AutomationCreate, db: Session = Depends(get_db)):
    if payload.source_type == "template" and not payload.template.strip():
        raise HTTPException(status_code=400, detail="Template text is required")
    automation = models.Automation(**payload.model_dump())
    db.add(automation)
    db.commit()
    db.refresh(automation)
    return automation


@router.post("/upload", response_model=schemas.AutomationOut, status_code=201)
async def upload_automation(
    file: UploadFile = File(...),
    name: str = Form(""),
    description: str = Form(""),
    schedule: str = Form("manual"),
    db: Session = Depends(get_db),
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="File is empty")
    if len(file_bytes) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File exceeds 20 MB limit")

    stored_path, ext = save_upload(file_bytes, file.filename)
    display_name = name.strip() or file.filename

    automation = models.Automation(
        name=display_name,
        description=description,
        template="",
        source_type="file",
        file_path=stored_path,
        original_filename=file.filename,
        file_type=ext,
        file_size=len(file_bytes),
        schedule=schedule,
    )
    db.add(automation)
    db.commit()
    db.refresh(automation)
    return automation


@router.patch("/{automation_id}", response_model=schemas.AutomationOut)
def update_automation(
    automation_id: int,
    payload: schemas.AutomationUpdate,
    db: Session = Depends(get_db),
):
    automation = db.query(models.Automation).filter(models.Automation.id == automation_id).first()
    if not automation:
        raise HTTPException(status_code=404, detail="Automation not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(automation, key, value)

    db.commit()
    db.refresh(automation)
    return automation


@router.delete("/{automation_id}", status_code=204)
def delete_automation(automation_id: int, db: Session = Depends(get_db)):
    automation = db.query(models.Automation).filter(models.Automation.id == automation_id).first()
    if not automation:
        raise HTTPException(status_code=404, detail="Automation not found")
    if automation.file_path:
        delete_file(automation.file_path)
    db.delete(automation)
    db.commit()


@router.post("/{automation_id}/run", response_model=schemas.AutomationRunResult)
def run_automation(automation_id: int, db: Session = Depends(get_db)):
    automation = db.query(models.Automation).filter(models.Automation.id == automation_id).first()
    if not automation:
        raise HTTPException(status_code=404, detail="Automation not found")
    if not automation.is_active:
        raise HTTPException(status_code=400, detail="Automation is inactive")

    output = run_automation_logic(automation)
    now = datetime.utcnow()
    automation.last_run_at = now
    automation.run_count += 1
    db.commit()

    return schemas.AutomationRunResult(
        automation_id=automation.id,
        output=output,
        run_at=now,
    )
