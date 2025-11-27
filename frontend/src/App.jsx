import React, { useState } from 'react'
import axios from 'axios'
import './App.css'
import DataAnalysisScreen from './DataAnalysisScreen'
import MergePrepScreen from './MergePrepScreen'
import OptimizerScreen from './OptimizerScreen'

function App() {
  const [file, setFile] = useState(null)
  const [fileInfo, setFileInfo] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [view, setView] = useState('merge') // merge | upload | parameters | optimizer
  const [selectedData, setSelectedData] = useState(null)
  const [summaryColumns, setSummaryColumns] = useState([])
  const [summaryData, setSummaryData] = useState([])
  const [summaryMetrics, setSummaryMetrics] = useState(null)
  const [generatedFileInfo, setGeneratedFileInfo] = useState(null)
  const [autoFileLabel, setAutoFileLabel] = useState(null)
  const [weights, setWeights] = useState({
    ns: 0.2,
    tot: 0.2,
    para: 0.15,
    arre: 0.15,
    sppc: 0.05,
    dc: 0.1,
    uc: 0.1,
    css: 0.05
  })

  const updateWeight = (key, rawValue) => {
    const parsed = parseFloat(rawValue)
    const newVal = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
    setWeights((prev) => ({ ...prev, [key]: newVal }))
  }

  const weightSum =
    weights.ns +
    weights.tot +
    weights.para +
    weights.arre +
    weights.sppc +
    weights.dc +
    weights.uc +
    weights.css
  const isWeightSumValid = Math.abs(weightSum - 1) < 0.001

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0]
    if (selectedFile) {
      setFile(selectedFile)
      setAutoFileLabel(null)
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

      const response = await axios.post('/api/upload-excel', formData, {
        params: {
          ns_weight: weights.ns,
          tot_weight: weights.tot,
          para_weight: weights.para,
          arre_weight: weights.arre,
          sppc_weight: weights.sppc,
          dc_weight: weights.dc,
          uc_weight: weights.uc,
          css_weight: weights.css
        }
      })

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

  const handleMergeComplete = ({ mergedMeta, uploadData }) => {
    setFile(null)
    setAutoFileLabel(uploadData.filename || mergedMeta.merged_file)
    setFileInfo({
      filename: uploadData.filename,
      totalRows: uploadData.total_rows,
      totalColumns: uploadData.total_columns
    })
    setSummaryColumns(uploadData.summary_columns || [])
    setSummaryData(uploadData.summary_data || [])
    setSummaryMetrics(uploadData.summary_metrics || null)
    setGeneratedFileInfo(null)
    setSelectedData(null)
    setError(null)
    setView('upload')
  }

  if (view === 'merge') {
    return (
      <MergePrepScreen
        onSkip={() => {
          setView('upload')
        }}
        onMergeComplete={handleMergeComplete}
        weights={weights}
      />
    )
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
        <div className="merge-reminder">
          <button className="secondary-btn" onClick={() => setView('merge')}>
            Back to merge step
          </button>
        </div>

        <div className="weights-panel">
          <div className="weights-panel-header">
            <h3>Weight configuration (optional)</h3>
            <p className="weights-note">Leave as-is to use default weights, or adjust to change TOTAL RATING.</p>
          </div>
          <div className="weights-grid">
            <div className="weight-field">
              <label>Non Staff Expenditure</label>
              <input
                type="number"
                step="0.01"
                value={weights.ns}
                onChange={(e) => updateWeight('ns', e.target.value)}
              />
            </div>
            <div className="weight-field">
              <label>Total Expenditure</label>
              <input
                type="number"
                step="0.01"
                value={weights.tot}
                onChange={(e) => updateWeight('tot', e.target.value)}
              />
            </div>
            <div className="weight-field">
              <label>Part 2A Paras</label>
              <input
                type="number"
                step="0.01"
                value={weights.para}
                onChange={(e) => updateWeight('para', e.target.value)}
              />
            </div>
            <div className="weight-field">
              <label>Arrears of Audit</label>
              <input
                type="number"
                step="0.01"
                value={weights.arre}
                onChange={(e) => updateWeight('arre', e.target.value)}
              />
            </div>
            <div className="weight-field">
              <label>SP + PC</label>
              <input
                type="number"
                step="0.01"
                value={weights.sppc}
                onChange={(e) => updateWeight('sppc', e.target.value)}
              />
            </div>
            <div className="weight-field">
              <label>DC Bills</label>
              <input
                type="number"
                step="0.01"
                value={weights.dc}
                onChange={(e) => updateWeight('dc', e.target.value)}
              />
            </div>
            <div className="weight-field">
              <label>UC Bills</label>
              <input
                type="number"
                step="0.01"
                value={weights.uc}
                onChange={(e) => updateWeight('uc', e.target.value)}
              />
            </div>
            <div className="weight-field">
              <label>CSS Flag</label>
              <input
                type="number"
                step="0.01"
                value={weights.css}
                onChange={(e) => updateWeight('css', e.target.value)}
              />
            </div>
          </div>
          <div
            className={
              'weights-sum ' +
              (isWeightSumValid ? 'ok' : 'error')
            }
          >
            Current sum:{' '}
            {weightSum.toFixed(2)} (target: 1.00)
          </div>
        </div>

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
            disabled={!file || loading || !isWeightSumValid}
            className="upload-btn"
          >
            {loading ? 'Processing...' : 'Upload & Analyze'}
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}

        {autoFileLabel && (
          <div className="info-pill">
            Using merged workbook: <strong>{autoFileLabel}</strong>
          </div>
        )}

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

