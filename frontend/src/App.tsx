import React, { useState, useEffect, useRef } from 'react';
import { 
  FileSpreadsheet, 
  ArrowRight, 
  RotateCcw, 
  Printer, 
  AlertCircle, 
  Activity, 
  Info,
  HelpCircle,
  X,
  Database,
  Brain,
  Sliders,
  Compass,
  Eye,
  ClipboardList
} from 'lucide-react';
import { scanFile, runAnalysis, explainInstance, parseCSV } from './services/api';
import type { ScanResult, AnalysisResult, LocalExplanation } from './types';
import { HorizontalBarChart, ModelBarChart } from './components/CustomChart';

function App() {
  // Application State
  const [file, setFile] = useState<File | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  
  // Loaders & Progress
  const [loadingScan, setLoadingScan] = useState(false);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [activeStage, setActiveStage] = useState<'scanning' | 'profiling' | 'training' | 'explaining' | 'done'>('scanning');
  const [error, setError] = useState<string | null>(null);
  const [backendHealthy, setBackendHealthy] = useState<boolean | null>(null);

  // Configuration settings
  const [targetColumn, setTargetColumn] = useState<string>('');
  const [taskType, setTaskType] = useState<string>('classification');
  const [testSize, setTestSize] = useState<number>(0.2);
  const [enableTwoStage, setEnableTwoStage] = useState<string>('auto');

  const [parsedDataset, setParsedDataset] = useState<Record<string, any>[]>([]);

  // LIME Local Explainer State
  const [selectedRowIdx, setSelectedRowIdx] = useState<number>(0);
  const [limeInputs, setLimeInputs] = useState<Record<string, any>>({});
  const [limeResult, setLimeResult] = useState<LocalExplanation | null>(null);
  const [loadingLime, setLoadingLime] = useState(false);
  const [limeError, setLimeError] = useState<string | null>(null);

  // Modal State for Model Details
  const [activeJustificationModel, setActiveJustificationModel] = useState<{
    model: string;
    justification: string;
    metrics: any;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check Backend Health on Mount
  useEffect(() => {
    fetch('http://localhost:8000/health')
      .then(res => res.json())
      .then(() => setBackendHealthy(true))
      .catch(() => setBackendHealthy(false));
  }, []);

  // Sync LIME Inputs when preview or selection changes
  useEffect(() => {
    if (scanResult && scanResult.preview && scanResult.preview[selectedRowIdx]) {
      const row = scanResult.preview[selectedRowIdx];
      // Sync all column keys excluding target column
      const inputs: Record<string, any> = {};
      Object.keys(row).forEach(key => {
        if (key !== targetColumn) {
          inputs[key] = row[key];
        }
      });
      setLimeInputs(inputs);
      setLimeResult(null);
      setLimeError(null);
    }
  }, [selectedRowIdx, scanResult, targetColumn]);

  // Handle local file selection
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    await processFile(selectedFile);
  };

  // Process file (both upload and sample trigger)
  const processFile = async (selectedFile: File) => {
    setFile(selectedFile);
    setLoadingScan(true);
    setError(null);
    setScanResult(null);
    setAnalysisResult(null);
    
    try {
      const text = await selectedFile.text();
      setParsedDataset(parseCSV(text));
      
      const scanRes = await scanFile(selectedFile);
      setScanResult(scanRes);
      setTargetColumn(scanRes.recommendations.target_column);
      setTaskType(scanRes.recommendations.task_type);
    } catch (err: any) {
      setError(err.message || 'Error scanning dataset file. Make sure backend is running.');
      setFile(null);
    } finally {
      setLoadingScan(false);
    }
  };

  // Load sample dataset from public folder
  const loadSampleDataset = async (filename: string) => {
    setLoadingScan(true);
    setError(null);
    try {
      const response = await fetch(`/${filename}`);
      if (!response.ok) throw new Error(`Could not load ${filename}. Check if file is in public directory.`);
      const text = await response.text();
      setParsedDataset(parseCSV(text));
      
      const blob = new Blob([text], { type: 'text/csv' });
      const sampleFile = new File([blob], filename, { type: 'text/csv' });
      setFile(sampleFile);
      
      const scanRes = await scanFile(sampleFile);
      setScanResult(scanRes);
      setTargetColumn(scanRes.recommendations.target_column);
      setTaskType(scanRes.recommendations.task_type);
    } catch (err: any) {
      setError(err.message || 'Failed to scan sample dataset.');
      setFile(null);
    } finally {
      setLoadingScan(false);
    }
  };

  // Run full ML analysis
  const executeDiagnostics = async () => {
    if (!file) return;
    setLoadingAnalysis(true);
    setError(null);
    setActiveStage('scanning');
    
    // Simulate checklist progression for smoother UI transition
    const stageTimer1 = setTimeout(() => setActiveStage('profiling'), 1000);
    const stageTimer2 = setTimeout(() => setActiveStage('training'), 2500);
    const stageTimer3 = setTimeout(() => setActiveStage('explaining'), 4500);

    try {
      const result = await runAnalysis(file, {
        target_column: targetColumn,
        task_type: taskType,
        test_size: testSize,
        enable_two_stage: enableTwoStage
      });
      
      // Clear timers and show finished
      clearTimeout(stageTimer1);
      clearTimeout(stageTimer2);
      clearTimeout(stageTimer3);
      setActiveStage('done');
      
      // Artificial delay to let user see "completed" checks
      setTimeout(() => {
        setAnalysisResult(result);
        setLoadingAnalysis(false);
      }, 600);

    } catch (err: any) {
      clearTimeout(stageTimer1);
      clearTimeout(stageTimer2);
      clearTimeout(stageTimer3);
      setError(err.message || 'An error occurred during training.');
      setLoadingAnalysis(false);
    }
  };

  // Run LIME Local Explainer
  const runLimeExplainer = async () => {
    if (!analysisResult) return;
    setLoadingLime(true);
    setLimeError(null);
    setLimeResult(null);

    try {
      const res = await explainInstance(
        parsedDataset,
        analysisResult.target_column.selected,
        analysisResult.training_evaluation.best_model.model,
        analysisResult.task_type.detected,
        limeInputs
      );
      if (res.local_explanation) {
        setLimeResult(res.local_explanation);
      } else {
        throw new Error(res.error || 'Local explanation could not be computed for this model type.');
      }
    } catch (err: any) {
      setLimeError(err.message || 'Failed to compute prediction explanation.');
    } finally {
      setLoadingLime(false);
    }
  };

  // Reset entire dashboard
  const handleReset = () => {
    setFile(null);
    setScanResult(null);
    setAnalysisResult(null);
    setError(null);
    setParsedDataset([]);
    setSelectedRowIdx(0);
    setLimeInputs({});
  };

  return (
    <div style={{ position: 'relative', width: '100%', minHeight: '100vh' }}>
      {/* Background Film Grain Overlay */}
      <div className="grain-drift" />

      {/* Floated Header */}
      {file && (
        <header className="no-print" style={{
          borderBottom: '1px solid var(--border)',
          padding: '16px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(13, 18, 16, 0.85)',
          backdropFilter: 'blur(12px)',
          position: 'sticky',
          top: 0,
          zIndex: 100
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }} onClick={handleReset} className="cursor-pointer">
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '14px',
              fontWeight: 600,
              letterSpacing: '0.05em',
              color: 'var(--highlight)'
            }}>
              MODAL DIAGNOSTIC SANDBOX
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Health Badge */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              color: backendHealthy ? 'var(--accent)' : 'var(--text-muted)',
              border: '1px solid var(--border)',
              padding: '4px 10px',
              borderRadius: '4px',
              background: '#0d1210'
            }}>
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: backendHealthy ? 'var(--accent)' : '#ef4444'
              }} />
              {backendHealthy ? 'HEALTHY' : 'BACKEND OFFLINE'}
            </div>
          </div>
        </header>
      )}

      {/* Main Container */}
      <main style={{ maxWidth: '1080px', margin: '0 auto', padding: '40px 24px' }}>
        
        {/* Error notification block */}
        {error && (
          <div className="animate-slide-up" style={{
            background: '#221415',
            border: '1px solid #451a1c',
            padding: '16px',
            borderRadius: '4px',
            color: '#f87171',
            marginBottom: '32px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontSize: '13px'
          }}>
            <AlertCircle size={16} />
            <div style={{ flex: 1 }}>{error}</div>
            <button 
              onClick={() => setError(null)} 
              style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer' }}
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* ========================================== */}
        {/* PHASE 1 & 2: THE LANDING HERO & SETUP STAGE */}
        {/* ========================================== */}
        {/* ========================================== */}
        {/* PHASE 1: THE LANDING HERO & INFORMATION PAGE */}
        {/* ========================================== */}
        {!file && (
          <div className="fade-in-blur" style={{ width: '100%' }}>
            <section style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              paddingTop: '8vh',
              paddingBottom: '6vh',
              position: 'relative'
            }}>
              {/* Centered Top Header Pill */}
              <div className="header-pill">
                <span className="header-pill-link">
                  ADAPTIVE ML DIAGNOSTICS WORKSHOP
                </span>
              </div>

              {/* Title with Rise-Up Reveal Animation */}
              <h1 style={{
                fontSize: '56px',
                fontFamily: 'var(--font-sans)',
                fontWeight: 400,
                color: 'var(--highlight)',
                marginTop: '32px',
                marginBottom: '24px',
                letterSpacing: '-0.02em',
                lineHeight: 1.1,
                maxWidth: '680px'
              }}>
                <div className="reveal-wrapper">
                  <span className="reveal-text" style={{ animationDelay: '0.1s' }}>
                    <span style={{ color: 'var(--accent)', fontWeight: 300 }}>[</span>Self-Adaptive<span style={{ color: 'var(--accent)', fontWeight: 300 }}>]</span>
                  </span>
                </div>
                <br />
                <div className="reveal-wrapper">
                  <span className="reveal-text" style={{ animationDelay: '0.2s' }}>
                    model diagnostics<span style={{ color: 'var(--accent)' }}>.</span>
                  </span>
                </div>
              </h1>

              {/* Subtitle */}
              <p style={{
                fontSize: '15px',
                color: 'var(--text-secondary)',
                maxWidth: '560px',
                marginBottom: '40px',
                fontWeight: 300,
                lineHeight: 1.6
              }}>
                Interpretable model profiling, hyperparameter benchmarking, and local explanations.
              </p>

              {/* Centerpiece Control Pill */}
              <div className="centerpiece-control-pill">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="centerpiece-upload-btn"
                  style={{ padding: '10px 24px', fontSize: '13px' }}
                >
                  <span className="centerpiece-dot" /> Upload CSV ↗
                </button>
              </div>

              {/* Quickstart samples */}
              <div style={{ marginTop: '24px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)' }}>
                  OR TRY:
                </span>
                <button
                  onClick={() => loadSampleDataset('sample_titanic.csv')}
                  className="toggle-btn"
                  style={{ borderStyle: 'dashed', background: 'rgba(139,163,147,0.02)' }}
                >
                  sample_titanic.csv
                </button>
                <button
                  onClick={() => loadSampleDataset('test_iris.csv')}
                  className="toggle-btn"
                  style={{ borderStyle: 'dashed', background: 'rgba(139,163,147,0.02)' }}
                >
                  test_iris.csv
                </button>
              </div>
            </section>

            {/* Scrollable Information Grid Below the Fold */}
            <section className="info-section">
              <span className="info-section-title">§ PIPELINE WORKSHOP FEATURES</span>
              
              <div className="features-grid">
                <div className="feature-card">
                  <div className="feature-card-icon">
                    <Database size={20} />
                  </div>
                  <h3 className="feature-card-title">Dataset Profiling</h3>
                  <p className="feature-card-description">
                    Extract statistical metrics, column datatypes, distributions, and missing value indicators from your uploaded dataset.
                  </p>
                </div>

                <div className="feature-card">
                  <div className="feature-card-icon">
                    <Brain size={20} />
                  </div>
                  <h3 className="feature-card-title">Adaptive Training</h3>
                  <p className="feature-card-description">
                    Automatically benchmarks multiple algorithm candidates (XGBoost, Random Forests, linear models) customized to your target column.
                  </p>
                </div>

                <div className="feature-card">
                  <div className="feature-card-icon">
                    <Sliders size={20} />
                  </div>
                  <h3 className="feature-card-title">Model Leaderboard</h3>
                  <p className="feature-card-description">
                    Compares cross-validation metrics, runtimes, and auto-generates written diagnostic justifications for the top selections.
                  </p>
                </div>

                <div className="feature-card">
                  <div className="feature-card-icon">
                    <Compass size={20} />
                  </div>
                  <h3 className="feature-card-title">Global SHAP Weights</h3>
                  <p className="feature-card-description">
                    Computes feature importances across the entire test subset, highlighting which metrics drive the pipeline decision.
                  </p>
                </div>

                <div className="feature-card">
                  <div className="feature-card-icon">
                    <Eye size={20} />
                  </div>
                  <h3 className="feature-card-title">LIME Local Explainer</h3>
                  <p className="feature-card-description">
                    Interactively query any prediction instance in the sandbox to visualize which column attributes drive individual scores.
                  </p>
                </div>

                <div className="feature-card">
                  <div className="feature-card-icon">
                    <ClipboardList size={20} />
                  </div>
                  <h3 className="feature-card-title">Publication Reports</h3>
                  <p className="feature-card-description">
                    Fully optimized, print-friendly diagnostics report layout ready to compile, save, and share with your team.
                  </p>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* Hidden Input File */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".csv,.xlsx,.xls"
          style={{ display: 'none' }}
        />

        {/* ========================================== */}
        {/* PHASE 2A: DATASET SCANNING LOADING STATE */}
        {/* ========================================== */}
        {file && loadingScan && (
          <section className="animate-slide-up" style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '50vh',
            textAlign: 'center'
          }}>
            <Activity className="animate-pulse-slow" size={28} style={{ color: 'var(--accent)', marginBottom: '20px' }} />
            <h2 style={{ fontSize: '18px', marginBottom: '6px', fontFamily: 'var(--font-mono)' }}>[Scanning Dataset Structure...]</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
              Determining column types, identifying targets, and parsing preview...
            </p>
          </section>
        )}

        {/* ========================================== */}
        {/* PHASE 2B: DEDICATED CONFIGURATION & PREVIEW */}
        {/* ========================================== */}
        {file && scanResult && !loadingScan && !analysisResult && !loadingAnalysis && (
          <section className="animate-slide-up" style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '32px',
            paddingTop: '4vh',
            paddingBottom: '8vh'
          }}>
            <div>
              <span className="tag-mono" style={{ color: 'var(--accent)' }}>§ PIPELINE SETUP</span>
              <h1 style={{
                fontSize: '36px',
                fontFamily: 'var(--font-sans)',
                fontWeight: 400,
                color: 'var(--highlight)',
                marginTop: '8px',
                letterSpacing: '-0.01em'
              }}>
                <span style={{ color: 'var(--accent)', fontWeight: 300 }}>[</span>Pipeline<span style={{ color: 'var(--accent)', fontWeight: 300 }}>]</span> setup.
              </h1>
            </div>

            {/* File info banner */}
            <div className="glass-panel" style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              padding: '16px 20px',
              background: 'rgba(13, 18, 16, 0.4)'
            }}>
              <FileSpreadsheet size={24} style={{ color: 'var(--accent)' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '14px', color: 'var(--highlight)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {scanResult.filename}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                  {scanResult.count} rows · {scanResult.columns.length} columns loaded
                </div>
              </div>
              <button 
                onClick={handleReset}
                className="btn-secondary"
                style={{ fontSize: '11px', padding: '6px 14px' }}
              >
                Reset File
              </button>
            </div>

            {/* Parameter selection board */}
            <div className="glass-panel" style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '24px',
              background: 'rgba(13, 18, 16, 0.2)'
            }}>
              {/* Left Column: Target selector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                    TARGET COLUMN
                  </label>
                  <select 
                    value={targetColumn} 
                    onChange={e => setTargetColumn(e.target.value)}
                    className="setup-select"
                  >
                    {scanResult.columns.map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                  <div style={{
                    fontSize: '11px', 
                    color: 'var(--text-secondary)', 
                    fontFamily: 'var(--font-mono)', 
                    marginTop: '4px', 
                    lineHeight: 1.4,
                    background: 'rgba(139, 163, 147, 0.03)',
                    border: '1px solid var(--border)',
                    padding: '8px 10px',
                    borderRadius: '4px'
                  }}>
                    <span style={{ color: 'var(--accent)' }}>Auto-suggested:</span> "{scanResult.recommendations.target_column}" ({scanResult.recommendations.target_justification})
                  </div>
                </div>

                {/* Task selection */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>TASK TYPE OVERRIDE</span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {['classification', 'regression'].map(type => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setTaskType(type)}
                        className={`toggle-btn ${taskType === type ? 'active' : ''}`}
                        style={{ flex: 1, padding: '8px 12px', fontSize: '11px' }}
                      >
                        {type === 'classification' ? 'Classification' : 'Regression'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column: Split & Adaptive search */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>TRAIN/TEST SPLIT</span>
                  <select
                    value={testSize}
                    onChange={e => setTestSize(parseFloat(e.target.value))}
                    className="setup-select"
                  >
                    <option value="0.2">Default (80/20 split) ⌵</option>
                    <option value="0.1">90/10 split ⌵</option>
                    <option value="0.25">75/25 split ⌵</option>
                    <option value="0.3">70/30 split ⌵</option>
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>TWO-STAGE ADAPTIVE SEARCH</span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {['auto', 'true', 'false'].map(mode => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setEnableTwoStage(mode)}
                        className={`toggle-btn ${enableTwoStage === mode ? 'active' : ''}`}
                        style={{ flex: 1, padding: '8px 12px', fontSize: '11px' }}
                      >
                        {mode.toUpperCase()}
                      </button>
                    ))}
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                    Auto runs deep search if features exceed threshold.
                  </span>
                </div>
              </div>
            </div>

            {/* Dataset Preview */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h4 style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                DATASET PREVIEW (FIRST 5 ROWS)
              </h4>
              <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '4px', background: '#090e0c' }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '12px',
                  fontFamily: 'var(--font-mono)',
                  textAlign: 'left'
                }}>
                  <thead>
                    <tr style={{ background: '#0d1210', borderBottom: '1px solid var(--border)' }}>
                      {scanResult.columns.map(col => (
                        <th key={col} style={{ padding: '10px 14px', color: col === targetColumn ? 'var(--accent)' : 'var(--text-muted)', fontWeight: 500 }}>
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {scanResult.preview.map((row, rIdx) => (
                      <tr key={rIdx} style={{ borderBottom: rIdx < 4 ? '1px solid var(--border)' : 'none', background: rIdx % 2 === 0 ? 'transparent' : 'rgba(139,163,147,0.01)' }}>
                        {scanResult.columns.map(col => (
                          <td key={col} style={{ padding: '10px 14px', color: col === targetColumn ? 'var(--highlight)' : 'var(--text-secondary)' }}>
                            {row[col] !== null ? String(row[col]) : 'NaN'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '12px' }}>
              <button
                onClick={handleReset}
                className="btn-secondary"
                style={{ padding: '12px 24px' }}
              >
                CANCEL
              </button>
              <button
                onClick={executeDiagnostics}
                className="btn-primary"
                style={{ padding: '12px 36px', fontSize: '13px' }}
              >
                START DIAGNOSTICS <ArrowRight size={14} />
              </button>
            </div>
          </section>
        )}

        {/* ========================================== */}
        {/* PHASE 3: RUNNING PIPELINE CHECKLIST */}
        {/* ========================================== */}
        {loadingAnalysis && (
          <section className="animate-slide-up" style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '40vh',
            textAlign: 'center'
          }}>
            <Activity className="animate-pulse-slow" size={32} style={{ color: 'var(--accent)', marginBottom: '24px' }} />
            <h2 style={{ fontSize: '20px', marginBottom: '8px' }}>Executing Model Diagnostics</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '32px' }}>
              Adaptive pipeline is analyzing your dataset.
            </p>

            {/* Checklist */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: '12px',
              width: '100%',
              maxWidth: '320px',
              border: '1px solid var(--border)',
              padding: '20px',
              borderRadius: '4px',
              background: 'var(--bg-card)'
            }}>
              {[
                { id: 'scanning', label: 'Parsing data & structure' },
                { id: 'profiling', label: 'Extracting data profile' },
                { id: 'training', label: 'Evaluating candidate models' },
                { id: 'explaining', label: 'Computing SHAP importances' }
              ].map((stage) => {
                const stages = ['scanning', 'profiling', 'training', 'explaining', 'done'];
                const currentIdx = stages.indexOf(activeStage);
                const stageIdx = stages.indexOf(stage.id);
                
                let iconColor = 'var(--text-muted)';
                let labelColor = 'var(--text-muted)';
                let prefix = '[ ]';
                
                if (stageIdx < currentIdx) {
                  iconColor = '#98b4a6'; // Checked green
                  labelColor = 'var(--highlight)';
                  prefix = '[✓]';
                } else if (stageIdx === currentIdx) {
                  iconColor = 'var(--accent)'; // Active gold
                  labelColor = 'var(--highlight)';
                  prefix = '[→]';
                }

                return (
                  <div key={stage.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    color: labelColor
                  }}>
                    <span style={{ color: iconColor }}>{prefix}</span>
                    <span>{stage.label}</span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ========================================== */}
        {/* PHASE 4: FULL SCROLLABLE ANALYSIS REPORT */}
        {/* ========================================== */}
        {analysisResult && !loadingAnalysis && (
          <section className="animate-slide-up" style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '40px'
          }}>
            
            {/* Header section (action menu & overview) */}
            <div className="no-print" style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid var(--border)',
              paddingBottom: '16px'
            }}>
              <div>
                <h2 style={{ fontSize: '22px', fontWeight: 500 }}>Diagnostic sandbox report</h2>
                <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: '4px' }}>
                  FILE: <span style={{ color: 'var(--accent)' }}>{analysisResult.filename}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => window.print()} className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <Printer size={14} /> PRINT REPORT
                </button>
                <button onClick={handleReset} className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <RotateCcw size={14} /> RUN FRESH ANALYSIS
                </button>
              </div>
            </div>

            {/* CONFIG OVERVIEW CHECK BOX */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: '16px'
            }}>
              <div className="glass-panel" style={{ padding: '16px' }}>
                <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>TARGET FEATURE</div>
                <div style={{ fontSize: '15px', color: 'var(--accent)', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
                  {analysisResult.target_column.selected}
                </div>
              </div>
              <div className="glass-panel" style={{ padding: '16px' }}>
                <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>TASK TYPE</div>
                <div style={{ fontSize: '15px', color: 'var(--highlight)', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
                  {analysisResult.task_type.detected.toUpperCase()}
                </div>
              </div>
              <div className="glass-panel" style={{ padding: '16px' }}>
                <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>TRAIN/TEST SPLIT</div>
                <div style={{ fontSize: '15px', color: 'var(--highlight)', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
                  {analysisResult.training_evaluation.train_samples} / {analysisResult.training_evaluation.test_samples} records
                </div>
              </div>
            </div>

            {/* ========================================== */}
            {/* SECTION 1: DATA PROFILE REPORT */}
            {/* ========================================== */}
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
                <span className="tag-mono" style={{ color: 'var(--accent)' }}>§ SECTION 01</span>
                <h3 style={{ fontSize: '18px', marginTop: '4px' }}>Dataset Statistical Profile</h3>
              </div>

              {/* Numerical vs categorical split info */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '16px' }}>
                {[
                  { label: 'Total rows', val: analysisResult.profiling.total_samples },
                  { label: 'Total features', val: analysisResult.profiling.total_features },
                  { label: 'Numeric features', val: analysisResult.profiling.numerical_features },
                  { label: 'Categorical features', val: analysisResult.profiling.categorical_features }
                ].map((stat, i) => (
                  <div key={i} style={{ borderLeft: '2px solid var(--border)', paddingLeft: '12px' }}>
                    <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{stat.label.toUpperCase()}</div>
                    <div style={{ fontSize: '22px', fontWeight: 600, marginTop: '4px' }}>{stat.val}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', marginTop: '10px' }}>
                {/* Missing Values list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h4 style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                    MISSING VALUE RATIO
                  </h4>
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    border: '1px solid var(--border)',
                    padding: '16px',
                    borderRadius: '4px',
                    background: '#060a08'
                  }}>
                    {Object.keys(analysisResult.profiling.missing_value_percentage).length > 0 ? (
                      Object.entries(analysisResult.profiling.missing_value_percentage).map(([col, pct]) => (
                        <div key={col} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>{col}</span>
                            <span style={{ color: pct > 10 ? '#ef4444' : 'var(--text-muted)' }}>{pct.toFixed(2)}%</span>
                          </div>
                          {/* Visual progress scale */}
                          <div style={{ height: '4px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{
                              height: '100%',
                              width: `${pct}%`,
                              background: pct > 10 ? '#ef4444' : 'var(--accent)',
                              transition: 'width 0.8s ease-out'
                            }} />
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>No missing values found in dataset.</div>
                    )}
                  </div>
                </div>

                {/* Target details */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h4 style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                    TARGET COLUMN ANALYSIS ("{analysisResult.target_column.selected}")
                  </h4>
                  <div style={{
                    border: '1px solid var(--border)',
                    padding: '16px',
                    borderRadius: '4px',
                    background: '#060a08',
                    minHeight: '130px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    gap: '12px'
                  }}>
                    {analysisResult.profiling.target_class_count ? (
                      // Classification Target Classes
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', paddingBottom: '4px' }}>
                          CLASS FREQUENCY DETAILS
                        </div>
                        {Object.entries(analysisResult.profiling.target_class_count).map(([cls, cnt]) => (
                          <div key={cls} style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>{cls}</span>
                            <span style={{ color: 'var(--highlight)' }}>{cnt} samples</span>
                          </div>
                        ))}
                      </div>
                    ) : analysisResult.profiling.target_range ? (
                      // Regression Target Bounds
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div style={{ borderLeft: '1px dashed var(--border)', paddingLeft: '12px' }}>
                          <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>MIN RANGE BOUND</div>
                          <div style={{ fontSize: '18px', fontFamily: 'var(--font-mono)', fontWeight: 500, color: 'var(--accent)' }}>
                            {analysisResult.profiling.target_range.min.toFixed(4)}
                          </div>
                        </div>
                        <div style={{ borderLeft: '1px dashed var(--border)', paddingLeft: '12px' }}>
                          <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>MAX RANGE BOUND</div>
                          <div style={{ fontSize: '18px', fontFamily: 'var(--font-mono)', fontWeight: 500, color: 'var(--accent)' }}>
                            {analysisResult.profiling.target_range.max.toFixed(4)}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>No target analytics available.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ========================================== */}
            {/* SECTION 2: LEADERBOARD & SCORES */}
            {/* ========================================== */}
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
                <span className="tag-mono" style={{ color: 'var(--accent)' }}>§ SECTION 02</span>
                <h3 style={{ fontSize: '18px', marginTop: '4px' }}>Model Pipeline Leaderboard</h3>
              </div>

              {/* Best Model Standout Hero */}
              <div style={{
                background: 'rgba(var(--accent-rgb), 0.04)',
                border: '1px solid var(--accent)',
                padding: '20px',
                borderRadius: '4px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10px',
                    color: 'var(--accent)',
                    border: '1px solid var(--accent)',
                    padding: '2px 8px',
                    borderRadius: '2px'
                  }}>
                    RECOMMENDED CHAMPION PIPELINE
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
                    METRIC STRATEGY: {analysisResult.training_evaluation.training_strategy.mode.toUpperCase()}
                  </div>
                </div>
                
                <h4 style={{ fontSize: '20px', color: 'var(--highlight)' }}>
                  {analysisResult.training_evaluation.best_model.model}
                </h4>

                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.45, borderLeft: '2px solid var(--accent)', paddingLeft: '12px' }}>
                  {analysisResult.training_evaluation.best_model.justification}
                </p>
              </div>

              {/* Model comparison table & score chart side by side */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '32px', alignItems: 'start' }}>
                
                {/* Leaderboard list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h4 style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                    RANKED PIPELINE EVALUATION
                  </h4>
                  <div style={{ border: '1px solid var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                    <table style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: '12px',
                      fontFamily: 'var(--font-mono)',
                      textAlign: 'left'
                    }}>
                      <thead>
                        <tr style={{ background: '#0d1210', borderBottom: '1px solid var(--border)' }}>
                          <th style={{ padding: '10px 14px', color: 'var(--text-muted)', fontWeight: 500 }}>MODEL</th>
                          {analysisResult.task_type.detected === 'classification' ? (
                            <>
                              <th style={{ padding: '10px 14px', color: 'var(--text-muted)', fontWeight: 500 }}>ACCURACY</th>
                              <th style={{ padding: '10px 14px', color: 'var(--text-muted)', fontWeight: 500 }}>F1-SCORE</th>
                            </>
                          ) : (
                            <>
                              <th style={{ padding: '10px 14px', color: 'var(--text-muted)', fontWeight: 500 }}>R² SCORE</th>
                              <th style={{ padding: '10px 14px', color: 'var(--text-muted)', fontWeight: 500 }}>RMSE</th>
                            </>
                          )}
                          <th style={{ padding: '10px 14px', color: 'var(--text-muted)', fontWeight: 500 }}>DETAILS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analysisResult.training_evaluation.models_evaluated.map((item, idx) => {
                          const isBest = item.model === analysisResult.training_evaluation.best_model.model;
                          return (
                            <tr key={item.model} style={{ 
                              borderBottom: idx < analysisResult.training_evaluation.models_evaluated.length - 1 ? '1px solid var(--border)' : 'none',
                              background: isBest ? 'rgba(var(--accent-rgb), 0.02)' : 'transparent'
                            }}>
                              <td style={{ padding: '10px 14px', color: isBest ? 'var(--accent)' : 'var(--highlight)', fontWeight: isBest ? 600 : 400 }}>
                                {item.model} {isBest && '★'}
                              </td>
                              {analysisResult.task_type.detected === 'classification' ? (
                                <>
                                  <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>{item.metrics.accuracy?.toFixed(4)}</td>
                                  <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>{item.metrics.f1_score?.toFixed(4)}</td>
                                </>
                              ) : (
                                <>
                                  <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>{item.metrics.r2_score?.toFixed(4)}</td>
                                  <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>{item.metrics.rmse?.toFixed(4)}</td>
                                </>
                              )}
                              <td style={{ padding: '10px 14px' }}>
                                <button
                                  onClick={() => setActiveJustificationModel({
                                    model: item.model,
                                    justification: item.justification || 'Trained on dataset features with model-specific preprocessors.',
                                    metrics: item.metrics
                                  })}
                                  className="toggle-btn"
                                  style={{ padding: '2px 8px', fontSize: '10px' }}
                                >
                                  VIEW INFO
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Score chart */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h4 style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                    METRIC COMPARISON CHART
                  </h4>
                  <div className="glass-panel" style={{ padding: '16px', background: '#060a08' }}>
                    <ModelBarChart
                      data={analysisResult.training_evaluation.models_evaluated.map(m => ({
                        label: m.model,
                        value: m.primary_value
                      }))}
                      metricName={analysisResult.task_type.detected === 'classification' ? 'Accuracy' : 'R² Score'}
                    />
                  </div>
                </div>

              </div>
            </div>

            {/* ========================================== */}
            {/* SECTION 3: EXPLAINABILITY (SHAP & LIME) */}
            {/* ========================================== */}
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
                <span className="tag-mono" style={{ color: 'var(--accent)' }}>§ SECTION 03</span>
                <h3 style={{ fontSize: '18px', marginTop: '4px' }}>Model Interpretability</h3>
              </div>

              {/* Check if explanations yielded an error */}
              {analysisResult.explanations.error ? (
                <div style={{
                  border: '1px solid var(--border)',
                  padding: '16px',
                  borderRadius: '4px',
                  color: 'var(--text-muted)',
                  fontSize: '12px',
                  fontFamily: 'var(--font-mono)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <Info size={14} /> Note: {analysisResult.explanations.error}. {analysisResult.explanations.note}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                  
                  {/* Global Explanations (SHAP Chart) */}
                  <div style={{ display: 'grid', gridTemplateColumns: '0.9fr 1.1fr', gap: '32px', alignItems: 'start' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <h4 style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                        GLOBAL FEATURE IMPORTANCE (SHAP)
                      </h4>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                        Calculated by running SHAP values over the background training data. The horizontal bars indicate which features have the highest aggregate contribution to the model's target predictions.
                      </p>
                    </div>
                    
                    <div className="glass-panel" style={{ padding: '20px', background: '#060a08' }}>
                      <HorizontalBarChart
                        data={Object.entries(analysisResult.explanations.global_explanation.feature_importance)
                          .map(([feat, val]) => ({
                            label: feat,
                            value: val
                          }))
                          // Sort highest first
                          .sort((a, b) => b.value - a.value)
                          // Slice top 8 features for cleanliness
                          .slice(0, 8)
                        }
                        metricLabel="SHAP Importance"
                      />
                    </div>
                  </div>

                  <hr style={{ border: 'none', borderTop: '1px solid var(--border)' }} />

                  {/* Local Instance Explainer (LIME) */}
                  <div style={{ display: 'grid', gridTemplateColumns: '0.90fr 1.10fr', gap: '32px', alignItems: 'start' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <h4 style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                          LOCAL PREDICTION INTERPRETER (LIME)
                        </h4>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                          Simulate single row predictions. Select a row index from your dataset preview below, modify individual feature inputs in real-time, and compute the explanation weights to see which feature values drive the decision.
                        </p>
                      </div>

                      {/* Select row trigger */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>SELECT PREVIEW ROW:</span>
                        <select 
                          value={selectedRowIdx} 
                          onChange={e => setSelectedRowIdx(parseInt(e.target.value))}
                          style={{ background: '#111815', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '6px 12px', borderRadius: '4px', outline: 'none', fontFamily: 'var(--font-mono)', fontSize: '12px' }}
                        >
                          {[0, 1, 2, 3, 4].map(idx => (
                            <option key={idx} value={idx}>Row #{idx + 1}</option>
                          ))}
                        </select>
                      </div>

                      {/* Config Form Grid for the Selected Instance */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '12px',
                        maxHeight: '220px',
                        overflowY: 'auto',
                        border: '1px solid var(--border)',
                        padding: '12px',
                        borderRadius: '4px',
                        background: '#060a08'
                      }}>
                        {Object.keys(limeInputs).map(key => (
                          <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                              {key}
                            </span>
                            <input
                              type={typeof limeInputs[key] === 'number' ? 'number' : 'text'}
                              value={limeInputs[key] !== null ? limeInputs[key] : ''}
                              onChange={e => {
                                const val = e.target.value;
                                setLimeInputs(prev => ({
                                  ...prev,
                                  [key]: val === '' ? null : isNaN(Number(val)) ? val : Number(val)
                                }));
                              }}
                              style={{ width: '100%', padding: '4px 8px', fontSize: '11px', fontFamily: 'var(--font-mono)', background: 'var(--bg-card)' }}
                            />
                          </div>
                        ))}
                      </div>

                      <button
                        onClick={runLimeExplainer}
                        disabled={loadingLime}
                        className="btn-secondary"
                        style={{ fontSize: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
                      >
                        {loadingLime ? 'COMPUTING LIME EXPLANATION...' : '● EXPLAIN PREDICTION ↗'}
                      </button>
                    </div>

                    {/* LIME Charts display */}
                    <div className="glass-panel" style={{
                      padding: '20px',
                      background: '#060a08',
                      minHeight: '260px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      position: 'relative'
                    }}>
                      {limeError && (
                        <div style={{ color: '#ef4444', fontSize: '12px', fontFamily: 'var(--font-mono)', textAlign: 'center' }}>
                          Error: {limeError}
                        </div>
                      )}

                      {!limeResult && !limeError && !loadingLime && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '10px', color: 'var(--text-muted)' }}>
                          <HelpCircle size={24} />
                          <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
                            Click "Explain Prediction" to see local contributions.
                          </span>
                        </div>
                      )}

                      {loadingLime && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '10px', color: 'var(--accent)' }}>
                          <Activity className="animate-pulse-slow" size={24} />
                          <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)' }} className="animate-pulse-slow">
                            Fitting LIME explainer model...
                          </span>
                        </div>
                      )}

                      {limeResult && !loadingLime && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} className="animate-fade-in">
                          {/* Prediction headers */}
                          <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
                            <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                              PREDICTED VALUE: <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{limeResult.prediction}</span>
                            </span>
                            {limeResult.prediction_probability && (
                              <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                                PROB: <span style={{ color: 'var(--highlight)' }}>{(Math.max(...limeResult.prediction_probability) * 100).toFixed(1)}%</span>
                              </span>
                            )}
                          </div>

                          {/* LIME horizontal contribution bars */}
                          <HorizontalBarChart
                            data={limeResult.explanation.map(item => ({
                              label: item.feature,
                              value: item.contribution,
                              color: item.contribution >= 0 ? 'var(--accent)' : 'var(--accent-gold)' // Sage for positive, Champagne for negative
                            }))}
                            metricLabel="Contribution"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              )}
            </div>

          </section>
        )}

      </main>

      {/* Footer copyright */}
      <footer className="no-print" style={{
        borderTop: '1px solid var(--border)',
        padding: '32px 24px',
        textAlign: 'center',
        fontSize: '11px',
        fontFamily: 'var(--font-mono)',
        color: 'var(--text-muted)',
        marginTop: '60px'
      }}>
        § MODAL DIAGNOSTIC SANDBOX · VERSION 1.0.0 · MIT LICENSE
      </footer>

      {/* Model Justification Modal Popup */}
      {activeJustificationModel && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          padding: '20px'
        }} className="animate-fade-in" onClick={() => setActiveJustificationModel(null)}>
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            padding: '24px',
            borderRadius: '4px',
            maxWidth: '500px',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }} onClick={e => e.stopPropagation()} className="animate-slide-up">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
              <h4 style={{ fontSize: '16px', color: 'var(--highlight)' }}>{activeJustificationModel.model}</h4>
              <button 
                onClick={() => setActiveJustificationModel(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '16px' }}>
                {Object.entries(activeJustificationModel.metrics).map(([name, val]: any) => (
                  <div key={name} style={{ borderLeft: '1px solid var(--border)', paddingLeft: '8px' }}>
                    <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{name.toUpperCase()}</span>
                    <div style={{ fontSize: '14px', fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>{val.toFixed(4)}</div>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                {activeJustificationModel.justification}
              </p>
            </div>

            <button onClick={() => setActiveJustificationModel(null)} className="btn-secondary" style={{ width: '100%' }}>
              CLOSE
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
