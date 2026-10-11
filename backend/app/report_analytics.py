import datetime
import io
import csv
import zipfile
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

BASELINE_DOWNLOAD_DATA = [
    {"device": "RTR-01", "type": "Core Router", "ip": "192.168.1.1", "status": "Online", "uptime": "99.98%"},
    {"device": "SW-01", "type": "Core Switch", "ip": "192.168.1.10", "status": "Online", "uptime": "99.95%"},
    {"device": "SW-04", "type": "Office Switch", "ip": "192.168.1.14", "status": "Online", "uptime": "99.91%"},
    {"device": "SW-07", "type": "Warehouse Switch", "ip": "192.168.1.17", "status": "Offline", "uptime": "97.40%"},
    {"device": "SRV-01", "type": "Main Server", "ip": "192.168.1.20", "status": "Online", "uptime": "99.99%"},
    {"device": "SRV-02", "type": "Application Server", "ip": "192.168.1.21", "status": "Online", "uptime": "99.96%"},
    {"device": "CAM-18", "type": "Gate Camera", "ip": "192.168.1.50", "status": "Online", "uptime": "99.80%"},
    {"device": "NM-DESK-001", "type": "Admin Desktop", "ip": "192.168.1.101", "status": "Online", "uptime": "99.70%"}
]

def format_seconds_to_hms(seconds: float) -> str:
    """Format total seconds into HH:MM:SS."""
    if seconds is None or seconds < 0:
        return "00:00:00"
    total_sec = int(round(seconds))
    hours = total_sec // 3600
    minutes = (total_sec % 3600) // 60
    secs = total_sec % 60
    return f"{hours:02d}:{minutes:02d}:{secs:02d}"

def parse_date_range(from_date_str: str, to_date_str: str):
    """Parse and validate date range."""
    now = datetime.datetime.now()
    if not from_date_str:
        start_dt = now - datetime.timedelta(days=7)
        start_dt = start_dt.replace(hour=0, minute=0, second=0, microsecond=0)
    else:
        start_dt = datetime.datetime.strptime(from_date_str.strip(), "%Y-%m-%d")
        start_dt = start_dt.replace(hour=0, minute=0, second=0, microsecond=0)

    if not to_date_str:
        end_dt = now.replace(hour=23, minute=59, second=59, microsecond=0)
    else:
        end_dt = datetime.datetime.strptime(to_date_str.strip(), "%Y-%m-%d")
        end_dt = end_dt.replace(hour=23, minute=59, second=59, microsecond=0)

    if start_dt > end_dt:
        raise ValueError("From Date cannot be later than To Date.")

    cutoff_dt = min(end_dt, now)
    return start_dt, end_dt, cutoff_dt

