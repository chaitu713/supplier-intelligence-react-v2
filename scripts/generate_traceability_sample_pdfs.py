from __future__ import annotations

from pathlib import Path

import fitz


OUTPUT_DIR = Path(__file__).resolve().parents[1] / "uploads" / "traceability" / "sample_pdfs"


DOCUMENTS = {
    "01_farm_plot_traceability_blueriver.pdf": [
        "Farm / Plot Traceability Evidence",
        "Prepared by: BlueRiver Commodities Ltd",
        "Supplier: BlueRiver Commodities Ltd",
        "Supplier ID: 2001",
        "Site ID: SITE-2001-01",
        "Farm Block: BlueRiver Kalimantan Smallholder Block",
        "Plot ID: BR-KAL-PLT-041",
        "Farm ID: BR-KAL-FARM-118",
        "Traceability ID: TRACE-BR-2026-041",
        "Producer: Kalimantan Smallholder Group A",
        "Commodity: Palm Oil and Cocoa",
        "Plots Covered: BR-KAL-PLT-041, BR-KAL-PLT-042",
        "Declaration Date: 2026-04-25",
        "Evidence Status: Complete",
    ],
    "02_geolocation_polygon_blueriver.pdf": [
        "Geolocation / Polygon Evidence",
        "Prepared by: BlueRiver GIS Review Team",
        "Supplier: BlueRiver Commodities Ltd",
        "Supplier ID: 2001",
        "Site ID: SITE-2001-01",
        "Plot ID: BR-KAL-PLT-041",
        "Polygon Reference: POLY-BR-KAL-041",
        "Latitude, Longitude: -1.6815, 113.3824",
        "GPS Coordinate: -1.6815, 113.3824",
        "Farm Boundary: GeoJSON polygon package received",
        "Coverage: Declared plots BR-KAL-PLT-041 and BR-KAL-PLT-042",
        "Assessment Date: 2026-04-26",
        "Evidence Status: Complete",
    ],
    "03_chain_of_custody_blueriver.pdf": [
        "Chain of Custody Evidence",
        "Prepared by: Archipelago Palm Collection Center",
        "Supplier: BlueRiver Commodities Ltd",
        "Supplier ID: 2001",
        "Event ID: EVT-2001-002",
        "Lot ID: LOT-2001-PO-001",
        "Batch ID: BR-PO-2026-001",
        "Shipment ID: SHP-BR-2026-118",
        "Chain of Custody Reference: COC-BR-2026-118",
        "Inbound: SITE-2001-01 BlueRiver Kalimantan Smallholder Block",
        "Outbound: SITE-2047-01 Archipelago Palm Collection Center",
        "Origin Plot: BR-KAL-PLT-041",
        "Traceability Link: TRACE-BR-2026-041",
        "Evidence Status: Complete",
    ],
    "04_shipment_lot_blueriver.pdf": [
        "Shipment / Lot Document",
        "Prepared by: BlueRiver Logistics",
        "Supplier: BlueRiver Commodities Ltd",
        "Supplier ID: 2001",
        "Lot ID: LOT-2001-PO-001",
        "Lot Code: BR-PO-2026-001",
        "Shipment Reference: SHP-BR-2026-118",
        "Shipment ID: SHP-BR-2026-118",
        "Commodity: Palm Oil",
        "Quantity: 82.5 MT",
        "Unit: MT",
        "Origin: SITE-2047-01 Archipelago Palm Collection Center",
        "Destination: SITE-2001-02 BlueRiver Surabaya Processing Hub",
        "Production Date: 2026-03-12",
        "Document Date: 2026-03-20",
        "Evidence Status: Complete",
    ],
    "05_deforestation_free_declaration_blueriver.pdf": [
        "Deforestation-Free Declaration",
        "Issued by: BlueRiver Commodities Ltd",
        "Supplier: BlueRiver Commodities Ltd",
        "Supplier ID: 2001",
        "Site ID: SITE-2001-01",
        "Declaration Reference: DFD-BR-2026-041",
        "Scope: Palm Oil and Cocoa sourced from BlueRiver Kalimantan Smallholder Block",
        "Declaration Date: 2026-04-27",
        "Cutoff Date: 2020-12-31",
        "Assessment Date: 2026-04-26",
        "Statement: The declared sourcing area is deforestation-free for the stated scope and cutoff date.",
        "Evidence Status: Complete",
    ],
}


def create_pdf(path: Path, lines: list[str]) -> None:
    document = fitz.open()
    page = document.new_page(width=595, height=842)
    y = 72
    for index, line in enumerate(lines):
        font_size = 18 if index == 0 else 11
        page.insert_text((72, y), line, fontsize=font_size, fontname="helv", fill=(0, 0, 0))
        y += 28 if index == 0 else 18
    document.save(path)
    document.close()


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for filename, lines in DOCUMENTS.items():
        create_pdf(OUTPUT_DIR / filename, lines)
    print(str(OUTPUT_DIR))


if __name__ == "__main__":
    main()
