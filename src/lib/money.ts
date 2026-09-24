export function money(value: number) {
  return `GH₵ ${value.toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function longDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function amountInWords(value: number) {
  const small = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];

  function wordsUnderThousand(number: number): string {
    const parts: string[] = [];

    if (number >= 100) {
      parts.push(`${small[Math.floor(number / 100)]} Hundred`);
      number %= 100;
    }

    if (number >= 20) {
      parts.push(`${tens[Math.floor(number / 10)]}${number % 10 ? `-${small[number % 10]}` : ""}`);
    } else if (number > 0) {
      parts.push(small[number]);
    }

    return parts.join(" ");
  }

  const whole = Math.floor(Math.max(value, 0));
  const pesewas = Math.round((value - whole) * 100);
  const scales = ["", "Thousand", "Million", "Billion"];
  const parts: string[] = [];
  let remainder = whole;
  let scaleIndex = 0;

  do {
    const group = remainder % 1000;

    if (group > 0) {
      parts.unshift(`${wordsUnderThousand(group)}${scales[scaleIndex] ? ` ${scales[scaleIndex]}` : ""}`);
    }

    remainder = Math.floor(remainder / 1000);
    scaleIndex += 1;
  } while (remainder > 0);

  const cedis = parts.length > 0 ? parts.join(" ") : "Zero";
  const pesewaText = pesewas > 0 ? ` and ${wordsUnderThousand(pesewas)} Pesewas` : "";

  return `${cedis} Ghana Cedis${pesewaText} Only`;
}
