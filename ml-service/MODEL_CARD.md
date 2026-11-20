# SecureLend credit-risk model — model card

## What it predicts
The **probability of default (PD)**: the chance that the borrower stops repaying and the loan is
written off. It is one input to the decision. The final decision also applies lending policy
(FOIR, RBI loan-to-value caps, age, credit-score floor) and fraud/identity checks. See
`backend/services/decisionEngine.js`.

## Training data (real loan outcomes)
| | |
|---|---|
| Source | Lending Club personal loans issued June 2007 – December 2011 (public loan-level data) |
| Loans | 42,493 with a final outcome |
| Target | `Charged Off` = defaulted (1), `Fully Paid` = repaid (0) |
| Default rate | 15.1% |
| File | `data/lending_club_2007_2011.csv.gz` (see `data/README.md`) |

Loan-level data with real repayment outcomes **and** credit scores is not published for Indian
lenders (CIBIL data is private). Lending Club's data is the largest openly available real-world
equivalent. To make it transferable, the model only uses **currency-free** inputs. CIBIL scores
(300–900) are mapped linearly onto the FICO scale (300–850) used in the data.

## Inputs
| Feature | Personal model | Property model |
|---|---|---|
| Credit score | ✔ | ✔ |
| Existing EMIs as % of income | ✔ | ✔ |
| Years in current job / business | ✔ | ✔ |
| Missed payments (30+ days late) in last 2 years | ✔ | ✔ |
| Credit applications in last 6 months | ✔ | ✔ |
| Length of credit history | ✔ | ✔ |
| Residence type (rented / owned / owned with loan) | ✔ | ✔ |
| Loan tenure | ✔ | – |
| Loan purpose | ✔ | – |

Deliberately **not** used:
- **Loan size vs income.** Lending Club loans were small relative to income (median 0.16× annual
  income), so normal Indian loan sizes would be scored as extreme. Affordability is judged by
  the FOIR rule instead. This costs only 0.008 AUC.
- **Absolute income or amounts.** Currencies and price levels differ.
- **Age, gender, location.** These are not used for scoring, which avoids discrimination.
  Age is used only for the legal and policy eligibility check.

## Method
1. **Out-of-time validation.** Trained on loans issued before Sept 2011 (33,811). Tested on the
   newest loans, Sept–Dec 2011 (8,682). This mimics using the model on future applicants.
2. **Candidates.** Logistic regression and gradient boosting (`HistGradientBoostingClassifier`)
   with **monotonic constraints**: a higher credit score can never raise risk, more missed
   payments can never lower it, and so on. They were compared by 5-fold cross-validated ROC-AUC.
3. **Selected model.** Monotonic gradient boosting. It is as accurate as logistic regression and
   its explanations always point in a direction a lender would expect. Unconstrained logistic
   regression learned that missed payments *lower* risk, an artefact of how Lending Club approved
   loans.
4. **Calibration.** Sigmoid (Platt) calibration with 5-fold CV, so a PD of 0.15 really means
   ~15% of such borrowers default.
5. **Explanations.** For each applicant, every input is swapped for the value of a typical repaid
   borrower. The change in PD shows how much that input raised or lowered their risk.
6. **Anomaly detection.** An Isolation Forest per loan type flags the 1% most unusual
   combinations of inputs, which are sent to manual verification.
7. **Backend fallback.** A logistic scorecard exported to `backend/ml/scorecard.json` scores
   applications if this service is down. Variables with counter-intuitive signs were removed.

## Results on the out-of-time test set (8,682 newest loans)

| Metric | Personal model | Property model |
|---|---|---|
| ROC-AUC | **0.690** | 0.623 |
| Gini | 0.381 | 0.247 |
| KS statistic | 0.291 | 0.172 |
| PR-AUC (default class; base rate 16.1%) | 0.287 | 0.232 |
| Brier score | 0.127 | 0.132 |
| Mean predicted PD vs actual default rate | 14.8% vs 16.1% | 13.9% vs 16.1% |

5-fold CV ROC-AUC on the training period: personal model 0.681 ± 0.008 (logistic regression
0.682); property model 0.634 ± 0.005.

**How good is this?** Two very different algorithms (linear and boosted trees) both land at about
0.69. That suggests this is close to the limit of what these application-time inputs can predict.
Claims of "95%+ accuracy" for loan default usually come from leaked post-loan data (payments,
recoveries), or from accuracy on an imbalanced target: always predicting "repays" is already 84%
accurate here. That's why plain accuracy is not reported.

### Default rate by risk band (personal model, test set)
| Band | PD range | Share of applicants | Actual default rate |
|---|---|---|---|
| Very low | < 7% | 14.8% | 4.8% |
| Low | 7–12% | 27.7% | 9.6% |
| Medium | 12–20% | 33.8% | 16.5% |
| High | 20–30% | 20.4% | 28.7% |
| Very high | ≥ 30% | 3.4% | 38.0% |

Risk rises steadily from band to band, which is what the decision thresholds rely on.

## How the PD is used (backend decision engine)
| Loan type | Approve | Manual review | Decline |
|---|---|---|---|
| Personal (unsecured) | PD < 12% | 12–22% | ≥ 22% |
| Property (secured by collateral) | PD < 16% | 16–26% | ≥ 26% |

Policy rules and fraud checks can override these thresholds, and they are always listed as
reasons in the decision summary.

## Limitations, and what a production lender must add
- **Not trained on Indian outcomes.** Before real lending, retrain with the lender's own repayment
  history (`training/train_model.py` accepts any dataset mapped to the same features) and
  re-validate.
- **Self-reported credit data.** In production, the credit score, missed payments, enquiries and
  credit history must come from a credit bureau pull (CIBIL/Experian/CRIF) with the applicant's
  consent, not from the form.
- **Property model is weak** (AUC 0.62). Secured-loan decisions lean on the LTV and FOIR rules.
- **Fraud checks are rules plus anomaly detection.** Labelled application-fraud datasets are not
  public. Production needs PAN/Aadhaar verification APIs, bank-statement analysis and document
  checks.
- **Monitoring.** Track the population stability index (PSI) of inputs and the actual default
  rate per band every month, and retrain when they drift.

## Retraining
```bash
cd ml-service
python training/train_model.py   # writes models/*.pkl, models/metrics.json, backend/ml/scorecard.json
```

## Full model comparison (project report, Chapter 4)
`python training/evaluate_models.py` (needs `pip install -r requirements-dev.txt`) re-creates every
number and chart used in the report from the same data and split: rule-based baseline, logistic
regression, Random Forest (240 trees, depth 12) and the proposed model, the confusion matrix at the
decline threshold, calibration, risk bands, decision outcomes and permutation importance.
Results are written to `reports/evaluation.json` and `reports/fig_*.png`.
