#!/usr/bin/env python3
"""Assemble assets/blender/notes/book_open.json from the Astra round logs and render results."""
import json, os, subprocess, sys

BL = "/Users/moorthy/Downloads/Projects/Naive hackathon/nightlight/assets/blender"
N = os.path.join(BL, "notes")
r1 = json.load(open(os.path.join(N, "book_open_rounds.json")))
r2 = json.load(open(os.path.join(N, "book_open_rounds_v2.json")))
render_seconds = int(sys.argv[1]) if len(sys.argv) > 1 else None


def probe(p):
    try:
        out = subprocess.check_output(["ffprobe", "-v", "error", "-show_entries",
                                       "format=duration:stream=width,height,r_frame_rate,nb_frames",
                                       "-of", "json", p])
        return json.loads(out)
    except Exception:
        return None


mp4 = os.path.join(BL, "book_open.mp4")
poster = os.path.join(BL, "book_open_poster.png")
notes = {
    "name": "book_open",
    "model": "gpt-6-astra",
    "endpoint": "https://api.openai.com/v1/chat/completions",
    "astra_rounds": len(r1["rounds"]) + len(r2["rounds"]),
    "rounds_summary": [
        {"round": 1, "kind": "initial brief", "api_seconds": r1["rounds"][0]["api_seconds"],
         "usage": r1["rounds"][0]["usage"], "blender_exit": r1["rounds"][0]["blender_rc"],
         "script": "scripts/book_open_astra_r1.py",
         "result": "ran first time in Blender 5.2.1; test frames looked good but grey/dim, glow too subtle, stiff page turn"},
        {"round": 2, "kind": "art-direction feedback (no traceback; script had no errors)",
         "api_seconds": r2["rounds"][0]["api_seconds"], "usage": r2["rounds"][0]["usage"],
         "blender_exit": r2["rounds"][0]["blender_rc"], "script": "scripts/book_open_astra_v2_r2.py",
         "result": "paper curl, stronger glow/bloom, more sparkles+stars, better framing; but over-exposed / pastel"},
    ],
    "hand_edits_after_astra": [
        "view exposure 0.55 -> 0.12 (Astra kept AgX + 'AgX - Medium High Contrast' look)",
        "paper self-emission 0.095 -> 0.05, world strength 0.60 -> 0.45, key area light 650 W -> 560 W",
        "DOF f-stop 2.0 -> 1.5 so the background props blur",
        "wood plank hex tones made warmer/richer honey (C8925E, B07A4A, DDAA72, BE8655, D6A26A)",
    ],
    "system_prompt": r1["system"],
    "astra_prompt_round1": r1["prompt"],
    "astra_prompt_round2_feedback": r2["feedback_prompt"],
    "final_script": "scripts/book_open_final.py",
    "driver": "scripts/astra_driver_book_open.py",
    "render_command": "scripts/render_book_open.sh scripts/book_open_final.py 16",
    "render_settings": {
        "engine": "BLENDER_EEVEE (Blender 5.2.1 LTS, Apple M3)", "resolution": "1600x900",
        "fps": 30, "frames": "1-200", "eevee_samples": 16,
        "color_management": "AgX, look 'AgX - Medium High Contrast', exposure 0.12",
        "compositor": "Render Layers -> Glare (BLOOM, threshold 1.0) -> Group Output (5.x compositing_node_group)",
        "dof": "camera dof on target empty, f/1.5, 50 mm",
        "encode": "ffmpeg -framerate 30 -c:v libx264 -pix_fmt yuv420p -crf 20 -preset slow -movflags +faststart",
    },
    "render_seconds": render_seconds,
    "outputs": {
        "book_open.mp4": {"bytes": os.path.getsize(mp4) if os.path.exists(mp4) else None, "probe": probe(mp4)},
        "book_open_poster.png": {"bytes": os.path.getsize(poster) if os.path.exists(poster) else None},
    },
}
json.dump(notes, open(os.path.join(N, "book_open.json"), "w"), indent=2)
print("wrote notes", notes["astra_rounds"], "rounds")
