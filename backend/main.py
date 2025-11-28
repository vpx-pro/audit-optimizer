import io
import logging
import math
import os
import re
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd
import uvicorn
from fastapi import FastAPI, File, HTTPException, Query, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from services.audit_selection_optimizer import run_audit_selection_optimizer
from services.merge_sources import SOURCE_CONFIG, merge_source_files
from services.risk_calculator import recalc_and_summarize_from_bytes

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = FastAPI(title="Audit Optimizer API")
BASE_DIR = Path(__file__).resolve().parent
GENERATED_DIR = BASE_DIR / "generated_files"
GENERATED_DIR.mkdir(parents=True, exist_ok=True)

DEFAULT_FRONTEND_DIST = BASE_DIR.parent / "frontend" / "dist"
FRONTEND_DIST = Path(os.environ.get("FRONTEND_DIST", DEFAULT_FRONTEND_DIST)).resolve()

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.error(f"Validation error: {exc.errors()}")
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors()}
    )

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
async def health():
    return {"status": "ok"}

@app.post("/api/upload-excel")
async def upload_excel(
    file: UploadFile = File(...),
    ns_weight: float = Query(0.20),
    tot_weight: float = Query(0.20),
    para_weight: float = Query(0.15),
    arre_weight: float = Query(0.15),
    sppc_weight: float = Query(0.05),
    dc_weight: float = Query(0.10),
    uc_weight: float = Query(0.10),
    css_weight: float = Query(0.05),
):
    """
    Upload an Excel file and return its column names
    """
    try:
        if not file.filename.endswith((".xlsx", ".xls")):
            raise HTTPException(status_code=400, detail="File must be an Excel file (.xlsx or .xls)")

        contents = await file.read()
        try:
            weights = {
                "ns": ns_weight,
                "tot": tot_weight,
                "para": para_weight,
                "arre": arre_weight,
                "sppc": sppc_weight,
                "dc": dc_weight,
                "uc": uc_weight,
                "css": css_weight,
            }
            return _process_excel_contents(contents, file.filename, weights=weights)
        except KeyError as calc_error:
            # Surface calculation issues (usually missing required columns in the
            # uploaded workbook) as a 400 with a clear message.
            raise HTTPException(status_code=400, detail=f"Risk calculation error: {str(calc_error)}")

    except HTTPException:
        # Preserve any HTTPException raised above (e.g. risk calculation errors)
        # instead of wrapping them as a generic 500.
        raise
    except KeyError as e:
        raise HTTPException(status_code=400, detail=f"Missing required column: {str(e)}")
    except Exception as e:
        logger.exception("Unexpected error while processing uploaded Excel file")
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")

@app.post("/api/select-columns")
async def select_columns(
    file: UploadFile = File(...),
    selected_columns: str = Query(...)
):
    """
    Process Excel file with selected columns
    """
    try:
        # Debug logging
        logger.debug(f"Received file: {file.filename if file else 'None'}")
        logger.debug(f"Received selected_columns: {selected_columns}")
        
        # Check if selected_columns is received and valid
        if not selected_columns or not selected_columns.strip():
            raise HTTPException(status_code=400, detail="No columns selected. Please select at least one column.")
        
        # Parse selected columns (comma-separated string)
        columns_list = [col.strip() for col in selected_columns.split(",") if col.strip()]
        
        if not columns_list:
            raise HTTPException(status_code=400, detail="No valid columns selected. Please check your column selection.")
        
        print(f"Parsed columns: {columns_list}")
        
        # Read file content
        contents = await file.read()
        if not contents:
            raise HTTPException(status_code=400, detail="File is empty or could not be read")
        
        excel_file = io.BytesIO(contents)
        
        # Try different engines for different Excel formats
        try:
            df = pd.read_excel(excel_file, engine='openpyxl')
        except Exception as e1:
            try:
                excel_file.seek(0)  # Reset file pointer
                df = pd.read_excel(excel_file, engine='xlrd')
            except Exception as e2:
                raise HTTPException(status_code=400, detail=f"Could not read Excel file. openpyxl error: {str(e1)}, xlrd error: {str(e2)}")
        
        print(f"DataFrame columns: {list(df.columns)}")
        
        # Normalize DataFrame column names (strip whitespace)
        df.columns = df.columns.str.strip()
        
        # Also normalize the columns_list (in case there are any whitespace issues)
        columns_list = [col.strip() for col in columns_list]
        
        # Validate columns exist
        missing_columns = [col for col in columns_list if col not in df.columns]
        if missing_columns:
            raise HTTPException(status_code=400, detail=f"Columns not found: {missing_columns}. Available columns: {list(df.columns)}")
        
        # Select only the chosen columns
        selected_df = df[columns_list]
        
        # Convert NaN values to empty string for JSON serialization
        selected_df = selected_df.fillna('')
        
        # Convert data to dict, handling any non-serializable types
        try:
            data_preview = selected_df.head(50).to_dict(orient='records')
            # Convert any remaining non-serializable types
            for record in data_preview:
                for key, value in record.items():
                    if pd.isna(value):
                        record[key] = ''
                    elif isinstance(value, (pd.Timestamp, pd.DatetimeTZDtype)):
                        record[key] = str(value)
                    elif hasattr(value, 'item'):  # numpy types
                        try:
                            record[key] = value.item()
                        except (ValueError, AttributeError):
                            record[key] = str(value)
        except Exception as e:
            logger.error(f"Error converting data to dict: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Error serializing data: {str(e)}")
        
        # Return summary with more data preview
        return {
            "selected_columns": columns_list,
            "total_rows": len(selected_df),
            "data_preview": data_preview
        }
    
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_detail = f"Error processing columns: {str(e)}\n{traceback.format_exc()}"
        print(error_detail)  # Print to console for debugging
        raise HTTPException(status_code=500, detail=error_detail)


