import React, { useState } from 'react'
import axios from 'axios'
import './DataAnalysisScreen.css'

function DataAnalysisScreen({ selectedData, onBack, generatedFileInfo, onFileGenerated, onProceedToOptimizer }) {
  const [parametersFile, setParametersFile] = useState(null)
  const [editableData, setEditableData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [calculations, setCalculations] = useState(null)
  const [generateLoading, setGenerateLoading] = useState(false)

  const handleParametersFileChange = (e) => {
    const selectedFile = e.target.files[0]
    if (selectedFile) {
      setParametersFile(selectedFile)
      setEditableData(null)
      setCalculations(null)
      onFileGenerated?.(null)
      setError(null)
    }
  }

  const handleUploadParameters = async () => {
    if (!parametersFile) {
      setError('Please select a parameters file first')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', parametersFile)

      const response = await axios.post('/api/upload-parameters', formData)

      setEditableData(response.data.data)
      onFileGenerated?.(null)
      calculateMetrics(response.data.data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Error uploading parameters file')
      console.error('Upload error:', err)
    } finally {
      setLoading(false)
    }
  }

  const calculateMetrics = (params) => {
    const calcs = {
      totalRows: selectedData?.totalRows || 0,
      totalColumns: selectedData?.columns?.length || 0,
      parametersLoaded: params ? params.length : 0,
      dataPoints: params ? params.length : 0,
    }

    if (params && params.length > 0) {
      // Calculate sum of percentages if available
      const percentageCol = params.find(row => row.hasOwnProperty('Percentage'))
      if (percentageCol) {
        const percentages = params
          .filter(row => row.Percentage && typeof row.Percentage === 'number')
          .map(row => row.Percentage)
        calcs.totalPercentage = percentages.reduce((a, b) => a + b, 0)
      }

      // Calculate total days if available
      const highDays = params
        .filter(row => row.HighDays && typeof row.HighDays === 'number')
        .map(row => row.HighDays)
      const mediumDays = params
        .filter(row => row.MediumDays && typeof row.MediumDays === 'number')
        .map(row => row.MediumDays)
      const lowDays = params
        .filter(row => row.LowDays && typeof row.LowDays === 'number')
        .map(row => row.LowDays)

      if (highDays.length > 0) {
        calcs.totalHighDays = highDays.reduce((a, b) => a + b, 0)
        calcs.totalMediumDays = mediumDays.reduce((a, b) => a + b, 0)
        calcs.totalLowDays = lowDays.reduce((a, b) => a + b, 0)
        calcs.totalDays = calcs.totalHighDays + calcs.totalMediumDays + calcs.totalLowDays
      }
    }

    setCalculations(calcs)
  }

  const handleCellChange = (rowIndex, key, value) => {
    setEditableData((prev) => {
      if (!prev) return prev
      const updated = prev.map((row, idx) =>
        idx === rowIndex ? { ...row, [key]: value } : row
      )
      calculateMetrics(updated)
      return updated
    })
  }

  return (
    <div className="analysis-app">
      <div className="analysis-container">
        <div className="analysis-header">
          <button onClick={onBack} className="back-btn">
            ← Back to Column Selection
          </button>
          <h1>Audit Optimizer - Data Analysis</h1>
        </div>

        <div className="section">
          <h2>Getting the Audit universe file</h2>
          <p className="section-description">
            The RAW audit file has been processed. Upload the parameters workbook to refine or override
            specific values and finalize your Audit Universe.
          </p>

          {(selectedData?.totalRows || selectedData?.metrics) && (
            <div className="metrics-grid intro-metrics">
              <div className="metric-card">
                <span className="metric-label">Total Entities</span>
                <span className="metric-value">
                  {selectedData?.totalRows?.toLocaleString
                    ? selectedData.totalRows.toLocaleString()
                    : selectedData?.totalRows ?? 'N/A'}
                </span>
              </div>
              <div className="metric-card">
                <span className="metric-label">Average Rating</span>
                <span className="metric-value">
                  {selectedData.metrics?.rating_stats?.avg?.toFixed
                    ? selectedData.metrics.rating_stats.avg.toFixed(2)
                    : selectedData.metrics?.rating_stats?.avg ?? 'N/A'}
                </span>
              </div>
              {selectedData.metrics?.risk_breakdown && (
                <div className="metric-card risk-breakdown">
                  <span className="metric-label">Risk Breakdown</span>
                  <div className="risk-tags">
                    {Object.entries(selectedData.metrics.risk_breakdown).map(([risk, count]) => (
                      <span key={risk} className="risk-tag">
                        {risk}: {count}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Parameters Upload Section */}
        <div className="section">
          <h2>Upload Parameters Excel File</h2>
          <p className="section-description">
            Upload an Excel file with audit parameters (e.g., Department, Percentage, HighDays, MediumDays, LowDays, etc.)
          </p>
          
          <div className="upload-section">
            <div className="file-input-wrapper">
              <input
                type="file"
                id="parameters-file-input"
                accept=".xlsx,.xls"
                onChange={handleParametersFileChange}
                className="file-input"
              />
              <label htmlFor="parameters-file-input" className="file-label">
                {parametersFile ? parametersFile.name : 'Choose Parameters Excel File'}
              </label>
            </div>

            <button
              onClick={handleUploadParameters}
              disabled={!parametersFile || loading}
              className="upload-btn"
            >
              {loading ? 'Processing...' : 'Upload Parameters'}
            </button>
          </div>

          {error && <div className="error-message">{error}</div>}
        </div>

        {/* Parameters Data Display */}
        {editableData && (
          <div className="section">
            <h2>Parameters Data</h2>
            <p className="section-description">
              Adjust any value inline to fine-tune the parameters before exporting the Audit Universe.
            </p>
            <div className="table-wrapper editable-table">
              <table className="data-table">
                <thead>
                  <tr>
                    {Object.keys(editableData[0] || {}).map((col) => (
                      <th key={col}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {editableData.map((row, rowIdx) => (
                    <tr key={rowIdx}>
                      {Object.keys(editableData[0] || {}).map((col) => (
                        <td key={col}>
                          <input
                            className="cell-input"
                            value={row[col] ?? ''}
                            onChange={(e) => handleCellChange(rowIdx, col, e.target.value)}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="actions-row">
              <button
                className="primary-btn"
                onClick={async () => {
                  setError(null)
                  if (!editableData) {
                    setError('Upload and edit parameters before generating the Audit Universe.')
                    return
                  }
                  setGenerateLoading(true)
                  try {
                    const payload = {
                      summary_columns: selectedData.columns,
                      summary_data: selectedData.data,
                      parameters_data: editableData,
                      original_filename: selectedData.originalFile?.name || 'Audit_Universe',
                    }
                    const response = await axios.post('/api/generate-audit-universe', payload)
                    onFileGenerated(response.data)
                  } catch (err) {
                    setError(err.response?.data?.detail || 'Failed to generate Audit Universe file.')
                    console.error('Generation error:', err)
                  } finally {
                    setGenerateLoading(false)
                  }
                }}
                disabled={generateLoading}
              >
                {generateLoading ? 'Generating...' : 'Generate Audit Universe'}
              </button>

              {generatedFileInfo && (
                <>
                  <button
                    className="secondary-btn"
                    onClick={() => generatedFileInfo?.download_url && window.open(generatedFileInfo.download_url, '_blank')}
                  >
                    Download Combined File
                  </button>
                  <button
                    className="primary-btn"
                    onClick={() => onProceedToOptimizer()}
                  >
                    Proceed to Optimizer
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Calculations Display */}
        {calculations && (
          <div className="section">
            <h2>Calculations & Metrics</h2>
            <div className="calculations-grid">
              <div className="calc-card">
                <div className="calc-label">Total Rows</div>
                <div className="calc-value">{calculations.totalRows?.toLocaleString() || 'N/A'}</div>
              </div>
              <div className="calc-card">
                <div className="calc-label">Total Columns</div>
                <div className="calc-value">{calculations.totalColumns || 'N/A'}</div>
              </div>
              <div className="calc-card">
                <div className="calc-label">Data Points</div>
                <div className="calc-value">{calculations.dataPoints || 'N/A'}</div>
              </div>
              {calculations.parametersLoaded > 0 && (
                <div className="calc-card">
                  <div className="calc-label">Parameters Loaded</div>
                  <div className="calc-value">{calculations.parametersLoaded}</div>
                </div>
              )}
              {calculations.totalPercentage !== undefined && (
                <div className="calc-card">
                  <div className="calc-label">Total Percentage</div>
                  <div className="calc-value">{calculations.totalPercentage}%</div>
                </div>
              )}
              {calculations.totalDays !== undefined && (
                <>
                  <div className="calc-card">
                    <div className="calc-label">Total High Days</div>
                    <div className="calc-value">{calculations.totalHighDays}</div>
                  </div>
                  <div className="calc-card">
                    <div className="calc-label">Total Medium Days</div>
                    <div className="calc-value">{calculations.totalMediumDays}</div>
                  </div>
                  <div className="calc-card">
                    <div className="calc-label">Total Low Days</div>
                    <div className="calc-value">{calculations.totalLowDays}</div>
                  </div>
                  <div className="calc-card highlight">
                    <div className="calc-label">Total Days</div>
                    <div className="calc-value">{calculations.totalDays}</div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default DataAnalysisScreen

