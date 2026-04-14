const CAR_MANUFACTURERS = [
  "HYUNDAI",
  "TOYOTA",
  "KIA",
  "MAZDA",
  "SKODA",
  "MITSUBISHI",
  "SUZUKI",
  "NISSAN",
  "VOLKSWAGEN",
  "SEAT",
  "HONDA",
  "RENAULT",
  "PEUGEOT",
  "CITROEN",
  "FORD",
  "CHEVROLET",
  "MERCEDES-BENZ",
  "ISUZU",
  "BMW",
  "AUDI",
  "TESLA",
  "FIAT",
  "SUBARU",
  "DAIHATSU",
  "OPEL",
  "VOLVO",
  "LEXUS",
  "JEEP",
  "PORSCHE",
  "MINI",
  "MG",
  "DACIA",
  "CUPRA",
  "LAND ROVER",
  "ALFA ROMEO",
  "JAGUAR",
  "INFINITI",
  "GENESIS",
  "BYD",
  "CHERY",
  "GREAT WALL",
  "HAVAL",
  "CHANGAN",
  "BAIC",
  "RAM",
  "DODGE",
  "CHRYSLER",
  "SMART",
  "POLESTAR",
  "LOTUS",
  "ROLLS-ROYCE",
  "BUICK",
  "CADILLAC",
  "LINCOLN",
  "GMC",
  "DS",
  "DAEWOO",
  "ABARTH",
  "FOTON",
  "JAC",
] as const;

const TRUCK_MANUFACTURERS = [
  "MERCEDES-BENZ",
  "VOLVO",
  "MAN",
  "SCANIA",
  "IVECO",
  "ISUZU",
  "DAF",
  "HINO",
  "MITSUBISHI FUSO",
  "RENAULT TRUCKS",
  "FREIGHTLINER",
  "KENWORTH",
  "MACK",
  "PETERBILT",
  "INTERNATIONAL",
] as const;

const BUS_MANUFACTURERS = [
  "MERCEDES-BENZ",
  "MAN",
  "VOLVO",
  "SCANIA",
  "IVECO",
] as const;

const MOTORCYCLE_MANUFACTURERS = [
  "HONDA",
  "YAMAHA",
  "SUZUKI",
  "KAWASAKI",
  "KTM",
  "SYM",
  "KYMCO",
  "PIAGGIO",
  "VESPA",
  "BMW",
  "DUCATI",
  "TRIUMPH",
  "APRILIA",
  "CFMOTO",
  "BENELLI",
  "HARLEY-DAVIDSON",
  "HUSQVARNA",
  "ROYAL ENFIELD",
] as const;

const VEHICLE_TYPE_CATALOG: Record<string, readonly string[]> = {
  car: CAR_MANUFACTURERS,
  truck: TRUCK_MANUFACTURERS,
  bus: BUS_MANUFACTURERS,
  motorcycle: MOTORCYCLE_MANUFACTURERS,
};

const KNOWN_ALIASES: Record<string, string> = {
  BENZ: "MERCEDES-BENZ",
  MERCEDES: "MERCEDES-BENZ",
  MERCEDESBENZ: "MERCEDES-BENZ",
  MBBUS: "MERCEDES-BENZ",
  LANDROVER: "LAND ROVER",
  RANGROVER: "LAND ROVER",
  ROLLSROYCE: "ROLLS-ROYCE",
  VOLKSWAGON: "VOLKSWAGEN",
  VW: "VOLKSWAGEN",
  GREATWALLMOTOR: "GREAT WALL",
  MITSUBISHIFUSOTRUCKANDBUSCORPORATION: "MITSUBISHI FUSO",
};

function normalizeKey(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function toUniqueInOrder(values: Iterable<string>): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    output.push(value);
  }
  return output;
}

function buildKnownCatalog(): Map<string, string> {
  const all = [
    ...CAR_MANUFACTURERS,
    ...TRUCK_MANUFACTURERS,
    ...BUS_MANUFACTURERS,
    ...MOTORCYCLE_MANUFACTURERS,
  ];
  const catalog = new Map<string, string>();
  all.forEach((value) => {
    catalog.set(normalizeKey(value), value);
  });
  Object.entries(KNOWN_ALIASES).forEach(([alias, canonical]) => {
    catalog.set(normalizeKey(alias), canonical);
  });
  return catalog;
}

const KNOWN_MANUFACTURERS = buildKnownCatalog();

export function listPreferredManufacturersByVehicleTypes(
  vehicleTypes: string[],
): string[] {
  const ordered = vehicleTypes.flatMap(
    (vehicleType) => VEHICLE_TYPE_CATALOG[vehicleType] ?? [],
  );
  if (ordered.length === 0) return [...CAR_MANUFACTURERS];
  return toUniqueInOrder(ordered);
}

export function toPreferredManufacturerName(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length < 2) return null;
  const normalized = normalizeKey(trimmed);
  if (!normalized) return null;
  return KNOWN_MANUFACTURERS.get(normalized) ?? null;
}
