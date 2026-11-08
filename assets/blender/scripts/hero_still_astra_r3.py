import bpy
import math
import os
import random
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

# Nightlight Press — stage-screen colour revision.
# Example:
# NL_OUT=/absolute/path/nightlight.png blender -b --factory-startup -P script.py

OUT = os.environ.get("NL_OUT")
if not OUT:
    raise RuntimeError("NL_OUT must be a full output PNG path.")
OUT = os.path.abspath(OUT)
os.makedirs(os.path.dirname(OUT), exist_ok=True)

RES_X = int(os.environ.get("NL_RES_X", "2400"))
RES_Y = int(os.environ.get("NL_RES_Y", "1260"))
SAMPLES = max(1, min(32, int(os.environ.get("NL_SAMPLES", "32"))))
FRAME = int(os.environ.get("NL_FRAME", "48"))
random.seed(21)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

scene = bpy.context.scene
scene.frame_start = 1
scene.frame_end = 48
scene.render.fps = 24
try:
    scene.render.engine = 'BLENDER_EEVEE'
except TypeError:
    scene.render.engine = 'BLENDER_EEVEE_NEXT'

if hasattr(scene, "eevee"):
    if hasattr(scene.eevee, "taa_render_samples"):
        scene.eevee.taa_render_samples = SAMPLES
    if hasattr(scene.eevee, "use_shadows"):
        scene.eevee.use_shadows = True

scene.render.resolution_x = RES_X
scene.render.resolution_y = RES_Y
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGB'
scene.render.film_transparent = False
scene.render.filepath = OUT

scene.view_settings.view_transform = 'Standard'
scene.view_settings.look = 'None'
scene.view_settings.exposure = 0.0
scene.view_settings.gamma = 1.0

HEX = {
    "paper": "FFF8EC",
    "ink": "22223B",
    "tomato": "FF6B4A",
    "sun": "FFC233",
    "sky": "4DA8DA",
    "leaf": "3BB273",
    "lilac": "B8A1FF",
}


def linear_channel(v):
    return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4


def rgb(h):
    return tuple(linear_channel(int(h[i:i + 2], 16) / 255.0)
                 for i in (0, 2, 4))


def mix(a, b, weight_a):
    return tuple(a[i] * weight_a + b[i] * (1 - weight_a) for i in range(3))


COL = {key: rgb(value) for key, value in HEX.items()}


def material(name, color, roughness=0.66, emission=0.0,
             grain=False, emission_color=None):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bs = mat.node_tree.nodes.get("Principled BSDF")
    bs.inputs["Base Color"].default_value = (*color, 1)
    bs.inputs["Roughness"].default_value = roughness
    bs.inputs["Specular IOR Level"].default_value = 0.3
    bs.inputs["Sheen Weight"].default_value = 0.0
    if emission:
        bs.inputs["Emission Color"].default_value = (
            *(emission_color if emission_color is not None else color), 1)
        bs.inputs["Emission Strength"].default_value = emission
    if grain:
        noise = mat.node_tree.nodes.new("ShaderNodeTexNoise")
        noise.inputs["Scale"].default_value = 100
        noise.inputs["Detail"].default_value = 2
        bump = mat.node_tree.nodes.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = 0.04
        bump.inputs["Distance"].default_value = 0.015
        mat.node_tree.links.new(noise.outputs["Fac"], bump.inputs["Height"])
        mat.node_tree.links.new(bump.outputs["Normal"], bs.inputs["Normal"])
    mat.diffuse_color = (*color, 1)
    return mat


M = {key: material(key, color, grain=key != "ink")
     for key, color in COL.items()}
PALETTE = ["tomato", "sun", "sky", "leaf", "lilac"]

RUG = {
    key: material("85 percent palette paper / " + key,
                  mix(COL[key], COL["paper"], 0.85), grain=True)
    for key in PALETTE
}