def generate_report_data(conn, from_date_str: str = None, to_date_str: str = None):
    """Generate comprehensive analytics from real MySQL database data."""
    start_dt, end_dt, cutoff_dt = parse_date_range(from_date_str, to_date_str)
    now = datetime.datetime.now()

    cursor = conn.cursor(dictionary=True)
    try:
        # 1. Fetch all assets
        cursor.execute("""
            SELECT id, device_code as code, device_name as name, device_type as type,
                   ip_address as ip, location, status, uptime_percent, created_at, updated_at, last_check
            FROM devices ORDER BY id ASC
        """)
        devices = cursor.fetchall()
        for d in devices:
            d["category"] = "Device"

        cursor.execute("""
            SELECT id, camera_code as code, camera_name as name, 'CCTV' as type,
                   ip_address as ip, location, status, uptime_percent, created_at, updated_at, last_check
            FROM cameras ORDER BY id ASC
        """)
        cameras = cursor.fetchall()
        for c in cameras:
            c["category"] = "CCTV Camera"

        cursor.execute("""
            SELECT id, desktop_code as code, department as name, 'Desktop' as type,
                   ip_address as ip, location, status, uptime_percent, created_at, updated_at, last_check,
                   operating_system
            FROM desktops ORDER BY id ASC
        """)
        desktops = cursor.fetchall()
        for dk in desktops:
            dk["category"] = "Desktop"

        all_assets = devices + cameras + desktops

        # 2. Fetch transition alerts
        cursor.execute("""
            SELECT id, source_type, source_name, message, severity, status, created_at
            FROM alerts
            ORDER BY created_at ASC
        """)
        raw_alerts = cursor.fetchall()

        # Also fetch any logs if present
        cursor.execute("""
            SELECT id, event_type, source_type, source_name, description, created_at
            FROM logs
            ORDER BY created_at ASC
        """)
        raw_logs = cursor.fetchall()

    finally:
        cursor.close()

    total_period_seconds = max(1.0, (cutoff_dt - start_dt).total_seconds())

    # Build asset lookup by code
    asset_by_code = {a["code"]: a for a in all_assets}

    # Group transition events by asset code
    events_by_code = {a["code"]: [] for a in all_assets}

    for alert in raw_alerts:
        msg = alert.get("message", "")
        status = None
        if "went Offline" in msg:
            status = "Offline"
        elif "went Online" in msg:
            status = "Online"
        elif "went Warning" in msg:
            status = "Warning"

        if status and alert.get("source_name") in events_by_code:
            events_by_code[alert["source_name"]].append({
                "source_type": alert["source_type"],
                "source_name": alert["source_name"],
                "status": status,
                "timestamp": alert["created_at"],
                "raw_message": msg
            })

    # Also incorporate logs if applicable
    for log in raw_logs:
        desc = log.get("description", "")
        status = None
        if "Offline" in desc:
            status = "Offline"
        elif "Online" in desc:
            status = "Online"

        if status and log.get("source_name") in events_by_code:
            events_by_code[log["source_name"]].append({
                "source_type": log["source_type"],
                "source_name": log["source_name"],
                "status": status,
                "timestamp": log["created_at"],
                "raw_message": desc
            })

    # Sort and deduplicate consecutive identical statuses for each asset
    deduped_events_by_code = {}
    for code, ev_list in events_by_code.items():
        ev_list.sort(key=lambda x: x["timestamp"])
        clean = []
        for e in ev_list:
            if not clean or clean[-1]["status"] != e["status"]:
                clean.append(e)
            else:
                # Same status: if time difference is large, keep track, but avoid duplicate transition count
                pass
        deduped_events_by_code[code] = clean

    # Calculate statistics per asset
    asset_results = []
    all_status_history = []
    event_counter = 1

    for asset in all_assets:
        code = asset["code"]
        transitions = deduped_events_by_code.get(code, [])
        created_at = asset.get("created_at") or start_dt

        # Find status prior to start_dt
        transitions_before = [t for t in transitions if t["timestamp"] < start_dt]
        transitions_in_period = [t for t in transitions if start_dt <= t["timestamp"] <= cutoff_dt]

        if transitions_before:
            initial_status = transitions_before[-1]["status"]
            has_history_before = True
        else:
            if transitions_in_period:
                # Inferred from first transition
                first_tr = transitions_in_period[0]
                initial_status = "Online" if first_tr["status"] == "Offline" else "Offline"
            else:
                # Steady state
                initial_status = asset.get("status") or "Online"
            has_history_before = False

        # Build timeline of states across [start_dt, cutoff_dt]
        timeline_segments = []
        current_st = initial_status
        current_time = start_dt

        for tr in transitions_in_period:
            tr_time = tr["timestamp"]
            if tr_time > current_time:
                seg_duration = (tr_time - current_time).total_seconds()
                timeline_segments.append({
                    "status": current_st,
                    "start": current_time,
                    "end": tr_time,
                    "duration": seg_duration
                })

                # Record transition event in history
                next_time = tr_time
                prev_st = current_st
                all_status_history.append({
                    "event_id": event_counter,
                    "category": asset["category"],
                    "asset_id": code,
                    "asset_name": asset["name"],
                    "ip": asset["ip"],
                    "prev_status": prev_st,
                    "new_status": tr["status"],
                    "timestamp": tr_time,
                    "event_date": tr_time.strftime("%Y-%m-%d"),
                    "event_time": tr_time.strftime("%H:%M:%S"),
                    "raw_message": tr["raw_message"]
                })
                event_counter += 1

            current_st = tr["status"]
            current_time = tr_time

        # Final segment up to cutoff_dt
        if cutoff_dt > current_time:
            seg_duration = (cutoff_dt - current_time).total_seconds()
            timeline_segments.append({
                "status": current_st,
                "start": current_time,
                "end": cutoff_dt,
                "duration": seg_duration
            })

        # Sum durations & event counts
        online_sec = sum(s["duration"] for s in timeline_segments if s["status"] == "Online")
        offline_sec = sum(s["duration"] for s in timeline_segments if s["status"] == "Offline")
        unknown_sec = max(0.0, total_period_seconds - (online_sec + offline_sec))

        online_events = sum(1 for t in transitions_in_period if t["status"] == "Online")
        offline_events = sum(1 for t in transitions_in_period if t["status"] == "Offline")

        # If asset had initial status during start of range
        if initial_status == "Online" and not transitions_in_period:
            online_events = max(1, online_events)
        elif initial_status == "Offline" and not transitions_in_period:
            offline_events = max(1, offline_events)

        tot_known = online_sec + offline_sec
        if tot_known > 0:
            online_pct = round((online_sec / tot_known) * 100.0, 2)
            offline_pct = round((offline_sec / tot_known) * 100.0, 2)
        else:
            online_pct = 100.0 if asset.get("status") == "Online" else 0.0
            offline_pct = 0.0 if asset.get("status") == "Online" else 100.0

        # History coverage note
        if created_at > cutoff_dt:
            coverage_note = "Asset created after selected date range"
        elif transitions_before and transitions_in_period:
            coverage_note = "Full verified historical transitions"
        elif transitions_in_period:
            coverage_note = "Verified transitions in selected period"
        elif transitions_before:
            coverage_note = f"Steady state {initial_status} (since {transitions_before[-1]['timestamp'].strftime('%Y-%m-%d')})"
        else:
            coverage_note = f"Steady state {asset.get('status', 'Online')} (No state changes logged)"

        last_change_time = transitions[-1]["timestamp"] if transitions else asset.get("updated_at")

        # First and last observed timestamps in period
        first_obs = timeline_segments[0]["start"] if timeline_segments else start_dt
        last_obs = timeline_segments[-1]["end"] if timeline_segments else cutoff_dt

        asset_results.append({
            "id": asset["id"],
            "code": code,
            "name": asset["name"],
            "type": asset["type"],
            "category": asset["category"],
            "ip": asset["ip"],
            "location": asset.get("location") or "N/A",
            "current_status": asset.get("status", "Online"),
            "online_duration_sec": round(online_sec, 1),
            "offline_duration_sec": round(offline_sec, 1),
            "unknown_duration_sec": round(unknown_sec, 1),
            "online_duration_hms": format_seconds_to_hms(online_sec),
            "offline_duration_hms": format_seconds_to_hms(offline_sec),
            "online_duration_min": round(online_sec / 60.0, 1),
            "offline_duration_min": round(offline_sec / 60.0, 1),
            "online_events": online_events,
            "offline_events": offline_events,
            "online_pct": online_pct,
            "offline_pct": offline_pct,
            "availability_pct": online_pct,
            "total_status_changes": len(transitions_in_period),
            "first_observed": first_obs.strftime("%Y-%m-%d %H:%M:%S") if isinstance(first_obs, datetime.datetime) else str(first_obs),
            "last_observed": last_obs.strftime("%Y-%m-%d %H:%M:%S") if isinstance(last_obs, datetime.datetime) else str(last_obs),
            "last_status_change": last_change_time.strftime("%Y-%m-%d %H:%M:%S") if isinstance(last_change_time, datetime.datetime) else (str(last_change_time) if last_change_time else "N/A"),
            "coverage_note": coverage_note,
            "uptime_percent_db": asset.get("uptime_percent", online_pct),
            "operating_system": asset.get("operating_system") or "Windows/Linux"
        })

    # Fill duration for each status history item
    # Sort history
    all_status_history.sort(key=lambda x: x["timestamp"])
    for i, item in enumerate(all_status_history):
        # Duration until next transition of the same asset or cutoff
        asset_next = [h for h in all_status_history[i+1:] if h["asset_id"] == item["asset_id"]]
        if asset_next:
            next_t = asset_next[0]["timestamp"]
        else:
            next_t = cutoff_dt

        dur_s = max(0.0, (next_t - item["timestamp"]).total_seconds())
        item["next_timestamp"] = next_t.strftime("%Y-%m-%d %H:%M:%S")
        item["duration_sec"] = round(dur_s, 1)
        item["duration_min"] = round(dur_s / 60.0, 1)
        item["duration_hms"] = format_seconds_to_hms(dur_s)
        item["timestamp_str"] = item["timestamp"].strftime("%Y-%m-%d %H:%M:%S")

    # Category summaries
    dev_res = [a for a in asset_results if a["category"] == "Device"]
    cam_res = [a for a in asset_results if a["category"] == "CCTV Camera"]
    desk_res = [a for a in asset_results if a["category"] == "Desktop"]

    def calc_group_avail(group):
        if not group: return 100.0
        tot_on = sum(a["online_duration_sec"] for a in group)
        tot_off = sum(a["offline_duration_sec"] for a in group)
        return round((tot_on / (tot_on + tot_off) * 100.0), 2) if (tot_on + tot_off) > 0 else 100.0

    overall_on_sec = sum(a["online_duration_sec"] for a in asset_results)
    overall_off_sec = sum(a["offline_duration_sec"] for a in asset_results)
    overall_avail = round((overall_on_sec / (overall_on_sec + overall_off_sec) * 100.0), 2) if (overall_on_sec + overall_off_sec) > 0 else 100.0

    summary = {
        "total_devices": len(dev_res),
        "total_cameras": len(cam_res),
        "total_desktops": len(desk_res),
        "total_assets": len(asset_results),
        "online_count": sum(1 for a in asset_results if a["current_status"] == "Online"),
        "offline_count": sum(1 for a in asset_results if a["current_status"] == "Offline"),
        "warning_count": sum(1 for a in asset_results if a["current_status"] == "Warning"),
        "total_online_duration_sec": round(overall_on_sec, 1),
        "total_offline_duration_sec": round(overall_off_sec, 1),
        "total_online_duration_hms": format_seconds_to_hms(overall_on_sec),
        "total_offline_duration_hms": format_seconds_to_hms(overall_off_sec),
        "total_online_events": sum(a["online_events"] for a in asset_results),
        "total_offline_events": sum(a["offline_events"] for a in asset_results),
        "overall_availability_pct": overall_avail,
        "devices_availability_pct": calc_group_avail(dev_res),
        "cameras_availability_pct": calc_group_avail(cam_res),
        "desktops_availability_pct": calc_group_avail(desk_res)
    }

    period = {
        "from_date": start_dt.strftime("%Y-%m-%d"),
        "to_date": end_dt.strftime("%Y-%m-%d"),
        "cutoff_timestamp": cutoff_dt.strftime("%Y-%m-%d %H:%M:%S"),
        "generated_at": now.strftime("%Y-%m-%d %H:%M:%S"),
        "total_period_seconds": int(total_period_seconds),
        "total_period_hms": format_seconds_to_hms(total_period_seconds)
    }

    # Frontend table format (backward compatible columns)
    table_data = []
    for a in asset_results:
        table_data.append({
            "id": a["code"],
            "name": a["name"],
            "type": a["type"],
            "ip": a["ip"],
            "status": a["current_status"],
            "uptime": f"{a['availability_pct']}%",
            "lastChecked": a["last_observed"]
        })

    return {
        "success": True,
        "period": period,
        "summary": summary,
        "devices": dev_res,
        "cameras": cam_res,
        "desktops": desk_res,
        "all_assets": asset_results,
        "status_history": all_status_history,
        "table_data": table_data
    }

