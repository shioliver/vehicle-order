import type { InspectionReport, VehicleInfo } from '@/types/domain';

const statusClass = (result: string) => (result === '异常' ? 'status-error' : result === '不适用' ? 'status-na' : 'status-normal');

function escapeHtml(value: string | number) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function buildReportHtml(report: InspectionReport, vehicle: VehicleInfo) {
  const sections = ['外观检测', '机舱检测', '内饰检测', '水泡车专项检测', '火烧车专项检测', '重大事故专项检测', '电子系统检测', '底盘检测'];
  const rows = (category: string) =>
    report.items
      .filter((item) => item.category === category)
      .map(
        (item) =>
          `<tr class="${item.result === '异常' ? 'abnormal-row' : ''}"><td>${escapeHtml(item.item)}</td><td class="${statusClass(item.result)}">${escapeHtml(item.result)}</td><td>${escapeHtml(item.remark || '无')}</td></tr>`
      )
      .join('');

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>二手车专业检测报告 - ${escapeHtml(report.reportNo)}</title>
<style>
body{font-family:"Microsoft YaHei",Arial,sans-serif;color:#111827;margin:28px;line-height:1.55}
.report-header{text-align:center;border-bottom:3px solid #165dff;padding-bottom:18px;margin-bottom:22px}
.logo-text{font-size:18px;font-weight:700;color:#165dff}.report-title{font-size:28px;font-weight:800;margin:8px 0}.meta{font-size:13px;color:#64748b}
h3{font-size:18px;margin:22px 0 10px;color:#165dff;border-left:4px solid #165dff;padding-left:10px}
.info-grid{display:grid;grid-template-columns:repeat(3,1fr);border:1px solid #dbe3ef;border-bottom:0;border-right:0}
.info-cell{padding:9px 10px;border-right:1px solid #dbe3ef;border-bottom:1px solid #dbe3ef}
.label{display:block;font-size:12px;color:#64748b}.value{font-weight:700;color:#111827}
table{width:100%;border-collapse:collapse;margin-bottom:14px;font-size:13px}th{background:#eef4ff;color:#1d4ed8}td,th{border:1px solid #dbe3ef;padding:7px 8px;text-align:left}
.status-normal{color:#15803d;font-weight:700}.status-error{color:#dc2626;font-weight:700}.status-na{color:#64748b}.abnormal-row{background:#fff3f3}
.conclusion{background:#f8fafc;border:1px solid #dbe3ef;border-radius:10px;padding:14px;margin-top:16px}
.verdict{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.verdict div{border:1px solid #dbe3ef;border-radius:8px;padding:10px;background:#fff}
.footer{font-size:12px;color:#64748b;text-align:center;margin-top:28px;border-top:1px solid #dbe3ef;padding-top:12px}
</style>
</head>
<body>
<div class="report-header"><div class="logo-text">车辆智能检测系统</div><div class="report-title">二手车专业检测报告</div><div class="meta">报告编号：${escapeHtml(report.reportNo)} | 检测机构：车辆智能检测中心</div></div>
<h3>车辆基本信息</h3>
<div class="info-grid">
<div class="info-cell"><span class="label">车牌号码</span><span class="value">${escapeHtml(vehicle.plateNo)}</span></div>
<div class="info-cell"><span class="label">VIN码</span><span class="value">${escapeHtml(vehicle.vin)}</span></div>
<div class="info-cell"><span class="label">品牌车型</span><span class="value">${escapeHtml(vehicle.brandModel)}</span></div>
<div class="info-cell"><span class="label">生产日期</span><span class="value">${escapeHtml(vehicle.produceDate)}</span></div>
<div class="info-cell"><span class="label">首次上牌</span><span class="value">${escapeHtml(vehicle.registerDate)}</span></div>
<div class="info-cell"><span class="label">表显里程</span><span class="value">${escapeHtml(vehicle.mileage)} km</span></div>
</div>
<h3>检测信息</h3>
<div class="info-grid">
<div class="info-cell"><span class="label">评估师</span><span class="value">${escapeHtml(report.inspectorName)} (${escapeHtml(report.inspectorNo)})</span></div>
<div class="info-cell"><span class="label">检测时间</span><span class="value">${escapeHtml(report.checkedAt)}</span></div>
<div class="info-cell"><span class="label">检测地点</span><span class="value">${escapeHtml(report.location)}</span></div>
<div class="info-cell"><span class="label">检测目的</span><span class="value">${escapeHtml(report.purpose)}</span></div>
<div class="info-cell"><span class="label">客户姓名</span><span class="value">${escapeHtml(report.clientName)}</span></div>
<div class="info-cell"><span class="label">客户手机</span><span class="value">${escapeHtml(report.clientPhone)}</span></div>
</div>
${sections.map((section) => `<h3>${section}记录</h3><table><thead><tr><th style="width:42%">检测项目</th><th style="width:16%">检测结果</th><th>备注</th></tr></thead><tbody>${rows(section)}</tbody></table>`).join('')}
<h3>车况判定</h3><div class="verdict"><div><strong>水泡车判定</strong><br>${escapeHtml(report.floodVerdict)}</div><div><strong>火烧车判定</strong><br>${escapeHtml(report.fireVerdict)}</div><div><strong>重大事故判定</strong><br>${escapeHtml(report.crashVerdict)}</div></div>
<div class="conclusion"><h3>检测结论</h3><p><strong>车况评级：</strong>${escapeHtml(report.grade)}</p><p><strong>异常项汇总：</strong>${escapeHtml(report.abnormalSummary)}</p><p><strong>维修评估建议：</strong>${escapeHtml(report.suggestion)}</p><p><strong>报告生成时间：</strong>${escapeHtml(report.createdAt)}</p></div>
<div class="footer"><p>本报告仅对被检测车辆在检测时状态负责，不对检测后车辆状态变化负责。</p><p>车辆智能检测系统 | 可独立复用检测报告工具</p></div>
</body>
</html>`;
}

export function downloadReportDoc(report: InspectionReport, vehicle: VehicleInfo) {
  const blob = new Blob(['\ufeff', buildReportHtml(report, vehicle)], { type: 'application/msword;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `二手车专业检测报告_${vehicle.plateNo || '未填写车牌'}_${report.reportNo}.doc`;
  link.click();
  URL.revokeObjectURL(link.href);
}
