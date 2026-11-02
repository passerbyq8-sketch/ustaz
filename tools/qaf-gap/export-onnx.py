"""Measurement-only conversion of already-local BGE weights; no model downloads."""
import json
import os
from pathlib import Path
import shutil
import sys
import time

repo = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(repo / "node_modules/.cache/qaf-gap/onnx-python"))
os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["TRANSFORMERS_OFFLINE"] = "1"
import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer
from onnxruntime.quantization import quantize_dynamic, QuantType

source, output = map(Path, sys.argv[1:3])
started = time.monotonic()
output.mkdir(parents=True, exist_ok=True)
(output / "onnx").mkdir(exist_ok=True)
for filename in ["config.json", "tokenizer.json", "tokenizer_config.json", "special_tokens_map.json", "sentencepiece.bpe.model"]:
    if (source / filename).exists():
        shutil.copyfile(source / filename, output / filename)
torch.set_num_threads(4)
tokenizer = AutoTokenizer.from_pretrained(str(source), local_files_only=True)
model = AutoModelForSequenceClassification.from_pretrained(str(source), local_files_only=True, attn_implementation="eager").eval()

class Logits(torch.nn.Module):
    def __init__(self, base):
        super().__init__()
        self.base = base
    def forward(self, input_ids, attention_mask):
        return self.base(input_ids=input_ids, attention_mask=attention_mask).logits

tokens = tokenizer("question", "candidate passage", return_tensors="pt")
full = output / "onnx/model.onnx"
with torch.no_grad():
    torch.onnx.export(Logits(model), (tokens["input_ids"], tokens["attention_mask"]), str(full),
        input_names=["input_ids", "attention_mask"], output_names=["logits"], opset_version=17, dynamo=False,
        external_data=True, dynamic_axes={"input_ids": {0: "batch", 1: "sequence"}, "attention_mask": {0: "batch", 1: "sequence"}, "logits": {0: "batch"}})
del model
quantize_dynamic(str(full), str(output / "onnx/model_quantized.onnx"), weight_type=QuantType.QInt8, use_external_data_format=True)
print(json.dumps({"source": str(source), "output": str(output), "ms": (time.monotonic() - started) * 1000}), flush=True)
