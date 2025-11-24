# Audit Optimizer

A full-stack application for importing Excel files, selecting columns, and performing audit analysis with parameter calculations.

## Features

- Upload RAW Excel files (.xlsx, .xls)
- Automatically run the Forest Risk calculator script on RAW uploads
- View risk summary metrics (ratings, risk category breakdown, entity counts)
- Upload and edit the Parameters workbook inline
- Generate a combined Audit Universe workbook directly from the browser
- Run the AMG Audit Selection Optimizer script on the combined file and download the outputs/logs
- Modern, responsive UI

## Project Structure

```
poc_app/
├── backend/          # FastAPI backend
│   ├── main.py      # API endpoints
│   └── requirements.txt
├── frontend/         # React frontend
│   ├── src/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
└── concept_data/     # Sample Excel files
```

## Setup Instructions

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Create a virtual environment (recommended):
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Run the server:
```bash
python main.py
```

The API will be available at `http://localhost:8000`

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

The app will be available at `http://localhost:3000`

## API Endpoints

### POST `/api/upload-excel`
Ingest a RAW Excel workbook, run the Forest Risk calculator, and return metadata + summary preview.

**Request:** Multipart form-data with `file`

**Response (partial):**
```json
{
  "filename": "raw.xlsx",
  "columns": [{ "name": "Department", "type": "object", "sample_values": ["Forest"] }],
  "summary_columns": ["sNo","OIOS Code","Name of Auditable Audit", "..."],
  "summary_data": [{ "sNo": 1, "OIOS Code": "F-1001", "...": "..." }],
  "summary_metrics": {
    "total_entities": 400,
    "risk_breakdown": { "High": 120, "Medium": 200, "Low": 80 }
  }
}
```

### POST `/api/upload-parameters`
Upload the editable parameters workbook and return the rows so they can be edited inline in the UI.

**Request:** Multipart form-data with `file`

**Response (partial):**
```json
{
  "filename": "parameters.xlsx",
  "data": [
    {
      "Department": "Forest",
      "Percentage": 20,
      "HighDays": 14,
      "MediumDays": 12,
      "LowDays": 10,
      "HighPct": 40,
      "MedPct": 40,
      "LowPct": 20
    }
  ],
  "total_rows": 8
}
```

### POST `/api/generate-audit-universe`
Combine the RAW summary and edited parameters (sent as JSON) into a unified workbook.

**Request body:**
```json
{
  "summary_columns": [...],
  "summary_data": [...],
  "parameters_data": [...],
  "original_filename": "Forest_RAW.xlsx"
}
```

**Response:**
```json
{
  "file_name": "Forest_RAW_Combined_20250101_120000.xlsx",
  "download_url": "/api/files/Forest_RAW_Combined_20250101_120000.xlsx"
}
```

### POST `/api/run-selection-optimizer`
Run the AMG audit selection script on a previously generated combined workbook.

**Request body:**
```json
{ "file_name": "Forest_RAW_Combined_20250101_120000.xlsx" }
```

**Response (partial):**
```json
{
  "result_file": "Forest_RAW_Results_20250101_120500.xlsx",
  "log_file": "Forest_RAW_Log_20250101_120500.txt",
  "result_url": "/api/files/Forest_RAW_Results_20250101_120500.xlsx",
  "log_url": "/api/files/Forest_RAW_Log_20250101_120500.txt",
  "summary": {
    "total_mandays_allocated": 890,
    "total_mandays_used": 870,
    "overall_utilization": 97.8,
    "selected_units": 132,
    "risk_breakdown": { "High": 54, "Medium": 55, "Low": 23 }
  }
}
```

## Workflow at a Glance

1. **RAW Upload (Upload screen)**  
   - Select any RAW audit Excel file.  
   - Backend runs the Forest Risk calculator and responds with a column listing, summary metrics, and a preview table.  
   - Review the counts + sample data, then proceed.

2. **Parameters & Audit Universe (Parameters screen)**  
   - Upload the parameters workbook (same format as the AMG scripts).  
   - Edit High/Medium/Low percentages, mandays, etc. inline.  
   - Click **Generate Audit Universe** to produce a merged workbook (Parameters + processed Audit Universe).  
   - A download button is shown once the file is generated; no auto-download surprises.

3. **Optimizer Dashboard (Optimizer screen)**  
   - Click **Run Audit Selection Optimizer** to execute the AMG selection script server-side.  
   - Download the generated Results workbook and Log file whenever you like.  
   - Review the summary cards (mandays, utilization, selected units, risk mix) plus department/section tables—handy for quick QA before distributing the files.

## Usage

1. Start both backend and frontend servers
2. Open the frontend in your browser
3. Complete the three-step workflow described above
4. Download the combined Audit Universe and the optimizer outputs when ready
5. Share/export screenshots of the optimizer dashboard if stakeholders want a quick view

## Technologies

- **Backend:** FastAPI, Pandas, OpenPyXL
- **Frontend:** React, Vite, Axios

# audit-optimizer
# audit-optimizer
