#!/usr/bin/env python3
"""Driver: asks OpenAI gpt-6-astra to write the office_flythrough Blender scene script.

Usage:
  astra_driver_office_flythrough.py generate            # round 1 from the brief
  astra_driver_office_flythrough.py fix <log_file>      # send a traceback back, get a corrected script
  astra_driver_office_flythrough.py revise <notes_file> # send visual feedback from test frames
The API key is read from ../../.env (relative to the nightlight root) and never printed.
Conversation state is kept in notes/office_flythrough_conversation.json.
"""
import json, os, re, sys, time, urllib.request, urllib.error

HERE = os.path.dirname(os.path.abspath(__file__))
BL = os.path.dirname(HERE)                      # assets/blender
ROOT = os.path.dirname(os.path.dirname(BL))     # nightlight
ENV = os.path.join(os.path.dirname(ROOT), ".env")
NOTES = os.path.join(BL, "notes")
CONV = os.path.join(NOTES, "office_flythrough_conversation.json")
BRIEF = os.path.join(NOTES, "office_flythrough_brief.txt")
SCRIPT = os.path.join(HERE, "office_flythrough.py")
MODEL = "gpt-6-astra"

SYSTEM = ("You are a senior Blender technical artist who writes production-quality bpy scripts. "
          "Reply with ONE complete, self-contained Python script inside a single ```python code block "
          "and nothing else outside the block. The script must run headless with "
          "`Blender -b -P script.py --python-exit-code 1` on Blender 5.2 LTS.")


def api_key():
    with open(ENV) as f:
        for line in f:
            line = line.strip()
            if line.startswith("OPENAI_API_KEY") and "=" in line:
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit("OPENAI_API_KEY not found in .env")


def call(messages):
    body = {"model": MODEL, "messages": messages, "max_completion_tokens": 32000}
    for attempt in range(2):
        req = urllib.request.Request(
            "https://api.openai.com/v1/chat/completions",
            data=json.dumps(body).encode(),
            headers={"Content-Type": "application/json", "Authorization": "Bearer " + api_key()},
        )
        t = time.time()
        try:
            with urllib.request.urlopen(req, timeout=900) as r:
                data = json.loads(r.read())
            print(f"astra call ok in {time.time()-t:.1f}s, usage={data.get('usage')}")
            return data["choices"][0]["message"]["content"], data.get("usage"), time.time() - t
        except urllib.error.HTTPError as e:
            msg = e.read().decode()[:800]
            print("HTTP", e.code, msg)
            if e.code == 400 and "max_completion_tokens" in msg and attempt == 0:
                body.pop("max_completion_tokens"); continue
            raise


def extract(text):
    m = re.findall(r"```(?:python|py)?\s*\n(.*?)```", text, re.S)
    if not m:
        return text
    return max(m, key=len)


def load():
    if os.path.exists(CONV):
        return json.load(open(CONV))
    return {"model": MODEL, "rounds": [], "messages": []}


def save(state):
    json.dump(state, open(CONV, "w"), indent=2)


def do_round(state, user_msg, kind):
    if not state["messages"]:
        state["messages"].append({"role": "system", "content": SYSTEM})
    state["messages"].append({"role": "user", "content": user_msg})
    text, usage, secs = call(state["messages"])
    code = extract(text)
    state["messages"].append({"role": "assistant", "content": "```python\n" + code + "\n```"})
    n = len(state["rounds"]) + 1
    path = os.path.join(HERE, f"office_flythrough_astra_r{n}.py")
    open(path, "w").write(code)
    open(SCRIPT, "w").write(code)
    state["rounds"].append({"round": n, "kind": kind, "seconds": round(secs, 1), "usage": usage,
                            "script": os.path.relpath(path, BL), "lines": code.count("\n") + 1})
    save(state)
    print(f"round {n} ({kind}) -> {path} ({code.count(chr(10))+1} lines)")


def main():
    cmd = sys.argv[1]
    state = load()
    if cmd == "generate":
        do_round(state, open(BRIEF).read(), "generate")
    elif cmd == "fix":
        log = open(sys.argv[2]).read()
        tail = "\n".join(log.splitlines()[-60:])
        do_round(state, "Running your script in Blender 5.2.1 (background mode) failed with this output/traceback:\n\n"
                 + tail + "\n\nPlease return the full corrected script (complete file, same structure and env vars).", "fix")
    elif cmd == "revise":
        do_round(state, open(sys.argv[2]).read(), "revise")
    else:
        raise SystemExit("unknown command")


if __name__ == "__main__":
    main()
