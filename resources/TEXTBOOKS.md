# NCERT maths textbooks, Classes 1–3

Where each concept in our chain is taught in the NCERT books, and the Hindi words those books use. Stage 19 uses this for `Concept.pages`, key words and question wording; Stage 21 uses it to match a voice note's page number to a concept. Read from the 2026–27 reprints on 31 October 2026.

## The books

| Class | Book | Chapters |
| --- | --- | --- |
| 1 | *Joyful Mathematics* (Hindi: *आनंदमय गणित*) | 13 |
| 2 | *Joyful Mathematics* (Hindi: *आनंदमय गणित*) | 11 |
| 3 | *Maths Mela* (Hindi: *गणित मेला*) | 14 |

NCERT publishes each one in about 23 languages. The ones that matter for Bhili-speaking children are Hindi, Gujarati and Marathi, since those are the school languages they meet. **Every language edition has the same page numbers**, which we checked for English, Hindi, Gujarati and Marathi. So the page map below holds for any of them.

Each book is a zip of chapter PDFs at `https://ncert.nic.in/textbook/pdf/<code>dd.zip`. Codes for other languages are on `https://ncert.nic.in/textbook.php`.

| Class | English | Hindi | Gujarati | Marathi |
| --- | --- | --- | --- | --- |
| 1 | `aejm1` | `ahjm1` | `agjm1` | `amrjm1` |
| 2 | `bejm1` | `bhjm1` | `bgjjm1` | `bmrjm1` |
| 3 | `cemm1` | `chmm1` | `cgjmm1` | `cmrmm1` |

ncert.nic.in doesn't send its intermediate certificate (Let's Encrypt `YE1`), so `curl` fails with "unable to get local issuer certificate". Fetch `http://ye1.i.lencr.org/`, convert it to PEM, append it to the system CA bundle, and pass that bundle with `--cacert`. Don't turn off verification.

## Where our concepts are taught

| Concept | Class 1 | Class 2 (`pages` in `concepts.json`) | Class 3 |
| --- | --- | --- | --- |
| Numbers to 20 | Ch 4 *Making 10*, pp. 42–47 ("10 and 3 is 13", "write the numbers 11–20") | Ch 3 *Fun with Numbers*, pp. 22–31 (number chart, before and after, number line) | — |
| Subtraction within 20 | Ch 5 *How Many?*, pp. 60–63 (within 9); Ch 6 *Vegetable Farm*, pp. 69–71 (15 − 9, story problems) | Ch 6, p. 59 (taking away by counting back on the ginladi) | — |
| Borrowing (subtraction crossing a ten) | — | Ch 6, p. 60 (18 − 9, 12 − 8 on the ginladi); pp. 64–66 ("open a garland of ten": 46 − 18 becomes 16 − 8) | — |
| Two-digit subtraction | — | Ch 6, pp. 61–63 (no regrouping: 39 − 28, 45 − 12, 37 − 24); pp. 67–68 (practice with regrouping, story problems) | Ch 12 *Give and Take* (three-digit, with regrouping) |

Class 2's Chapter 6, *Decoration for Festival* (pp. 50–70), holds almost the whole subtraction chain. Pages 50–58 are addition.

**Why the demo uses Class 2 pages:** the demo class is Grade 2, so `concepts.json` holds the Class 2 book's pages. A teacher's voice note names a page in her own class's book, so one book's pages are enough. Numbers to 20 and plain subtraction within 20 are mostly Class 1 topics, revised in Class 2; their Class 1 pages are in the table for a Grade 1 class later.

**For the demo voice note:** "borrowing, page 65" is Jyoti's garland story (46 − 18, "open one garland"), the clearest borrowing page in the book.

## The Hindi the books use for subtraction

From Class 1 Chapter 6 (pp. 69–71) and Class 2 Chapter 6 (pp. 59–68), with how often each appears:

| Hindi | Roman | Meaning | Count |
| --- | --- | --- | --- |
| बचे / बची / बचते | bache / bachi / bachte | left over | 28 |
| कितने / कितनी | kitne / kitni | how many | 19 |
| में से | mein se | out of, from | 12 |
| कुल | kul | in all, total | 9 |
| घटाइए / घटाव / घटाना | ghataiye / ghatav / ghatana | subtract / subtraction / to subtract | 7 |
| दे दिए / बेच दिए / बेच दीं | de diye / bech diye / bech deen | gave away / sold | 6 |
| शेष | shesh | remaining | 2 |
| दहाई / इकाई | dahai / ikai | ten / one (place value) | 2 each |
| माला खोलनी | mala kholni | open a garland (break a ten) | 2 |
| कम करने पर / हटाने पर / लेने पर | kam karne par / hatane par / lene par | on reducing / removing / taking | 1–3 |

Our existing key words already match the most common ones: `bache` and `de diye`. For the borrowing kit's 8–10 words (Stage 19), take them from this list: बचे, कितने, में से, घटाना, दे दिए, शेष, दहाई, इकाई and माला खोलना. Then the children hear the textbook's own words.

Typical question forms from the books, to model B and C questions on:
- "32 दीये थे और शाम तक 12 बेच दिए तो कितने दीये बचे?" (There were 32 lamps and 12 were sold by evening. How many lamps are left?)
- "कुल 40 गुब्बारे हैं। 13 गुब्बारे फूट गए। अब कितने गुब्बारे बचे हैं?" (There are 40 balloons. 13 burst. How many balloons are left now?)
- "18 में से 9 लेने पर" (taking 9 out of 18)