# The broad surfaces have a small constant warm contribution, not white sheen.
# This keeps cream luminous without lifting the saturation of coloured objects.
M["backdrop"] = material(
    "Warm cream seamless backdrop", rgb("F7E6C8"), emission=0.30)
M["platform"] = material(
    "Warm sunlit platform paper", rgb("FFF3E0"), emission=0.22, grain=True)
M["head"] = material("Warm cream agent heads", rgb("F6EAD6"), grain=True)
M["wood"] = material("Honey paper accents", rgb("EBCB91"), grain=True)
M["desk_sun"] = material(
    "55 percent sunshine desktops",
    mix(COL["sun"], COL["paper"], 0.55), grain=True)
M["desk_lilac"] = material(
    "55 percent lilac desktops",
    mix(COL["lilac"], COL["paper"], 0.55), grain=True)
M["walkway"] = material(
    "Soft sky-blue paper walkway",
    mix(COL["sky"], COL["paper"], 0.44), grain=True)
M["page_edge"] = material("Ivory page edges", rgb("F4DCA9"), grain=True)
M["cheek"] = material("Tomato rosy cheeks", rgb("F28C7A"))

# Standard has no highlight shoulder. Keep broad emissive surfaces below white;
# the emission strength remains 1.6, but its colour is a radiance-budgeted tint.
# Tiny motes and the halo, not the full page faces, provide the overbright glow.
page_color = rgb("FFF2DC")
M["pages_glow"] = material(
    "Readable warm luminous pages", page_color,
    emission=1.6, emission_color=tuple(c * 0.14 for c in page_color))
M["screen"] = material(
    "Soft luminous sky-blue screens", COL["sky"], emission=1.5,
    emission_color=tuple(c * 0.30 for c in COL["sky"]))
M["spark_gold"] = material("Golden magical motes", COL["sun"], emission=30)
M["spark_white"] = material("Warm white magical motes", rgb("FFF1D9"), emission=22)
M["star"] = material("Four-point golden star highlights", COL["sun"], emission=40)
M["antenna"] = material("Twinkling yellow idea lights", COL["sun"], emission=4)
M["halo"] = material("Warm spine halo", rgb("FFD587"), emission=3)

world = bpy.data.worlds.new("Warm cream morning world")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (
    1.0, 0.94, 0.84, 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.6
scene.world = world


def finish(obj, name, mat, parent=None):
    obj.name = name
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj


def smooth(obj):
    for polygon in obj.data.polygons:
        polygon.use_smooth = True


def box(name, loc, dims, mat, bevel=0.09, parent=None, rotation=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.dimensions = dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    finish(obj, name, mat, parent)
    mod = obj.modifiers.new("Soft handmade corners", 'BEVEL')
    mod.width = min(bevel, min(dims) * 0.47)
    mod.segments = 4
    mod = obj.modifiers.new("Weighted paper normals", 'WEIGHTED_NORMAL')
    mod.keep_sharp = True
    if rotation:
        obj.rotation_euler = rotation
    return obj


def sphere(name, loc, scale, mat, parent=None, small=False):
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=12 if small else 20,
        ring_count=8 if small else 12,
        radius=1, location=loc)
    obj = bpy.context.object
    obj.scale = (scale, scale, scale) if isinstance(scale, (float, int)) else scale
    finish(obj, name, mat, parent)
    smooth(obj)
    return obj


def cylinder(name, loc, radius, depth, mat, parent=None, vertices=24):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices, radius=radius, depth=depth, location=loc)
    obj = bpy.context.object
    finish(obj, name, mat, parent)
    bevel = obj.modifiers.new("Rounded cylinder rims", 'BEVEL')
    bevel.width = min(0.055, depth * 0.22, radius * 0.25)
    bevel.segments = 3
    smooth(obj)
    obj.modifiers.new("Soft normals", 'WEIGHTED_NORMAL')
    return obj


