/** Japanese and Latin letters/digits are separated by one literal ASCII space. */
const japanese = '[\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}ー]';
const boundaries = new RegExp(`(${japanese})([A-Za-z0-9])|([A-Za-z0-9])(${japanese})`, 'gu');
const protectedValue =
  /https?:\/\/[^\s<>"']+|[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

const adjacentBoundary = new RegExp(`(?:${japanese}[A-Za-z0-9]|[A-Za-z0-9]${japanese})`, 'u');

export function needsJapaneseSpace(left: string, right: string): boolean {
  return adjacentBoundary.test(left + right);
}

function spacePlain(text: string): string {
  const replace = (
    _: string,
    jaBefore: string,
    latinAfter: string,
    latinBefore: string,
    jaAfter: string,
  ) => (jaBefore ? `${jaBefore} ${latinAfter}` : `${latinBefore} ${jaAfter}`);
  // A shared middle character can participate in both boundaries: A日B.
  return text.replace(boundaries, replace).replace(boundaries, replace);
}

export function japaneseSpacing(text: string): string {
  let result = '';
  let offset = 0;
  const append = (part: string) => {
    if (part && needsJapaneseSpace([...result].at(-1) ?? '', [...part][0]!)) result += ' ';
    result += part;
  };
  for (const match of text.matchAll(protectedValue)) {
    append(spacePlain(text.slice(offset, match.index)));
    append(match[0]);
    offset = match.index + match[0].length;
  }
  append(spacePlain(text.slice(offset)));
  return result;
}
