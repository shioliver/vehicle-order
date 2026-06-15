import { requireAction, type PermissionAction } from '@/auth/permissions';
import { readCurrentUser, type SessionUser } from '@/auth/session';
import { seedData } from '@/db/seed';
import { inspectionCategories } from '@/db/schema';
import { formatBeijingDateTime } from '@/utils/date';
import type {
  Driver,
  DispatchTask,
  FleetData,
  InspectionGrade,
  InspectionItemResult,
  InspectionReport,
  InventoryRecord,
  RentalOrder,
  Vehicle
} from '@/types/domain';

const STORAGE_KEY = 'vehicle-fleet-system-v1';

const uid = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
const stamp = () => formatBeijingDateTime();
const todayKey = () => stamp().slice(0, 10).replace(/\D/g, '');
const normalizeKey = (value: string) => value.trim().toUpperCase();

const categoryLabels = [
  ['exterior', '外观检测'],
  ['cabin', '机舱检测'],
  ['interior', '内饰检测'],
  ['flood', '水泡车专项检测'],
  ['fire', '火烧车专项检测'],
  ['crash', '重大事故专项检测'],
  ['electric', '电子系统检测'],
  ['chassis', '底盘检测']
] as const;

const activeRentalStatuses: RentalOrder['status'][] = ['待取车', '租赁中'];
const activeDispatchStatuses: DispatchTask['status'][] = ['待接收', '执行中'];

function readStoredUsers() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedData.users;
    const parsed = JSON.parse(raw) as Partial<FleetData>;
    return Array.isArray(parsed.users) ? parsed.users : seedData.users;
  } catch {
    return seedData.users;
  }
}

function validateActiveSession(user: SessionUser | null): SessionUser | null {
  if (!user) return null;
  const storedUser = readStoredUsers().find((item) => item.id === user.id && item.username === user.username && item.role === user.role);
  if (!storedUser || storedUser.status === '停用') return null;
  return { ...user, status: storedUser.status };
}

function assertAction(action: PermissionAction): SessionUser {
  const user = validateActiveSession(readCurrentUser());
  requireAction(user, action);
  if (!user) throw new Error('当前账号无权限执行此操作');
  return user;
}

export interface InspectionDraft {
  vehicleId?: string;
  plateNo: string;
  vin: string;
  brandModel: string;
  energyType: Vehicle['energyType'];
  color: string;
  produceDate: string;
  registerDate: string;
  mileage: number;
  clientName: string;
  clientPhone: string;
  purpose: string;
  inspectorName: string;
  inspectorNo: string;
  location: string;
  grade: InspectionGrade;
  abnormalSummary: string;
  suggestion: string;
  items: InspectionItemResult[];
  autoStockIn: boolean;
}

