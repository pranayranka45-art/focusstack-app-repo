from fastapi import APIRouter, Depends, HTTPException

import schemas
from auth import require_user
from catalog import lab_runtimes
from code_runner import run_code
from store import get_store

router = APIRouter(prefix="/api/lab", tags=["lab"])


@router.get("/languages", response_model=list[schemas.LabLanguageInfo])
def languages():
    return lab_runtimes()


@router.get("/snippets", response_model=list[schemas.SnippetOut])
def list_snippets(user: dict = Depends(require_user)):
    return get_store().list_snippets(user["id"])


@router.get("/snippets/{snip_id}", response_model=schemas.SnippetOut)
def get_snippet(snip_id: str, user: dict = Depends(require_user)):
    row = get_store().get_snippet(user["id"], snip_id)
    if not row:
        raise HTTPException(status_code=404, detail="Snippet not found")
    return row


@router.post("/snippets", response_model=schemas.SnippetOut, status_code=201)
def create_snippet(payload: schemas.SnippetCreate, user: dict = Depends(require_user)):
    return get_store().create_snippet(user["id"], payload.model_dump(mode="json"))


@router.patch("/snippets/{snip_id}", response_model=schemas.SnippetOut)
def update_snippet(snip_id: str, payload: schemas.SnippetUpdate, user: dict = Depends(require_user)):
    row = get_store().update_snippet(user["id"], snip_id, payload.model_dump(exclude_unset=True, mode="json"))
    if not row:
        raise HTTPException(status_code=404, detail="Snippet not found")
    return row


@router.delete("/snippets/{snip_id}", status_code=204)
def delete_snippet(snip_id: str, user: dict = Depends(require_user)):
    if not get_store().delete_snippet(user["id"], snip_id):
        raise HTTPException(status_code=404, detail="Snippet not found")


@router.post("/snippets/{snip_id}/duplicate", response_model=schemas.SnippetOut, status_code=201)
def duplicate_snippet(snip_id: str, user: dict = Depends(require_user)):
    row = get_store().get_snippet(user["id"], snip_id)
    if not row:
        raise HTTPException(status_code=404, detail="Snippet not found")
    return get_store().create_snippet(
        user["id"],
        {
            "title": f"{row['title']} (copy)",
            "language": row["language"],
            "code": row["code"],
        }
    )


@router.post("/run", response_model=schemas.CodeRunResult)
def execute(payload: schemas.CodeRunRequest, user: dict = Depends(require_user)):
    return run_code(payload.language.value, payload.code)


@router.post("/snippets/{snip_id}/run", response_model=schemas.CodeRunResult)
def run_saved(snip_id: str, user: dict = Depends(require_user)):
    row = get_store().get_snippet(user["id"], snip_id)
    if not row:
        raise HTTPException(status_code=404, detail="Snippet not found")
    if not (row.get("code") or "").strip():
        raise HTTPException(status_code=400, detail="Snippet has no code to run")
    result = run_code(row["language"], row["code"])
    output = result["stdout"]
    if result["stderr"]:
        output = (output + "\n" + result["stderr"]).strip()
    get_store().update_snippet(user["id"], snip_id, {"last_output": output})
    return result
