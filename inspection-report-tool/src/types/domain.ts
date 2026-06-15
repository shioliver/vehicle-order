export type EnergyType = '燃油' | '纯电' | '混动';
export type InspectionGrade = 'S' | 'A' | 'B' | 'C' | 'D';

export interface VehicleInfo {
  plateNo: string;
  vin: string;
  brandModel: string;
  energyType: EnergyType;
  color: string;
  produceDate: string;
  registerDate: string;
  mileage: number;
}

export interface InspectionItemResult {
  category: string;
  item: string;
  result: '正常' | '异常' | '不适用';
  remark: string;
}

export interface InspectionReport {
  reportNo: string;
  clientName: string;
  clientPhone: string;
  purpose: string;
  inspectorName: string;
  inspectorNo: string;
  location: string;
  checkedAt: string;
  grade: InspectionGrade;
  abnormalSummary: string;
  suggestion: string;
  floodVerdict: '正常' | '疑似水泡' | '确认水泡';
  fireVerdict: '正常' | '疑似火烧' | '确认火烧';
  crashVerdict: '正常' | '确认事故车';
  items: InspectionItemResult[];
  createdAt: string;
}
