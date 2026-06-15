import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { fleetRepository, type InspectionDraft } from '@/db/fleetRepository';
import type { DispatchTask, Driver, FleetData, InspectionReport, InventoryRecord, RentalOrder, Vehicle } from '@/types/domain';

export const useFleetStore = defineStore('fleet', () => {
  const data = ref<FleetData>(fleetRepository.load());

  const refresh = () => {
    data.value = fleetRepository.load();
  };

  const reset = () => {
    fleetRepository.reset();
    refresh();
  };

  const createInspection = (draft: InspectionDraft) => {
    const report = fleetRepository.createInspection(draft);
    refresh();
    return report;
  };

  const upsertVehicle = (vehicle: Omit<Vehicle, 'id' | 'updatedAt'> & { id?: string; updatedAt?: string }) => {
    const result = fleetRepository.upsertVehicle(vehicle);
    refresh();
    return result;
  };

  const deleteVehicle = (vehicleId: string) => {
    fleetRepository.deleteVehicle(vehicleId);
    refresh();
  };

  const updateReport = (report: InspectionReport) => {
    const result = fleetRepository.updateReport(report);
    refresh();
    return result;
  };

  const deleteReport = (reportId: string) => {
    fleetRepository.deleteReport(reportId);
    refresh();
  };

  const stockIn = (vehicleId: string, operator: string, warehouse: string, parkingSpace: string) => {
    const record = fleetRepository.stockIn(vehicleId, operator, warehouse, parkingSpace);
    refresh();
    return record;
  };

  const upsertInventoryRecord = (record: Omit<InventoryRecord, 'id' | 'createdAt' | 'recordNo'> & { id?: string; createdAt?: string; recordNo?: string }) => {
    const result = fleetRepository.upsertInventoryRecord(record);
    refresh();
    return result;
  };

  const deleteInventoryRecord = (recordId: string) => {
    fleetRepository.deleteInventoryRecord(recordId);
    refresh();
  };

  const createRentalOrder = (vehicleId: string, userId: string, customerName: string) => {
    const order = fleetRepository.createRentalOrder(vehicleId, userId, customerName);
    refresh();
    return order;
  };

  const upsertRentalOrder = (order: Omit<RentalOrder, 'id' | 'orderNo'> & { id?: string; orderNo?: string }) => {
    const result = fleetRepository.upsertRentalOrder(order);
    refresh();
    return result;
  };

  const deleteRentalOrder = (orderId: string) => {
    fleetRepository.deleteRentalOrder(orderId);
    refresh();
  };

  const createDispatchTask = (vehicleId: string, driverId: string, routeName: string) => {
    const task = fleetRepository.createDispatchTask(vehicleId, driverId, routeName);
    refresh();
    return task;
  };

  const upsertDispatchTask = (task: Omit<DispatchTask, 'id' | 'taskNo'> & { id?: string; taskNo?: string }) => {
    const result = fleetRepository.upsertDispatchTask(task);
    refresh();
    return result;
  };

  const deleteDispatchTask = (taskId: string) => {
    fleetRepository.deleteDispatchTask(taskId);
    refresh();
  };

  const upsertDriver = (driver: Omit<Driver, 'id'> & { id?: string }) => {
    const result = fleetRepository.upsertDriver(driver);
    refresh();
    return result;
  };

  const deleteDriver = (driverId: string) => {
    fleetRepository.deleteDriver(driverId);
    refresh();
  };

  const vehicleName = (vehicleId: string) => {
    const vehicle = data.value.vehicles.find((item) => item.id === vehicleId);
    return vehicle ? `${vehicle.plateNo} ${vehicle.brandModel}` : '未知车辆';
  };

  const driverName = (driverId: string) => data.value.drivers.find((item) => item.id === driverId)?.name ?? '未分配';

  const metrics = computed(() => ({
    totalVehicles: data.value.vehicles.length,
    reports: data.value.reports.length,
    readyVehicles: data.value.vehicles.filter((item) => item.status === '预备库').length,
    rentableVehicles: data.value.vehicles.filter((item) => item.status === '可租赁').length,
    dispatching: data.value.dispatchTasks.filter((item) => item.status !== '已完成' && item.status !== '已取消').length,
    abnormal: data.value.reports.filter((item) => item.grade === 'C' || item.grade === 'D' || item.crashVerdict !== '正常').length
  }));

  return {
    data,
    metrics,
    refresh,
    reset,
    upsertVehicle,
    deleteVehicle,
    createInspection,
    updateReport,
    deleteReport,
    stockIn,
    upsertInventoryRecord,
    deleteInventoryRecord,
    createRentalOrder,
    upsertRentalOrder,
    deleteRentalOrder,
    createDispatchTask,
    upsertDispatchTask,
    deleteDispatchTask,
    upsertDriver,
    deleteDriver,
    vehicleName,
    driverName
  };
});
