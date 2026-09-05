import os
from datetime import datetime
from typing import Dict, Any, Optional
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

def set_cell_background(cell, fill_hex: str):
    """Utility to color a table cell background."""
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear')
    shd.set(qn('w:color'), 'auto')
    shd.set(qn('w:fill'), fill_hex)
    tcPr.append(shd)

def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    """Utility to set cell padding."""
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = OxmlElement('w:tcMar')
    for m, val in [('top', top), ('bottom', bottom), ('left', left), ('right', right)]:
        node = OxmlElement(f'w:{m}')
        node.set(qn('w:w'), str(val))
        node.set(qn('w:type'), 'dxa')
        tcMar.append(node)
    tcPr.append(tcMar)

def generate_audit_docx(
    audit_result: Dict[str, Any],
    completed_state: Dict[str, Any],
    output_dir: str = "reports",
    file_name: Optional[str] = None
) -> str:
    """
    Generates a professional DOCX audit report from audit_result and completed_state.
    Returns the absolute path to the generated .docx file.
    """
    os.makedirs(output_dir, exist_ok=True)

    case_id = completed_state.get("case_id", audit_result.get("case_id", "UNKNOWN"))
    alert_id = completed_state.get("alert_id", audit_result.get("alert_id", "UNKNOWN"))

    if not file_name:
        file_name = f"{case_id}_final_audit.docx"

    output_path = os.path.abspath(os.path.join(output_dir, file_name))

    doc = docx.Document()

    # Page setup - 1 inch margins
    sections = doc.sections
    for s in sections:
        s.top_margin = Inches(1.0)
        s.bottom_margin = Inches(1.0)
        s.left_margin = Inches(1.0)
        s.right_margin = Inches(1.0)

    # Styles setup
    style_normal = doc.styles['Normal']
    style_normal.font.name = 'Calibri'
    style_normal.font.size = Pt(11)
    style_normal.font.color.rgb = RGBColor(0x33, 0x41, 0x55) # Slate 700

    # Color Palette
    PRIMARY_COLOR = RGBColor(0x0F, 0x17, 0x2A)   # Slate 900
    SECONDARY_COLOR = RGBColor(0x1E, 0x29, 0x3B) # Slate 800
    ACCENT_BLUE = RGBColor(0x25, 0x63, 0xEB)     # Blue 600

    # --- Title Banner ---
    p_title = doc.add_paragraph()
    p_title.alignment = WD_ALIGN_PARAGRAPH.LEFT
    run_brand = p_title.add_run("FIN-SPECTRA")
    run_brand.font.size = Pt(24)
    run_brand.font.bold = True
    run_brand.font.color.rgb = ACCENT_BLUE

    p_subtitle = doc.add_paragraph()
    run_sub = p_subtitle.add_run("Final Investigation Audit Report")
    run_sub.font.size = Pt(16)
    run_sub.font.bold = True
    run_sub.font.color.rgb = PRIMARY_COLOR
    p_subtitle.paragraph_format.space_after = Pt(18)

    # Divider line
    p_div = doc.add_paragraph()
    p_div.paragraph_format.space_after = Pt(12)
    p_div_run = p_div.add_run("―" * 55)
    p_div_run.font.color.rgb = RGBColor(0xCB, 0xD5, 0xE1)

    # Helper function for section headings
    def add_section_heading(title: str):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(14)
        p.paragraph_format.space_after = Pt(6)
        run = p.add_run(title)
        run.font.size = Pt(14)
        run.font.bold = True
        run.font.color.rgb = SECONDARY_COLOR

    trigger_ev = completed_state.get("trigger_evidence") or {}
    alert_data = trigger_ev.get("alert") or {}
    customer_data = trigger_ev.get("customer") or {}
    tx_data = trigger_ev.get("transaction") or {}

    # --- Section 1: Case Information ---
    add_section_heading("1. Case Information")
    t1 = doc.add_table(rows=5, cols=2)
    t1.alignment = WD_TABLE_ALIGNMENT.CENTER
    t1_data = [
        ("Case ID", case_id),
        ("Alert ID", alert_id),
        ("Customer ID", completed_state.get("entity_id", "N/A")),
        ("Audit Timestamp", datetime.now().strftime("%Y-%m-%d %H:%M:%S UTC")),
        ("Final Investigation Status", "COMPLETED & PERSISTED")
    ]
    for idx, (k, v) in enumerate(t1_data):
        row = t1.rows[idx]
        c0, c1 = row.cells[0], row.cells[1]
        c0.width = Inches(2.2)
        c1.width = Inches(4.3)
        c0.text = k
        c1.text = str(v)
        c0.paragraphs[0].runs[0].font.bold = True
        c0.paragraphs[0].runs[0].font.color.rgb = SECONDARY_COLOR
        set_cell_background(c0, "F1F5F9")
        set_cell_margins(c0)
        set_cell_margins(c1)

    doc.add_paragraph().paragraph_format.space_after = Pt(6)

    # --- Section 2: Investigation Summary ---
    add_section_heading("2. Investigation Summary")
    t2 = doc.add_table(rows=6, cols=2)
    t2.alignment = WD_TABLE_ALIGNMENT.CENTER
    t2_data = [
        ("Alert Type", completed_state.get("alert_type", "UNKNOWN")),
        ("Triggering Transaction", f"ID: {tx_data.get('transaction_id', 'N/A')} | Amount: ${tx_data.get('amount', 0.0):,.2f} ({tx_data.get('transaction_type', 'N/A')})"),
        ("Customer Risk Level", customer_data.get("risk_level", "N/A")),
        ("Final Composite Risk Score", f"{completed_state.get('final_risk_score', 0.0):.2f} / 100.0"),
        ("Final Decision", completed_state.get("decision", "REVIEW")),
        ("Detected Typology", completed_state.get("typology_classification", "UNCLASSIFIED"))
    ]
    for idx, (k, v) in enumerate(t2_data):
        row = t2.rows[idx]
        c0, c1 = row.cells[0], row.cells[1]
        c0.width = Inches(2.2)
        c1.width = Inches(4.3)
        c0.text = k
        c1.text = str(v)
        c0.paragraphs[0].runs[0].font.bold = True
        c0.paragraphs[0].runs[0].font.color.rgb = SECONDARY_COLOR
        set_cell_background(c0, "F1F5F9")
        set_cell_margins(c0)
        set_cell_margins(c1)

    doc.add_paragraph().paragraph_format.space_after = Pt(6)

    # --- Section 3: Evidence Reviewed ---
    add_section_heading("3. Evidence Reviewed")
    accounts = trigger_ev.get("accounts") or []
    beneficiaries = trigger_ev.get("beneficiaries") or []
    devices = trigger_ev.get("devices") or []
    p_ev = doc.add_paragraph()
    p_ev.add_run(
        f"The auditor reviewed all raw evidence extracted from Neon PostgreSQL:\n"
        f"• Customer Record: ID {customer_data.get('customer_id', 'N/A')} ({customer_data.get('name', 'N/A')}), Occupation: {customer_data.get('occupation', 'N/A')}, Account Age: {customer_data.get('account_age_days', 'N/A')} days.\n"
        f"• Accounts Ingested: {len(accounts)} active account(s).\n"
        f"• Beneficiaries Linked: {len(beneficiaries)} external counterparty beneficiary account(s).\n"
        f"• Devices Tracked: {len(devices)} device hardware profile(s).\n"
        f"• Historical Ledger: {len(completed_state.get('ledger_history', []))} past transaction sample(s) analyzed for velocity baseline."
    )

    # --- Section 4: Investigation Findings ---
    add_section_heading("4. Investigation Findings")

    behavior = completed_state.get("behavioral_metrics") or {}
    graph = completed_state.get("graph_metrics") or {}

    p_f = doc.add_paragraph()
    p_f.add_run("• Behavior Analysis: ").bold = True
    p_f.add_run(f"Velocity Z-score of {behavior.get('velocity_z_score', 0.0):.2f} (Baseline: {behavior.get('velocity_baseline_status', 'N/A')}). Historical Mean: ${behavior.get('historical_mean', 0.0):,.2f}.\n")

    p_f.add_run("• Graph Analysis: ").bold = True
    p_f.add_run(f"Account count: {graph.get('tx_per_account', 0)}, Beneficiary dispersion ratio: {graph.get('beneficiary_dispersion_ratio', 0.0):.2f}, Multi-device flag: {graph.get('multi_device_multi_beneficiary_flag', False)}.\n")

    p_f.add_run("• KYC Verification: ").bold = True
    p_f.add_run(f"{completed_state.get('kyc_notes', 'N/A')}\n")

    p_f.add_run("• Typology Classification: ").bold = True
    p_f.add_run(f"Classified as '{completed_state.get('typology_classification', 'N/A')}'. Rationale: {completed_state.get('typology_rationale', 'N/A')}\n")

    p_f.add_run("• Risk Scoring: ").bold = True
    subscores = behavior.get("risk_subscores") or {}
    p_f.add_run(f"Final Score: {completed_state.get('final_risk_score', 0.0):.2f} (Phase-1 Prior: {subscores.get('phase1_prior', 0.0)}, Behavior: {subscores.get('behavior', 0.0)}, Graph: {subscores.get('graph', 0.0)}, KYC: {subscores.get('kyc', 0.0)}). Decision: {completed_state.get('decision', 'N/A')}.")

    # --- Section 5: Auditor Assessment ---
    add_section_heading("5. Auditor Assessment")
    t5 = doc.add_table(rows=7, cols=2)
    t5.alignment = WD_TABLE_ALIGNMENT.CENTER
    t5_evals = [
        ("Evidence Grounding", audit_result.get("evidence_grounding", "")),
        ("Numerical / Risk Consistency", audit_result.get("numerical_risk_consistency", "")),
        ("Typology Consistency", audit_result.get("typology_consistency", "")),
        ("KYC Consistency", audit_result.get("kyc_consistency", "")),
        ("Decision Consistency", audit_result.get("decision_consistency", "")),
        ("Narrative Accuracy", audit_result.get("narrative_accuracy", "")),
        ("Overall Quality Assessment", audit_result.get("overall_quality", "SATISFACTORY"))
    ]
    for idx, (k, v) in enumerate(t5_evals):
        row = t5.rows[idx]
        c0, c1 = row.cells[0], row.cells[1]
        c0.width = Inches(2.2)
        c1.width = Inches(4.3)
        c0.text = k
        c1.text = str(v)
        c0.paragraphs[0].runs[0].font.bold = True
        c0.paragraphs[0].runs[0].font.color.rgb = SECONDARY_COLOR
        set_cell_background(c0, "F8FAFC")
        set_cell_margins(c0)
        set_cell_margins(c1)

    doc.add_paragraph().paragraph_format.space_after = Pt(6)

    # --- Section 6: Issues Identified ---
    add_section_heading("6. Issues Identified")
    issues = audit_result.get("issues_identified") or ["No material issues identified."]
    for issue in issues:
        p_i = doc.add_paragraph(style='List Bullet')
        run_i = p_i.add_run(issue)
        if "No material issues" in issue:
            run_i.font.color.rgb = RGBColor(0x16, 0x65, 0x34) # Green
        else:
            run_i.font.color.rgb = RGBColor(0x99, 0x1B, 0x1B) # Red

    # --- Section 7: Final Audit Conclusion ---
    add_section_heading("7. Final Audit Conclusion")
    conclusion = audit_result.get("audit_conclusion", "PASS").upper()

    t7 = doc.add_table(rows=1, cols=1)
    t7.alignment = WD_TABLE_ALIGNMENT.CENTER
    c_box = t7.rows[0].cells[0]
    c_box.width = Inches(6.5)

    p_box = c_box.paragraphs[0]
    p_box.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_conc = p_box.add_run(f"FINAL AUDIT RESULT: {conclusion}")
    r_conc.font.size = Pt(16)
    r_conc.font.bold = True

    if "PASS" in conclusion:
        set_cell_background(c_box, "DCFCE7") # Light Green
        r_conc.font.color.rgb = RGBColor(0x16, 0x65, 0x34)
    elif "REVIEW" in conclusion:
        set_cell_background(c_box, "FEF3C7") # Light Amber
        r_conc.font.color.rgb = RGBColor(0x92, 0x40, 0x0E)
    else:
        set_cell_background(c_box, "FEE2E2") # Light Red
        r_conc.font.color.rgb = RGBColor(0x99, 0x1B, 0x1B)

    set_cell_margins(c_box, top=140, bottom=140)
    doc.add_paragraph().paragraph_format.space_after = Pt(6)

    # --- Section 8: Auditor Recommendation ---
    add_section_heading("8. Auditor Recommendation")
    recs = audit_result.get("auditor_recommendation") or ["Investigation appears adequately supported by evidence."]
    for rec in recs:
        p_r = doc.add_paragraph(style='List Bullet')
        p_r.add_run(rec)

    # Footer note
    p_ft = doc.add_paragraph()
    p_ft.paragraph_format.space_before = Pt(24)
    r_ft = p_ft.add_run("Fin-Spectra Automated LLM Audit Engine v2.4.1 | Confidential Compliance Audit Document")
    r_ft.font.size = Pt(9)
    r_ft.font.italic = True
    r_ft.font.color.rgb = RGBColor(0x94, 0xA3, 0xB8)

    doc.save(output_path)
    return output_path