def rod(name, a, b, radius, mat, parent=None):
    a, b = Vector(a), Vector(b)
    obj = cylinder(name, (a + b) * 0.5, radius, (b - a).length,
                   mat, parent, vertices=16)
    obj.rotation_euler = (b - a).to_track_quat('Z', 'Y').to_euler()
    return obj


def empty(name, loc=(0, 0, 0), parent=None):
    obj = bpy.data.objects.new(name, None)
    scene.collection.objects.link(obj)
    obj.location = loc
    obj.parent = parent
    return obj


def join_objects(objects, name):
    bpy.context.view_layer.update()
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = name
    return obj


# Thick paper platform, with clear sun and tomato edge bands.
box("Thin sunshine lower band", (0, 0, 0.16),
    (16.0, 10.0, 0.20), M["sun"], 0.09)
box("Clear tomato edge band", (0, 0, 0.32),
    (16.0, 10.0, 0.28), M["tomato"], 0.13)
box("Cream paper platform", (0, 0, 0.535),
    (15.98, 9.98, 0.42), M["platform"], 0.15)
box("Sky-blue paper central walkway", (0, -0.28, 0.762),
    (13.3, 1.06, 0.032), M["walkway"], 0.015)

# Infinite warm ground and curved cyclorama.
box("Backdrop ground", (0, 0, -0.16),
    (200, 200, 0.12), M["backdrop"], 0.02)

profile = [(12, -0.10)]
for i in range(1, 25):
    theta = math.pi * 0.5 * i / 24
    profile.append((
        12 + 10 * math.sin(theta),
        -0.10 + 10 * (1 - math.cos(theta))))
profile.append((22, 40))
verts = [(x, y, z) for y, z in profile for x in (-100, 100)]
faces = [(2 * i, 2 * i + 1, 2 * i + 3, 2 * i + 2)
         for i in range(len(profile) - 1)]
mesh = bpy.data.meshes.new("Cyclorama sweep mesh")
mesh.from_pydata(verts, [], faces)
mesh.update()
cyc = bpy.data.objects.new("Backdrop cyclorama", mesh)
scene.collection.objects.link(cyc)
cyc.data.materials.append(M["backdrop"])
smooth(cyc)
cyc.visible_shadow = False


def make_agent(index, x, y, color):
    # Enlarge about the platform plane, retaining the seated contact height.
    scale = 1.35
    root = empty("Agent %02d" % index,
                 (x + 0.17, y + 0.85, 0.75 * (1 - scale)))
    root.scale = (scale, scale, scale)
    root.rotation_euler.z = math.radians(20)

    sphere("Saturated felt capsule body", (0, 0, 1.38),
           (0.31, 0.27, 0.46), M[color], root)
    cylinder("Saturated rounded stool", (0, 0.06, 1.00),
             0.34, 0.17, M[color], root)

    head = empty("Curious warm cream head", (0, -0.015, 2.03), root)
    if index in (3, 8):
        head.rotation_euler = (
            math.radians(-9), math.radians(-13), math.radians(7))
    else:
        head.rotation_euler.z = math.radians(random.uniform(-3, 3))
    sphere("Warm cream round head", (0, 0, 0),
           (0.40, 0.365, 0.40), M["head"], head)

    face = []
    for side in (-1, 1):
        face.append(sphere(
            "Large ink dot eye", (side * 0.13, -0.344, 0.035),
            (0.0585, 0.030, 0.0754), M["ink"], head, True))
        face.append(sphere(
            "Tomato rosy cheek", (side * 0.245, -0.292, -0.085),
            (0.071, 0.023, 0.047), M["cheek"], head, True))
    join_objects(face, "Two large eyes and two rosy cheeks")

    rod("Saturated idea antenna", (0, 0, 0.35), (0.035, 0, 0.57),
        0.025, M[color], head)
    sphere("Yellow antenna light", (0.035, 0, 0.60),
           0.075, M["antenna"], head, True)

    arms = []
    for side in (-1, 1):
        hand = sphere(
            "Saturated working arm", (side * 0.28, -0.22, 1.36),
            (0.115, 0.24, 0.13), M[color], root)
        hand.rotation_euler.z = side * 0.3
        arms.append(hand)
    join_objects(arms, "Pair of saturated felt arms")


