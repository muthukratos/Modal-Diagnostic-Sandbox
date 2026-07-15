# ML Model Diagnostic Sandbox

[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-green.svg)](https://fastapi.tiangolo.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Automated End-to-End Machine Learning Pipeline with Intelligent Model Selection**

Upload a CSV/Excel file → Get trained ML models with explanations

## 🚀 Quick Start

### 1. Clone Repository
```bash
git clone <your-repo-url>
cd model-diagnostic-sandbox
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Start Backend Server
Open a terminal in the root folder and activate the virtual environment:
* **Command Prompt (CMD)**:
  ```cmd
  venv\Scripts\activate
  uvicorn main:app --reload
  ```
* **PowerShell**:
  ```powershell
  .\venv\Scripts\Activate.ps1
  uvicorn main:app --reload
  ```
Server runs at: `http://localhost:8000`  
Interactive API docs: `http://localhost:8000/docs`

### 4. Start Frontend
Open a new terminal in the root folder and run:
```bash
cd frontend
npm run dev
```
**Note:** If `npm run dev` fails with a security error in PowerShell, use Command Prompt (cmd) or run:
```bash
cmd /c "npm run dev"
```

Frontend runs at: `http://localhost:5173` (or 5174 if 5173 is busy)

## ✨ Features

- 📊 **Automatic Dataset Profiling** - Analyzes data characteristics
- 🤖 **Intelligent Model Selection** - Rule-based filtering using dataset meta-features
- ⚡ **Adaptive Training** - Smart 2-stage optimization (60% faster on large datasets)
- 🔍 **Auto-Detection** - Automatically determines task type and target column
- 💡 **Model Explainability** - SHAP and LIME explanations
- 🛡️ **Robust Edge Case Handling** - Handles missing data, tiny datasets, categorical features

## 📖 Documentation

- **[PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md)** - Quick reference
- **[summary.md](summary.md)** - Complete technical documentation

## 🧪 Try It Out

Sample datasets included:
- `sample_titanic.csv` - Real-world classification
- `test_iris.csv` - Multi-class classification

```python
import requests

response = requests.post(
    'http://localhost:8000/upload-and-analyze',
    files={'file': open('sample_titanic.csv', 'rb')},
    data={'target_column': 'auto', 'task_type': 'auto'}
)

print(response.json())
```

## 📊 Supported Models

**Classification:** LogisticRegression, DecisionTree, RandomForest, GradientBoosting, KNeighbors

**Regression:** LinearRegression, DecisionTree, RandomForest, GradientBoosting, KNeighbors

## 🎯 Production Ready

- ✅ 5/5 end-to-end tests passing
- ✅ 8/10 edge cases handled
- ✅ Full explainability support
- ✅ Comprehensive error handling

## 🤝 Contributing

Contributions welcome! This is a production-ready ML automation system.

## 📝 License

MIT License - see LICENSE file for details

---

**Built with FastAPI, scikit-learn, SHAP, and LIME** 🚀


