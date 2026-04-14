from __future__ import annotations

from pathlib import Path

import joblib
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field

from model_utils import build_explanation, engineer_features, risk_category, top_feature_importances
from training.train_model import train_and_save_models

BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / 'models'
RF_MODEL_PATH = MODEL_DIR / 'random_forest.pkl'
LOGREG_MODEL_PATH = MODEL_DIR / 'logistic_regression.pkl'

app = FastAPI(title='SecureLend ML Service', version='1.0.0')

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)


class PredictionRequest(BaseModel):
    model_config = ConfigDict(extra='ignore')

    income: float = Field(gt=0)
    creditScore: float = Field(ge=300, le=850)
    loanAmount: float = Field(gt=0)
    employment: str


class PredictionResponse(BaseModel):
    riskScore: float
    category: str
    explanation: str
    featureImportance: list[dict[str, float | str]]
    baselineRiskScore: float
    model: str
    policyThresholds: dict[str, float]


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

        risk_score = float(rf.predict_proba(feature_bundle.frame)[0][1])
        baseline_score = float(logreg.predict_proba(feature_bundle.frame)[0][1])
        category = risk_category(risk_score)

        preprocessor = rf.named_steps['preprocessor']
        classifier = rf.named_steps['classifier']
        transformed_feature_names = list(preprocessor.get_feature_names_out())
        feature_importance = top_feature_importances(
            transformed_feature_names,
            list(classifier.feature_importances_),
        )

        explanation = build_explanation(feature_importance, feature_bundle.engineered, risk_score)

        return {
            'riskScore': round(risk_score, 4),
            'category': category,
            'explanation': explanation,
            'featureImportance': feature_importance,
            'baselineRiskScore': round(baseline_score, 4),
            'model': 'random_forest',
            'policyThresholds': {
                'lowMaxExclusive': 0.3,
                'mediumMaxInclusive': 0.7,
            },
        }
    except Exception as error:
        raise HTTPException(status_code=500, detail=f'Prediction failed: {error}') from error
