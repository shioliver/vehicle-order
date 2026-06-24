export type UserRole = 'super_admin' | 'inspection_admin' | 'rental_admin' | 'customer' | 'driver';

export type UserStatus = '启用' | '停用';

export type VehicleStatus =
  | '待检测'
  | '检测中'
  | '已检测'
  | '待入库'
  | '预备库'
  | '可租赁'
  | '已出租'
  | '调度中'
  | '运营中'
  | '维修中'
  | '保养中'
  | '停用';

export type InspectionGrade = 'S' | 'A' | 'B' | 'C' | 'D';

export interface AppUser {
  id: string;
  username: string;
  password: string;
  name: string;
  role: UserRole;
  phone: string;
  status?: UserStatus;
}

export interface Vehicle {
  id: string;
  ownerId?: string;
  plateNo: string;
  vin: string;
  brandModel: string;
  energyType: '燃油' | '纯电' | '混动';
  color: string;
  produceDate: string;
  registerDate: string;
  mileage: number;
  status: VehicleStatus;
  grade?: InspectionGrade;
  warehouse?: string;
  parkingSpace?: string;
  dailyPrice?: number;
  deposit?: number;
  city?: string;
  pickupLocation?: string;
  description?: string;
  minRentalDays?: number;
  images?: VehicleAttachment[];
  reportFiles?: VehicleAttachment[];
  driverId?: string;
  lastInspectionId?: string;
  updatedAt: string;
}

export interface VehicleAttachment {
  id: string;
  name: string;
  type: 'image' | 'pdf' | 'word' | 'other';
  url: string;
  uploadedAt: string;
}

export interface InspectionImage {
  id: string;
  name: string;
  dataUrl: string;
  size: number;
  uploadedAt: string;
}

export interface InspectionItemResult {
  category: string;
  item: string;
  result: '正常' | '异常' | '不适用';
  remark: string;
  images?: InspectionImage[];
}

export interface InspectionReport {
  id: string;
  reportNo: string;
  vehicleId: string;
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

export interface InventoryRecord {
  id: string;
  recordNo: string;
  vehicleId: string;
  type: '入库' | '出库' | '调拨';
  source: '检测入库' | '手动入库' | '租赁出库' | '调度出库' | '还车入库';
  warehouse: string;
  parkingSpace: string;
  operator: string;
  mileage: number;
  energyLevel: number;
  remark: string;
  createdAt: string;
}

export interface RentalOrder {
  id: string;
  orderNo: string;
  vehicleId: string;
  userId: string;
  customerName: string;
  startAt: string;
  endAt: string;
  amount: number;
  deposit: number;
  status: '待审核' | '待取车' | '租赁中' | '已完成' | '已取消';
}

export interface Driver {
  id: string;
  userId?: string;
  name: string;
  phone: string;
  licenseNo: string;
  status: '空闲' | '出车中' | '休息' | '停用';
}

export interface DispatchTask {
  id: string;
  taskNo: string;
  vehicleId: string;
  driverId: string;
  routeName: string;
  startPoint: string;
  endPoint: string;
  scheduledAt: string;
  status: '待接收' | '执行中' | '已完成' | '已取消';
  remark: string;
}

export interface FleetData {
  users: AppUser[];
  vehicles: Vehicle[];
  reports: InspectionReport[];
  inventoryRecords: InventoryRecord[];
  rentalOrders: RentalOrder[];
  drivers: Driver[];
  dispatchTasks: DispatchTask[];
}
