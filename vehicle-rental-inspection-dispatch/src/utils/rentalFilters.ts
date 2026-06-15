import type { InspectionGrade, Vehicle } from '@/types/domain';

export type RentalMileageRange = '' | '0-10000' | '10000-30000' | '30000-60000' | '60000-';
export type RentalPriceRange = '' | '0-200' | '200-300' | '300-500' | '500-';

export interface RentalFilters {
  keyword: string;
  energyType: '' | Vehicle['energyType'];
  grade: '' | InspectionGrade;
  mileageRange: RentalMileageRange;
  priceRange: RentalPriceRange;
}

const mileageBounds: Record<Exclude<RentalMileageRange, ''>, [number, number | undefined]> = {
  '0-10000': [0, 10000],
  '10000-30000': [10000, 30000],
  '30000-60000': [30000, 60000],
  '60000-': [60000, undefined]
};

const priceBounds: Record<Exclude<RentalPriceRange, ''>, [number, number | undefined]> = {
  '0-200': [0, 200],
  '200-300': [200, 300],
  '300-500': [300, 500],
  '500-': [500, undefined]
};

function inRange(value: number, range: [number, number | undefined]) {
  const [min, max] = range;
  return value >= min && (max === undefined || value <= max);
}

export function filterRentalVehicles(vehicles: Vehicle[], filters: RentalFilters) {
  const keyword = filters.keyword.trim().toLowerCase();

  return vehicles.filter((vehicle) => {
    const vehicleName = `${vehicle.plateNo} ${vehicle.brandModel}`.toLowerCase();
    const price = vehicle.dailyPrice ?? 268;

    if (keyword && !vehicleName.includes(keyword)) return false;
    if (filters.energyType && vehicle.energyType !== filters.energyType) return false;
    if (filters.grade && vehicle.grade !== filters.grade) return false;
    if (filters.mileageRange && !inRange(vehicle.mileage, mileageBounds[filters.mileageRange])) return false;
    if (filters.priceRange && !inRange(price, priceBounds[filters.priceRange])) return false;

    return true;
  });
}
