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
"""Fills in the missing Bhili text in packages/content/data: C questions, key words and reteaching scripts.

Uses AI4Bharat's Marathi -> Bhili (Dehvali) adapter on sarvamai/sarvam-translate, fed English text.
There is no Hindi -> Bhili model, and pivoting through Marathi was unreliable (the base model often
answered in English or copied the Hindi), while English in gave the most Bhili-like text.
Only empty fields are filled, so text a Bhili speaker has corrected is never overwritten; to redo one,
delete its "bhili". A Bhili speaker should check the output. Run after adding or changing content:
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

tokenizer = AutoTokenizer.from_pretrained(BASE)
model = PeftModel.from_pretrained(AutoModelForCausalLM.from_pretrained(BASE, dtype=torch.bfloat16), ADAPTER).eval()


def to_bhili(english: str) -> str:
    messages = [{"role": "system", "content": TO_BHILI}, {"role": "user", "content": english}]
    prompt = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    inputs = tokenizer([prompt], return_tensors="pt")
    with torch.no_grad():
        output = model.generate(**inputs, max_new_tokens=256, do_sample=False, num_beams=4, early_stopping=True)
    # Digits stay 0-9, like A and B.
    bhili = tokenizer.decode(output[0][len(inputs.input_ids[0]) :], skip_special_tokens=True).strip()
    bhili = bhili.translate(DEVANAGARI_DIGITS)
    print(f"en:  {english}\nbhb: {bhili}\n", flush=True)
    # The numbers must survive translation, or the answer key is wrong. Bhili word order may move them.
    if sorted(re.findall(r"\d+", bhili)) != sorted(re.findall(r"\d+", english)):
        raise SystemExit("Numbers changed in translation; nothing was written.")
    return bhili


def dump(value) -> str:
    return json.dumps(value, ensure_ascii=False)


# The layout used by keywords.json and concepts.json: `{ "key": value, ... }`, one entry per line.
def line(value) -> str:
    if isinstance(value, dict):
        return "{ " + ", ".join(f"{dump(k)}: {line(v)}" for k, v in value.items()) + " }"
    return dump(value)


# Translate everything first, so a failure leaves every file untouched.
questions_path, keywords_path, concepts_path = (DATA / f for f in ("questions.json", "keywords.json", "concepts.json"))
questions = questions_path.read_text()
keywords = json.loads(keywords_path.read_text())
concepts = json.loads(concepts_path.read_text())

c_bhili = {q["C"]["scriptHi"]: to_bhili(q["C"]["english"]) for q in json.loads(questions) if "bhili" not in q["C"]}
for keyword in keywords:
    if "bhili" not in keyword:
        keyword["bhili"] = to_bhili(keyword["meaning"])
for concept in concepts:
    if "bhili" not in concept["reteach"]:
        concept["reteach"]["bhili"] = to_bhili(concept["reteach"]["english"])

# questions.json keeps its hand-made layout: put a "bhili" line after each "scriptHi" that lacks one.
questions = re.sub(
    r'( *)"scriptHi": (".*?"),\n',
    lambda m: m[0] + (f'{m[1]}"bhili": {dump(c_bhili[json.loads(m[2])])},\n' if json.loads(m[2]) in c_bhili else ""),
    questions,
)
questions_path.write_text(questions)
for path, items in ((keywords_path, keywords), (concepts_path, concepts)):
    path.write_text("[\n" + ",\n".join(f"  {line(item)}" for item in items) + "\n]\n")
