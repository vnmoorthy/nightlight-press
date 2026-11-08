"""Ask OpenAI gpt-6-astra to write (or fix) the Pip mascot Blender scene script.
usage: python3 astra_pip.py new <brief.txt> | fix <traceback.txt> | art <feedback.txt> [image.jpg]
Conversation -> pip/astra_conversation.json; script -> pip/pip_scene.py. API key read from .env, never printed."""
import json, os, re, sys, time, urllib.request, base64
HERE = os.path.dirname(os.path.abspath(__file__))
ENV = "/Users/moorthy/Downloads/Projects/Naive hackathon/.env"
CONV = os.path.join(HERE, "astra_conversation.json")
OUT = os.path.join(HERE, "pip_scene.py")
def key():
    for line in open(ENV, encoding="utf-8"):
        line = line.strip()
        if line.startswith("OPENAI_API_KEY="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit("OPENAI_API_KEY missing")
SYSTEM = ("You are an expert Blender technical artist. You write complete, self-contained, runnable Blender Python "
          "(bpy) scripts. Reply with exactly one ```python fenced code block containing the whole script and nothing else.")
def call(messages):
    body = json.dumps({"model": "gpt-6-astra", "messages": messages}).encode()
    req = urllib.request.Request("https://api.openai.com/v1/chat/completions", data=body,
        headers={"Content-Type": "application/json", "Authorization": "Bearer " + key()})
    t = time.time()
    with urllib.request.urlopen(req, timeout=600) as r:
        data = json.load(r)
    return data, time.time() - t
mode, path = sys.argv[1], sys.argv[2]
text = open(path, encoding="utf-8").read()
if mode == "new":
    conv = {"model": "gpt-6-astra", "rounds": [], "messages": [{"role": "system", "content": SYSTEM}, {"role": "user", "content": text}]}
else:
    conv = json.load(open(CONV))
    if mode == "fix":
        conv["messages"].append({"role": "user", "content": "The script failed when run with Blender 5.2.1 headless "
            "(Blender -b -P script.py). Here is the error output. Return the complete corrected script.\n\n" + text})
    else:
        img = sys.argv[3] if len(sys.argv) > 3 else None
        content = text
        if img:
            content = [{"type": "text", "text": text}, {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64," + base64.b64encode(open(img, "rb").read()).decode()}}]
        conv["messages"].append({"role": "user", "content": content})
data, secs = call(conv["messages"])
reply = data["choices"][0]["message"]["content"]
m = re.search(r"```(?:python)?\s*\n(.*?)```", reply, re.S)
code = m.group(1) if m else reply
last = conv["messages"][-1]
if isinstance(last["content"], list):
    last["content"][1]["image_url"]["url"] = "file://" + os.path.abspath(sys.argv[3])
conv["messages"].append({"role": "assistant", "content": reply})
conv["rounds"].append({"mode": mode, "seconds": round(secs, 1), "usage": data.get("usage"), "model": data.get("model")})
json.dump(conv, open(CONV, "w"), indent=1)
open(OUT, "w", encoding="utf-8").write(code)
if mode == "new" or not os.path.exists(os.path.join(HERE, "pip_scene_r1.py")):
    pass
open(os.path.join(HERE, "pip_scene_r%d.py" % len(conv["rounds"])), "w").write(code)
print(f"round {len(conv['rounds'])} ({mode}) {secs:.1f}s model={data.get('model')} lines={code.count(chr(10))}")
