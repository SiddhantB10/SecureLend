from __future__ import annotations

import os
from pathlib import Path

import joblib
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field

from model_utils import build_explanation, engineer_features, top_feature_importances
from training.train_model import train_and_save_models

BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / 'models'
RF_MODEL_PATH = MODEL_DIR / 'random_forest.pkl'
LOGREG_MODEL_PATH = MODEL_DIR / 'logistic_regression.pkl'

load_dotenv()


def parse_allowed_origins() -> list[str]:
    origins_raw = os.getenv('CORS_ORIGINS', '')
    return [origin.strip() for origin in origins_raw.split(',') if origin.strip()]

app = FastAPI(title='SecureLend ML Service', version='1.0.0')

allowed_origins = parse_allowed_origins() or ['*']

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)


class PredictionRequest(BaseModel):
    model_config = ConfigDict(extra='ignore')

    loanType: str = Field(default='personal')
    income: float = Field(gt=0)
    creditScore: float = Field(ge=300, le=900)
    loanAmount: float = Field(gt=0)
    existingDebt: float = Field(ge=0)
    propertyValue: float | None = Field(default=None, ge=0)
    employmentStatus: str | None = Field(default='stable')
    formulaScore: float | None = Field(default=None, ge=0)


class PredictionResponse(BaseModel):
    loanType: str
    mlScore: float
    explanation: str
    featureImportance: list[dict[str, float | str]]
    baselineRiskScore: float
    model: str
    riskScore: float


rf_pipeline = None
logreg_pipeline = None


def load_models() -> tuple[object, object]:
    global rf_pipeline, logreg_pipeline

    if rf_pipeline is not None and logreg_pipeline is not None:
        return rf_pipeline, logreg_pipeline

    if not RF_MODEL_PATH.exists() or not LOGREG_MODEL_PATH.exists():
        train_and_save_models(MODEL_DIR)

    rf_pipeline = joblib.load(RF_MODEL_PATH)
    logreg_pipeline = joblib.load(LOGREG_MODEL_PATH)
    return rf_pipeline, logreg_pipeline


@app.get('/health')
def health() -> dict[str, str]:
    return {'status': 'ok', 'service': 'securelend-ml'}


@app.post('/predict', response_model=PredictionResponse)
def predict(request: PredictionRequest) -> dict[str, object]:
    try:
        rf, logreg = load_models()
        feature_bundle = engineer_features(request.model_dump())

        ml_score = float(rf.predict_proba(feature_bundle.frame)[0][1])
        baseline_score = float(logreg.predict_proba(feature_bundle.frame)[0][1])

        preprocessor = rf.named_steps['preprocessor']
        classifier = rf.named_steps['classifier']
        transformed_feature_names = list(preprocessor.get_feature_names_out())
        feature_importance = top_feature_importances(
            transformed_feature_names,
            list(classifier.feature_importances_),
        )

        explanation = build_explanation(feature_importance, feature_bundle.engineered, ml_score)

        return {
            'loanType': feature_bundle.engineered['loanType'],
            'mlScore': round(ml_score, 4),
            'explanation': explanation,
            'featureImportance': feature_importance,
            'baselineRiskScore': round(baseline_score, 4),
            'model': 'random_forest',
            'riskScore': round(ml_score, 4),
        }
    except Exception as error:
        raise HTTPException(status_code=500, detail=f'Prediction failed: {error}') from error
