from fastapi import APIRouter

from ..schemas.datasets import (
    ESGRecord,
    SupplierPerformanceRecord,
    SupplierRecord,
    TransactionRecord,
)
from ..services.dataset_service import DatasetService

router = APIRouter(tags=["datasets"])
dataset_service = DatasetService()


@router.get("/suppliers", response_model=list[SupplierRecord])
@router.get("/api/v1/suppliers", response_model=list[SupplierRecord], include_in_schema=False)
def get_suppliers() -> list[SupplierRecord]:
    return dataset_service.get_suppliers()


@router.get("/esg", response_model=list[ESGRecord])
@router.get("/api/v1/esg", response_model=list[ESGRecord], include_in_schema=False)
def get_esg() -> list[ESGRecord]:
    return dataset_service.get_esg()


@router.get("/transactions", response_model=list[TransactionRecord])
@router.get("/api/v1/transactions", response_model=list[TransactionRecord], include_in_schema=False)
def get_transactions() -> list[TransactionRecord]:
    return dataset_service.get_transactions()


@router.get("/supplier_performance", response_model=list[SupplierPerformanceRecord])
@router.get(
    "/api/v1/supplier_performance",
    response_model=list[SupplierPerformanceRecord],
    include_in_schema=False,
)
def supplier_performance() -> list[SupplierPerformanceRecord]:
    return dataset_service.get_supplier_performance()
