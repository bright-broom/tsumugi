import { spaceCopy } from '@/i18n/html-typography';
/** Named placeholders preserve sentence order in every translation. No evaluation or recursive substitution. */
type ParametersIn<S extends string> = S extends `${string}{${infer Key}}${infer Rest}`
  ? Key | ParametersIn<Rest>
  : never;

export function format<const S extends string>(
  message: S,
  values: Record<ParametersIn<S>, string | number>,
): string {
  return spaceCopy(
    message.replace(/\{([A-Za-z][A-Za-z0-9]*)\}/g, (_, key: string) => {
      if (!Object.hasOwn(values, key)) throw new Error(`Missing message parameter: ${key}`);
      return String(values[key as ParametersIn<S>]);
    }),
  );
}