class AuditUniverseRequest(BaseModel):
    summary_columns: List[str]
    summary_data: List[Dict[str, Any]]
    parameters_data: List[Dict[str, Any]]
    original_filename: Optional[str] = None


class RunOptimizerRequest(BaseModel):
    file_name: str


class MergedFileRequest(BaseModel):
    file_name: str
    weights: Optional[Dict[str, float]] = None


def _process_excel_contents(
    contents: bytes,
    filename: str,
    weights: Optional[Dict[str, float]] = None,
) -> Dict[str, Any]:
    excel_file = io.BytesIO(contents)
    df = pd.read_excel(excel_file, engine="openpyxl")

    columns_info = [
        {
            "name": col,
            "type": str(df[col].dtype),
            "sample_values": df[col].dropna().head(5).tolist() if not df[col].dropna().empty else [],
        }
        for col in df.columns
    ]

    summary_columns, summary_data, summary_metrics = recalc_and_summarize_from_bytes(
        contents, weights=weights
    )

    return {
        "filename": filename,
        "columns": columns_info,
        "total_rows": len(df),
        "total_columns": len(df.columns),
        "summary_columns": summary_columns,
        "summary_data": summary_data,
        "summary_metrics": summary_metrics,
    }


def _sanitize_filename(name: str, suffix: str) -> str:
    base = re.sub(r"[^A-Za-z0-9_\-]+", "_", name.strip()) or "Audit_Universe"
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    return f"{base}_{suffix}_{timestamp}.xlsx"


def _write_audit_universe_excel(request: AuditUniverseRequest) -> Path:
    if not request.summary_columns or not request.summary_data:
        raise HTTPException(status_code=400, detail="Summary data is required to generate the Audit Universe.")
    if not request.parameters_data:
        raise HTTPException(status_code=400, detail="Parameters data is required to generate the Audit Universe.")

    summary_df = pd.DataFrame(request.summary_data, columns=request.summary_columns)

    # Final QA: ensure only rows with a valid OIOS Code are carried forward.
    # We mirror the cleaning used in `merge_source_files` so that blanks,
    # textual NaNs, and `None`-like markers are treated consistently.
    if "OIOS Code" in summary_df.columns:
        oios = summary_df["OIOS Code"].astype(str).str.strip()
        invalid_mask = oios.str.lower().isin(["", "nan", "none"])
        before_rows = len(summary_df)
        summary_df.loc[invalid_mask, "OIOS Code"] = pd.NA
        summary_df = summary_df.dropna(subset=["OIOS Code"])
        summary_df["OIOS Code"] = summary_df["OIOS Code"].astype(str).str.strip()
        after_rows = len(summary_df)
        if before_rows != after_rows:
            logger.info(
                "Filtered summary rows without a valid OIOS Code: "
                f"{before_rows - after_rows} dropped, {after_rows} remaining."
            )

    expected_param_cols = [
        "Department",
        "Percentage",
        "HighDays",
        "MediumDays",
        "LowDays",
        "HighPct",
        "MedPct",
        "LowPct",
    ]

    params_df = pd.DataFrame(request.parameters_data)

    # Support both the template headers (High%, Medium%, Low%) and the
    # internal names (HighPct/MedPct/LowPct) by normalizing here.
    rename_map = {}
    if "High%" in params_df.columns and "HighPct" not in params_df.columns:
        rename_map["High%"] = "HighPct"
    if "Medium%" in params_df.columns and "MedPct" not in params_df.columns:
        rename_map["Medium%"] = "MedPct"
    if "Low%" in params_df.columns and "LowPct" not in params_df.columns:
        rename_map["Low%"] = "LowPct"
    if rename_map:
        params_df = params_df.rename(columns=rename_map)

    for col in expected_param_cols:
        if col not in params_df.columns:
            params_df[col] = ""
    params_df = params_df[expected_param_cols]

    original_name = request.original_filename or "Audit_Universe"
    combined_filename = _sanitize_filename(Path(original_name).stem, "Combined")
    combined_path = GENERATED_DIR / combined_filename

    with pd.ExcelWriter(combined_path, engine="openpyxl") as writer:
        params_df.to_excel(writer, index=False, sheet_name="Parameters")
        summary_df.to_excel(writer, index=False, sheet_name="Audit Data")

    return combined_path


