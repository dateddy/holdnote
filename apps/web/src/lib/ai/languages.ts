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
  /** True when the fields, taken together, are in this language. */
  check: (texts: readonly string[]) => boolean;
};

/** Letters that only Vietnamese uses among the app's languages (đ, ơ, ư, tone marks...). */
const VIETNAMESE = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;

/** Short texts ("none", a range like "QQ+, AK") carry no language signal. */
const LONG = 40;

/**
 * Share of the words with a Vietnamese letter, over all the fields joined (task 5.1g). Judged
 * together because one field may hold only English poker terms ("Preflop raise 3bb. Flop c-bet
 * 4bb…") inside an otherwise Vietnamese review. Null when the text is too short to tell.
 */
function vietnameseShare(texts: readonly string[]): number | null {
  const joined = texts.join(' ').trim();
  if (joined.length < LONG) return null;
  const words = joined.split(/\s+/).filter((w) => /\p{L}/u.test(w));
  if (!words.length) return null;
  return words.filter((w) => VIETNAMESE.test(w)).length / words.length;
}

/** Vietnamese prose has accents on most words; poker terms in English dilute it, never to this. */
const VI_MIN_SHARE = 0.15;
/** An English review may quote a Vietnamese word or two, not more. */
const EN_MAX_SHARE = 0.05;

const vi: LanguagePack = {
  code: 'vi',
  instruction: [
    'NGÔN NGỮ TRẢ LỜI: Viết toàn bộ các ô chữ bằng tiếng Việt có dấu đầy đủ, giọng của một người chơi giỏi nói với bạn bè: ngắn, cụ thể, có số.',
    'Cách gọi: người chơi là "mình" (không viết "Hero"), người đối đầu là "đối thủ" (không viết "Villain"), nói với người học là "bạn".',
    'Giữ nguyên tiếng Anh các thuật ngữ poker: pair, two pair, set, straight, flush, full house, top pair, overpair, overcard, kicker, draw, gutshot, outs, combo, broadway, suited connector, check, check back, bet, call, raise, fold, c-bet, 3-bet, squeeze, iso, limp, shove, stab, donk, semi-bluff, bluff, value, fold equity, equity, range, pot odds, SPR, EV, preflop, flop, turn, river, board.',
    'Cụm tiếng Việt nên dùng: bắt bluff, bỏ cuộc, cướp blind, board ướt, board khô, giữ pot nhỏ, đọc range, đối thủ chặt, đối thủ loose.',
    'Không viết câu đệm kiểu "bao gồm các bài", "là chính xác", "là hợp lý để", "là tiêu chuẩn". Đi thẳng vào kết luận và lý do.',
    'Ô "lesson": 2 đến 4 ý đánh số, mỗi ý là một quy tắc dùng lại được, có số cụ thể. Ví dụ:',
    '"1. Iso người limp: 3bb + 1bb mỗi limper; min-raise không iso được ai. 2. Pot 3 người, trúng pair thứ ba chưa đủ để call. 3. Dưới 15bb chỉ shove hoặc fold."',
  ].join('\n'),
  reminder:
    'Nhắc lại: mọi ô chữ viết bằng tiếng Việt có dấu; gọi "mình" và "đối thủ", không viết Hero/Villain; lesson là 2-4 ý đánh số.',
  fixRequest:
    'Some text fields were not in Vietnamese with full diacritics. Rewrite every text field in Vietnamese with diacritics (tiếng Việt có dấu). Keep the same judgement.',
  missingLabel: 'Thiếu',
  check: (texts) => (vietnameseShare(texts) ?? 1) >= VI_MIN_SHARE,
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
  check: (texts) => (vietnameseShare(texts) ?? 0) <= EN_MAX_SHARE,
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
