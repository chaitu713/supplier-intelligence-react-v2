from fastapi import APIRouter, File, Form, UploadFile

from ..core.exceptions import AppError

from ..services.onboarding_service import onboarding_service

router = APIRouter(prefix="/onboarding", tags=["onboarding"])


@router.post("/upload")
async def upload_onboarding_document(
    file: UploadFile | None = File(default=None),
    supplier_name: str | None = Form(default=None),
    country: str | None = Form(default=None),
    tier: str | None = Form(default=None),
    size: str | None = Form(default=None),
    annual_revenue: str | None = Form(default=None),
    onboarding_date: str | None = Form(default=None),
    status: str | None = Form(default=None),
    commodities: str | None = Form(default=None),
    certifications: str | None = Form(default=None),
    certification_rows: str | None = Form(default=None),
) -> dict:
    if any(
        value is not None
        for value in [
            supplier_name,
            country,
            tier,
            size,
            annual_revenue,
            onboarding_date,
            status,
            commodities,
            certifications,
            certification_rows,
        ]
    ):
        return onboarding_service.process_submission(
            supplier_name=supplier_name,
            country=country,
            tier=tier,
            size=size,
            annual_revenue=annual_revenue,
            onboarding_date=onboarding_date,
            status=status,
            commodities=commodities,
            certifications=certifications,
            certification_rows=certification_rows,
        )

    if file is None:
        raise AppError("A file is required", status_code=400)

    file_bytes = await file.read()
    if not file_bytes:
        raise AppError("Uploaded file is empty", status_code=400)

    try:
        return onboarding_service.process_document(file_bytes)
    except Exception as exc:
        raise AppError(str(exc), status_code=400) from exc
