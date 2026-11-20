"""SecureLend ML service: probability-of-default scoring with per-applicant explanations."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Literal

import joblib
import pandas as pd
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field

from model_utils import (
    BORROWER_CATEGORICAL,
    BORROWER_NUMERIC,
    FEATURE_LABELS,
    FULL_CATEGORICAL,
    FULL_NUMERIC,
    describe_value,
    features_from_application,
)

BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = Path(os.getenv('MODEL_DIR', BASE_DIR / 'models'))
if not MODEL_DIR.is_absolute():
    MODEL_DIR = (BASE_DIR / MODEL_DIR).resolve()

load_dotenv()

app = FastAPI(title='SecureLend ML Service', version='2.0.0')
allowed_origins = [o.strip() for o in os.getenv('CORS_ORIGINS', '').split(',') if o.strip()] or ['*']
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=allowed_origins != ['*'],
    allow_methods=['*'],
    allow_headers=['*'],
)

_state: dict = {}


def load_artifacts() -> dict:
    if _state:
        return _state
    required = ['credit_risk_personal.pkl', 'credit_risk_property.pkl', 'anomaly_detector.pkl', 'metrics.json', 'reference_profiles.json']
    if not all((MODEL_DIR / name).exists() for name in required):
        from training.train_model import train_and_save_models

        train_and_save_models(MODEL_DIR)

    _state['models'] = {
        'personal': joblib.load(MODEL_DIR / 'credit_risk_personal.pkl'),
        'property': joblib.load(MODEL_DIR / 'credit_risk_property.pkl'),
    }
    _state['anomaly'] = joblib.load(MODEL_DIR / 'anomaly_detector.pkl')
    _state['metrics'] = json.loads((MODEL_DIR / 'metrics.json').read_text())
    _state['reference'] = json.loads((MODEL_DIR / 'reference_profiles.json').read_text())
    return _state


class PredictionRequest(BaseModel):
    model_config = ConfigDict(extra='ignore')

    loanType: Literal['personal', 'property'] = 'personal'
    creditScore: float = Field(ge=300, le=900, description='CIBIL score (300-900)')
    monthlyIncome: float = Field(gt=0, description='Net monthly income')
    existingEmi: float = Field(default=0, ge=0)
    loanAmount: float = Field(gt=0)
    tenureMonths: int = Field(ge=1, le=480)
    newEmi: float | None = Field(default=None, ge=0)
    interestRate: float | None = Field(default=None, ge=0, le=60)
    yearsEmployed: float = Field(default=0, ge=0, le=60)
    residenceType: str = 'rented'
    purpose: str = 'other'
    missedPayments: int = Field(default=0, ge=0, le=100)
    recentCreditApplications: int = Field(default=0, ge=0, le=100)
    creditHistoryYears: float = Field(default=0, ge=0, le=80)


def risk_band(pd_value: float, bands: list[dict]) -> str:
    for band in bands:
        if band['min'] <= pd_value < band['max'] or (band['max'] >= 1.0 and pd_value >= band['min']):
            return band['band']
    return bands[-1]['band']


@app.get('/')
def root() -> dict[str, str]:
    return {'message': 'SecureLend ML service is running', 'health': '/health', 'predict': '/predict', 'modelInfo': '/model-info'}


@app.get('/health')
def health() -> dict[str, str]:
    return {'status': 'ok', 'service': 'securelend-ml'}


@app.get('/model-info')
def model_info() -> dict:
    return load_artifacts()['metrics']


@app.post('/predict')
def predict(request: PredictionRequest) -> dict:
    try:
        state = load_artifacts()
        payload = request.model_dump()
        loan_type = payload['loanType']
        row = features_from_application(payload)

        numeric, categorical = (FULL_NUMERIC, FULL_CATEGORICAL) if loan_type == 'personal' else (BORROWER_NUMERIC, BORROWER_CATEGORICAL)
        columns = numeric + categorical
        model = state['models'][loan_type]
        reference = state['reference'][loan_type]

        # Row 0 = applicant; row i = applicant with feature i set to a typical repaid borrower's value.
        rows = [{c: row[c] for c in columns}]
        for column in columns:
            variant = dict(rows[0])
            variant[column] = reference[column]
            rows.append(variant)
        probabilities = model.predict_proba(pd.DataFrame(rows, columns=columns))[:, 1]
        pd_value = float(probabilities[0])

        contributions = []
        for i, column in enumerate(columns, start=1):
            impact = pd_value - float(probabilities[i])
            contributions.append(
                {
                    'feature': column,
                    'label': FEATURE_LABELS[column],
                    'value': describe_value(column, row[column]),
                    'typicalValue': describe_value(column, reference[column]),
                    'impact': round(impact, 4),  # + raises default probability, - lowers it
                    'direction': 'increases_risk' if impact > 0.002 else ('decreases_risk' if impact < -0.002 else 'neutral'),
                }
            )
        contributions.sort(key=lambda item: abs(item['impact']), reverse=True)

        anomaly = state['anomaly'][loan_type]
        anomaly_frame = pd.DataFrame([{c: row[c] for c in anomaly['columns']}])
        anomaly_score = float(anomaly['pipeline'].decision_function(anomaly_frame)[0])
        is_anomalous = bool(anomaly['pipeline'].predict(anomaly_frame)[0] == -1)

        metrics = state['metrics']
        variant_metrics = metrics[loan_type]
        return {
            'loanType': loan_type,
            'probabilityOfDefault': round(pd_value, 4),
            'riskBand': risk_band(pd_value, metrics['riskBands']),
            'contributions': contributions,
            'anomaly': {'isAnomalous': is_anomalous, 'score': round(anomaly_score, 4)},
            'model': {
                'name': variant_metrics['selectedModel'],
                'version': metrics['modelVersion'],
                'rocAuc': variant_metrics['test']['rocAuc'],
                'trainedOn': metrics['dataset']['name'],
            },
        }
    except HTTPException:
        raise
    except Exception as error:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=f'Prediction failed: {error}') from error