def make_desk(index, x, y):
    color = PALETTE[index % len(PALETTE)]
    cylinder("Colourful paper rug %02d" % index,
             (x, y + 0.25, 0.774), 0.99, 0.045,
             RUG[color], vertices=40)

    box("Palette-tinted desktop %02d" % index, (x, y, 1.46),
        (1.77, 1.13, 0.19),
        M["desk_lilac"] if index % 3 == 0 else M["desk_sun"], 0.09)

    legs = []
    for dx in (-0.68, 0.68):
        for dy in (-0.37, 0.37):
            legs.append(cylinder(
                "Desk leg", (x + dx, y + dy, 1.10),
                0.088, 0.61, M["paper"], vertices=16))
    join_objects(legs, "Four little desk legs %02d" % index)

    monitor = empty("Monitor assembly", (x - 0.35, y - 0.23, 1.57))
    monitor.rotation_euler.z = math.radians(-24)
    box("Monitor foot", (0, 0, 0.025), (0.40, 0.27, 0.06),
        M["ink"], 0.025, monitor)
    rod("Monitor neck", (0, 0, 0.02), (0, 0, 0.24),
        0.045, M["ink"], monitor)
    box("Ink rounded monitor frame", (0, 0, 0.42),
        (0.65, 0.105, 0.45), M["ink"], 0.05, monitor)
    box("Luminous sky-blue screen without writing", (0, 0.060, 0.42),
        (0.53, 0.025, 0.33), M["screen"], 0.012, monitor)

    papers = []
    for j in range(2):
        page = box(
            "Little manuscript stack",
            (x + 0.46, y - 0.12, 1.58 + j * 0.047),
            (0.43, 0.47, 0.042),
            M["paper"] if j else RUG[color], 0.017)
        page.rotation_euler.z = math.radians(7 if j else -5)
        papers.append(page)
    join_objects(papers, "Two-layer manuscript stack")
    make_agent(index, x, y, color)


for i in range(6):
    make_desk(i, -5.90 + 2.36 * i, 1.52)
for i in range(5):
    make_desk(i + 6, -4.72 + 2.36 * i, -1.90)


def plant(x, y, size=1):
    z = 0.745
    cylinder("Tomato plant pot", (x, y, z + 0.22 * size),
             0.29 * size, 0.44 * size, M["tomato"])
    cylinder("Thick pot lip", (x, y, z + 0.43 * size),
             0.32 * size, 0.09 * size, M["tomato"])
    rod("Plant stem", (x, y, z + 0.43 * size),
        (x, y, z + 1.08 * size), 0.045 * size, M["leaf"])

    foliage = []
    for dx, dy, dz, s in [
        (-0.20, 0, 0.86, 0.30),
        (0.20, 0.04, 0.98, 0.32),
        (0, 0.03, 1.23, 0.31),
    ]:
        foliage.append(sphere(
            "Rounded felt foliage",
            (x + dx * size, y + dy * size, z + dz * size),
            (s * size, s * 0.82 * size, s * 1.10 * size), M["leaf"]))
    join_objects(foliage, "Cluster of rounded green foliage")


plant(-7.12, 3.77, 1.05)
plant(7.00, 3.78, 0.95)
plant(6.85, -3.75, 0.85)
plant(-4.80, -4.18, 0.68)

shelf = empty("Small publishing library", (-7.02, -1.0, 0.75))
for x in (-0.49, 0.49):
    box("Bookcase side", (x, 0, 0.74), (0.14, 0.68, 1.48),
        M["tomato"], 0.06, shelf)
