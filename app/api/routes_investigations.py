from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
import os
import json
from app.database import get_db
from app.models.schema import Alert, Customer, Transaction, Account, Beneficiary, Device, InvestigationCase, ClassifiedAlert
from app.repositories.alert_repository import AlertRepository
from app.agents.state import create_initial_state_from_neon_alert
from app.agents.graph import investigation_graph
from app.auditor import LLMAuditor, generate_audit_docx

router = APIRouter()

# -------------------------------------------------------------
# 1. Pipeline Summary Metrics Endpoint
# -------------------------------------------------------------
@router.get("/summary")
def get_summary(db: Session = Depends(get_db)):
    """
    Returns live summary metrics and risk distribution from Neon DB.
    """
    accounts_ingested = db.query(func.count(Account.account_id)).scalar() or 0
    transactions_ingested = db.query(func.count(Transaction.transaction_id)).scalar() or 0
    total_alerts = db.query(func.count(Alert.alert_id)).scalar() or 0
    unique_accounts_with_alerts = db.query(func.count(func.distinct(Alert.customer_id))).scalar() or 0

    alerts = db.query(Alert).all()
    
    risk_level_counts = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}
    rule_counts = {}
    status_counts = {"OPEN": 0, "UNDER_INVESTIGATION": 0, "RESOLVED": 0, "ESCALATED": 0, "CLOSED": 0}

    for a in alerts:
        score = float(a.risk_score) if a.risk_score is not None else 0.0
        if score >= 75.0:
            risk_level_counts["CRITICAL"] += 1
        elif score >= 50.0:
            risk_level_counts["HIGH"] += 1
        elif score >= 25.0:
            risk_level_counts["MEDIUM"] += 1
        else:
            risk_level_counts["LOW"] += 1

        rule = a.alert_type or "UNKNOWN"
        rule_counts[rule] = rule_counts.get(rule, 0) + 1

        st = (a.status or "OPEN").upper()
        if st in status_counts:
            status_counts[st] += 1
        else:
            status_counts[st] = 1

    return {
        "accounts_ingested": accounts_ingested,
        "transactions_ingested": transactions_ingested,
        "raw_alerts_generated": total_alerts,
        "accounts_with_alerts": unique_accounts_with_alerts,
        "prioritized_alerts_count": total_alerts,
        "raw_alerts_by_rule": rule_counts,
        "classified_alerts_by_risk_level": risk_level_counts,
        "status_counts": status_counts,
        "pipeline_status": "HEALTHY",
        "system_version": "v2.4.1",
        "aggregation_window": "Past 24 hours"
    }