@app.post("/api/generate-audit-universe")
async def generate_audit_universe(payload: AuditUniverseRequest):
    try:
        combined_path = _write_audit_universe_excel(payload)
        download_url = f"/api/files/{combined_path.name}"
        return {
            "file_name": combined_path.name,
            "download_url": download_url,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to generate audit universe file")
        raise HTTPException(status_code=500, detail=f"Failed to generate audit universe: {str(e)}")


@app.post("/api/run-selection-optimizer")
async def run_selection_optimizer(request: RunOptimizerRequest):
    file_path = GENERATED_DIR / request.file_name
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Combined Audit Universe file not found.")

    try:
        result_path, log_path, summary = run_audit_selection_optimizer(file_path, GENERATED_DIR)
        return {
            "result_file": result_path.name,
            "log_file": log_path.name,
            "result_url": f"/api/files/{result_path.name}",
            "log_url": f"/api/files/{log_path.name}",
            "summary": summary,
        }
    except Exception as e:
        logger.exception("Failed to run audit selection optimizer")
        raise HTTPException(status_code=500, detail=f"Failed to run optimizer: {str(e)}")


@app.post("/api/upload-merged-file")
async def upload_merged_file(payload: MergedFileRequest):
    file_path = GENERATED_DIR / payload.file_name
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Merged file not found.")

    try:
        contents = file_path.read_bytes()
        return _process_excel_contents(contents, file_path.name, weights=payload.weights)
    except KeyError as e:
        raise HTTPException(status_code=400, detail=f"Risk calculation error: {str(e)}")
    except Exception as e:
        logger.exception("Failed to process merged file")
        raise HTTPException(status_code=500, detail=f"Error reading merged file: {str(e)}")


@app.post("/api/merge-sources")
async def merge_sources(
    audit_universe: UploadFile = File(...),
    avg_nonstaff: Optional[UploadFile] = File(None),
    avg_total_staff: Optional[UploadFile] = File(None),
    part_2a_paras: Optional[UploadFile] = File(None),
    arrears_audit: Optional[UploadFile] = File(None),
    special_point_press: Optional[UploadFile] = File(None),
    dc_bills: Optional[UploadFile] = File(None),
    uc_bills: Optional[UploadFile] = File(None),
    css: Optional[UploadFile] = File(None),
):
    optional_uploads = {
        "avg_nonstaff": avg_nonstaff,
        "avg_total_staff": avg_total_staff,
        "part_2a_paras": part_2a_paras,
        "arrears_audit": arrears_audit,
        "special_point_press": special_point_press,
        "dc_bills": dc_bills,
        "uc_bills": uc_bills,
        "css": css,
    }

    try:
        base_bytes = await audit_universe.read()
        optional_bytes: Dict[str, bytes] = {}
        for key, upload in optional_uploads.items():
            if upload:
                optional_bytes[key] = await upload.read()

        merged_df, sources_used = merge_source_files(base_bytes, optional_bytes)
        merged_filename = _sanitize_filename(Path(audit_universe.filename or "Audit_Universe").stem, "MergedSources")
        merged_path = GENERATED_DIR / merged_filename
        merged_df.to_excel(merged_path, index=False)

        present_sources = list(optional_bytes.keys())
        missing_sources = [key for key, _ in SOURCE_CONFIG if key not in optional_bytes]

        return {
            "merged_file": merged_filename,
            "download_url": f"/api/files/{merged_filename}",
            "total_rows": len(merged_df),
            "total_columns": len(merged_df.columns),
            "sources_used": sources_used,
            "sources_provided": present_sources,
            "sources_missing": missing_sources,
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Failed to merge audit sources")
        raise HTTPException(status_code=500, detail=f"Failed to merge sources: {str(exc)}")


@app.get("/api/files/{file_name}")
async def download_generated_file(file_name: str):
    if ".." in file_name or "/" in file_name:
        raise HTTPException(status_code=400, detail="Invalid file path.")
    file_path = GENERATED_DIR / file_name
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found.")
    media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    if file_path.suffix.lower() == ".txt":
        media_type = "text/plain"
    return FileResponse(file_path, media_type=media_type, filename=file_path.name)

@app.post("/api/upload-parameters")
async def upload_parameters(file: UploadFile = File(...)):
    """
    Upload a parameters Excel file (e.g., Department, Percentage, HighDays, etc.)
    """
    try:
        # Check if file is Excel
        if not file.filename.endswith(('.xlsx', '.xls')):
            raise HTTPException(status_code=400, detail="File must be an Excel file (.xlsx or .xls)")
        
        # Read file content
        contents = await file.read()
        excel_file = io.BytesIO(contents)
        
        # Try different engines for different Excel formats
        try:
            df = pd.read_excel(excel_file, engine='openpyxl')
        except Exception as e1:
            try:
                excel_file.seek(0)  # Reset file pointer
                df = pd.read_excel(excel_file, engine='xlrd')
            except Exception as e2:
                raise HTTPException(status_code=400, detail=f"Could not read Excel file. openpyxl error: {str(e1)}, xlrd error: {str(e2)}")
        
        # Normalize column names (strip whitespace)
        df.columns = df.columns.str.strip()
        
        # Convert to list of dictionaries with proper NaN handling
        data_records = []
        for _, row in df.iterrows():
            record = {}
            for key, value in row.items():
                # Handle NaN values (check first before any conversion)
                if pd.isna(value):
                    record[key] = ''
                # Handle numpy/pandas types that aren't JSON serializable
                elif isinstance(value, (pd.Timestamp, pd.DatetimeTZDtype)):
                    record[key] = str(value)
                elif hasattr(value, 'item'):  # numpy types
                    try:
                        converted = value.item()
                        # Check if it's a float NaN or inf
                        if isinstance(converted, float):
                            if math.isnan(converted) or math.isinf(converted):
                                record[key] = ''
                            else:
                                record[key] = converted
                        else:
                            record[key] = converted
                    except (ValueError, AttributeError, OverflowError):
                        record[key] = str(value) if value is not None else ''
                elif isinstance(value, float):
                    # Check for NaN or inf directly on float values
                    if math.isnan(value) or math.isinf(value):
                        record[key] = ''
                    else:
                        record[key] = value
                else:
                    record[key] = value if value is not None else ''
            data_records.append(record)
        
        return {
            "filename": file.filename,
            "data": data_records,
            "total_rows": len(df),
            "columns": list(df.columns)
        }
    
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_detail = f"Error processing parameters file: {str(e)}\n{traceback.format_exc()}"
        logger.error(error_detail)
        raise HTTPException(status_code=500, detail=f"Error processing parameters file: {str(e)}")


if FRONTEND_DIST.exists():
    assets_dir = FRONTEND_DIST / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="frontend-assets")

    @app.get("/", include_in_schema=False)
    async def serve_frontend():
        index_file = FRONTEND_DIST / "index.html"
        if index_file.exists():
            return FileResponse(index_file)
        raise HTTPException(status_code=404, detail="Frontend build not found.")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def frontend_fallback(full_path: str):
        if full_path.startswith("api"):
            raise HTTPException(status_code=404, detail="Not Found")
        index_file = FRONTEND_DIST / "index.html"
        if index_file.exists():
            return FileResponse(index_file)
        raise HTTPException(status_code=404, detail="Frontend build not found.")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)