box("Bookcase back", (0, 0.28, 0.74), (0.97, 0.10, 1.47),
    RUG["tomato"], 0.045, shelf)
for z in (0.08, 0.73, 1.43):
    box("Thick bookcase shelf", (0, 0, z), (1.10, 0.74, 0.13),
        M["desk_sun"], 0.055, shelf)
for row, z in enumerate((0.40, 1.06)):
    for j in range(4):
        book = box(
            "Chunky colourful library book",
            (-0.32 + j * 0.21, -0.06, z),
            (0.16, 0.44, 0.43 + 0.05 * ((j + row) % 2)),
            M[PALETTE[(j + row) % 5]], 0.045, shelf)
        book.rotation_euler.y = math.radians((j - 1.5) * 4)

press = empty("Friendly little printing press", (6.92, -0.85, 0.75))
box("Press foot", (0, 0, 0.16), (1.18, 1.17, 0.30),
    M["sky"], 0.13, press)
box("Press cabinet", (0, 0.10, 0.53), (0.93, 0.79, 0.54),
    RUG["sky"], 0.12, press)
for x in (-0.44, 0.44):
    box("Press roller support", (x, 0, 0.99), (0.16, 0.53, 0.72),
        M["tomato"], 0.07, press)
for z in (0.90, 1.19):
    rod("Big rounded print roller", (-0.44, -0.13, z), (0.44, -0.13, z),
        0.14, M["ink"] if z < 1 else M["wood"], press)
box("Paper feed tray", (0, -0.49, 0.78), (0.79, 0.83, 0.09),
    M["desk_sun"], 0.04, press)
box("Fresh sheet from press", (0, -0.61, 0.85), (0.64, 0.67, 0.045),
    M["paper"], 0.02, press)
sphere("Press control button", (0.49, -0.18, 0.59),
       0.085, M["sun"], press, True)


def cloud(x, y, z, size):
    rod("Thin cloud stick", (x, y, 0.76), (x, y, z),
        0.025, M["wood"])
    parts = []
    for dx, dz, radius in [
        (-0.43, -0.02, 0.29), (-0.12, 0.13, 0.38),
        (0.22, 0.06, 0.34), (0.48, -0.05, 0.24),
    ]:
        parts.append(sphere(
            "Cloud paper lobe",
            (x + dx * size, y, z + dz * size),
            (radius * size, 0.10, radius * size * 0.78), M["paper"]))
    join_objects(parts, "Soft scalloped paper cloud")


cloud(-3.65, 4.13, 3.15, 1.05)
cloud(4.75, 4.13, 3.30, 0.90)
rod("Thin sun stick", (0.4, 4.20, 0.75), (0.4, 4.20, 3.41),
    0.027, M["wood"])
sun_disc = cylinder(
    "Small paper theatre sun", (0.4, 4.20, 3.55),
    0.47, 0.12, M["sun"], vertices=48)
sun_disc.rotation_euler.x = math.radians(90)

# Open flying picture book.
book_root = empty("HERO — flying picture book")
book_root.scale = (1.6, 1.6, 1.6)