# -------------------------------------------------------------
# 2. Paginated & Filterable Alerts List Endpoint
# -------------------------------------------------------------
@router.get("/alerts")
def get_alerts(
    risk_level: Optional[str] = Query(None, description="Comma-separated risk levels: CRITICAL,HIGH,MEDIUM,LOW"),
    search: Optional[str] = Query(None, description="Search query matching alert ID, customer ID, or alert_type"),
    typology: Optional[str] = Query(None, description="Filter by alert_type"),
    status: Optional[str] = Query(None, description="Filter by alert status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """
    Returns filterable & paginated alerts from Neon DB matching Phase-1 ClassifiedAlert response structure.
    """
    query = db.query(Alert)

    if status and status.strip() and status.upper() != "ALL":
        query = query.filter(Alert.status == status.strip().upper())

    if typology and typology.strip() and typology.upper() != "ALL":
        query = query.filter(Alert.alert_type == typology.strip())

    alerts = query.order_by(Alert.created_at.desc(), Alert.risk_score.desc()).all()

    formatted_items = []
    for a in alerts:
        score = float(a.risk_score) if a.risk_score is not None else 0.0
        if score >= 75.0:
            calculated_risk_level = "CRITICAL"
        elif score >= 50.0:
            calculated_risk_level = "HIGH"
        elif score >= 25.0:
            calculated_risk_level = "MEDIUM"
        else:
            calculated_risk_level = "LOW"

        if risk_level:
            allowed_levels = {lvl.strip().upper() for lvl in risk_level.split(",") if lvl.strip()}
            if calculated_risk_level not in allowed_levels:
                continue

        if search:
            q = search.strip().lower()
            match_id = q in a.alert_id.lower()
            match_cust = q in (a.customer_id or "").lower()
            match_type = q in (a.alert_type or "").lower()
            if not (match_id or match_cust or match_type):
                continue

        formatted_items.append({
            "classified_alert_id": a.alert_id,
            "alert_id": a.alert_id,
            "account_id": a.customer_id,
            "customer_id": a.customer_id,
            "transaction_ids": [a.transaction_id] if a.transaction_id else [],
            "alert_type": a.alert_type,
            "triggered_rules": [a.alert_type],
            "detected_reason": f"Phase-1 Alert triggered: {a.alert_type} for customer {a.customer_id}",
            "evidence": {"risk_score": score, "transaction_id": a.transaction_id},
            "risk_score": score,
            "risk_level": calculated_risk_level,
            "timestamp": a.created_at.isoformat() if a.created_at else "",
            "status": a.status
        })

    total = len(formatted_items)
    total_pages = max(1, (total + page_size - 1) // page_size) if total > 0 else 1
    offset = (page - 1) * page_size
    paged_items = formatted_items[offset : offset + page_size]

    return {
        "items": paged_items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages
    }

# -------------------------------------------------------------
# 3. Read-Only Single Alert Detail Endpoint (CRITICAL RULE 8: DO NOT CLAIM)
# -------------------------------------------------------------
@router.get("/alerts/{alert_id}")
def get_alert_by_id(alert_id: str, db: Session = Depends(get_db)):
    """
    Retrieves detailed context for a single alert from Neon DB.
    MUST NOT modify alert status or claim it (READ-ONLY).
    """
    clean_id = alert_id.lstrip("#")
    repo = AlertRepository(db)
    enriched = repo.fetch_alert_read_only(clean_id)

    if not enriched:
        raise HTTPException(status_code=404, detail=f"Alert '{alert_id}' not found in database")

    alert_info = enriched.get("alert", {})
    score = float(alert_info.get("risk_score", 0.0))
    if score >= 75.0:
        risk_level = "CRITICAL"
    elif score >= 50.0:
        risk_level = "HIGH"
    elif score >= 25.0:
        risk_level = "MEDIUM"
    else:
        risk_level = "LOW"

    tx_id = alert_info.get("transaction_id")

    return {
        "classified_alert_id": alert_info.get("alert_id"),
        "alert_id": alert_info.get("alert_id"),
        "account_id": alert_info.get("customer_id"),
        "customer_id": alert_info.get("customer_id"),
        "transaction_ids": [tx_id] if tx_id else [],
        "alert_type": alert_info.get("alert_type"),
        "triggered_rules": [alert_info.get("alert_type")],
        "detected_reason": f"Phase-1 Alert triggered: {alert_info.get('alert_type')} for customer {alert_info.get('customer_id')}",
        "evidence": enriched,
        "risk_score": score,
        "risk_level": risk_level,
        "timestamp": alert_info.get("created_at"),
        "status": alert_info.get("status")
    }

# -------------------------------------------------------------
# 4. Get Transactions by ID List
# -------------------------------------------------------------
@router.get("/transactions")
def get_transactions(
    ids: Optional[str] = Query(None, description="Comma-separated transaction IDs"),
    db: Session = Depends(get_db)
):
    if not ids:
        return {"items": [], "total": 0}

    tx_ids = [t.strip() for t in ids.split(",") if t.strip()]
    txs = db.query(Transaction).filter(Transaction.transaction_id.in_(tx_ids)).all()

    items = [
        {
            "transaction_id": t.transaction_id,
            "step": 1,
            "timestamp": t.transaction_timestamp.isoformat() if t.transaction_timestamp else "",
            "source_account_id": t.account_id,
            "dest_account_id": t.beneficiary_id or "N/A",
            "amount": float(t.amount) if t.amount is not None else 0.0,
            "currency": "USD"
        }
        for t in txs
    ]

    return {"items": items, "total": len(items)}

# -------------------------------------------------------------
# 5. Targeted Investigation Execution Endpoint (CLAIMS & RUNS)
# -------------------------------------------------------------
@router.post("/investigations/{alert_id}/start")
def start_investigation(alert_id: str, db: Session = Depends(get_db)):
    """
    Claims a specific alert (OPEN -> UNDER_INVESTIGATION), invokes the LangGraph pipeline,
    persists the InvestigationCase snapshot, and updates alert status (RESOLVED/ESCALATED).
    """
    clean_id = alert_id.lstrip("#")
    repo = AlertRepository(db)
    
    enriched = repo.fetch_and_claim_alert_by_id(clean_id)
    if not enriched:
        raise HTTPException(status_code=404, detail=f"Alert '{alert_id}' not found")

    initial_state = create_initial_state_from_neon_alert(enriched)
    case_id = initial_state["case_id"]

    existing_case = db.query(InvestigationCase).filter(InvestigationCase.id == case_id).first()
    if existing_case and existing_case.state_snapshot_json:
        # Guarantee .docx report file exists in reports/ folder
        file_name = f"{case_id}_final_audit.docx"
        report_path = os.path.abspath(os.path.join("reports", file_name))
        if not os.path.exists(report_path):
            try:
                auditor = LLMAuditor()
                audit_res = auditor.audit_investigation(existing_case.state_snapshot_json)
                generate_audit_docx(audit_res, existing_case.state_snapshot_json, output_dir="reports", file_name=file_name)
            except Exception as audit_err:
                print(f"Warning: Audit report auto-generation encountered error: {str(audit_err)}")

        return {
            "status": "completed",
            "case_id": case_id,
            "alert_id": clean_id,
            "final_risk_score": existing_case.final_risk_score,
            "decision": existing_case.decision,
            "state": existing_case.state_snapshot_json
        }

    config = {"configurable": {"thread_id": case_id}, "recursion_limit": 50}
    final_state = investigation_graph.invoke(initial_state, config=config)

    final_score = float(final_state.get("final_risk_score", 0.0))
    decision = str(final_state.get("decision", "REVIEW"))

    new_case = InvestigationCase(
        id=case_id,
        alert_id=clean_id,
        entity_id=initial_state["entity_id"],
        status="CLOSED",
        priority_score=initial_state["raw_priority_score"],
        priority_band="HIGH" if initial_state["raw_priority_score"] >= 50 else "MEDIUM",
        final_risk_score=final_score,
        decision=decision,
        state_snapshot_json=final_state
    )
    db.merge(new_case)
    db.commit()

    if decision in ["BLOCK", "REVIEW"] or final_score >= 50:
        next_status = "ESCALATED"
    else:
        next_status = "RESOLVED"

    repo.complete_alert(clean_id, new_status=next_status)

    # Run LLM Auditor & generate DOCX report in reports/ folder post-investigation
    try:
        auditor = LLMAuditor()
        audit_res = auditor.audit_investigation(final_state)
        file_name = f"{case_id}_final_audit.docx"
        generate_audit_docx(audit_res, final_state, output_dir="reports", file_name=file_name)
    except Exception as audit_err:
        print(f"Warning: Audit report auto-generation encountered error: {str(audit_err)}")

    return {
        "status": "completed",
        "case_id": case_id,
        "alert_id": clean_id,
        "final_risk_score": final_score,
        "decision": decision,
        "state": final_state
    }

# -------------------------------------------------------------
# 6. Audit Report Download Endpoint
# -------------------------------------------------------------
@router.get("/investigations/{alert_id}/audit-report")
def download_audit_report(alert_id: str, db: Session = Depends(get_db)):
    """
    Returns the downloadable .docx final audit report for a completed investigation case.
    Generates the audit report on demand if the case exists but file was not created yet.
    """
    clean_id = alert_id.replace("CASE_", "").lstrip("#")
    case_id = f"CASE_{clean_id}"
    file_name = f"{case_id}_final_audit.docx"
    report_path = os.path.abspath(os.path.join("reports", file_name))

    if not os.path.exists(report_path):
        case = db.query(InvestigationCase).filter(
            (InvestigationCase.id == case_id) | (InvestigationCase.alert_id == clean_id)
        ).first()

        if case and case.state_snapshot_json:
            try:
                auditor = LLMAuditor()
                audit_res = auditor.audit_investigation(case.state_snapshot_json)
                generate_audit_docx(audit_res, case.state_snapshot_json, output_dir="reports", file_name=file_name)
            except Exception as err:
                raise HTTPException(status_code=500, detail=f"Failed to generate audit report: {str(err)}")
        else:
            # On-demand fallback execution if alert exists in DB
            repo = AlertRepository(db)
            enriched = repo.fetch_alert_read_only(clean_id)
            if enriched:
                try:
                    initial_state = create_initial_state_from_neon_alert(enriched)
                    config = {"configurable": {"thread_id": case_id}, "recursion_limit": 50}
                    final_state = investigation_graph.invoke(initial_state, config=config)
                    auditor = LLMAuditor()
                    audit_res = auditor.audit_investigation(final_state)
                    generate_audit_docx(audit_res, final_state, output_dir="reports", file_name=file_name)
                except Exception as err:
                    raise HTTPException(status_code=500, detail=f"Failed to run investigation for report: {str(err)}")
            else:
                raise HTTPException(
                    status_code=404, 
                    detail=f"Audit report for alert '{alert_id}' not found."
                )

    if not os.path.exists(report_path):
        raise HTTPException(status_code=404, detail="Audit report file could not be found.")

    return FileResponse(
        path=report_path,
        filename=file_name,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )

# -------------------------------------------------------------
# 6. Legacy / Generic Run Endpoint
# -------------------------------------------------------------
@router.post("/run")
def run_investigation(alert: ClassifiedAlert, db: Session = Depends(get_db)):
    alert_id = alert.get_alert_id()
    return start_investigation(alert_id, db=db)

# -------------------------------------------------------------
# 7. List Cases & Get Case Snapshots
# -------------------------------------------------------------
@router.get("/cases")
def list_cases(db: Session = Depends(get_db)):
    cases = db.query(InvestigationCase).order_by(InvestigationCase.created_at.desc()).limit(50).all()
    return [
        {
            "id": c.id,
            "alert_id": c.alert_id,
            "entity_id": c.entity_id,
            "decision": c.decision,
            "score": c.final_risk_score,
            "status": c.status
        }
        for c in cases
    ]

@router.get("/cases/{case_id}")
def get_case(case_id: str, db: Session = Depends(get_db)):
    clean_id = case_id.replace("CASE_", "").lstrip("#")
    full_case_id = f"CASE_{clean_id}"
    
    case = db.query(InvestigationCase).filter(
        (InvestigationCase.id == full_case_id) | (InvestigationCase.alert_id == clean_id)
    ).first()

    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    return {
        "id": case.id,
        "alert_id": case.alert_id,
        "entity_id": case.entity_id,
        "decision": case.decision,
        "score": case.final_risk_score,
        "state": case.state_snapshot_json
    }
