import type { InspectionReport, Vehicle } from '@/types/domain';

const statusClass = (result: string) => (result === '正常' ? 'status-normal' : result === '异常' ? 'status-error' : 'status-na');

export function buildReportHtml(report: InspectionReport, vehicle: Vehicle) {
  const sections = ['外观检测', '机舱检测', '内饰检测', '水泡车专项检测', '火烧车专项检测', '重大事故专项检测', '电子系统检测', '底盘检测'];

  const rows = (category: string) =>
    report.items
      .filter((item) => item.category === category)
      .map(
        (item) =>
          `<tr><td>${item.item}</td><td class="${statusClass(item.result)}">${item.result}</td><td>${item.remark || '无'}</td></tr>`
      )
      .join('');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>二手车专业检测报告 - ${report.reportNo}</title>
<style>
body{font-family:"Microsoft YaHei",Arial,sans-serif;color:#1f2937;margin:28px;line-height:1.6}
.report-header{text-align:center;border-bottom:3px solid #0b766d;padding-bottom:18px;margin-bottom:22px}
.logo-text{font-size:18px;font-weight:700;color:#0b766d}
.report-title{font-size:28px;font-weight:800;color:#111827;margin:8px 0}
.meta{font-size:13px;color:#64748b}
h3{font-size:18px;margin:22px 0 10px;color:#0b766d;border-left:4px solid #0b766d;padding-left:10px}
.info-grid{display:grid;grid-template-columns:repeat(3,1fr);border:1px solid #dbe3ef;border-bottom:0;border-right:0}
.info-cell{padding:10px;border-right:1px solid #dbe3ef;border-bottom:1px solid #dbe3ef}
.label{display:block;font-size:12px;color:#64748b}.value{font-weight:700;color:#111827}
table{width:100%;border-collapse:collapse;margin-bottom:14px;font-size:13px}
th{background:#e6fbf8;color:#0b766d}td,th{border:1px solid #dbe3ef;padding:8px;text-align:left}
.status-normal{color:#15803d;font-weight:700}.status-error{color:#dc2626;font-weight:700}.status-na{color:#64748b}
.conclusion{background:#fffaf2;border:1px solid #ded4c5;border-radius:10px;padding:14px;margin-top:16px}
.verdict{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.verdict div{border:1px solid #ded4c5;border-radius:8px;padding:10px;background:#fffaf2}
.footer{font-size:12px;color:#64748b;text-align:center;margin-top:28px;border-top:1px solid #dbe3ef;padding-top:12px}
</style>
</head>
<body>
<div class="report-header">
  <div class="logo-text">车辆智能检测系统</div>
  <div class="report-title">二手车专业检测报告</div>
  <div class="meta">报告编号：${report.reportNo} | 检测机构：车辆智能检测中心</div>
</div>
<h3>车辆基本信息</h3>
<div class="info-grid">
  <div class="info-cell"><span class="label">车牌号码</span><span class="value">${vehicle.plateNo}</span></div>
  <div class="info-cell"><span class="label">VIN码</span><span class="value">${vehicle.vin}</span></div>
  <div class="info-cell"><span class="label">品牌车型</span><span class="value">${vehicle.brandModel}</span></div>
  <div class="info-cell"><span class="label">生产日期</span><span class="value">${vehicle.produceDate}</span></div>
  <div class="info-cell"><span class="label">首次上牌</span><span class="value">${vehicle.registerDate}</span></div>
  <div class="info-cell"><span class="label">表显里程</span><span class="value">${vehicle.mileage} km</span></div>
</div>
<h3>检测信息</h3>
<div class="info-grid">
  <div class="info-cell"><span class="label">评估师</span><span class="value">${report.inspectorName} (${report.inspectorNo})</span></div>
  <div class="info-cell"><span class="label">检测时间</span><span class="value">${report.checkedAt}</span></div>
  <div class="info-cell"><span class="label">检测地点</span><span class="value">${report.location}</span></div>
  <div class="info-cell"><span class="label">检测目的</span><span class="value">${report.purpose}</span></div>
  <div class="info-cell"><span class="label">客户姓名</span><span class="value">${report.clientName}</span></div>
  <div class="info-cell"><span class="label">客户手机</span><span class="value">${report.clientPhone}</span></div>
</div>
${sections
  .map(
    (section) => `<h3>${section}记录</h3><table><thead><tr><th style="width:40%">检测项目</th><th style="width:24%">检测结果</th><th>备注</th></tr></thead><tbody>${rows(section)}</tbody></table>`
  )
  .join('')}
<div class="conclusion">
  <h3>检测结论</h3>
  <p><strong>车况评级：</strong>${report.grade}</p>
  <p><strong>异常项汇总：</strong>${report.abnormalSummary}</p>
  <p><strong>维修评估建议：</strong>${report.suggestion}</p>
  <p><strong>报告生成时间：</strong>${report.createdAt}</p>
</div>
<h3>车况判定</h3>
<div class="verdict">
  <div><strong>水泡车判定</strong><br>${report.floodVerdict}</div>
  <div><strong>火烧车判定</strong><br>${report.fireVerdict}</div>
  <div><strong>重大事故判定</strong><br>${report.crashVerdict}</div>
</div>
<div class="footer">
  <p>本报告仅对被检测车辆在检测时状态负责，不对检测后车辆状态变化负责。</p>
  <p>如对检测结果有疑问，请在收到报告后7日内联系检测机构。</p>
  <p>车辆智能检测系统 v1.0 | 专业技术支持</p>
</div>
</body>
</html>`;
}

export function downloadReportDoc(report: InspectionReport, vehicle: Vehicle) {
  const blob = new Blob(['\ufeff', buildReportHtml(report, vehicle)], { type: 'application/msword;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `二手车专业检测报告_${vehicle.plateNo}_${report.reportNo}.doc`;
  link.click();
  URL.revokeObjectURL(link.href);
}
