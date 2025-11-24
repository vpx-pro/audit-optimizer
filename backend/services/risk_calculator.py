import io
from typing import List, Dict, Tuple

import numpy as np
import pandas as pd


def to_num(series: pd.Series) -> pd.Series:
    """Convert series to numeric, treating 'Not Available' and blanks as NaN."""
    return pd.to_numeric(series.replace("Not Available", np.nan), errors="coerce")


def pick_col(df: pd.DataFrame, candidates: List[str], required: bool = True) -> str:
    """
    Robustly pick a column from a list of candidate names.
    Handles minor changes in spacing / case.
    """
    normalized = {
        c: " ".join(c.strip().lower().split())
        for c in df.columns
    }

    for cand in candidates:
        norm_cand = " ".join(cand.strip().lower().split())
        for real_name, norm_name in normalized.items():
            if norm_name == norm_cand:
                return real_name

    if required:
        raise KeyError(f"None of the candidate columns found: {candidates}")
    return None


def rate_nonstaff(avg_ns):
    if pd.isna(avg_ns) or avg_ns <= 300_000:
        return 3.0
    elif avg_ns <= 800_000:
        return 5.0
    elif avg_ns <= 1_400_000:
        return 7.0
    return 9.0


def rate_total_exp(avg_total):
    if pd.isna(avg_total) or avg_total <= 18_500_000:
        return 3.0
    elif avg_total <= 35_400_000:
        return 5.0
    elif avg_total <= 55_000_000:
        return 7.0
    return 9.0


def rate_2a(total_para):
    if pd.isna(total_para) or total_para <= 0:
        return 3.0
    elif total_para <= 2:
        return 5.0
    elif total_para <= 5:
        return 7.0
    return 9.0


def rate_arrear(years):
    if pd.isna(years):
        return 9.0
    years = float(years)
    if years <= 3:
        return 3.0
    elif years <= 5:
        return 5.0
    elif years <= 10:
        return 7.0
    return 9.0


def rate_sp_pc(sum_sp_pc):
    if pd.isna(sum_sp_pc) or sum_sp_pc <= 1:
        return 3.0
    if sum_sp_pc == 2:
        return 5.0
    if sum_sp_pc >= 5:
        return 9.0
    return 5.0


def rate_css(flag):
    if pd.isna(flag):
        return np.nan
    text = str(flag).strip().lower()
    if text == "yes":
        return 9.0
    if text == "no":
        return 0.0
    return np.nan


def total_rating(row):
    ns = row["Non Stafff Expenditure Rating"] or 3.0
    tot = row["TOTAL Expenditure Rating"] or 3.0
    para = row["2A para Rating "] or 3.0
    arre = row["Arrear of Audit Rating "] or 3.0
    sppc = row["SP+ PC RATING"] or 3.0
    dc = row["DC BILL RATING"] or 3.0
    uc = row["UC RATING"] or 3.0
    css = row["Cetrally Sponsored Scheme Rating"]
    css = 0.0 if pd.isna(css) else css

    return (
        0.20 * ns
        + 0.20 * tot
        + 0.15 * para
        + 0.15 * arre
        + 0.05 * sppc
        + 0.10 * dc
        + 0.10 * uc
        + 0.05 * css
    )


def risk_category(total_rating_value):
    if pd.isna(total_rating_value):
        return np.nan
    tr = float(total_rating_value)
    if tr < 3.85:
        return "Low"
    elif tr <= 4.25:
        return "Medium"
    return "High"


def _normalize_numeric_columns(df: pd.DataFrame, columns: List[str]) -> List[str]:
    valid_cols = []
    for col in columns:
        if col:
            valid_cols.append(col)
    df[valid_cols] = df[valid_cols].apply(to_num)
    return valid_cols


