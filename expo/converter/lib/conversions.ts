export type CategoryId = 'length' | 'mass' | 'temperature' | 'volume' | 'speed';

export type UnitDefinition = {
  id: string;
  name: string;
  symbol: string;
  toBase: (value: number) => number;
  fromBase: (value: number) => number;
};

export type CategoryDefinition = {
  id: CategoryId;
  name: string;
  units: readonly UnitDefinition[];
};

function linear(id: string, name: string, symbol: string, factor: number): UnitDefinition {
  return {
    id,
    name,
    symbol,
    toBase: (value) => value * factor,
    fromBase: (value) => value / factor,
  };
}

export const categories: readonly CategoryDefinition[] = [
  {
    id: 'length',
    name: 'Length',
    units: [
      linear('millimeter', 'Millimeter', 'mm', 0.001),
      linear('centimeter', 'Centimeter', 'cm', 0.01),
      linear('meter', 'Meter', 'm', 1),
      linear('kilometer', 'Kilometer', 'km', 1000),
      linear('inch', 'Inch', 'in', 0.0254),
      linear('foot', 'Foot', 'ft', 0.3048),
      linear('yard', 'Yard', 'yd', 0.9144),
      linear('mile', 'Mile', 'mi', 1609.344),
    ],
  },
  {
    id: 'mass',
    name: 'Mass',
    units: [
      linear('milligram', 'Milligram', 'mg', 0.000001),
      linear('gram', 'Gram', 'g', 0.001),
      linear('kilogram', 'Kilogram', 'kg', 1),
      linear('ounce', 'Ounce', 'oz', 0.028349523125),
      linear('pound', 'Pound', 'lb', 0.45359237),
      linear('stone', 'Stone', 'st', 6.35029318),
    ],
  },
  {
    id: 'temperature',
    name: 'Temperature',
    units: [
      {
        id: 'celsius',
        name: 'Celsius',
        symbol: '°C',
        toBase: (value) => value,
        fromBase: (value) => value,
      },
      {
        id: 'fahrenheit',
        name: 'Fahrenheit',
        symbol: '°F',
        toBase: (value) => ((value - 32) * 5) / 9,
        fromBase: (value) => (value * 9) / 5 + 32,
      },
      {
        id: 'kelvin',
        name: 'Kelvin',
        symbol: 'K',
        toBase: (value) => value - 273.15,
        fromBase: (value) => value + 273.15,
      },
    ],
  },
  {
    id: 'volume',
    name: 'Volume',
    units: [
      linear('milliliter', 'Milliliter', 'mL', 0.001),
      linear('liter', 'Liter', 'L', 1),
      linear('teaspoon-us', 'Teaspoon (US)', 'tsp', 0.00492892159375),
      linear('tablespoon-us', 'Tablespoon (US)', 'tbsp', 0.01478676478125),
      linear('cup-us', 'Cup (US)', 'cup', 0.2365882365),
      linear('pint-us', 'Pint (US)', 'pt', 0.473176473),
      linear('quart-us', 'Quart (US)', 'qt', 0.946352946),
      linear('gallon-us', 'Gallon (US)', 'gal', 3.785411784),
    ],
  },
  {
    id: 'speed',
    name: 'Speed',
    units: [
      linear('meter-second', 'Meter / second', 'm/s', 1),
      linear('kilometer-hour', 'Kilometer / hour', 'km/h', 1 / 3.6),
      linear('mile-hour', 'Mile / hour', 'mph', 0.44704),
      linear('foot-second', 'Foot / second', 'ft/s', 0.3048),
      linear('knot', 'Knot', 'kn', 0.5144444444444445),
    ],
  },
] as const;

export const defaultSelections: Record<CategoryId, { from: string; to: string }> = {
  length: { from: 'meter', to: 'foot' },
  mass: { from: 'kilogram', to: 'pound' },
  temperature: { from: 'celsius', to: 'fahrenheit' },
  volume: { from: 'liter', to: 'gallon-us' },
  speed: { from: 'kilometer-hour', to: 'mile-hour' },
};

export function getCategory(id: CategoryId) {
  const category = categories.find((candidate) => candidate.id === id);
  if (!category) {
    throw new Error(`Unknown conversion category: ${id}`);
  }
  return category;
}

function getUnit(category: CategoryDefinition, id: string) {
  const unit = category.units.find((candidate) => candidate.id === id);
  if (!unit) {
    throw new Error(`Unknown ${category.id} unit: ${id}`);
  }
  return unit;
}

export function convert(
  value: number,
  categoryId: CategoryId,
  fromUnitId: string,
  toUnitId: string,
) {
  if (!Number.isFinite(value)) {
    throw new Error('Conversion value must be finite.');
  }

  const category = getCategory(categoryId);
  const from = getUnit(category, fromUnitId);
  const to = getUnit(category, toUnitId);
  return to.fromBase(from.toBase(value));
}

export function parseNumericInput(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatNumber(value: number) {
  if (!Number.isFinite(value)) {
    return '—';
  }

  if (value === 0) {
    return '0';
  }

  const absolute = Math.abs(value);
  if (absolute >= 1_000_000_000 || absolute < 0.000001) {
    return value.toExponential(6).replace(/\.0+e/, 'e');
  }

  return String(Number(value.toPrecision(10)));
}
