const stripIsbnFormatting = (value: string) =>
  value.trim().replace(/[^0-9Xx]/g, '').toUpperCase();

export function isValidIsbn10(value: string): boolean {
  const isbn = stripIsbnFormatting(value);
  if (!/^\d{9}[\dX]$/.test(isbn)) {
    return false;
  }

  const sum = [...isbn].reduce((total, character, index) => {
    const digit = character === 'X' ? 10 : Number(character);
    return total + digit * (10 - index);
  }, 0);

  return sum % 11 === 0;
}

export function isValidIsbn13(value: string): boolean {
  const isbn = stripIsbnFormatting(value);
  if (!/^97[89]\d{10}$/.test(isbn)) {
    return false;
  }

  const sum = [...isbn.slice(0, 12)].reduce(
    (total, character, index) =>
      total + Number(character) * (index % 2 === 0 ? 1 : 3),
    0,
  );
  const checkDigit = (10 - (sum % 10)) % 10;

  return checkDigit === Number(isbn[12]);
}

export function isbn10To13(value: string): string | null {
  const isbn10 = stripIsbnFormatting(value);
  if (!isValidIsbn10(isbn10)) {
    return null;
  }

  const body = `978${isbn10.slice(0, 9)}`;
  const sum = [...body].reduce(
    (total, character, index) =>
      total + Number(character) * (index % 2 === 0 ? 1 : 3),
    0,
  );
  const checkDigit = (10 - (sum % 10)) % 10;

  return `${body}${checkDigit}`;
}

export function normalizeIsbn(value: string): string | null {
  const isbn = stripIsbnFormatting(value);

  if (isbn.length === 10) {
    return isbn10To13(isbn);
  }

  if (isbn.length === 13 && isValidIsbn13(isbn)) {
    return isbn;
  }

  return null;
}
