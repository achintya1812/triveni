# End-to-end testing: the full build

This guide tests every feature of the deployed full build, on real phones, in the order the demo uses them. Each test says what to do and what you should see. Write the result in the table at the end.

- **Web app:** https://triveni-251j.vercel.app
- **API:** https://triveni-full-api.onrender.com (open `/health` first: it should say `{"ok":true}`)
- **Bot:** `@triveni_school_bot` on Telegram

The expected results for the check, the results screen and the brief come from running the app's own rules on the demo class with the slates in Part 3. If what you see differs, that's a finding: note it, and keep going.

---

## Part 0: Before you start

### What you need

| | |
|---|---|
| **Teacher's phone** | Android with Chrome. The app is installed from it (test 1.3). Microphone and camera allowed. |
| **Parent's phone** | Telegram installed and signed in. |
| **Laptop** (optional) | Chrome, for the English pass and for watching requests in DevTools. |
| **20 slates** | Notebook pages, made as in Part 3, photographed 5 at a time. |
| **Something to play audio through** | The phone speaker is fine. |

### Resetting the demo class

The setup screen (with **डेमो कक्षा लोड करें**) shows only when the phone holds no class. To start again from a clean demo class:

1. Chrome → **⋮ → Settings → Site settings → All sites → triveni-251j.vercel.app → Clear & reset**.
2. Open the app again and tap **डेमो कक्षा लोड करें**.

> **Loading the demo class wipes every parent's Telegram opt-in.** It sends all 20 children with no parent attached, and the server overwrites what's stored. Always do the Telegram opt-in (Part 6) **after** the last reset.

### Two things to know first

