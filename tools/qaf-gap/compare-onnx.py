"""Compare the local quantized export with its local PyTorch source; offline."""
import json
import os
from pathlib import Path
import sys
os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["TRANSFORMERS_OFFLINE"] = "1"
import torch
import onnxruntime as ort
from transformers import AutoModelForSequenceClassification, AutoTokenizer

source, exported, output = map(Path, sys.argv[1:4])
torch.set_num_threads(4)
tokenizer = AutoTokenizer.from_pretrained(str(source), local_files_only=True)
model = AutoModelForSequenceClassification.from_pretrained(str(source), local_files_only=True, attn_implementation="eager").eval()
questions = ["ما حكم الجمع بين المغرب والعشاء في المطر؟", "ما صحة حديث سورة الواقعة؟", "How to perform ablution?"]
passages = ["يجوز الجمع بين المغرب والعشاء في المطر الذي يبل الثياب.", "حديث قراءة سورة تبارك في الليل غير حديث سورة الواقعة.", "Wash the face and hands when performing ablution. " * 20]
tokens = tokenizer(questions, passages, padding=True, truncation=True, max_length=512, return_tensors="pt")
with torch.no_grad():
    expected = model(**tokens).logits[:, 0].numpy()
del model
options = ort.SessionOptions()
options.intra_op_num_threads = 4
options.inter_op_num_threads = 1
session = ort.InferenceSession(str(exported / "onnx/model_quantized.onnx"), sess_options=options, providers=["CPUExecutionProvider"])
got = session.run(None, {k: v.numpy() for k, v in tokens.items() if k in {i.name for i in session.get_inputs()}})[0][:, 0]
delta = max(abs(float(a) - float(b)) for a, b in zip(expected, got))
result = {"samples": 3, "sequenceTokens": int(tokens["input_ids"].shape[1]), "pytorchLogits": expected.tolist(), "onnxLogits": got.tolist(), "maxAbsLogitDiff": delta}
output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
print(json.dumps(result), flush=True)
