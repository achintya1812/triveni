# /// script
# requires-python = ">=3.11,<3.13"
# dependencies = [
#   "torch",
#   "transformers>=4.50,<5",
#   "peft",
#   "accelerate",
# ]
# [[tool.uv.index]]
# name = "pytorch-cpu"
# url = "https://download.pytorch.org/whl/cpu"
# explicit = true
# [tool.uv.sources]
# torch = { index = "pytorch-cpu" }
# ///
"""Fills in the missing Bhili text in packages/content/data: C questions, key words, reteaching scripts,
parent catch-up lessons, the reteaching kit and the listening check's Bhili prompts.

Uses AI4Bharat's Marathi -> Bhili (Dehvali) adapter on sarvamai/sarvam-translate, fed English text.
There is no Hindi -> Bhili model, and pivoting through Marathi was unreliable (the base model often
answered in English or copied the Hindi), while English in gave the most Bhili-like text.
Only empty fields are filled, so text a Bhili speaker has corrected is never overwritten; to redo one,
delete its "bhili". A text whose numbers don't survive translation is left empty and listed at the end:
reword its English and run again. A Bhili speaker should check the output. Run after adding or changing content:
  uv run services/bhili/translate.py
Needs about 10 GB of free RAM, so stop the TTS server first.
"""

import json
import re
from pathlib import Path

import torch
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer

BASE = "sarvamai/sarvam-translate"
ADAPTER = "ai4bharat/bhili-translate-mar-bhb"
# The adapter's trained prompt, kept as is even though the input is English.
TO_BHILI = (
    "You are a professional Marathi (mr) to Bhili (bhb) translator. Your goal is to accurately convey the meaning "
    "and nuances of the original Marathi text while adhering to Bhili grammar, vocabulary, and cultural "
    "sensitivities. Produce only the Bhili translation, without any additional explanations or commentary. "
    "Please translate the following Marathi text into Bhili:"
)
DATA = Path(__file__).parents[2] / "packages/content/data"
DEVANAGARI_DIGITS = str.maketrans("०१२३४५६७८९", "0123456789")
BEAMS = 4

tokenizer = AutoTokenizer.from_pretrained(BASE)
model = PeftModel.from_pretrained(AutoModelForCausalLM.from_pretrained(BASE, dtype=torch.bfloat16), ADAPTER).eval()


skipped = []


def to_bhili(english: str) -> str | None:
    messages = [{"role": "system", "content": TO_BHILI}, {"role": "user", "content": english}]
    prompt = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    inputs = tokenizer([prompt], return_tensors="pt")
    with torch.no_grad():
        output = model.generate(
            **inputs, max_new_tokens=256, do_sample=False, num_beams=BEAMS, num_return_sequences=BEAMS, early_stopping=True
        )
    # Digits stay 0-9, like A and B.
    beams = [
        tokenizer.decode(o[len(inputs.input_ids[0]) :], skip_special_tokens=True).strip().translate(DEVANAGARI_DIGITS)
        for o in output
    ]
    # The numbers must survive translation, or the answer key is wrong. Bhili word order may move them.
    # Take the best beam that keeps them.
    numbers = sorted(re.findall(r"\d+", english))
    bhili = next((b for b in beams if sorted(re.findall(r"\d+", b)) == numbers), None)
    print(f"en:  {english}\nbhb: {bhili or 'NUMBERS CHANGED: ' + beams[0]}\n", flush=True)
    if bhili is None:
        skipped.append(english)
    return bhili


def dump(value) -> str:
    return json.dumps(value, ensure_ascii=False)


# The layout used by keywords.json and concepts.json: `{ "key": value, ... }`, one entry per line.
def line(value) -> str:
    if isinstance(value, dict):
        return "{ " + ", ".join(f"{dump(k)}: {line(v)}" for k, v in value.items()) + " }"
    if isinstance(value, list) and value and isinstance(value[0], dict):
        return "[" + ", ".join(line(v) for v in value) + "]"
    return dump(value)


# Translate everything first, so a crash leaves every file untouched.
questions_path, keywords_path, concepts_path = (DATA / f for f in ("questions.json", "keywords.json", "concepts.json"))
kits_path, listening_path = DATA / "kits.json", DATA / "listening.json"
questions = questions_path.read_text()
keywords = json.loads(keywords_path.read_text())
concepts = json.loads(concepts_path.read_text())
kits = json.loads(kits_path.read_text())
listening = json.loads(listening_path.read_text())

c_bhili = {q["C"]["scriptHi"]: to_bhili(q["C"]["english"]) for q in json.loads(questions) if "bhili" not in q["C"]}
c_bhili = {k: v for k, v in c_bhili.items() if v}
for keyword in keywords:
    if "bhili" not in keyword and (bhili := to_bhili(keyword["meaning"])):
        keyword["bhili"] = bhili
for concept in concepts:
    if "bhili" not in concept["reteach"] and (bhili := to_bhili(concept["reteach"]["english"])):
        concept["reteach"]["bhili"] = bhili
    if "catchUp" in concept and "bhili" not in concept["catchUp"] and (bhili := to_bhili(concept["catchUp"]["english"])):
        concept["catchUp"]["bhili"] = bhili
for kit in kits:
    for step in kit["steps"]:
        if "bhili" not in step["says"] and (bhili := to_bhili(step["says"]["english"])):
            step["says"]["bhili"] = bhili
    if "bhili" not in kit["parentActivity"] and (bhili := to_bhili(kit["parentActivity"]["english"])):
        kit["parentActivity"]["bhili"] = bhili
for item in listening:
    if "text" not in item["bhili"] and (bhili := to_bhili(item["bhili"]["english"])):
        # The key order the schema reads best in: text first.
        item["bhili"] = {"text": bhili, **item["bhili"]}

# questions.json keeps its hand-made layout: put a "bhili" line after each "scriptHi" that lacks one.
questions = re.sub(
    r'( *)"scriptHi": (".*?"),\n',
    lambda m: m[0] + (f'{m[1]}"bhili": {dump(c_bhili[json.loads(m[2])])},\n' if json.loads(m[2]) in c_bhili else ""),
    questions,
)
questions_path.write_text(questions)
for path, items in ((keywords_path, keywords), (concepts_path, concepts)):
    path.write_text("[\n" + ",\n".join(f"  {line(item)}" for item in items) + "\n]\n")
for path, items in ((kits_path, kits), (listening_path, listening)):
    path.write_text(json.dumps(items, ensure_ascii=False, indent=2) + "\n")
if skipped:
    print("Numbers changed in these, so they were left empty. Reword the English and run again:")
    print("\n".join(f"  {english}" for english in skipped))
    raise SystemExit(1)
