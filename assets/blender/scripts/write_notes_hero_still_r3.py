"""Update notes/hero_still.json after the round-3 art-director revision.

usage: python3 write_notes_hero_still_r3.py <hero_seconds> <poster_seconds>
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
BL = os.path.dirname(HERE)
NOTES = os.path.join(BL, "notes", "hero_still.json")
CONV = os.path.join(BL, "notes", "hero_still_conversation.json")
FEEDBACK = os.path.join(BL, "notes", "hero_still_feedback_r3.txt")

hero_s, poster_s = int(sys.argv[1]), int(sys.argv[2])
d = json.load(open(NOTES))
conv = json.load(open(CONV))

# the r3 request attached the round-2 JPEG; point the log at its backup copy
for m in conv["messages"]:
    if isinstance(m["content"], list):
        for part in m["content"]:
            if part.get("type") == "image_url":
                part["image_url"]["url"] = "file://" + os.path.join(BL, "renders", "hero_still_r2", "hero_still.jpg")
json.dump(conv, open(CONV, "w"), indent=1)

d["astra_rounds"] = len(conv["rounds"])
d["rounds"] = conv["rounds"]
d["round_purposes"] = d["round_purposes"][:2] + [
    "3: art-director review of the round-2 final (washed out / greige on a stage screen: backdrop "
    "#DAD2C8, platform #CCC7C0, book pages clipped). Sent the round-2 JPEG as an image plus notes: "
    "Standard view transform for palette fidelity, sheen 0, full-saturation agents/rugs, sun 42 deg, "
    "lilac shadow fill, faces toward camera, readable book pages with a tiny house, 80-mote ribbon + "
    "8 star sparkles, glare threshold 1.0, camera fit locked to frame 48 so the poster matches the hero."
]
d["error_fix_rounds"] = 0
d["prompt_feedback_round3"] = open(FEEDBACK, encoding="utf-8").read()
d["prompt_feedback_round3_image"] = "renders/hero_still_r2/hero_still.jpg (round-2 final, sent inline as a data URI)"
d["manual_edits_after_astra"] = [
    "round 2: cyc.visible_shadow = False (the tall cyclorama shadowed the whole set from the low sun) - Astra kept it in round 3",
    "round 2: AgX exposure 0.6 -> 0.25 (superseded by round 3's Standard view transform)",
    "round 3: exposure 0.0 -> -0.9 (env override NL_EXPOSURE). At 0.0 Standard clipped the sunlit paper and "
    "backdrop to pure white; tested -1.4 (muddy tan #D5C3A5) and -1.0 (kraft #F1DDBA) at 800x420",
    "round 3: backdrop albedo F7E6C8 -> FBEFDC so it reads as cream paper instead of tan kraft",
]
d["script"] = "scripts/hero_still_scene.py"
d["script_astra_raw_round3"] = "scripts/hero_still_astra_r3.py (Astra's round-3 output before the two manual tweaks)"
d["script_previous_round2"] = "scripts/hero_still_scene_r2.py"
d["previous_outputs_round2"] = "renders/hero_still_r2/ (hero_still.png/.jpg, hero_still_poster.png, notes)"
d["caller"] = "scripts/astra_hero_still.py (modes: new, fix, art <feedback> [image])"
d["render"] = {
    "engine": "BLENDER_EEVEE (Blender 5.2.1 LTS, -b --factory-startup)",
    "view_transform": "Standard, look None, exposure -0.9, gamma 1.0",
    "compositor": "CompositorNodeGlare Fog Glow, High, threshold 1.0, strength 0.85, size 0.75",
    "lights": "sun 3.0 at 42 deg elevation from back-right, angle 6 deg; area fills 210 lilac / 140 warm / 100 cream; 220 W point light under the book",
    "dof": "f/2.4, 70 mm, focused on the book; camera auto-fit always computed at frame 48",
    "hero_still.png": {"res": "2400x1260", "samples": 32, "frame": 48, "render_seconds_wall": hero_s},
    "hero_still_poster.png": {"res": "1600x840", "samples": 32, "frame": 30, "render_seconds_wall": poster_s},
    "hero_still.jpg": "ffmpeg lanczos downscale of hero_still.png to 1600x840, -q:v 2",
    "test_frames": "800x420, 12 samples, exposures 0.0 / -1.4 / -1.0; ~130-500 s each wall time because two other "
                   "Blender renders (book_open, office_flythrough) were running on the same GPU",
}
d["env_vars"] = {"NL_OUT": "output png path", "NL_RES_X": 2400, "NL_RES_Y": 1260,
                 "NL_SAMPLES": 32, "NL_FRAME": 48, "NL_EXPOSURE": -0.9}
json.dump(d, open(NOTES, "w"), indent=1)
print("notes updated:", NOTES, "rounds", d["astra_rounds"])