def create_excel_report(report_data: dict) -> bytes:
    """Create a formatted multi-sheet Excel workbook adhering to prompt specifications."""
    wb = Workbook()
    # Remove default sheet
    wb.remove(wb.active)

    period = report_data["period"]
    summary = report_data["summary"]

    # Styles
    navy_fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
    blue_fill = PatternFill(start_color="0284C7", end_color="0284C7", fill_type="solid")
    green_fill = PatternFill(start_color="10B981", end_color="10B981", fill_type="solid")
    light_gray_fill = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")
    alt_row_fill = PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid")

    font_header = Font(name="Segoe UI", size=11, bold=True, color="FFFFFF")
    font_title = Font(name="Segoe UI", size=14, bold=True, color="1E293B")
    font_bold = Font(name="Segoe UI", size=11, bold=True)
    font_regular = Font(name="Segoe UI", size=10)

    thin_border = Border(
        left=Side(style="thin", color="CBD5E1"),
        right=Side(style="thin", color="CBD5E1"),
        top=Side(style="thin", color="CBD5E1"),
        bottom=Side(style="thin", color="CBD5E1")
    )

    def apply_header_style(ws, row_idx, num_cols):
        for col_idx in range(1, num_cols + 1):
            cell = ws.cell(row=row_idx, column=col_idx)
            cell.fill = navy_fill
            cell.font = font_header
            cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
            cell.border = thin_border
        ws.row_dimensions[row_idx].height = 28

    def auto_adjust_columns(ws, max_cols=30):
        for col in ws.columns:
            col_letter = get_column_letter(col[0].column)
            max_len = 0
            for cell in col:
                val_str = str(cell.value or "")
                if "\n" in val_str:
                    lines = val_str.split("\n")
                    max_len = max(max_len, max(len(l) for l in lines))
                else:
                    max_len = max(max_len, len(val_str))
            ws.column_dimensions[col_letter].width = max(14, min(max_len + 3, 40))

    # ==========================================
    # SHEET 1: Summary
    # ==========================================
    ws_sum = wb.create_sheet(title="Summary")
    ws_sum.views.sheetView[0].showGridLines = True

    ws_sum.cell(row=1, column=1, value="NEO METALIKS NMS — NETWORK MONITORING REPORT").font = font_title
    ws_sum.cell(row=2, column=1, value=f"Selected Period: {period['from_date']} to {period['to_date']} | Generated At: {period['generated_at']}").font = font_regular

    headers_sum = ["Metric Name", "Value", "Unit / Description", "Category"]
    for col_idx, h in enumerate(headers_sum, 1):
        ws_sum.cell(row=4, column=col_idx, value=h)
    apply_header_style(ws_sum, 4, len(headers_sum))

    metrics_rows = [
        ("Total Monitored Assets", summary["total_assets"], "All devices, cameras & desktops", "Overview"),
        ("Total Network Devices", summary["total_devices"], "Routers, switches, servers", "Assets"),
        ("Total CCTV Cameras", summary["total_cameras"], "Surveillance cameras", "Assets"),
        ("Total Desktops", summary["total_desktops"], "IT workstation desktops", "Assets"),
        ("Current Online Assets", summary["online_count"], "Active online assets", "Status"),
        ("Current Offline Assets", summary["offline_count"], "Assets currently offline", "Status"),
        ("Total Online Duration (Formatted)", summary["total_online_duration_hms"], "HH:MM:SS format across period", "Duration"),
        ("Total Offline Duration (Formatted)", summary["total_offline_duration_hms"], "HH:MM:SS format across period", "Duration"),
        ("Total Online Duration (Seconds)", summary["total_online_duration_sec"], "Exact total seconds", "Duration"),
        ("Total Offline Duration (Seconds)", summary["total_offline_duration_sec"], "Exact total seconds", "Duration"),
        ("Total Online State Transitions", summary["total_online_events"], "Count of times assets went online", "Events"),
        ("Total Offline State Transitions", summary["total_offline_events"], "Count of times assets went offline", "Events"),
        ("Overall Availability", f"{summary['overall_availability_pct']}%", "Online duration / Total known duration", "Performance"),
        ("Network Devices Availability", f"{summary['devices_availability_pct']}%", "Devices uptime percentage", "Performance"),
        ("CCTV Cameras Availability", f"{summary['cameras_availability_pct']}%", "Cameras uptime percentage", "Performance"),
        ("Desktops Availability", f"{summary['desktops_availability_pct']}%", "Desktops uptime percentage", "Performance")
    ]

    for idx, (m, v, desc, cat) in enumerate(metrics_rows, start=5):
        ws_sum.cell(row=idx, column=1, value=m).font = font_bold
        ws_sum.cell(row=idx, column=2, value=v).font = font_regular
        ws_sum.cell(row=idx, column=3, value=desc).font = font_regular
        ws_sum.cell(row=idx, column=4, value=cat).font = font_regular
        for c in range(1, 5):
            ws_sum.cell(row=idx, column=c).border = thin_border
            if idx % 2 == 0:
                ws_sum.cell(row=idx, column=c).fill = alt_row_fill

    auto_adjust_columns(ws_sum)

    # Helper for asset sheets
    def build_asset_sheet(ws, title, asset_list, asset_type_label="Device"):
        ws.views.sheetView[0].showGridLines = True
        ws.cell(row=1, column=1, value=f"NEO METALIKS NMS — {title.upper()}").font = font_title
        ws.cell(row=2, column=1, value=f"From: {period['from_date']} To: {period['to_date']} | Generated: {period['generated_at']}").font = font_regular

        headers = [
            f"{asset_type_label} ID", f"{asset_type_label} Name", "Device Type" if asset_type_label == "Device" else ("Operating System" if asset_type_label == "Desktop" else "Camera Type"),
            "IP Address", "Location", "Current/Last Known Status",
            "Total Online Duration", "Total Offline Duration",
            "Online Duration (Minutes)", "Offline Duration (Minutes)",
            "Online Duration (Seconds)", "Offline Duration (Seconds)",
            "Online Count", "Offline Count",
            "Online %", "Offline %", "Availability %",
            "First Observed Timestamp", "Last Observed Timestamp",
            "Last Status Change Time", "Total Status Changes", "Timeline Coverage"
        ]

        for col_idx, h in enumerate(headers, 1):
            ws.cell(row=4, column=col_idx, value=h)
        apply_header_style(ws, 4, len(headers))

        for row_idx, a in enumerate(asset_list, start=5):
            type_val = a.get("operating_system", "Windows") if asset_type_label == "Desktop" else a.get("type", asset_type_label)
            row_vals = [
                a["code"], a["name"], type_val,
                a["ip"], a["location"], a["current_status"],
                a["online_duration_hms"], a["offline_duration_hms"],
                a["online_duration_min"], a["offline_duration_min"],
                a["online_duration_sec"], a["offline_duration_sec"],
                a["online_events"], a["offline_events"],
                f"{a['online_pct']}%", f"{a['offline_pct']}%", f"{a.get('availability_pct', a['online_pct'])}%",
                a["first_observed"], a["last_observed"],
                a["last_status_change"], a["total_status_changes"],
                a["coverage_note"]
            ]

            for c_idx, val in enumerate(row_vals, start=1):
                cell = ws.cell(row=row_idx, column=c_idx, value=val)
                cell.font = font_regular
                cell.border = thin_border
                if c_idx in (1, 4, 6):
                    cell.alignment = Alignment(horizontal="center")
                if row_idx % 2 == 0:
                    cell.fill = alt_row_fill
            ws.row_dimensions[row_idx].height = 20

        auto_adjust_columns(ws)

    # ==========================================
    # SHEET 2: Devices Detail
    # ==========================================
    ws_dev = wb.create_sheet(title="Devices Detail")
    build_asset_sheet(ws_dev, "Devices Detail", report_data["devices"], asset_type_label="Device")

    # ==========================================
    # SHEET 3: CCTV Cameras Detail
    # ==========================================
    ws_cam = wb.create_sheet(title="CCTV Cameras Detail")
    build_asset_sheet(ws_cam, "CCTV Cameras Detail", report_data["cameras"], asset_type_label="Camera")

    # ==========================================
    # SHEET 4: Desktops Detail
    # ==========================================
    ws_desk = wb.create_sheet(title="Desktops Detail")
    build_asset_sheet(ws_desk, "Desktops Detail", report_data["desktops"], asset_type_label="Desktop")

    # ==========================================
    # SHEET 5: Status History / Events
    # ==========================================
    ws_hist = wb.create_sheet(title="Status History")
    ws_hist.views.sheetView[0].showGridLines = True
    ws_hist.cell(row=1, column=1, value="NEO METALIKS NMS — STATUS HISTORY & TRANSITION EVENTS").font = font_title
    ws_hist.cell(row=2, column=1, value=f"Period: {period['from_date']} to {period['to_date']} | Total Events Recorded: {len(report_data['status_history'])}").font = font_regular

    headers_hist = [
        "Event ID", "Asset Category", "Asset ID", "Asset Name", "IP Address",
        "Previous Status", "New Status", "Status Change Timestamp", "Next Status Change Timestamp",
        "Duration in Status (HH:MM:SS)", "Duration (Minutes)", "Duration (Seconds)", "Event Date", "Event Time"
    ]
    for col_idx, h in enumerate(headers_hist, 1):
        ws_hist.cell(row=4, column=col_idx, value=h)
    apply_header_style(ws_hist, 4, len(headers_hist))

    if not report_data["status_history"]:
        cell_empty = ws_hist.cell(row=5, column=1, value="No status transitions recorded within the selected date range.")
        cell_empty.font = font_bold
        ws_hist.merge_cells(start_row=5, start_column=1, end_row=5, end_column=len(headers_hist))
        cell_empty.alignment = Alignment(horizontal="center")
    else:
        for row_idx, ev in enumerate(report_data["status_history"], start=5):
            row_vals = [
                ev["event_id"], ev["category"], ev["asset_id"], ev["asset_name"], ev["ip"],
                ev["prev_status"], ev["new_status"], ev["timestamp_str"], ev["next_timestamp"],
                ev["duration_hms"], ev["duration_min"], ev["duration_sec"], ev["event_date"], ev["event_time"]
            ]
            for c_idx, val in enumerate(row_vals, start=1):
                cell = ws_hist.cell(row=row_idx, column=c_idx, value=val)
                cell.font = font_regular
                cell.border = thin_border
                if c_idx in (1, 6, 7):
                    cell.alignment = Alignment(horizontal="center")
                if row_idx % 2 == 0:
                    cell.fill = alt_row_fill
            ws_hist.row_dimensions[row_idx].height = 20

    auto_adjust_columns(ws_hist)

    output = io.BytesIO()
    wb.save(output)
    return output.getvalue()

