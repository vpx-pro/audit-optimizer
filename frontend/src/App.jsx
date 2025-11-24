import React, { useState } from 'react'
import axios from 'axios'
import './App.css'
import DataAnalysisScreen from './DataAnalysisScreen'
import OptimizerScreen from './OptimizerScreen'

function App() {
  const [file, setFile] = useState(null)
  const [fileInfo, setFileInfo] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [view, setView] = useState('upload') // upload | parameters | optimizer
  const [selectedData, setSelectedData] = useState(null)
  const [summaryColumns, setSummaryColumns] = useState([])
  const [summaryData, setSummaryData] = useState([])
  const [summaryMetrics, setSummaryMetrics] = useState(null)
  const [generatedFileInfo, setGeneratedFileInfo] = useState(null)

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0]
    if (selectedFile) {
      setFile(selectedFile)
      setFileInfo(null)
      setSummaryColumns([])
      setSummaryData([])
      setSummaryMetrics(null)
      setSelectedData(null)
      setGeneratedFileInfo(null)
      setView('upload')
      setError(null)
    }
  }

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file first')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await axios.post('/api/upload-excel', formData)

      setFileInfo({
        filename: response.data.filename,
        totalRows: response.data.total_rows,
        totalColumns: response.data.total_columns,
      })
      setSummaryColumns(response.data.summary_columns || [])
      setSummaryData(response.data.summary_data || [])
      setSummaryMetrics(response.data.summary_metrics || null)
    } catch (err) {
      setError(err.response?.data?.detail || 'Error uploading file')
      console.error('Upload error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleProceedToAnalysis = () => {
    if (!summaryData.length || !summaryColumns.length) {
      setError('Please upload a valid file to generate the audit summary.')
      return
    }

    setSelectedData({
      columns: summaryColumns,
      data: summaryData,
      totalRows: summaryMetrics?.total_entities || summaryData.length,
      metrics: summaryMetrics,
      originalFile: file
    })
    setGeneratedFileInfo(null)
    setView('parameters')
  }

  const handleBackToUpload = () => {
    setView('upload')
    setSelectedData(null)
    setGeneratedFileInfo(null)
  }

  if (view === 'parameters' && selectedData) {
    return (
      <DataAnalysisScreen
        selectedData={selectedData}
        generatedFileInfo={generatedFileInfo}
        onFileGenerated={(info) => setGeneratedFileInfo(info)}
        onProceedToOptimizer={() => setView('optimizer')}
        onBack={handleBackToUpload}
      />
    )
  }

  if (view === 'optimizer' && generatedFileInfo) {
    return (
      <OptimizerScreen
        fileInfo={generatedFileInfo}
        onBack={() => setView('parameters')}
        sourceData={selectedData}
      />
    )
  }

  return (
    <div className="app">
      <div className="container">
        <h1>Audit Optimizer</h1>
        <p className="subtitle">
          Upload a RAW audit Excel file and let Audit Optimizer compute the risk summary automatically.
        </p>

        <div className="upload-section">
          <div className="file-input-wrapper">
            <input
              type="file"
              id="file-input"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="file-input"
            />
            <label htmlFor="file-input" className="file-label">
              {file ? file.name : 'Choose Excel File'}
            </label>
          </div>

          <button
            onClick={handleUpload}
            disabled={!file || loading}
            className="upload-btn"
          >
            {loading ? 'Processing...' : 'Upload & Analyze'}
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}

        {fileInfo && (
          <div className="file-info">
            <h3>File Information</h3>
            <p><strong>Filename:</strong> {fileInfo.filename}</p>
            <p><strong>Total Rows:</strong> {fileInfo.totalRows.toLocaleString()}</p>
            <p><strong>Total Columns:</strong> {fileInfo.totalColumns}</p>
          </div>
        )}

        {summaryData.length > 0 && (
          <div className="summary-section">
            <div className="summary-header">
              <div>
                <h2>Audit Risk Summary</h2>
                <p className="summary-description">
                  Generated automatically using the Forest Risk calculator.
                </p>
              </div>
              <button className="submit-btn" onClick={handleProceedToAnalysis}>
                Proceed to Analysis
              </button>
            </div>

            {summaryMetrics && (
              <div className="metrics-grid">
                <div className="metric-card">
                  <span className="metric-label">Total Entities</span>
                  <span className="metric-value">
                    {summaryMetrics?.total_entities?.toLocaleString
                      ? summaryMetrics.total_entities.toLocaleString()
                      : summaryMetrics?.total_entities ?? 'N/A'}
                  </span>
                </div>
                <div className="metric-card">
                  <span className="metric-label">Avg. Rating</span>
                  <span className="metric-value">
                    {summaryMetrics?.rating_stats?.avg?.toFixed
                      ? summaryMetrics.rating_stats.avg.toFixed(2)
                      : summaryMetrics?.rating_stats?.avg ?? 'N/A'}
                  </span>
                </div>
                <div className="metric-card">
                  <span className="metric-label">Highest Rating</span>
                  <span className="metric-value">
                    {summaryMetrics?.rating_stats?.max?.toFixed
                      ? summaryMetrics.rating_stats.max.toFixed(2)
                      : summaryMetrics?.rating_stats?.max ?? 'N/A'}
                  </span>
                </div>
                <div className="metric-card">
                  <span className="metric-label">Lowest Rating</span>
                  <span className="metric-value">
                    {summaryMetrics?.rating_stats?.min?.toFixed
                      ? summaryMetrics.rating_stats.min.toFixed(2)
                      : summaryMetrics?.rating_stats?.min ?? 'N/A'}
                  </span>
                </div>
                <div className="metric-card risk-breakdown">
                  <span className="metric-label">Risk Breakdown</span>
                  <div className="risk-tags">
                    {Object.entries(summaryMetrics.risk_breakdown || {}).map(([risk, count]) => (
                      <span key={risk} className="risk-tag">
                        {risk}: {count}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="table-wrapper summary-table">
              <table className="data-table">
                <thead>
                  <tr>
                    {summaryColumns.map((col) => (
                      <th key={col}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {summaryData.slice(0, 15).map((row, idx) => (
                    <tr key={idx}>
                      {summaryColumns.map((col) => (
                        <td key={col}>{String(row[col] ?? '')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {summaryData.length > 15 && (
              <p className="preview-note">
                Showing first 15 records. Use "Proceed to Analysis" to work with the complete summary.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default App