export class FleetRepository {
  load(): FleetData {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = structuredClone(seedData);
      initial.reports.forEach((report) => {
        report.items = this.completeInspectionItems(report.items);
      });
      this.repairRelations(initial);
      this.save(initial);
      return initial;
    }
    const data = JSON.parse(raw) as FleetData;
    let changed = false;
    data.inventoryRecords.forEach((record) => {
      if (!record.recordNo) {
        record.recordNo = this.nextInventoryNo(data);
        changed = true;
      }
    });
    data.reports.forEach((report) => {
      const completed = this.completeInspectionItems(report.items);
      if (completed.length !== report.items.length) {
        report.items = completed;
        changed = true;
      }
    });
    changed = this.repairRelations(data) || changed;
    if (changed) this.save(data);
    return data;
  }

  private save(data: FleetData) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  reset() {
    assertAction('system:reset');
    this.save(seedData);
  }

  login(username: string, password: string) {
    const data = this.load();
    return data.users.find((user) => user.username === username && user.password === password && user.status !== '停用') ?? null;
  }

  upsertVehicle(input: Omit<Vehicle, 'id' | 'updatedAt'> & { id?: string; updatedAt?: string }): Vehicle {
    const actor = assertAction(input.id ? 'vehicle:update' : 'vehicle:create');
    const data = this.load();
    const existing = input.id ? data.vehicles.find((item) => item.id === input.id) : undefined;
    if (actor.role === 'customer') this.assertCustomerVehicleUpsert(actor, input, existing);
    this.assertUnique(data.vehicles, 'plateNo', input.plateNo, input.id, '车牌号码');
    this.assertUnique(data.vehicles, 'vin', input.vin, input.id, 'VIN码');
    const vehicle: Vehicle = {
      ...existing,
      ...input,
      ownerId: actor.role === 'customer' ? actor.id : input.ownerId ?? existing?.ownerId,
      status: actor.role === 'customer' ? (input.status === '停用' ? '停用' : '可租赁') : input.status,
      id: input.id || uid('v'),
      updatedAt: stamp()
    };

    if (existing) {
      Object.assign(existing, vehicle);
    } else {
      data.vehicles.unshift(vehicle);
    }

    this.save(data);
    return vehicle;
  }

  deleteVehicle(vehicleId: string) {
    assertAction('vehicle:delete');
    const data = this.load();
    data.vehicles = data.vehicles.filter((item) => item.id !== vehicleId);
    data.reports = data.reports.filter((item) => item.vehicleId !== vehicleId);
    data.inventoryRecords = data.inventoryRecords.filter((item) => item.vehicleId !== vehicleId);
    data.rentalOrders = data.rentalOrders.filter((item) => item.vehicleId !== vehicleId);
    data.dispatchTasks = data.dispatchTasks.filter((item) => item.vehicleId !== vehicleId);
    data.drivers.forEach((driver) => {
      if (!data.dispatchTasks.some((task) => task.driverId === driver.id && task.status !== '已完成' && task.status !== '已取消')) {
        driver.status = driver.status === '出车中' ? '空闲' : driver.status;
      }
    });
    this.save(data);
  }

  updateReport(report: InspectionReport): InspectionReport {
    assertAction('report:update');
    const data = this.load();
    const existing = data.reports.find((item) => item.id === report.id);
    if (!existing) throw new Error('报告不存在');
    const previousVehicleId = existing.vehicleId;
    this.assertUnique(data.reports, 'reportNo', report.reportNo, report.id, '报告编号');
    if (!data.vehicles.some((item) => item.id === report.vehicleId)) throw new Error('报告关联车辆不存在');
    report.items = this.completeInspectionItems(report.items);
    Object.assign(existing, report);

    const vehicle = data.vehicles.find((item) => item.id === report.vehicleId);
    if (vehicle) {
      vehicle.grade = report.grade;
      vehicle.lastInspectionId = report.id;
      vehicle.updatedAt = stamp();
    }
    if (previousVehicleId !== report.vehicleId) this.refreshVehicleLatestReport(data, previousVehicleId);

    this.save(data);
    return existing;
  }

  deleteReport(reportId: string) {
    assertAction('report:delete');
    const data = this.load();
    data.reports = data.reports.filter((item) => item.id !== reportId);
    data.vehicles.forEach((vehicle) => {
      if (vehicle.lastInspectionId === reportId) {
        const latest = data.reports.find((report) => report.vehicleId === vehicle.id);
        vehicle.lastInspectionId = latest?.id;
        vehicle.grade = latest?.grade;
        vehicle.updatedAt = stamp();
      }
    });
    this.save(data);
  }

  createInspection(draft: InspectionDraft): InspectionReport {
    assertAction('report:create');
    const data = this.load();
    const vehicle = this.resolveInspectionVehicle(data, draft);
    const completedItems = this.completeInspectionItems(draft.items);

    Object.assign(vehicle, {
      plateNo: draft.plateNo,
      vin: draft.vin,
      brandModel: draft.brandModel,
      energyType: draft.energyType,
      color: draft.color,
      produceDate: draft.produceDate,
      registerDate: draft.registerDate,
      mileage: draft.mileage,
      grade: draft.grade,
      status: draft.autoStockIn ? '预备库' : '已检测',
      updatedAt: stamp()
    } satisfies Partial<Vehicle>);

    if (!data.vehicles.some((item) => item.id === vehicle.id)) {
      data.vehicles.unshift(vehicle);
    }

    const report: InspectionReport = {
      id: uid('r'),
      reportNo: this.nextReportNo(data),
      vehicleId: vehicle.id,
      clientName: draft.clientName,
      clientPhone: draft.clientPhone,
      purpose: draft.purpose,
      inspectorName: draft.inspectorName,
      inspectorNo: draft.inspectorNo,
      location: draft.location,
      checkedAt: stamp(),
      grade: draft.grade,
      abnormalSummary: draft.abnormalSummary || '未发现明显异常。',
      suggestion: draft.suggestion || '建议按运营标准完成清洁、补能和随车物品核验。',
      floodVerdict: this.calcFloodVerdict(draft.items),
      fireVerdict: this.calcFireVerdict(draft.items),
      crashVerdict: draft.items.some((item) => item.category === '重大事故专项检测' && item.result === '异常')
        ? '确认事故车'
        : '正常',
      items: completedItems,
      createdAt: stamp()
    };

    data.reports.unshift(report);
    vehicle.lastInspectionId = report.id;

    if (draft.autoStockIn && report.floodVerdict === '正常' && report.fireVerdict === '正常' && report.crashVerdict === '正常') {
      vehicle.status = '预备库';
      vehicle.warehouse = vehicle.warehouse || '默认网约车预备库';
      vehicle.parkingSpace = vehicle.parkingSpace || `P-${String(data.inventoryRecords.length + 1).padStart(3, '0')}`;
      data.inventoryRecords.unshift({
        id: uid('i'),
        recordNo: this.nextInventoryNo(data),
        vehicleId: vehicle.id,
        type: '入库',
        source: '检测入库',
        warehouse: vehicle.warehouse,
        parkingSpace: vehicle.parkingSpace,
        operator: draft.inspectorName,
        mileage: vehicle.mileage,
        energyLevel: 80,
        remark: '检测通过后自动入库，并同步到网约车预备库。',
        createdAt: stamp()
      });
    }

    this.save(data);
    return report;
  }

  stockIn(vehicleId: string, operator: string, warehouse: string, parkingSpace: string): InventoryRecord {
    assertAction('inventory:create');
    const data = this.load();
    const vehicle = data.vehicles.find((item) => item.id === vehicleId);
    if (!vehicle) throw new Error('车辆不存在');
    this.assertParkingAvailable(data, warehouse, parkingSpace, vehicleId);

    vehicle.status = '预备库';
    vehicle.warehouse = warehouse;
    vehicle.parkingSpace = parkingSpace;
    vehicle.updatedAt = stamp();

    const record: InventoryRecord = {
      id: uid('i'),
      recordNo: this.nextInventoryNo(data),
      vehicleId,
      type: '入库',
      source: '手动入库',
      warehouse,
      parkingSpace,
      operator,
      mileage: vehicle.mileage,
      energyLevel: 70,
      remark: '手动入库到网约车预备库。',
      createdAt: stamp()
    };
    data.inventoryRecords.unshift(record);
    this.save(data);
    return record;
  }

  upsertInventoryRecord(input: Omit<InventoryRecord, 'id' | 'createdAt' | 'recordNo'> & { id?: string; createdAt?: string; recordNo?: string }): InventoryRecord {
    assertAction(input.id ? 'inventory:update' : 'inventory:create');
    const data = this.load();
    const existing = input.id ? data.inventoryRecords.find((item) => item.id === input.id) : undefined;
    if (!data.vehicles.some((item) => item.id === input.vehicleId)) throw new Error('入库流水关联车辆不存在');
    if (input.recordNo || existing?.recordNo) this.assertUnique(data.inventoryRecords, 'recordNo', input.recordNo || existing?.recordNo || '', input.id, '流水号');
    this.assertParkingAvailable(data, input.warehouse, input.parkingSpace, input.vehicleId);
    const record: InventoryRecord = {
      ...existing,
      ...input,
      id: input.id || uid('i'),
      recordNo: input.recordNo || existing?.recordNo || this.nextInventoryNo(data),
      createdAt: input.createdAt || stamp()
    };

    if (existing) {
      Object.assign(existing, record);
    } else {
      data.inventoryRecords.unshift(record);
    }

    const vehicle = data.vehicles.find((item) => item.id === record.vehicleId);
    if (vehicle) {
      vehicle.warehouse = record.warehouse;
      vehicle.parkingSpace = record.parkingSpace;
      if (record.type === '入库') vehicle.status = '预备库';
      if (record.type === '出库') vehicle.status = record.source === '租赁出库' ? '已出租' : '调度中';
      vehicle.updatedAt = stamp();
    }

    this.save(data);
    return record;
  }

  deleteInventoryRecord(recordId: string) {
    assertAction('inventory:delete');
    const data = this.load();
    data.inventoryRecords = data.inventoryRecords.filter((item) => item.id !== recordId);
    this.save(data);
  }

  createRentalOrder(vehicleId: string, userId: string, customerName: string): RentalOrder {
    const actor = assertAction('rental:create');
    const data = this.load();
    const vehicle = data.vehicles.find((item) => item.id === vehicleId);
    const orderUserId = actor.role === 'customer' ? actor.id : userId;
    const orderCustomerName = actor.role === 'customer' ? actor.name : customerName;
    if (!vehicle) throw new Error('车辆不存在');
    if (!data.users.some((item) => item.id === orderUserId && item.status !== '停用')) throw new Error('租赁用户不存在或已停用');
    if (vehicle.ownerId && vehicle.ownerId === orderUserId) throw new Error('不能租赁自己发布的车辆');
    this.assertVehicleCanRent(data, vehicleId);

    vehicle.status = '已出租';
    vehicle.updatedAt = stamp();

    const order: RentalOrder = {
      id: uid('o'),
      orderNo: this.nextOrderNo(data),
      vehicleId,
      userId: orderUserId,
      customerName: orderCustomerName,
      startAt: stamp(),
      endAt: stamp(),
      amount: vehicle.dailyPrice ?? 268,
      deposit: vehicle.deposit ?? 3000,
      status: '租赁中'
    };
    data.rentalOrders.unshift(order);
    this.save(data);
    return order;
  }

  upsertRentalOrder(input: Omit<RentalOrder, 'id' | 'orderNo'> & { id?: string; orderNo?: string }): RentalOrder {
    const actor = assertAction(input.id ? 'rental:update' : 'rental:create');
    const data = this.load();
    const existing = input.id ? data.rentalOrders.find((item) => item.id === input.id) : undefined;
    const previousVehicleId = existing?.vehicleId;
    if (actor.role === 'customer') {
      this.assertCustomerRentalUpdate(actor, input, existing);
    }
    if (!data.vehicles.some((item) => item.id === input.vehicleId)) throw new Error('订单关联车辆不存在');
    if (!data.users.some((item) => item.id === input.userId && item.status !== '停用')) throw new Error('订单关联用户不存在或已停用');
    if (input.orderNo) this.assertUnique(data.rentalOrders, 'orderNo', input.orderNo, input.id, '订单号');
    if (activeRentalStatuses.includes(input.status)) this.assertVehicleCanRent(data, input.vehicleId, input.id);
    const order: RentalOrder = {
      ...existing,
      ...input,
      id: input.id || uid('o'),
      orderNo: input.orderNo || existing?.orderNo || this.nextOrderNo(data)
    };

    if (existing) {
      Object.assign(existing, order);
    } else {
      data.rentalOrders.unshift(order);
    }

    if (previousVehicleId && previousVehicleId !== order.vehicleId) {
      const previousVehicle = data.vehicles.find((item) => item.id === previousVehicleId);
      if (previousVehicle?.status === '已出租') previousVehicle.status = '可租赁';
    }
    this.syncRentalVehicleStatus(data, order);
    this.save(data);
    return order;
  }

  deleteRentalOrder(orderId: string) {
    assertAction('rental:delete');
    const data = this.load();
    const order = data.rentalOrders.find((item) => item.id === orderId);
    data.rentalOrders = data.rentalOrders.filter((item) => item.id !== orderId);
    if (order) {
      const vehicle = data.vehicles.find((item) => item.id === order.vehicleId);
      if (vehicle?.status === '已出租') {
        vehicle.status = vehicle.warehouse ? '预备库' : '可租赁';
        vehicle.updatedAt = stamp();
      }
    }
    this.save(data);
  }

  createDispatchTask(vehicleId: string, driverId: string, routeName: string): DispatchTask {
    assertAction('dispatch:create');
    const data = this.load();
    const vehicle = data.vehicles.find((item) => item.id === vehicleId);
    const driver = data.drivers.find((item) => item.id === driverId);
    if (!vehicle || !driver) throw new Error('车辆或司机不存在');
    this.assertVehicleCanDispatch(data, vehicleId);
    this.assertDriverCanDispatch(data, driverId);

    vehicle.status = '调度中';
    vehicle.driverId = driverId;
    vehicle.updatedAt = stamp();
    driver.status = '出车中';

    const task: DispatchTask = {
      id: uid('t'),
      taskNo: this.nextTaskNo(data),
      vehicleId,
      driverId,
      routeName,
      startPoint: '网约车预备库',
      endPoint: '运营区域',
      scheduledAt: stamp(),
      status: '待接收',
      remark: '由预备库直接派发。'
    };
    data.dispatchTasks.unshift(task);
    this.save(data);
    return task;
  }

  upsertDispatchTask(input: Omit<DispatchTask, 'id' | 'taskNo'> & { id?: string; taskNo?: string }): DispatchTask {
    const actor = assertAction(input.id ? 'dispatch:update' : 'dispatch:create');
    const data = this.load();
    const existing = input.id ? data.dispatchTasks.find((item) => item.id === input.id) : undefined;
    const previousVehicleId = existing?.vehicleId;
    const previousDriverId = existing?.driverId;
    if (actor.role === 'driver') {
      this.assertDriverDispatchUpdate(actor, input, existing, data);
    }
    if (!data.vehicles.some((item) => item.id === input.vehicleId) || !data.drivers.some((item) => item.id === input.driverId)) {
      throw new Error('调度任务关联车辆或司机不存在');
    }
    if (input.taskNo) this.assertUnique(data.dispatchTasks, 'taskNo', input.taskNo, input.id, '任务号');
    if (activeDispatchStatuses.includes(input.status)) {
      this.assertVehicleCanDispatch(data, input.vehicleId, input.id);
      this.assertDriverCanDispatch(data, input.driverId, input.id);
    }
    const task: DispatchTask = {
      ...existing,
      ...input,
      id: input.id || uid('t'),
      taskNo: input.taskNo || existing?.taskNo || this.nextTaskNo(data)
    };

    if (existing) {
      Object.assign(existing, task);
    } else {
      data.dispatchTasks.unshift(task);
    }

    if (previousVehicleId && previousVehicleId !== task.vehicleId) this.releaseVehicle(data, previousVehicleId);
    if (previousDriverId && previousDriverId !== task.driverId) this.releaseDriver(data, previousDriverId);
    this.syncDispatchStatus(data, task);
    this.save(data);
    return task;
  }

  deleteDispatchTask(taskId: string) {
    assertAction('dispatch:delete');
    const data = this.load();
    const task = data.dispatchTasks.find((item) => item.id === taskId);
    data.dispatchTasks = data.dispatchTasks.filter((item) => item.id !== taskId);
    if (task) {
      this.releaseVehicle(data, task.vehicleId);
      this.releaseDriver(data, task.driverId);
    }
    this.save(data);
  }

  upsertDriver(input: Omit<Driver, 'id'> & { id?: string }): Driver {
    assertAction(input.id ? 'driver:update' : 'driver:create');
    const data = this.load();
    const existing = input.id ? data.drivers.find((item) => item.id === input.id) : undefined;
    this.assertUnique(data.drivers, 'phone', input.phone, input.id, '司机手机号');
    this.assertUnique(data.drivers, 'licenseNo', input.licenseNo, input.id, '驾驶证号');
    if (input.id && input.status !== '出车中' && data.dispatchTasks.some((task) => task.driverId === input.id && activeDispatchStatuses.includes(task.status))) {
      throw new Error('司机存在未完成调度任务，不能改为空闲/休息/停用');
    }
    const driver: Driver = {
      ...existing,
      ...input,
      id: input.id || uid('d')
    };

    if (existing) {
      Object.assign(existing, driver);
    } else {
      data.drivers.unshift(driver);
    }

    this.save(data);
    return driver;
  }

  deleteDriver(driverId: string) {
    assertAction('driver:delete');
    const data = this.load();
    data.drivers = data.drivers.filter((item) => item.id !== driverId);
    data.dispatchTasks = data.dispatchTasks.filter((item) => item.driverId !== driverId);
    data.vehicles.forEach((vehicle) => {
      if (vehicle.driverId === driverId) {
        vehicle.driverId = undefined;
        vehicle.status = vehicle.warehouse ? '预备库' : '可租赁';
        vehicle.updatedAt = stamp();
      }
    });
    this.save(data);
  }

  private assertCustomerRentalUpdate(
    actor: SessionUser,
    input: Omit<RentalOrder, 'id' | 'orderNo'> & { id?: string; orderNo?: string },
    existing?: RentalOrder
  ) {
    if (!input.id || !existing) throw new Error('租车客户只能修改自己的现有订单');
    if (existing.userId !== actor.id || input.userId !== actor.id) throw new Error('只能操作自己的租赁订单');
    if (
      input.vehicleId !== existing.vehicleId ||
      input.customerName !== existing.customerName ||
      input.startAt !== existing.startAt ||
      input.endAt !== existing.endAt ||
      input.amount !== existing.amount ||
      input.deposit !== existing.deposit ||
      (input.orderNo && input.orderNo !== existing.orderNo)
    ) {
      throw new Error('租车客户只能修改订单状态');
    }
    const allowed =
      input.status === existing.status ||
      (['待审核', '待取车'].includes(existing.status) && input.status === '已取消') ||
      (existing.status === '租赁中' && input.status === '已完成');
    if (!allowed) throw new Error('当前订单状态不支持此操作');
  }

  private assertDriverDispatchUpdate(
    actor: SessionUser,
    input: Omit<DispatchTask, 'id' | 'taskNo'> & { id?: string; taskNo?: string },
    existing: DispatchTask | undefined,
    data: FleetData
  ) {
    if (!input.id || !existing) throw new Error('司机只能更新自己的现有调度任务');
    const driver = data.drivers.find((item) => item.userId === actor.id);
    if (!driver || existing.driverId !== driver.id || input.driverId !== driver.id) throw new Error('只能操作自己的调度任务');
    if (
      input.vehicleId !== existing.vehicleId ||
      input.routeName !== existing.routeName ||
      input.startPoint !== existing.startPoint ||
      input.endPoint !== existing.endPoint ||
      input.scheduledAt !== existing.scheduledAt ||
      input.remark !== existing.remark ||
      (input.taskNo && input.taskNo !== existing.taskNo)
    ) {
      throw new Error('司机只能修改任务状态');
    }
    const allowed =
      input.status === existing.status ||
      (existing.status === '待接收' && input.status === '执行中') ||
      (existing.status === '执行中' && input.status === '已完成');
    if (!allowed) throw new Error('当前调度任务状态不支持此操作');
  }

  private assertCustomerVehicleUpsert(
    actor: SessionUser,
    input: Omit<Vehicle, 'id' | 'updatedAt'> & { id?: string; updatedAt?: string },
    existing?: Vehicle
  ) {
    if (input.id && !existing) throw new Error('车辆不存在');
    if (existing && existing.ownerId !== actor.id) throw new Error('只能编辑自己发布的车辆');
    if (input.status !== '可租赁' && input.status !== '停用') throw new Error('车主只能上架或下架车辆');
    if (existing) {
      const lockedFields: Array<keyof Vehicle> = ['warehouse', 'parkingSpace', 'driverId', 'lastInspectionId'];
      const changedLockedField = lockedFields.some((field) => input[field] !== existing[field]);
      if (changedLockedField) throw new Error('车主不能修改平台运营字段');
    }
  }

  private createVehicleFromDraft(draft: InspectionDraft): Vehicle {
    return {
      id: uid('v'),
      plateNo: draft.plateNo,
      vin: draft.vin,
      brandModel: draft.brandModel,
      energyType: draft.energyType,
      color: draft.color,
      produceDate: draft.produceDate,
      registerDate: draft.registerDate,
      mileage: draft.mileage,
      status: '已检测',
      grade: draft.grade,
      images: [],
      reportFiles: [],
      updatedAt: stamp()
    };
  }

  private nextReportNo(data: FleetData) {
    return this.nextNo(data.reports.map((item) => item.reportNo), 'RPT');
  }

  private nextOrderNo(data: FleetData) {
    return this.nextNo(data.rentalOrders.map((item) => item.orderNo), 'RO');
  }

  private nextTaskNo(data: FleetData) {
    return this.nextNo(data.dispatchTasks.map((item) => item.taskNo), 'DT');
  }

  private nextInventoryNo(data: FleetData) {
    return this.nextNo(data.inventoryRecords.map((item) => item.recordNo), 'IR');
  }

  private nextNo(existingNos: string[], prefix: string) {
    const base = `${prefix}${todayKey()}`;
    let index =
      existingNos
        .filter((item) => item.startsWith(base))
        .map((item) => Number(item.slice(base.length)))
        .filter(Number.isFinite)
        .reduce((max, item) => Math.max(max, item), 0) + 1;
    let next = `${base}${String(index).padStart(4, '0')}`;
    while (existingNos.includes(next)) {
      index += 1;
      next = `${base}${String(index).padStart(4, '0')}`;
    }
    return next;
  }

  private completeInspectionItems(items: InspectionItemResult[]) {
    const byKey = new Map(items.map((item) => [`${item.category}::${item.item}`, item]));
    return categoryLabels.flatMap(([, category]) =>
      inspectionCategories[categoryLabels.find(([_, label]) => label === category)![0]].map((item) => {
        const existing = byKey.get(`${category}::${item}`);
        return existing ? { ...existing } : { category, item, result: '正常' as const, remark: '无' };
      })
    );
  }

  private resolveInspectionVehicle(data: FleetData, draft: InspectionDraft) {
    const byId = draft.vehicleId ? data.vehicles.find((item) => item.id === draft.vehicleId) : undefined;
    if (draft.vehicleId && !byId) throw new Error('检测关联车辆不存在');
    if (byId) {
      this.assertUnique(data.vehicles, 'plateNo', draft.plateNo, byId.id, '车牌号码');
      this.assertUnique(data.vehicles, 'vin', draft.vin, byId.id, 'VIN码');
      return byId;
    }

    const plateMatch = data.vehicles.find((item) => normalizeKey(item.plateNo) === normalizeKey(draft.plateNo));
    const vinMatch = data.vehicles.find((item) => normalizeKey(item.vin) === normalizeKey(draft.vin));
    if (plateMatch && vinMatch && plateMatch.id !== vinMatch.id) throw new Error('车牌和 VIN 分别匹配到不同车辆，请先修正车辆档案');
    return plateMatch || vinMatch || this.createVehicleFromDraft(draft);
  }

  private assertUnique<T extends { id: string }>(items: T[], field: keyof T, value: string, currentId: string | undefined, label: string) {
    if (!value.trim()) throw new Error(`${label}不能为空`);
    const normalized = normalizeKey(value);
    const duplicated = items.some((item) => item.id !== currentId && normalizeKey(String(item[field] ?? '')) === normalized);
    if (duplicated) throw new Error(`${label}已存在，不能重复`);
  }

  private assertParkingAvailable(data: FleetData, warehouse: string, parkingSpace: string, vehicleId: string) {
    if (!warehouse.trim() || !parkingSpace.trim()) return;
    const occupied = data.vehicles.some(
      (item) =>
        item.id !== vehicleId &&
        item.status === '预备库' &&
        normalizeKey(item.warehouse || '') === normalizeKey(warehouse) &&
        normalizeKey(item.parkingSpace || '') === normalizeKey(parkingSpace)
    );
    if (occupied) throw new Error('该仓库车位已被其他预备库车辆占用');
  }

  private assertVehicleCanRent(data: FleetData, vehicleId: string, currentOrderId?: string) {
    const vehicle = data.vehicles.find((item) => item.id === vehicleId);
    if (!vehicle) throw new Error('车辆不存在');
    const occupiedByRental = data.rentalOrders.some((item) => item.id !== currentOrderId && item.vehicleId === vehicleId && activeRentalStatuses.includes(item.status));
    const occupiedByDispatch = data.dispatchTasks.some((item) => item.vehicleId === vehicleId && activeDispatchStatuses.includes(item.status));
    if (occupiedByRental) throw new Error('该车辆已有进行中的租赁订单');
    if (occupiedByDispatch) throw new Error('该车辆已有未完成的调度任务');
    const allowedStatuses: Vehicle['status'][] = currentOrderId ? ['可租赁', '预备库', '已出租'] : ['可租赁', '预备库'];
    if (!allowedStatuses.includes(vehicle.status)) throw new Error('车辆当前状态不可租赁');
  }

  private assertVehicleCanDispatch(data: FleetData, vehicleId: string, currentTaskId?: string) {
    const vehicle = data.vehicles.find((item) => item.id === vehicleId);
    if (!vehicle) throw new Error('车辆不存在');
    const occupiedByDispatch = data.dispatchTasks.some((item) => item.id !== currentTaskId && item.vehicleId === vehicleId && activeDispatchStatuses.includes(item.status));
    const occupiedByRental = data.rentalOrders.some((item) => item.vehicleId === vehicleId && activeRentalStatuses.includes(item.status));
    if (occupiedByDispatch) throw new Error('该车辆已有未完成的调度任务');
    if (occupiedByRental) throw new Error('该车辆已有进行中的租赁订单');
    const allowedStatuses: Vehicle['status'][] = currentTaskId ? ['预备库', '调度中'] : ['预备库'];
    if (!allowedStatuses.includes(vehicle.status)) throw new Error('车辆当前状态不可调度');
  }

  private assertDriverCanDispatch(data: FleetData, driverId: string, currentTaskId?: string) {
    const driver = data.drivers.find((item) => item.id === driverId);
    if (!driver) throw new Error('司机不存在');
    const occupied = data.dispatchTasks.some((item) => item.id !== currentTaskId && item.driverId === driverId && activeDispatchStatuses.includes(item.status));
    if (occupied) throw new Error('该司机已有未完成的调度任务');
    if (!['空闲', '出车中'].includes(driver.status)) throw new Error('司机当前状态不可调度');
  }

  private refreshVehicleLatestReport(data: FleetData, vehicleId: string) {
    const vehicle = data.vehicles.find((item) => item.id === vehicleId);
    if (!vehicle) return;
    const latest = data.reports.find((item) => item.vehicleId === vehicleId);
    vehicle.lastInspectionId = latest?.id;
    vehicle.grade = latest?.grade;
    vehicle.updatedAt = stamp();
  }

  private repairRelations(data: FleetData) {
    let changed = false;
    data.vehicles.forEach((vehicle) => {
      if (!vehicle.images) {
        vehicle.images = [];
        changed = true;
      }
      if (!vehicle.reportFiles) {
        vehicle.reportFiles = [];
        changed = true;
      }
      if (!vehicle.city) {
        vehicle.city = '重庆';
        changed = true;
      }
      if (!vehicle.pickupLocation) {
        vehicle.pickupLocation = vehicle.warehouse || '车主约定取车点';
        changed = true;
      }
      if (!vehicle.minRentalDays) {
        vehicle.minRentalDays = 1;
        changed = true;
      }
      const latestReport = data.reports.find((report) => report.vehicleId === vehicle.id);
      if (latestReport && vehicle.lastInspectionId !== latestReport.id) {
        vehicle.lastInspectionId = latestReport.id;
        vehicle.grade = latestReport.grade;
        vehicle.updatedAt = stamp();
        changed = true;
      }
    });
    data.dispatchTasks.filter((task) => activeDispatchStatuses.includes(task.status)).forEach((task) => {
      const vehicle = data.vehicles.find((item) => item.id === task.vehicleId);
      const driver = data.drivers.find((item) => item.id === task.driverId);
      if (vehicle && (vehicle.status !== '调度中' || vehicle.driverId !== task.driverId)) {
        vehicle.status = '调度中';
        vehicle.driverId = task.driverId;
        vehicle.updatedAt = stamp();
        changed = true;
      }
      if (driver && driver.status !== '出车中') {
        driver.status = '出车中';
        changed = true;
      }
    });
    data.rentalOrders.filter((order) => activeRentalStatuses.includes(order.status)).forEach((order) => {
      const vehicle = data.vehicles.find((item) => item.id === order.vehicleId);
      if (vehicle && vehicle.status !== '已出租' && !data.dispatchTasks.some((task) => task.vehicleId === vehicle.id && activeDispatchStatuses.includes(task.status))) {
        vehicle.status = '已出租';
        vehicle.updatedAt = stamp();
        changed = true;
      }
    });
    return changed;
  }

  private calcFloodVerdict(items: InspectionItemResult[]): InspectionReport['floodVerdict'] {
    const count = items.filter((item) => item.category === '水泡车专项检测' && item.result === '异常').length;
    if (count >= 2) return '确认水泡';
    if (count === 1) return '疑似水泡';
    return '正常';
  }

  private calcFireVerdict(items: InspectionItemResult[]): InspectionReport['fireVerdict'] {
    const count = items.filter((item) => item.category === '火烧车专项检测' && item.result === '异常').length;
    if (count >= 2) return '确认火烧';
    if (count === 1) return '疑似火烧';
    return '正常';
  }

  private syncRentalVehicleStatus(data: FleetData, order: RentalOrder) {
    const vehicle = data.vehicles.find((item) => item.id === order.vehicleId);
    if (!vehicle) return;
    if (order.status === '租赁中' || order.status === '待取车') vehicle.status = '已出租';
    if (order.status === '已完成' || order.status === '已取消') vehicle.status = vehicle.warehouse ? '预备库' : '可租赁';
    vehicle.updatedAt = stamp();
  }

  private syncDispatchStatus(data: FleetData, task: DispatchTask) {
    const vehicle = data.vehicles.find((item) => item.id === task.vehicleId);
    const driver = data.drivers.find((item) => item.id === task.driverId);

    if (vehicle) {
      vehicle.driverId = task.driverId;
      vehicle.status = task.status === '已完成' || task.status === '已取消' ? '预备库' : '调度中';
      vehicle.updatedAt = stamp();
    }
    if (driver) {
      driver.status = task.status === '已完成' || task.status === '已取消' ? '空闲' : '出车中';
    }
  }

  private releaseVehicle(data: FleetData, vehicleId: string) {
    const vehicle = data.vehicles.find((item) => item.id === vehicleId);
    if (!vehicle) return;
    vehicle.driverId = undefined;
    if (vehicle.status === '调度中' || vehicle.status === '运营中') vehicle.status = vehicle.warehouse ? '预备库' : '可租赁';
    vehicle.updatedAt = stamp();
  }

  private releaseDriver(data: FleetData, driverId: string) {
    const driver = data.drivers.find((item) => item.id === driverId);
    if (driver?.status === '出车中') driver.status = '空闲';
  }
}

export const fleetRepository = new FleetRepository();
