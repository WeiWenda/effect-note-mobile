import { NumberFormat, CurrencyType } from '../loom-state';

export const addThousandsSeparator = (num: string, separator: string) => {
  const regex = /\B(?=(\d{3})+(?!\d))/g;
  return num.replace(regex, separator);
};

export const getNumberCellContent = (
  format: NumberFormat,
  value: number | null,
  options?: {
    currency?: CurrencyType;
    prefix?: string;
    suffix?: string;
    separator?: string;
  }
): string => {
  const { currency, separator, suffix, prefix } = options ?? {};

  if (value === null) {
    return "";
  }

  let formattedValue = value.toString();

  if (format === NumberFormat.CURRENCY) {
    if (!currency) {
      throw new Error(
        'a currency is required when number format is set to currency'
      );
    }
    return toCurrencyString(value, currency);
  }
  if (separator && formattedValue.length > 0)
    formattedValue = addThousandsSeparator(formattedValue, separator);
  if (prefix && formattedValue.length > 0)
    formattedValue = `${prefix} ${value}`;
  if (suffix && formattedValue.length > 0)
    formattedValue = `${value} ${suffix}`;
  return formattedValue;
};

const toCurrencyString = (value: number, type: CurrencyType) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: type,
  }).format(value);
};