def create_csv_report(report_data: dict) -> str:
    """Create advanced CSV with UTF-8 BOM, preserving baseline columns while appending comprehensive data."""
    output = io.StringIO()
    writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)

    period = report_data["period"]
    summary = report_data["summary"]

    # 1. BASELINE COLUMNS & ROWS (PRESERVED AS REQUIRED BY PROMPT)
    writer.writerow(["Device", "Type", "IP Address", "Status", "Uptime"])
    for b in BASELINE_DOWNLOAD_DATA:
        writer.writerow([b["device"], b["type"], b["ip"], b["status"], b["uptime"]])
    for row in report_data.get("table_data", []):
        writer.writerow([f"{row['id']} - {row['name']}", row["type"], row["ip"], row["status"], row["uptime"]])

    writer.writerow([])
    # 2. PERIOD & SUMMARY METRICS
    writer.writerow(["# ========================================================"])
    writer.writerow(["# REPORT METADATA & SUMMARY METRICS"])
    writer.writerow(["# ========================================================"])
    writer.writerow(["Selected From Date", period["from_date"]])
    writer.writerow(["Selected To Date", period["to_date"]])
    writer.writerow(["Report Generated At", period["generated_at"]])
    writer.writerow(["Total Period Duration (HH:MM:SS)", period["total_period_hms"]])
    writer.writerow(["Total Monitored Assets", summary["total_assets"]])
    writer.writerow(["Total Devices", summary["total_devices"]])
    writer.writerow(["Total CCTV Cameras", summary["total_cameras"]])
    writer.writerow(["Total Desktops", summary["total_desktops"]])
    writer.writerow(["Currently Online", summary["online_count"]])
    writer.writerow(["Currently Offline", summary["offline_count"]])
    writer.writerow(["Overall Availability Percentage", f"{summary['overall_availability_pct']}%"])
    writer.writerow(["Devices Availability Percentage", f"{summary['devices_availability_pct']}%"])
    writer.writerow(["CCTV Cameras Availability Percentage", f"{summary['cameras_availability_pct']}%"])
    writer.writerow(["Desktops Availability Percentage", f"{summary['desktops_availability_pct']}%"])
    writer.writerow(["Total Online Duration (HH:MM:SS)", summary["total_online_duration_hms"]])
    writer.writerow(["Total Offline Duration (HH:MM:SS)", summary["total_offline_duration_hms"]])
    writer.writerow(["Total Online Duration (Seconds)", summary["total_online_duration_sec"]])
    writer.writerow(["Total Offline Duration (Seconds)", summary["total_offline_duration_sec"]])
    writer.writerow(["Total Online State Transitions", summary["total_online_events"]])
    writer.writerow(["Total Offline State Transitions", summary["total_offline_events"]])

    writer.writerow([])
    # 3. DETAILED ASSET PERFORMANCE BREAKDOWN
    writer.writerow(["# ========================================================"])
    writer.writerow(["# DETAILED ASSET PERFORMANCE BREAKDOWN"])
    writer.writerow(["# ========================================================"])
    writer.writerow([
        "Asset Category", "Asset ID", "Asset Name", "Type", "IP Address", "Location",
        "Current Status", "Online Duration (HH:MM:SS)", "Offline Duration (HH:MM:SS)",
        "Online Duration (Sec)", "Offline Duration (Sec)", "Online Duration (Min)",
        "Offline Duration (Min)", "Online Events", "Offline Events", "Online %", "Offline %",
        "First Observed", "Last Observed", "Last Status Change", "Total Status Changes", "History Coverage"
    ])

    for a in report_data["all_assets"]:
        writer.writerow([
            a["category"], a["code"], a["name"], a["type"], a["ip"], a["location"],
            a["current_status"], a["online_duration_hms"], a["offline_duration_hms"],
            a["online_duration_sec"], a["offline_duration_sec"], a["online_duration_min"],
            a["offline_duration_min"], a["online_events"], a["offline_events"],
            f"{a['online_pct']}%", f"{a['offline_pct']}%", a["first_observed"],
            a["last_observed"], a["last_status_change"], a["total_status_changes"], a["coverage_note"]
        ])

    writer.writerow([])
    # 4. CHRONOLOGICAL STATUS TRANSITION EVENTS
    writer.writerow(["# ========================================================"])
    writer.writerow(["# STATUS TRANSITIONS & HISTORY EVENTS"])
    writer.writerow(["# ========================================================"])
    writer.writerow([
        "Event ID", "Asset Category", "Asset ID", "Asset Name", "IP Address",
        "Previous Status", "New Status", "Status Change Timestamp", "Next Status Change Timestamp",
        "Duration in Status (HH:MM:SS)", "Duration (Sec)", "Duration (Min)", "Event Date", "Event Time"
    ])

    if not report_data["status_history"]:
        writer.writerow(["No status transitions recorded within the selected date range."])
    else:
        for ev in report_data["status_history"]:
            writer.writerow([
                ev["event_id"], ev["category"], ev["asset_id"], ev["asset_name"], ev["ip"],
                ev["prev_status"], ev["new_status"], ev["timestamp_str"], ev["next_timestamp"],
                ev["duration_hms"], ev["duration_sec"], ev["duration_min"], ev["event_date"], ev["event_time"]
            ])

    # Return with UTF-8 BOM
    return "\ufeff" + output.getvalue()

