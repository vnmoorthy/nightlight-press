#!/usr/bin/env python3
"""Driver: asks OpenAI gpt-6-astra to write the Blender scene script for book_open,
runs it headless in Blender (test mode), feeds tracebacks back for up to 4 rounds.

Usage: python3 astra_driver_book_open.py [--rounds 4] [--extra "additional brief notes"]
The OPENAI_API_KEY is read from the project's ../.env and never printed.
"""
import json, os, re, subprocess, sys, time, urllib.request, urllib.error, argparse

ROOT = "/Users/moorthy/Downloads/Projects/Naive hackathon/nightlight"
BL = os.path.join(ROOT, "assets/blender")
SCRIPTS = os.path.join(BL, "scripts")
NOTES = os.path.join(BL, "notes")
ENV_FILE = os.path.join(ROOT, "..", ".env")
BLENDER = "/Applications/Blender.app/Contents/MacOS/Blender"
MODEL = "gpt-6-astra"
NAME = "book_open"


def load_key():
    key = os.environ.get("OPENAI_API_KEY")
    if key:
        return key
    with open(ENV_FILE) as f:
        for line in f:
            line = line.strip()
            if line.startswith("OPENAI_API_KEY="):
                v = line.split("=", 1)[1].strip().strip('"').strip("'")
                return v
    raise SystemExit("OPENAI_API_KEY not found")


BRIEF = open(os.path.join(NOTES, f"{NAME}_brief.txt")).read() if os.path.exists(os.path.join(NOTES, f"{NAME}_brief.txt")) else None

SYSTEM = (
    "You are a senior Blender technical artist. You write complete, runnable Blender Python (bpy) "
    "scripts for headless rendering. Reply with ONE python code block only, no commentary."
)


def call_astra(messages, key):
    body = json.dumps({"model": MODEL, "messages": messages}).encode()
    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=body,
        headers={"Content-Type": "application/json", "Authorization": "Bearer " + key},
    )
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=600) as r:
            data = json.loads(r.read())
    except urllib.error.HTTPError as e:
        raise SystemExit("OpenAI HTTP %s: %s" % (e.code, e.read()[:800].decode(errors="replace")))
    dt = time.time() - t0
    content = data["choices"][0]["message"]["content"]
    usage = data.get("usage", {})
    return content, dt, usage, data.get("model")


def extract_code(text):
    m = re.findall(r"```(?:python|py)?\s*\n(.*?)```", text, re.S)
    if m:
        return max(m, key=len)
    return text


def run_blender(script_path, out_dir, extra_env):
    env = dict(os.environ)
    env.pop("OPENAI_API_KEY", None)
    env.update(extra_env)
    env["OUTPUT_DIR"] = out_dir
    os.makedirs(out_dir, exist_ok=True)
    t0 = time.time()
    p = subprocess.run(
        [BLENDER, "-b", "--factory-startup", "-P", script_path, "--python-exit-code", "1"],
        env=env, capture_output=True, text=True, timeout=1500,
    )
    dt = time.time() - t0
    log = p.stdout + "\n" + p.stderr
    return p.returncode, log, dt


def tail_error(log, n=60):
    lines = log.splitlines()
    idx = None
    for i, l in enumerate(lines):
        if "Traceback" in l or l.startswith("Error:"):
            idx = i
            break
    if idx is not None:
        return "\n".join(lines[idx: idx + n])
    return "\n".join(lines[-n:])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--rounds", type=int, default=4)
    ap.add_argument("--tag", default="")
    ap.add_argument("--continue-from", default="", help="previous Astra script to continue from")
    ap.add_argument("--feedback", default="", help="file with art-direction feedback")
    ap.add_argument("--start-round", type=int, default=1)
    args = ap.parse_args()
    key = load_key()
    brief = open(os.path.join(NOTES, f"{NAME}_brief.txt")).read()
    messages = [{"role": "system", "content": SYSTEM}, {"role": "user", "content": brief}]
    feedback = ""
    if args.continue_from:
        prev = open(args.continue_from).read()
        feedback = open(args.feedback).read()
        messages.append({"role": "assistant", "content": "```python\n" + prev + "\n```"})
        messages.append({"role": "user", "content": feedback})
    log_path = os.path.join(NOTES, f"{NAME}_rounds{args.tag}.json")
    rounds = []
    test_env = {"RES_X": "480", "RES_Y": "270", "SAMPLES": "8", "FRAME_LIST": "1,60,120,180"}
    for r in range(args.start_round, args.start_round + args.rounds):
        content, dt, usage, model = call_astra(messages, key)
        code = extract_code(content)
        sp = os.path.join(SCRIPTS, f"{NAME}_astra{args.tag}_r{r}.py")
        open(sp, "w").write(code)
        out_dir = os.path.join(BL, "renders", f"{NAME}_test{args.tag}_r{r}")
        rc, log, bdt = run_blender(sp, out_dir, test_env)
        open(os.path.join(out_dir, "blender.log"), "w").write(log)
        err = tail_error(log) if rc != 0 else ""
        rounds.append({"round": r, "model": model, "api_seconds": round(dt, 1), "usage": usage,
                       "script": sp, "blender_rc": rc, "blender_seconds": round(bdt, 1),
                       "error": err[:4000]})
        json.dump({"model": MODEL, "system": SYSTEM, "prompt": brief, "continue_from": args.continue_from,
                   "feedback_prompt": feedback, "rounds": rounds},
                  open(log_path, "w"), indent=2)
        print(f"round {r}: model={model} api={dt:.0f}s blender rc={rc} {bdt:.0f}s script={sp}")
        if rc == 0:
            print("SUCCESS")
            print("\n".join(log.splitlines()[-15:]))
            return
        print(err[-2500:])
        messages.append({"role": "assistant", "content": content})
        messages.append({"role": "user", "content":
                         "Running that script with `Blender -b --factory-startup -P script.py --python-exit-code 1` "
                         "in Blender 5.2.1 failed with this output:\n\n```\n" + err[-6000:] +
                         "\n```\nFix the cause (and any similar API issues elsewhere in the script) and reply with the "
                         "complete corrected script in one python code block."})
    print("FAILED after rounds")


if __name__ == "__main__":
    main()