for side in (-1, 1):
    wing = empty(
        "Left page wing" if side < 0 else "Right page wing",
        parent=book_root)
    wing.rotation_euler.y = math.radians(-side * 18)

    # Covers intentionally extend beyond the pages on all sides.
    box("Visible tomato hard cover", (side * 0.71, 0, -0.015),
        (1.49, 1.97, 0.16), M["tomato"], 0.065, wing)
    box("Thick ivory page block", (side * 0.70, 0, 0.105),
        (1.32, 1.75, 0.13), M["page_edge"], 0.05, wing)
    box("Readable glowing open page", (side * 0.70, 0, 0.185),
        (1.29, 1.72, 0.075), M["pages_glow"], 0.035, wing)

    # Page surface is z=.2225; picture bottoms begin at least .01 above it.
    sphere("Picture book sun", (side * 0.78, 0.46, 0.251),
           (0.18, 0.18, 0.018), M["sun"], wing)
    sphere("Picture book lilac hill", (side * 0.77, -0.29, 0.251),
           (0.43, 0.25, 0.018), M["lilac"], wing)
    sphere("Picture book green hill", (side * 0.67, -0.45, 0.285),
           (0.46, 0.20, 0.018), M["leaf"], wing)

    if side == 1:
        box("Tiny tomato picture house", (0.67, -0.015, 0.265),
            (0.29, 0.31, 0.042), M["tomato"], 0.018, wing)
        # A bevelled diamond roof reads as a soft, cut-paper pitched roof.
        roof = box("Tiny tomato picture roof", (0.67, 0.145, 0.296),
                   (0.28, 0.28, 0.035), M["tomato"], 0.015, wing)
        roof.rotation_euler.z = math.radians(45)
        box("Tiny ink house door", (0.67, -0.075, 0.301),
            (0.085, 0.16, 0.025), M["ink"], 0.011, wing)

box("Soft red book spine", (0, 0, 0.03), (0.15, 1.96, 0.18),
    M["tomato"], 0.07, book_root)

# Thin open halo rather than an opaque glowing plate over the pictures.
bpy.ops.mesh.primitive_torus_add(
    major_segments=48, minor_segments=8,
    major_radius=0.77, minor_radius=0.025,
    location=(0, 0.05, -0.115))
halo = finish(bpy.context.object, "Thin golden halo behind book spine",
              M["halo"], book_root)
halo.scale = (0.68, 1.50, 0.45)
smooth(halo)
halo.visible_shadow = False

for frame, position, rotation in [
    (1, (2.15, -1.90, 2.10), (18, -10, -21)),
    (24, (2.85, -0.92, 4.40), (26, 0, -7)),
    (48, (2.15, 0.10, 5.70), (20, -5, -14)),
]:
    book_root.location = position
    book_root.rotation_euler = tuple(math.radians(a) for a in rotation)
    book_root.keyframe_insert(data_path="location", frame=frame)
    book_root.keyframe_insert(data_path="rotation_euler", frame=frame)

focus = empty("Book focus", (0, 0, 0.12), book_root)


