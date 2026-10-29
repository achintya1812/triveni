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
"""Writes the Bhili text of each C question into packages/content/data/questions.json.

Uses AI4Bharat's Marathi -> Bhili (Dehvali) adapter on sarvamai/sarvam-translate, fed the English
text of C. There is no Hindi -> Bhili model, and pivoting through Marathi was unreliable (the base
model often answered in English or copied the Hindi), while English in gave the most Bhili-like text.
A Bhili speaker should check the output. Run once, after changing a C question:
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
QUESTIONS = Path(__file__).parents[2] / "packages/content/data/questions.json"
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
    # The numbers must survive translation, or the answer key is wrong.
    if re.findall(r"\d+", bhili) != re.findall(r"\d+", english):
        raise SystemExit("Numbers changed in translation; nothing was written.")
    return bhili


# Edit the file as text to keep its hand-made layout: put a "bhili" line after each "scriptHi" line.
source = QUESTIONS.read_text()
english = {q["C"]["scriptHi"]: q["C"]["english"] for q in json.loads(source)}
source = re.sub(r'\n *"bhili": .*', "", source)
source = re.sub(
    r'( *)"scriptHi": (".*?"),\n',
    lambda m: f'{m[0]}{m[1]}"bhili": {json.dumps(to_bhili(english[json.loads(m[2])]), ensure_ascii=False)},\n',
    source,
)
QUESTIONS.write_text(source)
