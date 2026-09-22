// Turns numbers into the words a clinician would actually say, so the voice
// never reads "88/56" as "eighty-eight slash fifty-six" or a lab as a decimal.
const ones = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
];
const tens = [
  "",
  "",
  "twenty",
  "thirty",
  "forty",
  "fifty",
  "sixty",
  "seventy",
  "eighty",
  "ninety",
];

function words(value: number): string {
  if (value < 20) return ones[value];
  if (value < 100) {
    const rest = value % 10;
    return rest
      ? `${tens[Math.floor(value / 10)]}-${ones[rest]}`
      : tens[Math.floor(value / 10)];
  }
  const hundreds = Math.floor(value / 100),
    rest = value % 100;
  return rest
    ? `${ones[hundreds]} hundred ${words(rest)}`
    : `${ones[hundreds]} hundred`;
}

/** 118 becomes "one eighteen", the way it is said at a bedside. */
function reading(value: number) {
  if (value < 100) return words(value);
  const rest = value % 100;
  return rest
    ? `${ones[Math.floor(value / 100)]} ${words(rest)}`
    : words(value);
}

export const sayPressure = (systolic: number, diastolic: number) =>
  `${reading(systolic)} over ${reading(diastolic)}`;

export const sayDecimal = (value: number) => {
  const [whole, fraction] = value.toString().split(".");
  const start = words(Number(whole));
  return fraction
    ? `${start} point ${fraction
        .split("")
        .map((d) => ones[Number(d)])
        .join(" ")}`
    : start;
};

export const sayPercent = (value: number) => `${words(value)} percent`;
export const sayRate = (value: number) => `${words(value)} beats per minute`;
