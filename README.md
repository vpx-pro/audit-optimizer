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
Upload an Excel file and get column information.

**Request:** Multipart form data with `file` field

**Response:**
```json
{
  "filename": "example.xlsx",
  "columns": [
    {
      "name": "Column1",
      "type": "object",
      "sample_values": ["value1", "value2"]
    }
  ],
  "total_rows": 100,
  "total_columns": 5
}
```

### POST `/api/select-columns`
Process selected columns from uploaded Excel file.

**Request:** Multipart form data with `file` and `selected_columns` (comma-separated string)

**Response:**
```json
{
  "selected_columns": ["Column1", "Column2"],
  "total_rows": 100,
  "data_preview": [...]
}
```

### POST `/api/upload-parameters`
Upload a parameters Excel file for audit calculations.

**Request:** Multipart form data with `file` field

**Response:**
```json
{
  "filename": "parameters.xlsx",
  "data": [...],
  "total_rows": 10,
  "columns": ["Department", "Percentage", "HighDays", ...]
}
```

## Usage

1. Start both backend and frontend servers
2. Open the frontend in your browser
3. **Step 1**: Click "Choose Excel File" and select a RAW audit Excel file
4. Click **Upload & Analyze** – the FastAPI backend runs the Forest risk script and returns the summary + metrics
5. Review the generated summary preview and metrics
6. Click **Proceed to Analysis** to move to the data preparation screen
7. **Step 2**: Upload the Parameters Excel file, edit values inline, and click **Generate Audit Universe** to get the combined workbook (download link opens in a new window)
8. Click **Run Selection Optimizer** to execute the AMG audit selection script on the combined workbook and download the resulting reports/logs

## Technologies

- **Backend:** FastAPI, Pandas, OpenPyXL
- **Frontend:** React, Vite, Axios

# audit-optimizer
