import io
from typing import Dict, List, Tuple

import pandas as pd


SOURCE_CONFIG = [
    ("avg_nonstaff", "1-Average Non Staff Expenditure.xlsx"),
    ("avg_total_staff", "2-Average Total Staff Expenditure.xlsx"),
    ("part_2a_paras", "3-Part 2A paras.xlsx"),
    ("arrears_audit", "4-Arrears of Audit.xlsx"),
    ("special_point_press", "5-Special Point and Press Clip.xlsx"),
    ("dc_bills", "6-DC Bills and Money value.xlsx"),
    ("uc_bills", "7-UC Bills and Money value.xlsx"),
    ("css", "8-Centrally Sponsored Scheme.xlsx"),
]


def _normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    rename_map = {
        "ßß": "Sl No.",
        "Section ": "Section",
        "DDO Code": "DDO Code",
    }
    normalized = df.copy()
    normalized.columns = [
        col.strip() if isinstance(col, str) else col
        for col in normalized.columns
    ]
    normalized = normalized.rename(
        columns={old: new for old, new in rename_map.items() if old in normalized.columns}
    )
    return normalized


def _clean_key(series: pd.Series) -> pd.Series:
    cleaned = series.astype(str).str.strip()
    cleaned = cleaned.mask(cleaned.str.lower().isin(["", "nan", "none"]))
    return cleaned.str.upper()


def _merge_with_fallback(base_df: pd.DataFrame, other_df: pd.DataFrame) -> Tuple[pd.DataFrame, List[str]]:
    base = base_df.copy()
    other = other_df.copy()

    base["oios_key"] = _clean_key(base["OIOS Code"])
    base["name_key"] = _clean_key(base["Name of Auditable Audit"])

    other["id_key"] = _clean_key(other["Audit entity ID"])
    other["name_key"] = _clean_key(other["Name of audit entity"])

    drop_cols = ["sl no", "Audit entity ID", "Name of audit entity", "Name of Department"]
    value_cols = [c for c in other.columns if c not in drop_cols + ["id_key", "name_key"]]

    keep_cols = ["id_key", "name_key"] + value_cols
    other_keep = other[[col for col in keep_cols if col in other.columns]]

    merged_code = base.merge(other_keep, left_on="oios_key", right_on="id_key", how="left")
    merged_name = base.merge(other_keep, on="name_key", how="left", suffixes=("", "_name"))

    final = merged_code.copy()
    added_columns = []
    for col in value_cols:
        fallback_col = col + "_name"
        if col not in final.columns:
            continue
        if fallback_col in merged_name.columns:
            final[col] = final[col].fillna(merged_name[fallback_col])
        added_columns.append(col)

    cols_to_drop = [col for col in final.columns if col in {"oios_key", "id_key"} or col.startswith("name_key")]
    if cols_to_drop:
        final = final.drop(columns=cols_to_drop)

    return final, added_columns


def _read_excel_bytes(file_bytes: bytes) -> pd.DataFrame:
    df = pd.read_excel(io.BytesIO(file_bytes))
    return _normalize_columns(df)


def merge_source_files(base_file: bytes, optional_files: Dict[str, bytes]) -> Tuple[pd.DataFrame, List[Dict[str, object]]]:
    audit = _read_excel_bytes(base_file)

    audit["OIOS Code"] = audit["OIOS Code"].astype(str).str.strip()
    audit.loc[audit["OIOS Code"].str.lower().isin(["", "nan", "none"]), "OIOS Code"] = pd.NA
    audit = audit.dropna(subset=["OIOS Code"])

    merged = audit.copy()
    sources_used: List[Dict[str, object]] = []

    for source_key, _ in SOURCE_CONFIG:
        if source_key not in optional_files:
            continue

        other_df = _read_excel_bytes(optional_files[source_key])
        before_cols = set(merged.columns)
        merged, added_cols = _merge_with_fallback(merged, other_df)
        gained_cols = [col for col in merged.columns if col not in before_cols]

        sources_used.append(
            {
                "key": source_key,
                "columns_added": added_cols or gained_cols,
            }
        )

    merged["OIOS Code"] = merged["OIOS Code"].astype(str).str.strip()
    merged.loc[merged["OIOS Code"].str.lower().isin(["", "nan", "none"]), "OIOS Code"] = pd.NA
    merged = merged.dropna(subset=["OIOS Code"])

    cols_to_drop = [c for c in merged.columns if c.lower().startswith("audit entity id")]
    if cols_to_drop:
        merged = merged.drop(columns=cols_to_drop)

    if "sNo" in merged.columns:
        merged = merged.sort_values("sNo")
    else:
        merged = merged.sort_values("OIOS Code")

    merged = merged.reset_index(drop=True)
    return merged, sources_used

