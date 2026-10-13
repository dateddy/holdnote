/**
 * Language packs for AI output. The system prompt stays one fixed English text (cacheable);
 * each pack adds an instruction written in the target language, a short example, and a check
 * the code runs on the reply. Adding a language = adding a pack here.
 */

export type LanguagePack = {
  code: string;
  /** Opens the user message, written in the target language itself. */
  instruction: string;
  /** Closes the user message: a one-line reminder. */
  reminder: string;
  /** Sent with the retry when the reply is in the wrong language. */
  fixRequest: string;
  /** Prefix for the missing-info line appended to the math field. */
  missingLabel: string;
  /** True when every long text is in this language. */
  check: (texts: readonly string[]) => boolean;
};

/** Letters that only Vietnamese uses among the app's languages (đ, ơ, ư, tone marks...). */
const VIETNAMESE = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;

/** Short texts ("none", a range like "QQ+, AK") carry no language signal. */
const LONG = 40;
const long = (texts: readonly string[]) => texts.filter((t) => t.trim().length >= LONG);

const vi: LanguagePack = {
  code: 'vi',
  instruction: [
    'NGÔN NGỮ TRẢ LỜI: Viết toàn bộ các ô chữ bằng tiếng Việt có dấu đầy đủ.',
    'Không viết tiếng Anh, không viết tiếng Việt không dấu. Giữ thuật ngữ poker tiếng Anh như c-bet, 3-bet, SPR, range.',
    'Ví dụ một ô "lesson": "Gặp nit 3-bet ở stack 25bb, fold AJo là đúng; range của họ đè bài mình."',
  ].join('\n'),
  reminder: 'Nhắc lại: mọi ô chữ viết bằng tiếng Việt có dấu.',
  fixRequest:
    'Some text fields were not in Vietnamese with full diacritics. Rewrite every text field in Vietnamese with diacritics (tiếng Việt có dấu). Keep the same judgement.',
  missingLabel: 'Thiếu',
  check: (texts) => long(texts).every((t) => VIETNAMESE.test(t)),
};

const en: LanguagePack = {
  code: 'en',
  instruction: [
    'OUTPUT LANGUAGE: Write every text field in English.',
    "The student's notes may be in another language; still answer in English.",
    'Example "lesson": "Facing a nit 3-bet at 25bb, folding AJo is right; their range crushes yours."',
  ].join('\n'),
  reminder: 'Reminder: every text field in English.',
  fixRequest:
    'Some text fields were not in English. Rewrite every text field in English. Keep the same judgement.',
  missingLabel: 'Missing',
  check: (texts) => long(texts).every((t) => !VIETNAMESE.test(t)),
};

const PACKS: Record<string, LanguagePack> = { vi, en };

/** Pack for a profile locale. Languages without a pack yet get English. */
export function languagePack(locale: string | null | undefined): LanguagePack {
  return (locale && PACKS[locale]) || en;
}

/** Is a saved review written in `locale`? Used to decide whether an old AI review can be reused. */
export function reviewInLanguage(
  r: {
    range_text: string | null;
    math_text: string | null;
    line_text: string | null;
    lesson: string | null;
  },
  locale: string | null | undefined,
): boolean {
  return languagePack(locale).check([
    r.range_text ?? '',
    r.math_text ?? '',
    r.line_text ?? '',
    r.lesson ?? '',
  ]);
}