def light(name, typ, loc, energy, color, size=5, target=None, parent=None):
    data = bpy.data.lights.new(name, typ)
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    obj.location = loc
    obj.parent = parent
    data.energy = energy
    data.color = color
    data.use_shadow = True
    if typ == 'AREA':
        data.shape = 'DISK'
        data.size = size
    if typ == 'POINT':
        data.shadow_soft_size = size
    if target is not None:
        obj.rotation_euler = (
            Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()
    return obj


# Below the covers: casts golden light downward without bleaching the pictures.
light("Golden light spilling beneath book", 'POINT', (0, 0, -0.27),
      220, (1.0, 0.72, 0.39), 0.75, parent=book_root)


def bezier(t, a, b, c, d):
    return (
        (1 - t) ** 3 * Vector(a) +
        3 * (1 - t) ** 2 * t * Vector(b) +
        3 * (1 - t) * t * t * Vector(c) +
        t ** 3 * Vector(d)
    )


def animate_mote(obj, p, phase, amplitude=1.0):
    p = Vector(p)
    for frame in (1, 24, 48):
        a = phase + frame * 0.09
        obj.location = p + amplitude * Vector((
            0.06 * math.sin(a),
            0.06 * math.cos(a),
            0.10 * math.sin(a + 1)))
        obj.keyframe_insert(data_path="location", frame=frame)


# A broader, gently braided ribbon of eighty motes.
for i in range(80):
    t = i / 79
    p = bezier(
        t, (0.20, -1.85, 1.78), (4.50, -2.35, 2.40),
        (5.00, -0.55, 5.00), (2.20, 0.08, 5.65))
    phase = t * math.tau * 3.2
    ribbon_width = 0.12 + 0.10 * math.sin(math.pi * t)
    p += Vector((
        ribbon_width * math.sin(phase) + random.uniform(-0.07, 0.07),
        ribbon_width * math.cos(phase) + random.uniform(-0.07, 0.07),
        random.uniform(-0.10, 0.10)))
    obj = sphere(
        "Magic ribbon mote %02d" % i, p, random.uniform(0.05, 0.11),
        M["spark_gold" if i % 3 else "spark_white"], small=True)
    obj.visible_shadow = False
    animate_mote(obj, p, i * 0.72)

for i in range(24):
    angle = random.uniform(0, math.tau)
    radius = random.uniform(1.25, 2.25)
    p = Vector((
        2.30 + math.cos(angle) * radius,
        0.10 + math.sin(angle) * radius * 0.64,
        random.uniform(4.75, 6.75)))
    obj = sphere(
        "Floating book dust %02d" % i, p, random.uniform(0.045, 0.075),
        M["spark_white" if i % 2 else "spark_gold"], small=True)
    obj.visible_shadow = False
    animate_mote(obj, p, angle, 1.2)

# Eight four-point star glints, in planes facing the camera.
camera_direction = Vector((10.5, -15.0, 21.1)).normalized()
star_rotation = camera_direction.to_track_quat('Y', 'Z').to_euler()
star_positions = [
    (0.35, -0.10, 6.25),
    (1.05, 0.75, 6.65),
    (2.90, 0.75, 6.80),
    (4.25, 0.10, 6.25),
    (4.65, -0.45, 5.35),
    (3.70, -1.05, 4.75),
    (1.30, -0.80, 5.10),
    (3.25, 0.95, 5.55),
]
for i, position in enumerate(star_positions):
    star = empty("Animated four-point star %02d" % i, position)
    star.rotation_euler = star_rotation
    size = random.uniform(0.72, 1.05)
    star.scale = (size, size, size)
    parts = [
        sphere("Star horizontal ray", (0, 0, 0),
               (0.32, 0.03, 0.03), M["star"], star, True),
        sphere("Star vertical ray", (0, 0, 0),
               (0.03, 0.03, 0.32), M["star"], star, True),
    ]
    shape = join_objects(parts, "Crossed golden star rays")
    shape.visible_shadow = False
    animate_mote(star, position, i * 0.9, 0.8)
    for frame, multiplier in ((1, 0.82), (24, 1.06), (48, 1.0)):
        star.scale = (size * multiplier,) * 3
        star.keyframe_insert(data_path="scale", frame=frame)

# Standard-display lighting budget: much lower than the former 5.5 AgX key.
# A less orange key protects blue/lilac fidelity; warmth comes from paper,
# the backdrop, the world and the book instead of a heavily yellow illuminant.
sun_elevation = math.radians(42)
sun_horizontal = 16.0
sun_position = (
    sun_horizontal * 0.72,
    sun_horizontal * math.sqrt(1 - 0.72 ** 2),
    sun_horizontal * math.tan(sun_elevation),
)
sun = light(
    "Dominant 42-degree morning sun", 'SUN', sun_position,
    3.0, (1.0, 0.96, 0.90), target=(0, 0, 0))
sun.data.angle = math.radians(6)

light("Soft lilac sky fill", 'AREA', (-9, -5, 13),
      210, (0.80, 0.78, 1.0), 10, target=(0, 0, 1))
light("Restrained warm front bounce", 'AREA', (3, -10, 8),
      140, (1.0, 0.93, 0.84), 9, target=(0, 0, 1))
light("Soft cream ceiling fill", 'AREA', (0, 5, 13),
      100, (1.0, 0.97, 0.91), 8, target=(0, 0, 0))

# Three-quarter camera: preserve the composition and book-focused miniature DOF.
cam_data = bpy.data.cameras.new("Nightlight key art camera")
cam = bpy.data.objects.new("Nightlight key art camera", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam
cam_data.type = 'PERSP'
cam_data.lens = 70
cam_data.sensor_width = 36
cam_data.sensor_fit = 'HORIZONTAL'
cam_data.clip_end = 300
cam_data.dof.use_dof = True
cam_data.dof.focus_object = focus
cam_data.dof.aperture_fstop = 2.4
cam_data.dof.aperture_blades = 7

# ALWAYS fit the hero pose. NL_FRAME changes the animation, never the framing.
scene.frame_set(48)
bpy.context.view_layer.update()

points = []
for obj in scene.objects:
    if obj.type == 'MESH' and not obj.name.startswith("Backdrop"):
        points.extend(obj.matrix_world @ Vector(corner)
                      for corner in obj.bound_box)

target = Vector((0, 0, 2.0))
direction = camera_direction


def place_camera(distance):
    cam.location = target + direction * distance
    cam.rotation_euler = (
        target - cam.location).to_track_quat('-Z', 'Y').to_euler()
    bpy.context.view_layer.update()


def camera_bounds():
    projected = [world_to_camera_view(scene, cam, point) for point in points]
    return (
        min(point.x for point in projected),
        max(point.x for point in projected),
        min(point.y for point in projected),
        max(point.y for point in projected),
    )


# Fit inside the 70% x 90% envelope; retain every prop and sparkle.
distance = 40.0
for _ in range(16):
    place_camera(distance)
    xmin, xmax, ymin, ymax = camera_bounds()
    ratio = max((xmax - xmin) / 0.70, (ymax - ymin) / 0.90)
    if abs(ratio - 1) < 0.001:
        break
    distance *= ratio

xmin, xmax, ymin, ymax = camera_bounds()
width = xmax - xmin
height = ymax - ymin
desired_cx = 0.97 - width / 2
desired_cy = 0.03 + height / 2
cam_data.shift_x = (xmin + xmax) / 2 - desired_cx
cam_data.shift_y = ((ymin + ymax) / 2 - desired_cy) / (RES_X / RES_Y)
bpy.context.view_layer.update()

# Blender 5.x compositor: standalone group, group output and socket-based glare.
ng = bpy.data.node_groups.new("NL_Comp", "CompositorNodeTree")
ng.interface.new_socket(
    name="Image", in_out='OUTPUT', socket_type='NodeSocketColor')

rl = ng.nodes.new("CompositorNodeRLayers")
rl.location = (-280, 0)
glare = ng.nodes.new("CompositorNodeGlare")
glare.location = (-40, 0)
try:
    glare.inputs["Type"].default_value = 'Fog Glow'
except (TypeError, ValueError):
    glare.inputs["Type"].default_value = 'Bloom'
glare.inputs["Quality"].default_value = 'High'
glare.inputs["Threshold"].default_value = 1.0
glare.inputs["Strength"].default_value = 0.85
glare.inputs["Size"].default_value = 0.75

output = ng.nodes.new("NodeGroupOutput")
output.location = (200, 0)
ng.links.new(rl.outputs["Image"], glare.inputs["Image"])
ng.links.new(glare.outputs["Image"], output.inputs["Image"])
scene.compositing_node_group = ng

# Render the requested animation frame using the fixed frame-48 composition.
scene.frame_set(FRAME)
bpy.context.view_layer.update()
mesh_count = sum(obj.type == 'MESH' for obj in scene.objects)
bpy.ops.render.render(write_still=True)

print(
    "Nightlight Press: Standard colour revision; frame %d, %dx%d, "
    "%d samples, %d meshes / %d objects; framing locked to frame 48 -> %s"
    % (FRAME, RES_X, RES_Y, SAMPLES, mesh_count, len(scene.objects), OUT)
)
