import bpy
import math
import os
import random
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

# Nightlight Press — a sunny, wordless miniature publishing office.
# Run: NL_OUT=/absolute/path/nightlight.png blender -b --factory-startup -P script.py

OUT = os.environ.get("NL_OUT")
if not OUT:
    raise RuntimeError("NL_OUT must be a full output PNG path.")
OUT = os.path.abspath(OUT)
os.makedirs(os.path.dirname(OUT), exist_ok=True)

RES_X = int(os.environ.get("NL_RES_X", "2400"))
RES_Y = int(os.environ.get("NL_RES_Y", "1260"))
SAMPLES = int(os.environ.get("NL_SAMPLES", "32"))
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

scene.view_settings.view_transform = 'AgX'
try:
    scene.view_settings.look = 'AgX - Punchy'
except TypeError:
    try:
        scene.view_settings.look = 'AgX - Base Contrast'
    except TypeError:
        pass
scene.view_settings.exposure = 0.25  # [manual tweak] 0.6 clipped the paper once the sun reached the set

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


COL = {key: rgb(value) for key, value in HEX.items()}


def mix(a, b, weight_a):
    return tuple(a[i] * weight_a + b[i] * (1 - weight_a) for i in range(3))


def material(name, color, roughness=0.76, emission=0.0, grain=False):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bs = mat.node_tree.nodes.get("Principled BSDF")
    bs.inputs["Base Color"].default_value = (*color, 1)
    bs.inputs["Roughness"].default_value = roughness
    bs.inputs["Specular IOR Level"].default_value = 0.20
    bs.inputs["Sheen Weight"].default_value = 0.23
    if emission:
        bs.inputs["Emission Color"].default_value = (*color, 1)
        bs.inputs["Emission Strength"].default_value = emission
    if grain:
        noise = mat.node_tree.nodes.new("ShaderNodeTexNoise")
        noise.inputs["Scale"].default_value = 100
        noise.inputs["Detail"].default_value = 2
        bump = mat.node_tree.nodes.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = 0.045
        bump.inputs["Distance"].default_value = 0.018
        mat.node_tree.links.new(noise.outputs["Fac"], bump.inputs["Height"])
        mat.node_tree.links.new(bump.outputs["Normal"], bs.inputs["Normal"])
    mat.diffuse_color = (*color, 1)
    return mat


M = {key: material(key, color, grain=key != "ink") for key, color in COL.items()}
PALETTE = ["tomato", "sun", "sky", "leaf", "lilac"]
PASTEL = {
    key: material("Colourful pastel paper / " + key,
                  mix(COL[key], COL["paper"], 0.65), grain=True)
    for key in PALETTE
}

M["backdrop"] = material("Warm cream seamless backdrop", rgb("FFF1DC"))
M["wood"] = material("Honey paper accents", rgb("EBCB91"), grain=True)
M["desk_sun"] = material("Light sunshine paper desktops",
                         mix(COL["sun"], COL["paper"], 0.28), grain=True)
M["desk_lilac"] = material("Light lilac paper desktops",
                           mix(COL["lilac"], COL["paper"], 0.32), grain=True)
M["walkway"] = material("Soft sky-blue paper walkway",
                        mix(COL["sky"], COL["paper"], 0.38), grain=True)
M["page_edge"] = material("Ivory page edges", rgb("F4DCA9"), grain=True)
M["cheek"] = material("Rosy clay cheek", rgb("F09F91"))
M["screen"] = material("Softly luminous sky-blue screen", COL["sky"], emission=1.5)
M["pages_glow"] = material("Warm white luminous pages", rgb("FFF2DC"), emission=8)
M["spark_gold"] = material("Golden magical motes", COL["sun"], emission=26)
M["spark_white"] = material("Warm white magical motes", COL["paper"], emission=20)
M["antenna"] = material("Little idea lights", COL["sun"], emission=2.7)

