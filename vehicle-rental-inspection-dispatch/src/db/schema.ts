export const schemaSql = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    phone TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS vehicles (
    id TEXT PRIMARY KEY,
    plate_no TEXT NOT NULL UNIQUE,
    vin TEXT NOT NULL UNIQUE,
    brand_model TEXT NOT NULL,
    energy_type TEXT NOT NULL,
    color TEXT,
    produce_date TEXT,
    register_date TEXT,
    mileage INTEGER DEFAULT 0,
    status TEXT NOT NULL,
    grade TEXT,
    warehouse TEXT,
    parking_space TEXT,
    daily_price REAL,
    deposit REAL,
    driver_id TEXT,
    last_inspection_id TEXT,
    updated_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS inspection_reports (
    id TEXT PRIMARY KEY,
    report_no TEXT NOT NULL UNIQUE,
    vehicle_id TEXT NOT NULL,
    client_name TEXT NOT NULL,
    client_phone TEXT NOT NULL,
    purpose TEXT NOT NULL,
    inspector_name TEXT NOT NULL,
    inspector_no TEXT NOT NULL,
    location TEXT NOT NULL,
    checked_at TEXT NOT NULL,
    grade TEXT NOT NULL,
    abnormal_summary TEXT,
    suggestion TEXT,
    flood_verdict TEXT NOT NULL,
    fire_verdict TEXT NOT NULL,
    crash_verdict TEXT NOT NULL,
    items_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS inventory_records (
    id TEXT PRIMARY KEY,
    record_no TEXT NOT NULL UNIQUE,
    vehicle_id TEXT NOT NULL,
    type TEXT NOT NULL,
    source TEXT NOT NULL,
    warehouse TEXT NOT NULL,
    parking_space TEXT NOT NULL,
    operator TEXT NOT NULL,
    mileage INTEGER NOT NULL,
    energy_level INTEGER NOT NULL,
    remark TEXT,
    created_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS rental_orders (
    id TEXT PRIMARY KEY,
    order_no TEXT NOT NULL UNIQUE,
    vehicle_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    start_at TEXT NOT NULL,
    end_at TEXT NOT NULL,
    amount REAL NOT NULL,
    deposit REAL NOT NULL,
    status TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS drivers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    license_no TEXT NOT NULL,
    status TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS dispatch_tasks (
    id TEXT PRIMARY KEY,
    task_no TEXT NOT NULL UNIQUE,
    vehicle_id TEXT NOT NULL,
    driver_id TEXT NOT NULL,
    route_name TEXT NOT NULL,
    start_point TEXT NOT NULL,
    end_point TEXT NOT NULL,
    scheduled_at TEXT NOT NULL,
    status TEXT NOT NULL,
    remark TEXT
  );`
];

export const inspectionCategories = {
  exterior: [
    '左前翼子板',
    '左前车门面',
    '左A柱',
    '左B柱',
    '左C柱',
    '右前车门面',
    '右A柱',
    '右B柱',
    '前保险杠',
    '后保险杠',
    '发动机盖漆面',
    '全车玻璃'
  ],
  cabin: ['保险丝盒', '管路', '线路插头', '高压线束', '制动液液位', '冷却液液位', '驱动电机外观'],
  interior: ['主驾驶座椅磨损', '方向盘磨损', '仪表台外观', '天窗/遮阳帘', '车内地毯', '后备箱照明'],
  flood: ['座椅滑轨锈蚀', '地毯水渍霉味', '安全带水渍', '线束泥沙', '后备箱积水痕迹'],
  fire: ['发动机舱线束', '发动机舱塑料件', '防火墙隔热层', '驾驶舱烟熏痕迹', '车顶棚烟熏痕迹'],
  crash: ['左右前纵梁', '左右后纵梁', '防火墙结构', '左右A柱', '左右B柱', '水箱框架', '行李箱底板'],
  electric: ['中控屏', '空调系统', '车窗升降', '灯光系统', '雷达影像', '安全气囊故障灯'],
  chassis: ['底盘护板', '前副车架及悬架摆臂', '后副车架及多连杆', '驱动半轴防尘套', '制动油管', '四轮轮胎']
};
