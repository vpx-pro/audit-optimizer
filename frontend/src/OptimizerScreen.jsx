import React, { useState } from 'react'
import axios from 'axios'
import './OptimizerScreen.css'

function OptimizerScreen({ fileInfo, onBack, sourceData }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [resultInfo, setResultInfo] = useState(null)
  const [summary, setSummary] = useState(null)

  const handleRunOptimizer = async () => {
    if (!fileInfo?.file_name) {
      setError('No combined Audit Universe file found. Please return and generate the file first.')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const response = await axios.post('/api/run-selection-optimizer', {
        file_name: fileInfo.file_name,
      })
      setResultInfo(response.data)
      setSummary(response.data.summary)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to run the selection optimizer.')
      console.error('Optimizer run error:', err)
    } finally {
      setLoading(false)
    }
  }

  const renderRiskTags = () => {
    if (!summary?.risk_breakdown) return null
    return Object.entries(summary.risk_breakdown).map(([risk, count]) => (
      <span key={risk} className="risk-tag">
        {risk}: {count}
      </span>
    ))
  }

  return (
    <div className="optimizer-app">
      <div className="optimizer-container">
        <div className="analysis-header">
          <button onClick={onBack} className="back-btn">
            ← Back to Parameters
          </button>
          <h1>Audit Selection Optimizer</h1>
        </div>

        <div className="section">
          <h2>Combined Audit Universe</h2>
          <p className="section-description">
            The parameters and audit universe have been merged into a single workbook. Download it or proceed to run the optimizer.
          </p>
          <div className="actions-row">
            <button
              className="secondary-btn"
              onClick={() => fileInfo?.download_url && window.open(fileInfo.download_url, '_blank')}
              disabled={!fileInfo?.download_url}
            >
              Download Combined File
            </button>
            <button
              className="primary-btn"
              onClick={handleRunOptimizer}
              disabled={loading}
            >
              {loading ? 'Running Optimizer...' : 'Run Audit Selection Optimizer'}
            </button>
            {resultInfo?.result_url && (
              <>
                <button
                  className="secondary-btn"
                  onClick={() => window.open(resultInfo.result_url, '_blank')}
                >
                  Download Results
                </button>
                <button
                  className="secondary-btn"
                  onClick={() => window.open(resultInfo.log_url, '_blank')}
                >
                  View Log
                </button>
              </>
            )}
          </div>
          {error && <div className="error-message">{error}</div>}
        </div>

        {summary && (
          <div className="section">
            <h2>Optimization Summary</h2>
            <div className="metrics-grid">
              <div className="metric-card">
                <span className="metric-label">Mandays Allocated</span>
                <span className="metric-value">{summary.total_mandays_allocated?.toLocaleString() || '0'}</span>
              </div>
              <div className="metric-card">
                <span className="metric-label">Mandays Used</span>
                <span className="metric-value">{summary.total_mandays_used?.toLocaleString() || '0'}</span>
              </div>
              <div className="metric-card">
                <span className="metric-label">Utilization</span>
                <span className="metric-value">{summary.overall_utilization ?? 0}%</span>
              </div>
              <div className="metric-card">
                <span className="metric-label">Selected Units</span>
                <span className="metric-value">{summary.selected_units ?? 0}</span>
              </div>
              {summary.risk_breakdown && (
                <div className="metric-card risk-breakdown">
                  <span className="metric-label">Risk Mix</span>
                  <div className="risk-tags">
                    {renderRiskTags()}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {summary?.department_summary && summary.department_summary.length > 0 && (
          <div className="section">
            <h2>Department Utilization</h2>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Department</th>
                    <th>Mandays Allocated</th>
                    <th>Mandays Used</th>
                    <th>Utilization (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.department_summary.map((dept) => (
                    <tr key={dept.Department}>
                      <td>{dept.Department}</td>
                      <td>{dept.Mandays_Allocated}</td>
                      <td>{dept.Mandays_Used}</td>
                      <td>{dept['Utilization(%)']}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {summary?.section_analysis && summary.section_analysis.length > 0 && (
          <div className="section">
            <h2>Section Analysis (Selected Units)</h2>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Section</th>
                    <th>High</th>
                    <th>Medium</th>
                    <th>Low</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.section_analysis.map((row) => (
                    <tr key={row.Section}>
                      <td>{row.Section}</td>
                      <td>{row.High}</td>
                      <td>{row.Medium}</td>
                      <td>{row.Low}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default OptimizerScreen