def recalc_and_summarize_from_bytes(file_bytes: bytes) -> Tuple[List[str], List[Dict], Dict]:
    """
    Run the risk calculation pipeline using the uploaded Excel bytes.
    Returns (columns, records, metrics).
    """
    excel_file = io.BytesIO(file_bytes)
    df = pd.read_excel(excel_file)

    col_slno = pick_col(df, ["Sl No.", "Sl No", "sno", "S No"])
    col_entity_id = pick_col(df, ["Audit entity ID", "Audit entity Id", "OIOS Code"])
    col_name = pick_col(df, ["Name of Audit Entity", "Name of Auditable Audit"])
    col_dept = pick_col(df, ["Department"])
    col_class = pick_col(df, ["Default classification", "Classification"])
    col_section = pick_col(df, ["Section"])
    col_last_aud = pick_col(df, ["Last Audited ", "Last Audited", "Last Audited upto"])

    ns_cols = [
        pick_col(df, ["Non Staff Expenditure 2022-23"]),
        pick_col(df, ["Non Staff Expenditure 2023-24"]),
        pick_col(df, ["Non Staff Expenditure 2024-25"]),
    ]
    tot_cols = [
        pick_col(df, ["Total Expenditure 2022-23"]),
        pick_col(df, ["Total Expenditure 2023-24"]),
        pick_col(df, ["Total Expenditure 2024-25"]),
    ]
    part_cols = [
        pick_col(df, ["Part IIA Para 2022-23"]),
        pick_col(df, ["Part IIA Para 2023-24"]),
        pick_col(df, ["Part IIA Para 2024-25"]),
    ]

    col_arrear = pick_col(df, ["Arrear of Audit"], required=False)
    col_sp = pick_col(df, ["SP", "Special Points"], required=False)
    col_pc = pick_col(df, ["PC", "Press Clippings/ Special Points"], required=False)
    col_css = pick_col(df, ["Centrally sponsored scheme"], required=False)

    _normalize_numeric_columns(df, [c for c in ns_cols + tot_cols + part_cols if c])

    if col_arrear:
        df[col_arrear] = to_num(df[col_arrear])
    else:
        df["Arrear_tmp"] = np.nan
        col_arrear = "Arrear_tmp"

    if col_sp:
        df[col_sp] = to_num(df[col_sp])
    else:
        df["SP_tmp"] = 0.0
        col_sp = "SP_tmp"

    if col_pc:
        df[col_pc] = to_num(df[col_pc])
    else:
        df["PC_tmp"] = 0.0
        col_pc = "PC_tmp"

    df["AVERAGE  Non Staff  Expenditure"] = (
        df[ns_cols].mean(axis=1, skipna=True).fillna(0)
    )
    df["AVERAGE Total  Expenditure 2024-25"] = (
        df[tot_cols].mean(axis=1, skipna=True).fillna(0)
    )
    df["Total Part 2 A Para"] = df[part_cols].fillna(0).sum(axis=1)
    df["SP+PC"] = df[[col_sp, col_pc]].fillna(0).sum(axis=1)

    df["Non Stafff Expenditure Rating"] = df[
        "AVERAGE  Non Staff  Expenditure"
    ].apply(rate_nonstaff)
    df["TOTAL Expenditure Rating"] = df[
        "AVERAGE Total  Expenditure 2024-25"
    ].apply(rate_total_exp)
    df["2A para Rating "] = df["Total Part 2 A Para"].apply(rate_2a)
    df["Arrear of Audit Rating "] = df[col_arrear].apply(rate_arrear)
    df["SP+ PC RATING"] = df["SP+PC"].apply(rate_sp_pc)
    df["DC BILL RATING"] = 3.0
    df["UC RATING"] = 3.0

    if col_css:
        df["Cetrally Sponsored Scheme Rating"] = df[col_css].apply(rate_css)
    else:
        df["Cetrally Sponsored Scheme Rating"] = 0.0

    df["TOTAL RATING"] = df.apply(total_rating, axis=1)
    df["Risk CATEGORIZATION @Bell Curve"] = df["TOTAL RATING"].apply(risk_category)

    df_final = pd.DataFrame(
        {
            "sNo": df[col_slno],
            "OIOS Code": df[col_entity_id],
            "Name of Auditable Audit": df[col_name],
            "Department": df[col_dept],
            "Classification": df[col_class],
            "Section": df[col_section],
            "Last Audited upto": df[col_last_aud],
            "Total Rating": df["TOTAL RATING"],
            "Audit Risk Category": df["Risk CATEGORIZATION @Bell Curve"],
        }
    )

    records = df_final.fillna("").to_dict(orient="records")
    columns = list(df_final.columns)

    metrics = {
        "total_entities": len(df_final),
        "risk_breakdown": df_final["Audit Risk Category"]
        .fillna("Unknown")
        .value_counts()
        .to_dict(),
        "rating_stats": {
            "min": float(df_final["Total Rating"].min())
            if not df_final["Total Rating"].empty
            else 0.0,
            "max": float(df_final["Total Rating"].max())
            if not df_final["Total Rating"].empty
            else 0.0,
            "avg": float(df_final["Total Rating"].mean())
            if not df_final["Total Rating"].empty
            else 0.0,
        },
    }

    return columns, records, metrics

