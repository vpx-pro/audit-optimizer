import React, { useState } from 'react'
import axios from 'axios'
import './MergePrepScreen.css'

const SOURCE_FIELDS = [
  {
    key: 'audit_universe',
    label: 'Audit Universe (Base)',
    required: true,
    description: 'Required: master audit universe without parameter columns.'
  },
  { key: 'avg_nonstaff', label: '1 - Average Non Staff Expenditure', description: 'Optional enrichment.' },
  { key: 'avg_total_staff', label: '2 - Average Total Staff Expenditure', description: 'Optional enrichment.' },
  { key: 'part_2a_paras', label: '3 - Part 2A Paras', description: 'Optional enrichment.' },
  { key: 'arrears_audit', label: '4 - Arrears of Audit', description: 'Optional enrichment.' },
  { key: 'special_point_press', label: '5 - Special Point and Press Clip', description: 'Optional enrichment.' },
  { key: 'dc_bills', label: '6 - DC Bills and Money Value', description: 'Optional enrichment.' },
  { key: 'uc_bills', label: '7 - UC Bills and Money Value', description: 'Optional enrichment.' },
  { key: 'css', label: '8 - Centrally Sponsored Scheme', description: 'Optional enrichment.' }
]

function MergePrepScreen({ onSkip, onMergeComplete, weights }) {
  const [files, setFiles] = useState({})
  const [loading, setLoading] = useState(false)
  const [autoProcessing, setAutoProcessing] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  const handleFileChange = (key, file) => {
    setFiles((prev) => ({
      ...prev,
      [key]: file || undefined
    }))
  }

  const handleMerge = async () => {
    setError(null)
    if (!files.audit_universe) {
      setError('Please upload the base Audit Universe file before merging.')
      return
    }

    const formData = new FormData()
    SOURCE_FIELDS.forEach(({ key }) => {
      if (files[key]) {
        formData.append(key, files[key])
      }
    })

    try {
      setLoading(true)
      const response = await axios.post('/api/merge-sources', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setResult(response.data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to merge sources. Please retry.')
      console.error('Merge error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleAutoProceed = async () => {
    if (!result?.merged_file) return
    try {
      setAutoProcessing(true)
      const response = await axios.post('/api/upload-merged-file', {
        file_name: result.merged_file,
        weights
      })

      onMergeComplete({
        mergedMeta: result,
        uploadData: response.data
      })
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to process merged file.')
      console.error('Auto proceed error:', err)
    } finally {
      setAutoProcessing(false)
    }
  }

  return (
    <div className="app">
      <div className="container">
        <h1>Audit Optimizer</h1>
        <p className="subtitle">
          Step 1 · Merge your raw Audit Universe with optional parameter workbooks before analysis.
        </p>

        <div className="merge-grid">
          {SOURCE_FIELDS.map((field) => (
            <div key={field.key} className="merge-card">
              <div className="merge-card-header">
                <div>
                  <h3>{field.label}</h3>
                  <p>{field.description}</p>
                </div>
                {field.required && <span className="required-pill">Required</span>}
              </div>
              <label className="merge-file-label">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => handleFileChange(field.key, e.target.files[0])}
                />
                <span>{files[field.key]?.name || 'Choose file'}</span>
              </label>
            </div>
          ))}
        </div>

        <div className="merge-actions">
          <button className="secondary-btn" onClick={onSkip}>
            Skip merge (I already have a combined file)
          </button>
          <button className="upload-btn" onClick={handleMerge} disabled={loading}>
            {loading ? 'Merging files...' : 'Merge & Continue'}
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}

        {result && (
          <div className="merge-result">
            <div className="result-header">
              <div>
                <h2>Merged workbook ready</h2>
                <p>
                  Rows: {result.total_rows.toLocaleString()} · Columns: {result.total_columns}
                </p>
                <p>
                  Sources used:{' '}
                  {result.sources_provided.length > 0 ? result.sources_provided.join(', ') : 'Base file only'}
                </p>
              </div>
              <div className="result-actions">
                <a className="secondary-btn outline" href={result.download_url} target="_blank" rel="noreferrer">
                  Download merged file
                </a>
                <button className="upload-btn" onClick={handleAutoProceed} disabled={autoProcessing}>
                  {autoProcessing ? 'Preparing summary...' : 'Auto-run next step'}
                </button>
              </div>
            </div>

            {result.sources_missing?.length ? (
              <p className="missing-note">
                Missing optional files:{' '}
                {result.sources_missing
                  .filter((key) => !result.sources_provided.includes(key))
                  .map((key) => SOURCE_FIELDS.find((f) => f.key === key)?.label || key)
                  .join(', ')}
              </p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}

export default MergePrepScreen