- **Today's lesson must be two-digit subtraction, not borrowing.** If the day's lesson is logged as borrowing (as the README's demo step 1 says, "आज borrowing पढ़ाया, page 65"), Meena counts as taught borrowing today. She then moves from **Never taught** to **Taught but not learned**, and her catch-up for parents disappears from the brief. Use the voice note in test 3.4 instead.
- **The order of A, B and C changes every Monday.** This week (until Sunday 1 November) it's **C, A, B**. From Monday 2 November it's **A, B, C**, and from 9 November **B, C, A**. The check screen shows the right order; just follow it.

---

## Part 1: App shell, language and install

| ID | Do | Expect |
|---|---|---|
| 1.1 | Open the web app in Chrome on the teacher's phone. | Title **त्रिवेणी**, the setup screen in Hindi, and a **English** button at the top right. |
| 1.2 | Tap **English**, then reload the page. | The screen is in English and stays English after the reload. Tap **हिंदी** to switch back. |
| 1.3 | Chrome **⋮ → Add to Home screen**, then open the app from the new icon. | It opens full screen, without Chrome's address bar. Use this icon for every test from here on. |
| 1.4 | Tap **डेमो कक्षा लोड करें** (Load demo class). | Within a few seconds: five tabs (**आज**, **रजिस्टर**, **जाँच**, **नतीजे**, **कक्षा**), the **आज** tab open, **no red banner**, and no "⏳ … भेजना बाकी" badge left in the header. |

---

## Part 2: The morning brief before the check (आज)

| ID | Do | Expect |
|---|---|---|
| 2.1 | Read the brief at the top of **आज**. | A Hindi brief that starts "सुप्रभात!". Under it, "Claude ने भाषा सुधारी है।" (reworded by Claude). It mentions:<br>• **Meena** missed borrowing (उधार लेकर घटाना), with a catch-up for her parents<br>• **Arjun** in the probe group, starting at borrowing<br>• a quick re-check for **Ravi, Sunil, Rekha, Dinesh, Sita and Anita** |
| 2.2 | Tap **पढ़कर सुनाएँ** (Read aloud). | "आवाज़ तैयार हो रही है…", then the brief is read aloud in Hindi within a few seconds. |
| 2.3 | Scroll down. | **अभिभावकों के लिए छूटा पाठ** (Catch-up for parents): borrowing, Meena, and a button **1 अभिभावक को छूटा पाठ भेजें**. Don't tap it yet: Part 6 does. |
| 2.4 | Check the lists under the brief. | **छोटी दोबारा जाँच** (Quick re-checks) and **प्रोब समूह** (Probe group, with Arjun). The brief's own text names these differently ("त्वरित दोबारा जाँच", "जाँच समूह"), and Claude may reword them again. |
| 2.5 | Check the Hindi itself. | Natural classroom Hindi, with no English left in it. Each child gets the verb for their presumed gender: "Meena वापस **आई** है" (feminine), "Ravi … **आया** है". Note any child given the wrong gender, or the plural "आए हैं" for one child. |
| 2.6 | Turn on airplane mode and reopen **आज**. | The brief without Claude's rewording uses neutral wording: "फिर से कक्षा में: Meena।" and "Meena की अनुपस्थिति में पढ़ाया गया: …". Turn airplane mode off again. |

---

## Part 3: Daily log (रजिस्टर)

| ID | Do | Expect |
|---|---|---|
| 3.1 | Open **रजिस्टर**. | Today's date, the 20 children, **जो बच्चे अनुपस्थित हैं, उन्हें छुएँ** (tap the absent children), a concept dropdown, the mic button **दबाकर रखें और बताएँ आज क्या पढ़ाया**, and **पिछले दिन** (history) with the last three weeks. |
| 3.2 | In history, find 21 and 22 October. | Both say borrowing, with Meena absent. 21 October was logged by voice note. |
| 3.3 | Tap the mic button briefly (under a second). | A hint: **बोलते समय बटन दबाए रखें।** (hold the button while you speak). Nothing is sent. |
| 3.4 | **Hold** the mic and say: **"आज two-digit subtraction पढ़ाया, page 62."** Let go. | "संदेश समझा जा रहा है…", then within about 2 seconds:<br>• **सुना: "…page 62…"**<br>• **पेज 62 में दो अंकों का घटाव है।**<br>• the dropdown set to **दो अंकों का घटाव** (two-digit subtraction) |
| 3.5 | Leave everyone present and tap **सहेजें (0 अनुपस्थित)**. | **सहेज लिया**, and today appears in history. |
| 3.6 | Try a note with no page. Hold and say: **"आज बच्चों ने एक से बीस तक गिनना और लिखना सीखा।"** | Matched through Claude: **विषय: 20 तक की संख्याएँ**, in about 3 seconds. **Then set the dropdown back to two-digit subtraction and save**, so today's lesson stays right for the check. |
| 3.7 | (Optional) Say a non-maths note: **"आज maths नहीं हुआ, हिंदी की कविता पढ़ाई।"** | **विषय समझ नहीं आया।** (couldn't tell which concept). Set it back to two-digit subtraction and save. |

---

## Part 4: The live check (जाँच)

### Make the slates first

20 slates, one per child, in **Latin digits (0–9)**. Each slate has the child's roll or name at the top, then **two rows** of three shapes. Children whose home language is Hindi (Pooja, Anita and Naresh) draw **no square**.

- **Row 1, two-digit subtraction (52 − 27):** right answers are ◯ A **25**, △ B **28**, □ C **26**.
- **Row 2, borrowing (14 − 5):** right answers are ◯ A **9**, △ B **8**, □ C **6**.

| Roll | Child | Write at the top | Row 1: ◯ △ □ | Row 2: ◯ △ □ | Why |
|---|---|---|---|---|---|
| 1 | Ravi | `1` | 25, **64**, 26 | 9, **22**, 6 | Language gap on both rows |
| 2 | Meena | `मीना` (name only) | **35, 32, 34** | **11, 9, 4** | All wrong; never taught borrowing |
| 3 | Sunil | `3` | 25, 28, 26 | 9, 8, 6 | |
| 4 | Kavita | `4` | 25, 28, 26 | 9, 8, 6 | |
| 5 | Arjun | `5 Arjun` | **35, 32, 34** | **11, 12, 14** | All wrong; the borrowing mistake |
| 6 | Pooja | `6` | 25, 28 (no □) | 9, 8 (no □) | Hindi at home |
| 7 | Mahesh | `7` | 25, 28, 26 | 9, 8, 6 | |
| 8 | Rekha | `8` | 25, 28, 26 | 9, 8, 6 | |
| 9 | Dinesh | `9` | 25, 28, 26 | 9, 8, 6 | |
| 10 | Sita | `Sita` (name only) | 25, **64, 82** | 9, 8, 6 | Word-problem slip, new on two-digit |
| 11 | Ramesh | `11` | 25, 28, 26 | 9, 8, 6 | |
| 12 | Anita | `12 Anita` | 25, 28 (no □) | 9, 8 (no □) | Hindi at home |
| 13 | Gopal | `13` | 25, 28, 26 | 9, 8, 6 | |
| 14 | Lalita | `14` | 25, 28, 26 | 9, 8, 6 | |
| 15 | Vikram | `15` | 25, 28, 26 | 9, 8, 6 | |
| 16 | Sangeeta | `16` | 25, 28, 26 | 9, 8, 6 | |
| 17 | Mukesh | `17` | 25, 28, 26 | 9, 8, 6 | |
| 18 | Radha | `18` | 25, 28, 26 | 9, 8, 6 | |
| 19 | Naresh | `19` | 25, 28 (no □) | 9, 8 (no □) | Hindi at home |
| 20 | Jyoti | `20 ज्योति` | 25, 28, 26 | 9, 8, 6 | |

Photograph them 5 at a time, flat, from above, in daylight: rolls 1–5, 6–10, 11–15 and 16–20. Save the 4 photos to the phone's gallery.

### Run the check

| ID | Do | Expect |
|---|---|---|
| 4.1 | Open **जाँच**. | **दो अंकों का घटाव** (two-digit subtraction) suggested for row 1, with the note that it comes from what was taught since the last check. |
| 4.2 | For **दूसरी पंक्ति (चाहें तो)** (row 2), pick **उधार लेकर घटाना** (borrowing). Tap **जाँच शुरू करें**. | The check screen for today's date. |
| 4.3 | **आज कौन अनुपस्थित है?** Tap no one. | Everyone stays present. |
| 4.4 | Follow the numbered steps. This week they come in the order C, A, B. | • **C box:** a **भीली में सुनाएँ** button plays the C question in Bhili, with the note that Hindi-at-home children skip this box.<br>• **A box:** **यह बोर्ड पर लिखें** shows "52 − 27 = ?" for row 1 and "14 − 5 = ?" for row 2.<br>• **B box:** **हिंदी में सुनाएँ** plays the B question in Hindi.<br>All the audio plays within a second or two. |
| 4.5 | **Draft test:** after a step or two, switch to **रजिस्टर**, then back to **जाँच**. Then close the app fully and reopen it. | The check is still there both times, at the same step, with nothing lost. |
| 4.6 | At **स्लेट से जवाब भरें**, tap **गैलरी से चुनें** and select **all 4 photos at once**. | Each photo shows **इंतज़ार → पढ़ रहे हैं… → पढ़ ली**. Up to 3 are read at once; all 4 within about 30 seconds. The counter reaches **4 में से 4 फ़ोटो पढ़ी गईं**. |
| 4.7 | Look at the grid. | Each child's two rows filled in. Pooja, Anita and Naresh show **घर में हिंदी: C नहीं**. A highlighted (coloured) box is one Claude wasn't sure of. |
| 4.8 | Fix any highlighted box: tap it, and correct it against the table above if it's wrong. | The value changes. The flag line says how many boxes still need checking. |
| 4.9 | Look for **यह स्लेट किसकी है?** (Whose slate is this?). | Likely: Meena's slate (name only, in Hindi), shown as "फ़ोटो 1, स्लेट 2: … नाम '…'". Pick **Meena** in its dropdown. If Claude placed it by name already, there's nothing to assign: that also passes. |
| 4.10 | (Optional) Try **फ़ोटो लें**, the in-app camera: take 2 photos of any slates, then **हो गया (2)**. | The camera opens inside the app; both photos are read like gallery photos. **Discard this check afterwards** (4.12) and start again, or the extra slates will be counted as duplicates. |
| 4.11 | Tap **जवाब सहेजें** (Save answers). | **"… की जाँच सहेज ली। नतीजे टैब में देखें।"**, with no red banner. |
| 4.12 | (Only if you need it) **छोड़ दें** (Discard) on a check in progress. | It asks first, then clears the check and its photos. |

---

## Part 5: Results (नतीजे)

Open **नतीजे**. Today's check opens; last week's check (23 October) is in the **जाँच** picker too. A two-concept check shows one tab per concept. Under the tabs, a button per group shows its count; tap one to see that group's children and what to do. The first group that needs help opens by default.

| ID | Do | Expect |
|---|---|---|
| 5.1 | Tab 1, two-digit subtraction. Tap each group button in turn. | • **भाषा की दिक्कत** (Language gap): Ravi. Note: B 64, "घटाने की जगह जोड़ दिया" (added instead of subtracted).<br>• **इबारती सवाल की दिक्कत** (Word-problem gap): Sita, marked **एक बार दिखा: दोबारा जाँचें** (seen once: re-check).<br>• **पढ़ाया पर सीखा नहीं** (Taught but not learned): Meena and Arjun, marked **प्रोब से पक्का करना है** (to confirm with the probe). Notes: 35, 32, 34, "बड़े अंक में से छोटा अंक घटा दिया".<br>• Everyone else under **तैयार** (Ready). |
| 5.2 | Tab 2, borrowing. Tap each group button in turn. | • **भाषा की दिक्कत**: Ravi, confirmed (no "seen once" mark).<br>• **पढ़ाया ही नहीं गया (अनुपस्थित)** (Never taught): **Meena**, with **अभिभावकों को छूटा पाठ भेजें**.<br>• **पढ़ाया पर सीखा नहीं**: **Arjun**, with the note "A: 11 लिखा, बड़े अंक में से छोटा अंक घटा दिया" (his 11 points to borrowing).<br>• Everyone else under **तैयार**. |
| 5.3 | In Ravi's group, read what to do. | **पहले ये हिंदी शब्द सिखाएँ, भीली आवाज़ के साथ:** with the key words (दे दिए "gave away", बचे "left", उड़ गईं "flew away"). Each word's Bhili audio plays. |
| 5.4 | In **पढ़ाया पर सीखा नहीं**, tap **दोबारा पढ़ाने वाली आवाज़ (भीली)**. | The reteaching script plays in Bhili. |
| 5.5 | Open last week's check (23 October). | Its groups, including **भीली क्लिप समझ नहीं आई** (Rekha) and the clip warning about the Bhili clip. |
| 5.6 | Back on today's check, choose **भाषा की दिक्कत**, switch tabs and back. | The same group stays chosen when the other tab has it; otherwise the first group opens. |
| 5.7 | Tap the ⓘ next to **जाँच**. | A popup **नतीजे कैसे बनते हैं** explains A, B and C and how groups form. **बंद करें** closes it. |
| 5.8 | Tap the ⓘ on a group card, for a few groups. | A short popup on what that pattern means, for example for भाषा की दिक्कत: "अंकों (A) और भीली कहानी (C) में सही, हिंदी कहानी (B) में गलत…". |

---

## Part 6: Telegram: opt-in and the catch-up

Do this **after** your last reset.

| ID | Do | Expect |
|---|---|---|
| 6.1 | **कक्षा** → **अभिभावकों के QR कोड दिखाएँ**. On the parent's phone, scan **Meena's** code with the camera or Telegram, then tap **Start**. | The bot replies at once with a Hindi welcome. |
| 6.2 | Go back to **कक्षा** (reopen the tab). | Meena shows **अभिभावक टेलीग्राम पर ✓**, and the count reads "20 में से 1 अभिभावकों को…". |
| 6.3 | On the teacher's phone, change **Meena's** "हिंदी की समझ" (Hindi understanding) to any value, then reopen **कक्षा**. | She **still** shows ✓. If the ✓ disappears, that's a bug: note it. |
| 6.4 | **आज** → **1 अभिभावक को छूटा पाठ भेजें**. | "भेज रहे हैं…", then **"Meena के अभिभावकों को टेलीग्राम पर भेज दिया।"** |
| 6.5 | On the parent's phone. | A **voice message** (with a waveform, not a file) that plays the catch-up **in Bhili**, captioned "Meena के लिए:" plus the activity steps in Hindi, and a **हो गया 👍** button. |
| 6.6 | Tap **हो गया 👍**. | A short pop-up: **धन्यवाद! 👍**. The tap is stored (6.9). |
| 6.7 | Reply to the voice note with a text, for example "ठीक है". | The bot answers **धन्यवाद! आपका संदेश शिक्षक तक पहुँच गया।** |
| 6.8 | Reply with a short voice message. | The same answer. Meena's home language is Bhili, so this reply is stored without a transcript. |
| 6.9 | (Laptop) Supabase → full-build project → Table Editor → `parent_replies`. | The newest rows show a `done`, a `text` and a `voice` reply, all for Meena. |

---

## Part 7: Quick re-check and probe (आज, after the check)

Go back to **आज**. The brief now reflects today's check.

| ID | Do | Expect |
|---|---|---|
| 7.1 | Read the brief. | It now has (Claude may word it differently):<br>• Meena's catch-up for borrowing<br>• a **language group**: Ravi, with the words दे दिए, बचे, उड़ गईं<br>• a **probe group** ("जाँच समूह"): Meena and Arjun, starting at borrowing<br>• a **reteaching group**: Arjun<br>• a **quick re-check**: **Sita** only<br>The lists under the brief match: **प्रोब समूह** (Meena, Arjun), **दोबारा पढ़ाने वाला समूह** (Arjun), **छोटी दोबारा जाँच** (Sita). |
| 7.2 | Under the quick re-checks, tap **दोबारा जाँच शुरू करें** for two-digit subtraction (Sita). | A re-check screen with a fresh question: "63 − 35 = ?" on the board, with the B and C audio. |
| 7.3 | Tap Sita's boxes: **A once (right), B twice (wrong), C twice (wrong)**. Save with **जाँच सहेजें (1 बच्चा)**. | It saves, with no red banner. |
| 7.4 | Look at the brief again. | Sita is now in a **word-problem group** ("शब्द-प्रश्न समूह" in the brief), and the quick re-check list is gone. |
| 7.5 | **प्रोब समूह** → **प्रोब शुरू करें**. | **प्रोब: उधार लेकर घटाना** (borrowing), with Meena and Arjun. Step 1 is in numbers ("15 − 6", answer 9). |
| 7.6 | For **Arjun**: tap **✗** on step 1 (numbers), then **✓** on step 2 (with drawings). | Arjun stops at step 2: **"उधार लेकर घटाना (दहाई खोलकर) से शुरू करें, पहले चित्रों से, फिर संख्याओं से।"** |
| 7.7 | For **Meena**: tap **✓** on step 1. | **पहली बार में सही: कक्षा के साथ वापस।** (passed at once: back with the class). |
| 7.8 | **प्रोब सहेजें (2)**. | Saved. In the brief, Meena has left the probe group, and Arjun's reteaching group starts from borrowing. |

---

## Part 8: Reteaching kit and buddies

| ID | Do | Expect |
|---|---|---|
| 8.1 | **दोबारा पढ़ाने वाला समूह** → **पढ़ाने की किट खोलें**. | **दोबारा पढ़ाने की किट: उधार लेकर घटाना**, with **आवाज़ भीली में** selected and "इस समूह के ज़्यादातर बच्चों को भीली में पढ़ाना ठीक रहेगा।" |
| 8.2 | Play each step with **चरण 1 सुनाएँ**, **चरण 2 सुनाएँ** and so on. Then switch the audio to Hindi and play one. | Every step plays in Bhili, then in Hindi. |
| 8.3 | Check **मुख्य शब्द** (Key words) and **साथी** (Buddy). | 8–10 key words, each with Hindi and Bhili audio. The buddy is one of **Kavita, Mahesh or Ramesh** ("… दोनों भाषाएँ समझता है…"). |
| 8.4 | **अभिभावकों के लिए → अभिभावकों को गतिविधि भेजें**. | Arjun's parent isn't on Telegram: **"अभी टेलीग्राम पर नहीं: Arjun…"**. (If you opted in Arjun's code too, his parent gets the activity as a voice note.) |

---

## Part 9: Class tab and the listening check (कक्षा)

> Running the listening check **replaces the language profiles**, which changes later groups and the kit's language. Do it last, or reset afterwards.

| ID | Do | Expect |
|---|---|---|
| 9.1 | Open **कक्षा**. | The 20 children, each with their home language, a profile line such as "हिंदी 25%, भीली 100% समझता है। दोबारा पढ़ाएँ: पहले भीली में।" (percentages vary), the Hindi-understanding picker, and their Telegram status. Ravi is **Bhili first**; Kavita, Mahesh and Ramesh follow both. |
| 9.2 | **अभिभावकों के QR कोड दिखाएँ**. | A printable page with 20 QR codes, one per child, each labelled. |
| 9.3 | **सुनने की जाँच** shows "पिछली बार … को की।" (16 October). Tap **फिर से करें** (Run it again). | Item 1 of 4: four numbered pictures to draw on the board, a Hindi question then a Bhili one (both play), and a tap grid with two numbers per child. |
| 9.4 | Tap a few cells (once for right, twice for wrong), go through all 4 items, and save. | Saved. The profiles in 9.1 change to match what you tapped. |

---

## Part 10: Offline (teacher's phone, installed app)

| ID | Do | Expect |
|---|---|---|
| 10.1 | Turn on **airplane mode**. Close the app fully and reopen it from the icon. | It opens normally, with all the data there. |
| 10.2 | **रजिस्टर**: mark one child absent and save. | Saved, with a badge in the header: **⏳ 1 भेजना बाकी**. |
| 10.3 | Hold the mic and record a note. | **सिग्नल नहीं है: संदेश सहेज लिया, फ़ोन ऑनलाइन होते ही पढ़ा जाएगा…** |
| 10.4 | **आज**: look at the brief. | The brief still shows. "Claude से जुड़ नहीं सके, इसलिए यह सीधा सारांश है।" (the template, since Claude can't be reached). |
| 10.5 | **जाँच**: start a check, play its B and C audio, then add a slate photo from the gallery. | The audio plays from the cache. The photo waits: **सिग्नल नहीं है: फ़ोन ऑनलाइन होते ही ये फ़ोटो पढ़ी जाएँगी।** |
| 10.6 | Turn airplane mode **off**, and keep the check screen open. | Within about 30 seconds the badge clears, the voice note is transcribed into today's lesson, and the photo is read with its review showing. |
| 10.7 | Clean up: discard the test check, and set today's absence and lesson back (everyone present, two-digit subtraction). | |

---

## Part 11: English pass and designs

| ID | Do | Expect |
|---|---|---|
| 11.1 | Tap **English** and visit every tab, plus the probe, kit, re-check, listening check and QR pages. | Everything is in English, with no Hindi left in the interface. Children's names and the B and C question audio stay as they are. |
| 11.2 | Open https://triveni-251j.vercel.app/designs/ | The design slides: tomorrow's words for the teacher, the community audio library, and the simulation table. All load. |

---

## Part 12: The demo run (the Stage 23 check)

Reset (Part 0), opt in Meena's parent (6.1), make sure the 4 slate photos are in the gallery, then run the README's demo with the changes in this guide:

1. Voice note **"आज two-digit subtraction पढ़ाया, page 62"** (3.4), and save.
2. Two-concept check: two-digit subtraction plus borrowing (4.1–4.4).
3. The gallery photos; fix one box; assign one slate (4.6–4.11).
4. Results: Ravi, Meena and Arjun (5.1–5.2).
5. The brief, read aloud (2.2, 7.1).
6. Sita's quick re-check (7.2–7.4).
7. Arjun's probe, then the kit in Bhili (7.5–8.2). Flip to English for a moment.
8. Send Meena's catch-up; the parent's phone plays it; tap **हो गया 👍** (6.4–6.6).
9. Close on `/designs/`.

**Pass:** the whole run, **twice in a row, under 6 minutes each**, with no red banner. Reset and opt in again between the two runs.

---

## Results

| ID | Pass / Fail | Notes |
|---|---|---|
| 1.1–1.4 | | |
| 2.1–2.6 | | |
| 3.1–3.7 | | |
| 4.1–4.12 | | |
| 5.1–5.8 | | |
| 6.1–6.9 | | |
| 7.1–7.8 | | |
| 8.1–8.4 | | |
| 9.1–9.4 | | |
| 10.1–10.7 | | |
| 11.1–11.2 | | |
| Demo run 1 (time) | | |
| Demo run 2 (time) | | |

### Already checked from the laptop (31 October)

Every API endpoint, all 68 cached speech clips, the 8 B-version clips, the 10 Telegram voice notes, live Hindi speech (Bulbul), voice notes in m4a and webm, slate reading, the brief rewording, the webhook secret, and the web pages and designs all passed against the live deployment.

### Known issues to watch

- **Brief Hindi:** Claude presumes each child's gender from their name. A name it guesses wrong gets the wrong verb form.
- **Devanagari digits on slates** read poorly. The demo uses Latin digits (Stage 20).
- **Reloading the demo class** wipes the Telegram opt-ins (Part 0).
- **The README demo's step 1** ("borrowing, page 65") makes Meena "taught", which breaks steps 4 and 8. This guide uses two-digit subtraction instead.