world = bpy.data.worlds.new("Sunny cream morning")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (1.0, 0.96, 0.90, 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.9
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
    # Update parenting transforms before combining small decorative components.
    bpy.context.view_layer.update()
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = name
    return obj


# Three layers of thick, softly rounded paper.
box("Thin sunshine lower band", (0, 0, 0.16),
    (16.0, 10.0, 0.20), M["sun"], 0.09)
box("Clear tomato edge band", (0, 0, 0.32),
    (16.0, 10.0, 0.28), M["tomato"], 0.13)
box("Cream paper platform", (0, 0, 0.535),
    (15.98, 9.98, 0.42), M["paper"], 0.15)
box("Sky-blue paper central walkway", (0, -0.28, 0.762),
    (13.3, 1.06, 0.032), M["walkway"], 0.015)

# Infinite warm paper ground and curved cyclorama.
box("Backdrop ground", (0, 0, -0.16),
    (200, 200, 0.12), M["backdrop"], 0.02)

profile = [(12, -0.10)]
for i in range(1, 25):
    theta = math.pi * 0.5 * i / 24
    profile.append((12 + 10 * math.sin(theta),
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
# [manual fix] the 40-unit sweep sits between the low back-right sun and the
# diorama and was shadowing the whole set; let sunlight pass through it.
cyc.visible_shadow = False


def make_agent(index, x, y, color):
    # Enlarge around the platform plane, not the world origin: no floating feet.
    scale = 1.35
    root = empty("Agent %02d" % index,
                 (x + 0.17, y + 0.85, 0.75 * (1 - scale)))
    root.scale = (scale, scale, scale)

    sphere("Saturated felt capsule body", (0, 0, 1.38),
           (0.31, 0.27, 0.46), M[color], root)
    cylinder("Low rounded stool", (0, 0.06, 1.00),
             0.34, 0.17, PASTEL[color], root)

    head = empty("Curious cream head", (0, -0.015, 2.03), root)
    if index in (3, 8):
        head.rotation_euler = (
            math.radians(-9), math.radians(-13), math.radians(13))
    else:
        head.rotation_euler.z = math.radians(random.uniform(-9, 9))
    sphere("Cream round head", (0, 0, 0),
           (0.40, 0.365, 0.40), M["paper"], head)

    face = []
    for side in (-1, 1):
        face.append(sphere("Ink dot eye", (side * 0.13, -0.344, 0.035),
                           (0.045, 0.023, 0.058), M["ink"], head, True))
    face.append(sphere("Rosy cheek", (0.245, -0.292, -0.075),
                       (0.066, 0.018, 0.041), M["cheek"], head, True))
    join_objects(face, "Two ink eyes and rosy cheek")

    rod("Idea antenna", (0, 0, 0.35), (0.035, 0, 0.57),
        0.025, M[color], head)
    sphere("Antenna light", (0.035, 0, 0.60),
           0.075, M["antenna"], head, True)

    arms = []
    for side in (-1, 1):
        hand = sphere("Soft working arm", (side * 0.28, -0.22, 1.36),
                      (0.115, 0.24, 0.13), M[color], root)
        hand.rotation_euler.z = side * 0.3
        arms.append(hand)
    join_objects(arms, "Pair of saturated felt arms")


def make_desk(index, x, y):
    color = PALETTE[index % len(PALETTE)]
    cylinder("Colourful round paper rug %02d" % index,
             (x, y + 0.25, 0.774), 0.99, 0.045,
             PASTEL[color], vertices=40)

    box("Rounded sunshine desktop %02d" % index, (x, y, 1.46),
        (1.77, 1.13, 0.19),
        M["desk_lilac"] if index % 3 == 0 else M["desk_sun"], 0.09)

    legs = []
    for dx in (-0.68, 0.68):
        for dy in (-0.37, 0.37):
            legs.append(cylinder("Desk leg", (x + dx, y + dy, 1.10),
                                 0.088, 0.61, M["paper"], vertices=16))
    join_objects(legs, "Four little desk legs %02d" % index)

    # The screens look toward their operators; the ink silhouettes remain legible.
    monitor = empty("Monitor assembly", (x - 0.35, y - 0.23, 1.57))
    monitor.rotation_euler.z = math.radians(-24)
    box("Monitor foot", (0, 0, 0.025), (0.40, 0.27, 0.06),
        M["ink"], 0.025, monitor)
    rod("Monitor neck", (0, 0, 0.02), (0, 0, 0.24),
        0.045, M["ink"], monitor)
    box("Ink-coloured rounded monitor frame", (0, 0, 0.42),
        (0.65, 0.105, 0.45), M["ink"], 0.05, monitor)
    box("Luminous sky-blue screen without writing", (0, 0.060, 0.42),
        (0.53, 0.025, 0.33), M["screen"], 0.012, monitor)

    papers = []
    for j in range(2):
        page = box("Little manuscript stack",
                   (x + 0.46, y - 0.12, 1.58 + j * 0.047),
                   (0.43, 0.47, 0.042),
                   M["paper"] if j else PASTEL[color], 0.017)
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

# Small colourful library at the left end.
shelf = empty("Small publishing library", (-7.02, -1.0, 0.75))
for x in (-0.49, 0.49):
    box("Bookcase side", (x, 0, 0.74), (0.14, 0.68, 1.48),
        M["tomato"], 0.06, shelf)
box("Bookcase back", (0, 0.28, 0.74), (0.97, 0.10, 1.47),
    PASTEL["tomato"], 0.045, shelf)
for z in (0.08, 0.73, 1.43):
    box("Thick bookcase shelf", (0, 0, z), (1.10, 0.74, 0.13),
        M["desk_sun"], 0.055, shelf)
for row, z in enumerate((0.40, 1.06)):
    for j in range(4):
        book = box("Chunky colourful library book",
                   (-0.32 + j * 0.21, -0.06, z),
                   (0.16, 0.44, 0.43 + 0.05 * ((j + row) % 2)),
                   M[PALETTE[(j + row) % 5]], 0.045, shelf)
        book.rotation_euler.y = math.radians((j - 1.5) * 4)

# Friendly toy printing press at the right end.
press = empty("Friendly little printing press", (6.92, -0.85, 0.75))
box("Press foot", (0, 0, 0.16), (1.18, 1.17, 0.30), M["sky"], 0.13, press)
box("Press cabinet", (0, 0.10, 0.53), (0.93, 0.79, 0.54),
    PASTEL["sky"], 0.12, press)
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
    rod("Thin cloud stick", (x, y, 0.76), (x, y, z), 0.025, M["wood"])
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
sun_disc = cylinder("Small paper theatre sun", (0.4, 4.20, 3.55),
                    0.47, 0.12, M["sun"], vertices=48)
sun_disc.rotation_euler.x = math.radians(90)

# Larger luminous hero book, with wordless cut-paper pictures.
book_root = empty("HERO — flying picture book")
book_root.scale = (1.4, 1.4, 1.4)
for side in (-1, 1):
    wing = empty("Left page wing" if side < 0 else "Right page wing",
                 parent=book_root)
    wing.rotation_euler.y = math.radians(-side * 18)
    box("Tomato hard cover", (side * 0.70, 0, 0),
        (1.45, 1.90, 0.13), M["tomato"], 0.06, wing)
    box("Thick ivory page block", (side * 0.70, 0, 0.105),
        (1.32, 1.75, 0.13), M["page_edge"], 0.05, wing)
    box("Glowing open page", (side * 0.70, 0, 0.185),
        (1.29, 1.72, 0.075), M["pages_glow"], 0.035, wing)
    sphere("Picture book sun", (side * 0.73, 0.38, 0.234),
           (0.19, 0.19, 0.018), M["sun"], wing)
    sphere("Picture book lilac hill", (side * 0.77, -0.28, 0.238),
           (0.43, 0.25, 0.018), M["lilac"], wing)
    sphere("Picture book green hill", (side * 0.67, -0.43, 0.260),
           (0.46, 0.20, 0.018), M["leaf"], wing)
box("Soft red book spine", (0, 0, 0.03), (0.15, 1.88, 0.18),
    M["tomato"], 0.07, book_root)

for frame, position, rotation in [
    (1, (2.15, -1.90, 2.10), (8, -13, -21)),
    (24, (2.85, -0.92, 4.40), (16, -3, -7)),
    (48, (2.15, 0.10, 5.70), (10, -8, -14)),
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


light("Golden light spilling from book", 'POINT', (0, 0, -0.20),
      160, (1.0, 0.69, 0.35), 0.8, parent=book_root)


def bezier(t, a, b, c, d):
    return (
        (1 - t) ** 3 * Vector(a) +
        3 * (1 - t) ** 2 * t * Vector(b) +
        3 * (1 - t) * t * t * Vector(c) +
        t ** 3 * Vector(d)
    )


# Bigger, brighter motes form a gently spiralling ribbon; all stay on the right.
for i in range(54):
    t = i / 53
    p = bezier(t, (0.20, -1.85, 1.78), (4.50, -2.35, 2.40),
               (5.00, -0.55, 5.00), (2.20, 0.08, 5.65))
    phase = t * math.tau * 2.5
    p += Vector((
        0.10 * math.sin(phase) + random.uniform(-0.055, 0.055),
        0.13 * math.cos(phase) + random.uniform(-0.055, 0.055),
        random.uniform(-0.07, 0.07)))
    obj = sphere("Arc sparkle %02d" % i, p, random.uniform(0.045, 0.090),
                 M["spark_gold" if i % 3 else "spark_white"], small=True)
    for frame in (1, 24, 48):
        phase = i * 0.72 + frame * 0.09
        obj.location = p + Vector((
            0.05 * math.sin(phase),
            0.04 * math.cos(phase),
            0.075 * math.sin(phase + 1)))
        obj.keyframe_insert(data_path="location", frame=frame)

for i in range(24):
    angle = random.uniform(0, math.tau)
    radius = random.uniform(1.20, 2.25)
    p = Vector((
        2.30 + math.cos(angle) * radius,
        0.10 + math.sin(angle) * radius * 0.64,
        random.uniform(4.75, 6.75)))
    obj = sphere("Floating book dust %02d" % i, p, random.uniform(0.045, 0.075),
                 M["spark_white" if i % 2 else "spark_gold"], small=True)
    for frame in (1, 24, 48):
        phase = angle + frame * 0.075
        obj.location = p + Vector((
            0.09 * math.sin(phase), 0.07 * math.cos(phase),
            0.12 * math.sin(phase + 0.8)))
        obj.keyframe_insert(data_path="location", frame=frame)

# Dominant low back-right sunlight: elevation 33 degrees, shadows front-left.
sun_elevation = math.radians(33)
sun_horizontal = 16.0
sun_position = (
    sun_horizontal * 0.72,
    sun_horizontal * math.sqrt(1 - 0.72 ** 2),
    sun_horizontal * math.tan(sun_elevation),
)
sun = light("Dominant low golden morning sun", 'SUN', sun_position,
            5.5, (1.0, 0.84, 0.62), target=(0, 0, 0))
sun.data.angle = math.radians(6)

# Half-strength broad fills preserve the long, readable cast shadows.
light("Subtle lilac-blue sky fill", 'AREA', (-9, -5, 13),
      300, (0.88, 0.92, 1.0), 10, target=(0, 0, 1))
light("Warm front paper bounce", 'AREA', (3, -10, 8),
      240, (1.0, 0.88, 0.73), 9, target=(0, 0, 1))
light("Soft cream ceiling fill", 'AREA', (0, 5, 13),
      175, (1.0, 0.96, 0.87), 8, target=(0, 0, 0))

# Three-quarter miniature camera with automatic fit and optical shift.
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

scene.frame_set(FRAME)
bpy.context.view_layer.update()

points = []
for obj in scene.objects:
    if obj.type == 'MESH' and not obj.name.startswith("Backdrop"):
        points.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)

target = Vector((0, 0, 2.0))
direction = Vector((10.5, -15.0, 21.1)).normalized()


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


# Fit to the larger 70% x 90% composition envelope without cropping.
# Its unequal screen aspect means one dimension will be the limiting constraint.
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

# Blender 5.x compositor API: standalone node group and socket-based glare.
ng = bpy.data.node_groups.new("NL_Comp", "CompositorNodeTree")
ng.interface.new_socket(name="Image", in_out='OUTPUT', socket_type='NodeSocketColor')

rl = ng.nodes.new("CompositorNodeRLayers")
rl.location = (-280, 0)
glare = ng.nodes.new("CompositorNodeGlare")
glare.location = (-40, 0)
try:
    glare.inputs["Type"].default_value = 'Fog Glow'
except (TypeError, ValueError):
    glare.inputs["Type"].default_value = 'Bloom'
glare.inputs["Quality"].default_value = 'High'
glare.inputs["Threshold"].default_value = 0.8
glare.inputs["Strength"].default_value = 0.9
glare.inputs["Size"].default_value = 0.7

output = ng.nodes.new("NodeGroupOutput")
output.location = (200, 0)
ng.links.new(rl.outputs["Image"], glare.inputs["Image"])
ng.links.new(glare.outputs["Image"], output.inputs["Image"])
scene.compositing_node_group = ng

scene.frame_set(FRAME)
mesh_count = sum(obj.type == 'MESH' for obj in scene.objects)
bpy.ops.render.render(write_still=True)

print(
    "Nightlight Press: sunny revision; frame %d, %dx%d, %d samples, "
    "%d meshes / %d objects -> %s"
    % (FRAME, RES_X, RES_Y, SAMPLES, mesh_count, len(scene.objects), OUT)
)