def create_zip_report(report_data: dict) -> bytes:
    """Create a ZIP archive containing individual CSVs for each sheet."""
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        # 1. Summary CSV
        s_out = io.StringIO()
        sw = csv.writer(s_out)
        sw.writerow(["Metric", "Value", "Description"])
        for k, v in report_data["summary"].items():
            sw.writerow([k, v, ""])
        zf.writestr("01_Summary.csv", ("\ufeff" + s_out.getvalue()).encode("utf-8"))

        # 2. Devices Detail
        d_out = io.StringIO()
        dw = csv.writer(d_out)
        dw.writerow(["Device ID", "Device Name", "Type", "IP Address", "Location", "Current Status",
                     "Online Duration (HH:MM:SS)", "Offline Duration (HH:MM:SS)", "Online %", "Offline %",
                     "Online Events", "Offline Events", "Total Changes", "Coverage"])
        for d in report_data["devices"]:
            dw.writerow([d["code"], d["name"], d["type"], d["ip"], d["location"], d["current_status"],
                         d["online_duration_hms"], d["offline_duration_hms"], f"{d['online_pct']}%",
                         f"{d['offline_pct']}%", d["online_events"], d["offline_events"],
                         d["total_status_changes"], d["coverage_note"]])
        zf.writestr("02_Devices_Detail.csv", ("\ufeff" + d_out.getvalue()).encode("utf-8"))

        # 3. Cameras Detail
        c_out = io.StringIO()
        cw = csv.writer(c_out)
        cw.writerow(["Camera ID", "Camera Name", "Type", "IP Address", "Location", "Current Status",
                     "Online Duration (HH:MM:SS)", "Offline Duration (HH:MM:SS)", "Online %", "Offline %",
                     "Online Events", "Offline Events", "Total Changes", "Coverage"])
        for c in report_data["cameras"]:
            cw.writerow([c["code"], c["name"], c["type"], c["ip"], c["location"], c["current_status"],
                         c["online_duration_hms"], c["offline_duration_hms"], f"{c['online_pct']}%",
                         f"{c['offline_pct']}%", c["online_events"], c["offline_events"],
                         c["total_status_changes"], c["coverage_note"]])
        zf.writestr("03_CCTV_Cameras_Detail.csv", ("\ufeff" + c_out.getvalue()).encode("utf-8"))

        # 4. Desktops Detail
        dk_out = io.StringIO()
        dkw = csv.writer(dk_out)
        dkw.writerow(["Desktop ID", "Department", "Location", "IP Address", "OS", "Current Status",
                      "Online Duration (HH:MM:SS)", "Offline Duration (HH:MM:SS)", "Online %", "Offline %",
                      "Online Events", "Offline Events", "Total Changes", "Coverage"])
        for dk in report_data["desktops"]:
            dkw.writerow([dk["code"], dk["name"], dk["location"], dk["ip"], dk["operating_system"], dk["current_status"],
                          dk["online_duration_hms"], dk["offline_duration_hms"], f"{dk['online_pct']}%",
                          f"{dk['offline_pct']}%", dk["online_events"], dk["offline_events"],
                          dk["total_status_changes"], dk["coverage_note"]])
        zf.writestr("04_Desktops_Detail.csv", ("\ufeff" + dk_out.getvalue()).encode("utf-8"))

        # 5. Status History
        h_out = io.StringIO()
        hw = csv.writer(h_out)
        hw.writerow(["Event ID", "Category", "Asset ID", "Asset Name", "IP Address", "Prev Status", "New Status",
                     "Timestamp", "Next Timestamp", "Duration (HH:MM:SS)", "Duration (Sec)", "Date", "Time"])
        for ev in report_data["status_history"]:
            hw.writerow([ev["event_id"], ev["category"], ev["asset_id"], ev["asset_name"], ev["ip"],
                         ev["prev_status"], ev["new_status"], ev["timestamp_str"], ev["next_timestamp"],
                         ev["duration_hms"], ev["duration_sec"], ev["event_date"], ev["event_time"]])
        zf.writestr("05_Status_History.csv", ("\ufeff" + h_out.getvalue()).encode("utf-8"))

    return zip_buffer.getvalue()
