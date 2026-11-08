"""Ask OpenAI gpt-6-astra to write (or fix) the hero_still Blender scene script.

usage: python3 astra_hero_still.py new  <brief.txt>
       python3 astra_hero_still.py fix  <traceback.txt>
       python3 astra_hero_still.py art  <feedback.txt> [reference.jpg]   (art-direction revision)
Conversation is kept in notes/hero_still_conversation.json; the script lands in
scripts/hero_still_scene.py. The API key is read from ../.env and never printed.
"""
import json, os, re, sys, time, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
BL = os.path.dirname(HERE)
ENV = os.path.abspath(os.path.join(BL, "..", "..", "..", ".env"))
CONV = os.path.join(BL, "notes", "hero_still_conversation.json")
OUT = os.path.join(HERE, "hero_still_scene.py")

def key():
    for line in open(ENV, encoding="utf-8"):
        line = line.strip()
        if line.startswith("OPENAI_API_KEY="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit("OPENAI_API_KEY missing")

SYSTEM = ("You are an expert Blender technical artist. You write complete, self-contained, "
          "runnable Blender Python (bpy) scripts. Reply with exactly one ```python fenced code block "
          "containing the whole script and nothing else.")

def call(messages):
    body = json.dumps({"model": "gpt-6-astra", "messages": messages}).encode()
    req = urllib.request.Request("https://api.openai.com/v1/chat/completions", data=body,
        headers={"Content-Type": "application/json", "Authorization": "Bearer " + key()})
    t = time.time()
    with urllib.request.urlopen(req, timeout=600) as r:
        data = json.load(r)
    return data, time.time() - t

def main():
    mode, path = sys.argv[1], sys.argv[2]
    text = open(path, encoding="utf-8").read()
    if mode == "new":
        conv = {"model": "gpt-6-astra", "rounds": [], "messages": [{"role": "system", "content": SYSTEM}]}
        conv["messages"].append({"role": "user", "content": text})
    elif mode == "art":
        conv = json.load(open(CONV))
        img = sys.argv[3] if len(sys.argv) > 3 else None
        if img:
            import base64
            b64 = base64.b64encode(open(img, "rb").read()).decode()
            content = [{"type": "text", "text": text},
                       {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64," + b64}}]
        else:
            content = text
        conv["messages"].append({"role": "user", "content": content})
    else:
        conv = json.load(open(CONV))
        conv["messages"].append({"role": "user", "content":
            "The script failed when run with Blender 5.2.1 headless (Blender -b -P script.py). "
            "Here is the error output. Return the complete corrected script.\n\n" + text})
    data, secs = call(conv["messages"])
    reply = data["choices"][0]["message"]["content"]
    m = re.search(r"```(?:python)?\s*\n(.*?)```", reply, re.S)
    code = m.group(1) if m else reply
    if mode == "art" and isinstance(conv["messages"][-1]["content"], list):
        # keep the saved conversation small: replace the inline image with its path
        conv["messages"][-1]["content"][1]["image_url"]["url"] = "file://" + os.path.abspath(sys.argv[3])
    conv["messages"].append({"role": "assistant", "content": reply})
    conv["rounds"].append({"mode": mode, "seconds": round(secs, 1), "usage": data.get("usage"),
                           "model": data.get("model")})
    json.dump(conv, open(CONV, "w"), indent=1)
    open(OUT, "w", encoding="utf-8").write(code)
    print(f"round {len(conv['rounds'])} ({mode}) {secs:.1f}s model={data.get('model')} lines={code.count(chr(10))}")

if __name__ == "__main__":
    main()
