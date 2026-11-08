import bpy
import math
import os
import random
import sys
import time
import traceback
from mathutils import Vector

# Nightlight Press — office_flythrough
# Procedural clay-and-paper diorama, with all animation baked to keyframes.
FLOOR_Z = 0.56
BOOK_SCALE = 1.7
MATS = {}
SPHERE_MESHES = {}

PALETTE = {
    "paper": "FFF8EC",
    "ink": "22223B",
    "tomato": "FF6B4A",
    "sun": "FFC233",
    "sky": "4DA8DA",
    "leaf": "3BB273",
    "lilac": "B8A1FF",
    "honey": "D9A066",
    "wood_dark": "C08552",
    "terracotta": "E07A4F",
    "white": "FFFFFF",
    "backdrop": "F2DFC2",
}


def hex_to_linear(value):
    value = value.lstrip("#")
    rgb = [int(value[i:i + 2], 16) / 255.0 for i in (0, 2, 4)]
    return tuple(
        c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
        for c in rgb
    )


def make_mat(name, hex_color, emission=0.0, roughness=0.76):
    mat = bpy.data.materials.new(name)
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    color = (*hex_to_linear(hex_color), 1.0)
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = 0.0
    bsdf.inputs["Specular IOR Level"].default_value = 0.22
    bsdf.inputs["Sheen Weight"].default_value = 0.06
    if emission:
        bsdf.inputs["Emission Color"].default_value = color
        bsdf.inputs["Emission Strength"].default_value = emission
    mat.diffuse_color = color
    return mat


def material(obj, mat):
    obj.data.materials.append(MATS[mat] if isinstance(mat, str) else mat)
    return obj


def smooth(obj):
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return obj


def empty(name, location=(0, 0, 0), parent=None):
    obj = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(obj)
    obj.parent = parent
    obj.location = location
    obj.empty_display_size = 0.12
    return obj


def rounded_box(name, location, size, mat, bevel=0.04, parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1)
    obj = bpy.context.object
    obj.name = name
    # Bake dimensions into vertices instead of relying on transform operators.
    for vertex in obj.data.vertices:
        vertex.co.x *= size[0]
        vertex.co.y *= size[1]
        vertex.co.z *= size[2]
    obj.parent = parent
    obj.location = location
    material(obj, mat)
    if bevel:
        mod = obj.modifiers.new("Hand-rounded paper edges", "BEVEL")
        mod.width = min(bevel, min(size) * 0.44)
        mod.segments = 3
    smooth(obj)
    normal = obj.modifiers.new("Soft weighted normals", "WEIGHTED_NORMAL")
    normal.keep_sharp = True
    return obj


def add_sphere(name, location, radius, mat, scale=(1, 1, 1), parent=None):
    # Dust and sparkles share inexpensive unit-sphere meshes.
    key = mat if isinstance(mat, str) else mat.name
    if key not in SPHERE_MESHES:
        bpy.ops.mesh.primitive_uv_sphere_add(
            segments=12, ring_count=8, radius=1
        )
        obj = bpy.context.object
        material(obj, mat)
        smooth(obj)
        SPHERE_MESHES[key] = obj.data
    else:
        obj = bpy.data.objects.new(name, SPHERE_MESHES[key])
        bpy.context.scene.collection.objects.link(obj)
    obj.name = name
    obj.parent = parent
    obj.location = location
    obj.scale = tuple(radius * s for s in scale)
    return obj


def add_cylinder(name, location, radius, depth, mat, parent=None, vertices=24):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices, radius=radius, depth=depth
    )
    obj = bpy.context.object
    obj.name = name
    obj.parent = parent
    obj.location = location
    material(obj, mat)
    mod = obj.modifiers.new("Rounded cylinder edges", "BEVEL")
    mod.width = min(0.035, depth * 0.2, radius * 0.16)
    mod.segments = 3
    smooth(obj)
    return obj


def rod(name, a, b, radius, mat, parent=None):
    a, b = Vector(a), Vector(b)
    obj = add_cylinder(
        name, (a + b) / 2, radius, (b - a).length,
        mat, parent=parent, vertices=12
    )
    obj.rotation_euler = (b - a).to_track_quat("Z", "Y").to_euler()
    return obj


def add_light(name, light_type, location, energy, color, size=None, target=None):
    data = bpy.data.lights.new(name, light_type)
    data.energy = energy
    data.color = hex_to_linear(color)
    if light_type == "AREA":
        data.shape = "DISK"
        data.size = size or 5.0
    elif light_type == "POINT":
        data.shadow_soft_size = size or 0.12
        data.use_shadow = False

    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = location
    if target is not None:
        obj.rotation_euler = (
            Vector(target) - obj.location
        ).to_track_quat("-Z", "Y").to_euler()
    return obj


def text_label(name, body, location, size, mat, parent=None):
    # Uses Blender's built-in font only.
    curve = bpy.data.curves.new(name, "FONT")
    curve.body = body
    curve.align_x = "CENTER"
    curve.align_y = "CENTER"
    curve.size = size
    curve.extrude = 0.001
    curve.bevel_depth = 0.0005
    obj = bpy.data.objects.new(name, curve)
    bpy.context.scene.collection.objects.link(obj)
    obj.parent = parent
    obj.location = location
    obj.rotation_euler = (math.pi / 2, 0, 0)
    material(obj, mat)
    return obj


def build_room():
    add_cylinder(
        "Thick cream circular diorama base",
        (0, 0, 0.245), 5.4, 0.49, "paper", vertices=96
    )
    add_cylinder(
        "Thin tomato rim band",
        (0, 0, 0.425), 5.415, 0.065, "tomato", vertices=96
    )
    add_cylinder(
        "Honey floor disc",
        (0, 0, 0.515), 5.27, 0.07, "wood_dark", vertices=96
    )

    width = 0.38
    for i in range(-13, 14):
        y = i * width
        half = math.sqrt(
            max(0.0, 5.23 ** 2 - (abs(y) + width / 2) ** 2)
        )
        if half > 0.1:
            rounded_box(
                "Honey plank %02d" % (i + 13),
                (0, y, 0.55),
                (half * 2, width - 0.018, 0.04),
                "honey" if i % 3 else "wood_dark", 0.018
            )

    bottom = FLOOR_Z
    top = FLOOR_Z + 2.8
    left_x = -3.5
    ymin, ymax = -2.2, 3.5
    sill = FLOOR_Z + 1.12
    lintel = FLOOR_Z + 2.30
    windows = [(-1.77, -0.42), (0.63, 2.02)]

    # Actual window apertures: no glass and no wall geometry across the holes.
    rounded_box(
        "Left wall below windows",
        (left_x, (ymin + ymax) / 2, (bottom + sill) / 2),
        (0.18, ymax - ymin, sill - bottom), "paper"
    )
    rounded_box(
        "Left wall above windows",
        (left_x, (ymin + ymax) / 2, (lintel + top) / 2),
        (0.18, ymax - ymin, top - lintel), "paper"
    )
    spans = [
        (ymin, windows[0][0]),
        (windows[0][1], windows[1][0]),
        (windows[1][1], ymax),
    ]
    for i, (a, b) in enumerate(spans):
        rounded_box(
            "Left wall window pier %d" % i,
            (left_x, (a + b) / 2, (sill + lintel) / 2),
            (0.18, b - a, lintel - sill), "paper"
        )

    for i, (a, b) in enumerate(windows):
        for y in (a, b, (a + b) / 2):
            rounded_box(
                "Window %d upright" % i,
                (-3.475, y, (sill + lintel) / 2),
                (0.24, 0.075, lintel - sill + 0.12), "paper", 0.018
            )
        for z in (sill, lintel, (sill + lintel) / 2):
            rounded_box(
                "Window %d cross rail" % i,
                (-3.475, (a + b) / 2, z),
                (0.24, b - a + 0.13, 0.075), "paper", 0.018
            )
        rounded_box(
            "Deep sunny window sill",
            (-3.36, (a + b) / 2, sill - 0.035),
            (0.40, b - a + 0.22, 0.10), "paper"
        )

    door_l, door_r, right = 2.02, 2.98, 3.35
    door_top = FLOOR_Z + 1.94
    for name, a, b in [
        ("Main lilac back wall", -3.5, door_l),
        ("Right door pier", door_r, right),
    ]:
        rounded_box(
            name, ((a + b) / 2, 3.5, (bottom + top) / 2),
            (b - a, 0.18, top - bottom), "lilac"
        )
    rounded_box(
        "Doorway lintel", (2.5, 3.5, (door_top + top) / 2),
        (door_r - door_l, 0.18, top - door_top), "lilac"
    )
    rounded_box(
        "Left cream top trim", (-3.5, 0.65, top + 0.015),
        (0.24, 5.82, 0.095), "paper", 0.025
    )
    rounded_box(
        "Back cream top trim", (-0.075, 3.5, top + 0.015),
        (6.96, 0.24, 0.095), "paper", 0.025
    )
    rounded_box(
        "Left wooden skirting", (-3.37, 0.65, bottom + 0.09),
        (0.09, 5.7, 0.15), "honey", 0.025
    )
    rounded_box(
        "Back wooden skirting", (-0.74, 3.37, bottom + 0.09),
        (5.52, 0.08, 0.15), "honey", 0.025
    )
    for x in (door_l, door_r):
        rounded_box(
            "Cream door jamb", (x, 3.37, FLOOR_Z + 0.98),
            (0.10, 0.20, 2.02), "paper", 0.025
        )
    rounded_box(
        "Cream door header", (2.5, 3.37, door_top),
        (1.12, 0.20, 0.12), "paper", 0.025
    )

    hinge = empty("Outward door hinge", (door_l, 3.56, FLOOR_Z))
    hinge.rotation_euler.z = math.radians(70)
    rounded_box(
        "Open sun-yellow front door", (0.46, 0, 0.94),
        (0.92, 0.09, 1.88), "sun", 0.055, hinge
    )
    rounded_box(
        "Inset door panel", (0.46, -0.055, 0.99),
        (0.68, 0.035, 1.31), "honey", 0.055, hinge
    )
    rounded_box(
        "Yellow inset centre", (0.46, -0.079, 0.99),
        (0.59, 0.025, 1.22), "sun", 0.045, hinge
    )
    add_sphere(
        "Little round door knob", (0.77, -0.13, 0.96),
        0.065, "tomato", parent=hinge
    )

    bpy.ops.mesh.primitive_plane_add(
        size=2, location=(2.5, 4.45, FLOOR_Z + 1.14)
    )
    glow = bpy.context.object
    glow.name = "Warm sunshine beyond doorway"
    glow.rotation_euler = (math.pi / 2, 0, 0)
    glow.scale = (0.82, 1.14, 1)
    material(glow, "door_glow")
    add_light(
        "Sunshine entering doorway", "AREA", (2.5, 4.12, 2.1),
        150, "FFF0CC", 1.25, target=(1.9, 0.5, 0.8)
    )

    rounded_box(
        "Publisher wall plaque", (0.45, 3.365, 3.08),
        (2.28, 0.055, 0.29), "paper", 0.04
    )
    text_label(
        "Nightlight Press wall lettering", "NIGHTLIGHT PRESS",
        (0.45, 3.327, 3.08), 0.158, "ink"
    )


def build_clock():
    center = Vector((0.60, 3.32, FLOOR_Z + 1.99))
    rim = add_cylinder(
        "Tomato round clock rim", center,
        0.47, 0.11, "tomato", vertices=48
    )
    rim.rotation_euler.x = math.pi / 2
    face = add_cylinder(
        "White clock face", center + Vector((0, -0.067, 0)),
        0.413, 0.025, "white", vertices=48
    )
    face.rotation_euler.x = math.pi / 2
    for i in range(12):
        a = 2 * math.pi * i / 12
        add_sphere(
            "Clock hour dot",
            center + Vector((0.35 * math.sin(a), -0.09, 0.35 * math.cos(a))),
            0.019, "ink", scale=(1, 0.4, 1)
        )
    pivot = center + Vector((0, -0.107, 0))
    rod(
        "Clock minute hand", pivot,
        pivot + Vector((0.22, 0, 0.25)), 0.018, "ink"
    )
    rod(
        "Clock hour hand", pivot,
        pivot + Vector((-0.19, 0, 0.10)), 0.025, "ink"
    )
    add_sphere("Clock pin", pivot, 0.043, "tomato")


def build_bookshelf():
    x, y, width = -1.78, 3.12, 1.64
    rounded_box(
        "Bookshelf paper backing", (x, y + 0.18, 1.79),
        (width, 0.08, 2.40), "wood_dark", 0.025
    )
    for xx in (x - width / 2, x + width / 2):
        rounded_box(
            "Bookshelf side", (xx, y, 1.79),
            (0.105, 0.43, 2.43), "honey"
        )
    colors = ["tomato", "sun", "sky", "leaf", "lilac", "paper"]
    for row, shelf_z in enumerate((0.65, 1.22, 1.79, 2.36, 2.98)):
        rounded_box(
            "Rounded bookshelf shelf", (x, y - 0.015, shelf_z),
            (width + 0.12, 0.48, 0.10), "honey"
        )
        if row == 4:
            continue
        cursor = x - 0.70
        for j in range(10):
            w = random.uniform(0.08, 0.13)
            h = random.uniform(0.32, 0.46)
            book = rounded_box(
                "Colourful shelf book",
                (cursor + w / 2, y - 0.055, shelf_z + 0.055 + h / 2),
                (w, 0.29, h), colors[(j + row * 2) % len(colors)], 0.018
            )
            if j in (3, 8):
                book.rotation_euler.y = random.uniform(-0.13, 0.13)
            rounded_box(
                "Book spine paper dash",
                (cursor + w / 2, y - 0.208, shelf_z + 0.15),
                (w * 0.65, 0.008, 0.025), "paper", 0.003
            )
            cursor += w + 0.024


def build_lamp(x, y, color):
    top = FLOOR_Z + 0.88
    add_cylinder(
        "Desk lamp foot", (x, y, top + 0.035),
        0.105, 0.055, color
    )
    rod(
        "Desk lamp lower arm", (x, y, top + 0.055),
        (x + 0.04, y, top + 0.36), 0.022, color
    )
    rod(
        "Desk lamp bent arm", (x + 0.04, y, top + 0.36),
        (x - 0.12, y - 0.015, top + 0.43), 0.022, color
    )
    bpy.ops.mesh.primitive_cone_add(
        vertices=20, radius1=0.13, radius2=0.06, depth=0.14,
        location=(x - 0.12, y - 0.015, top + 0.37)
    )
    shade = bpy.context.object
    shade.name = "Little cone lamp shade"
    material(shade, color)
    smooth(shade)
    bevel = shade.modifiers.new("Soft shade lip", "BEVEL")
    bevel.width, bevel.segments = 0.014, 3
    add_sphere(
        "Warm glowing lamp bulb", (x - 0.12, y - 0.015, top + 0.295),
        0.055, "lamp_glow", scale=(1, 1, 0.75)
    )
    add_light(
        "Small warm desk lamp", "POINT",
        (x - 0.12, y - 0.025, top + 0.26),
        10, "FFD88B", 0.09
    )


def build_monitor(x, y, top, index):
    # Short, offset monitors on the near half. Their screen normals point
    # front-right, so the camera sees the blue surface throughout the orbit.
    # Offset placement and raised seated heads keep faces unobstructed.
    dx = 0.40 if index == 0 else 0.30
    root = empty(
        "Desk %d angled low monitor" % index,
        (x + dx, y - 0.245, top + 0.06)
    )
    root.rotation_euler.z = math.radians(35)

    add_cylinder(
        "Monitor stand foot", (0, 0, 0.028),
        0.105, 0.035, "paper", parent=root
    )
    rod(
        "Monitor short stand", (0, 0, 0.04), (0, 0, 0.15),
        0.027, "paper", root
    )
    rounded_box(
        "Friendly low monitor housing", (0, 0, 0.225),
        (0.40, 0.085, 0.245), "paper", 0.035, root
    )
    rounded_box(
        "Emissive sky-blue monitor screen", (0, -0.050, 0.225),
        (0.335, 0.014, 0.183), "screen_glow", 0.018, root
    )
    for j in range(3):
        rounded_box(
            "Screen story line", (-0.015, -0.061, 0.267 - j * 0.043),
            (0.225 - 0.035 * j, 0.006, 0.010), "paper", 0.002, root
        )


def build_desk(x, y, index):
    top = FLOOR_Z + 0.84
    rounded_box(
        "Desk %d honey top" % index, (x, y, top),
        (1.36, 0.82, 0.12), "honey", 0.06
    )
    for dx in (-0.52, 0.52):
        for dy in (-0.28, 0.28):
            rounded_box(
                "Desk rounded wooden leg", (x + dx, y + dy, FLOOR_Z + 0.39),
                (0.115, 0.115, 0.77), "wood_dark", 0.045
            )

    build_monitor(x, y, top, index)
    rounded_box(
        "Tiny keyboard", (x + 0.18, y + 0.12, top + 0.078),
        (0.34, 0.15, 0.035), "paper", 0.015
    )
    for j in range(3):
        rounded_box(
            "Keyboard soft key row",
            (x + 0.18, y + 0.075 + j * 0.045, top + 0.098),
            (0.26, 0.008, 0.006), "lilac", 0.002
        )
    build_lamp(x - 0.46, y + 0.20, "sun" if index % 2 else "tomato")
    return top + 0.06


def build_figure(x, y, color, index):
    # The staff now sit behind the desks, on the +Y side, facing -Y.
    stool_y = y + 0.72
    seat_z = FLOOR_Z + 0.46
    add_cylinder(
        "Little stool seat", (x, stool_y, seat_z),
        0.25, 0.12, "honey"
    )
    for angle in (0, 2.094, 4.189):
        rod(
            "Stool splayed leg",
            (x + 0.19 * math.cos(angle),
             stool_y + 0.19 * math.sin(angle), FLOOR_Z + 0.02),
            (x + 0.14 * math.cos(angle),
             stool_y + 0.14 * math.sin(angle), seat_z - 0.03),
            0.045, "wood_dark"
        )

    rig = empty(
        "Staff %d gentle idle rig" % index,
        (x, stool_y, FLOOR_Z + 0.52)
    )
    add_sphere(
        "Rounded clay staff body", (0, 0, 0.28), 1, color,
        scale=(0.205, 0.175, 0.33), parent=rig
    )
    for dx in (-0.16, 0.16):
        add_sphere(
            "Staff little shoe", (dx, -0.16, -0.23),
            0.11, "ink", scale=(0.8, 1.35, 0.55), parent=rig
        )
        rod(
            "Staff seated leg", (dx * 0.6, -0.04, 0.10),
            (dx, -0.16, -0.17), 0.075, color, rig
        )
        add_sphere(
            "Staff stubby sleeve", (dx * 1.15, -0.055, 0.29),
            0.10, color, scale=(0.8, 0.9, 1.35), parent=rig
        )

    head_height = 0.84
    head = empty(
        "Staff %d bobbing head" % index, (0, -0.015, head_height), rig
    )
    add_sphere(
        "Friendly paper clay head", (0, 0, 0),
        0.215, "paper", parent=head
    )

    # A modest glance toward the open right side, never away from camera.
    face_angle = math.radians(15 + (index % 3) * 6)
    forward = Vector((math.sin(face_angle), -math.cos(face_angle), 0))
    tangent = Vector((-forward.y, forward.x, 0))
    for sign in (-1, 1):
        p = (
            forward * 0.195
            + tangent * (0.064 * sign)
            + Vector((0, 0, 0.025))
        )
        add_sphere("Tiny friendly ink eye", p, 0.026, "ink", parent=head)
    add_sphere(
        "Little clay nose",
        forward * 0.216 + Vector((0, 0, -0.021)),
        0.032, "terracotta", parent=head
    )

    phase = index * 1.17
    for frame in list(range(1, 331, 12)) + [330]:
        t = frame / 30.0
        rig.rotation_euler = (
            0.022 * math.sin(t * 1.5 + phase),
            0.030 * math.sin(t * 1.1 + phase),
            0,
        )
        rig.keyframe_insert(data_path="rotation_euler", frame=frame)
        head.location.z = head_height + 0.023 * math.sin(t * 2.0 + phase)
        head.rotation_euler.z = 0.045 * math.sin(t * 1.3 + phase)
        head.keyframe_insert(data_path="location", frame=frame)
        head.keyframe_insert(data_path="rotation_euler", frame=frame)


def paper_stack(x, y, z, count=5, size=(0.32, 0.25)):
    for i in range(count):
        obj = rounded_box(
            "Loose paper sheet",
            (x + random.uniform(-0.015, 0.015),
             y + random.uniform(-0.012, 0.012), z + i * 0.013),
            (size[0], size[1], 0.012), "paper", 0.005
        )
        obj.rotation_euler.z = random.uniform(-0.06, 0.06)


def envelope(x, y, z, angle=0):
    root = empty("Folded envelope", (x, y, z))
    root.rotation_euler.z = angle
    rounded_box(
        "Cream envelope", (0, 0, 0),
        (0.29, 0.19, 0.018), "paper", 0.012, root
    )
    rod(
        "Envelope flap left", (-0.13, 0.075, 0.014),
        (0, -0.035, 0.014), 0.004, "wood_dark", root
    )
    rod(
        "Envelope flap right", (0, -0.035, 0.014),
        (0.13, 0.075, 0.014), 0.004, "wood_dark", root
    )
    rounded_box(
        "Tomato postage stamp", (0.095, 0.04, 0.015),
        (0.045, 0.045, 0.007), "tomato", 0.004, root
    )


def build_easel():
    x, y = -2.82, 0.38
    for dx in (-0.38, 0.38):
        rod(
            "Easel front wooden leg",
            (x + dx, y - 0.17, FLOOR_Z + 0.02),
            (x + dx * 0.35, y + 0.04, FLOOR_Z + 1.91),
            0.048, "wood_dark"
        )
    rod(
        "Easel third leg", (x, y + 0.61, FLOOR_Z + 0.02),
        (x, y + 0.04, FLOOR_Z + 1.84), 0.052, "wood_dark"
    )
    rounded_box(
        "Easel canvas tray", (x, y - 0.09, FLOOR_Z + 0.99),
        (1.12, 0.20, 0.10), "honey"
    )
    rounded_box(
        "Paper canvas", (x, y, FLOOR_Z + 1.46),
        (0.94, 0.065, 0.87), "paper", 0.025
    )
    rounded_box(
        "Painted blue sky", (x, y - 0.041, FLOOR_Z + 1.48),
        (0.81, 0.016, 0.72), "sky", 0.015
    )
    add_sphere(
        "Canvas painted sun", (x - 0.22, y - 0.064, FLOOR_Z + 1.67),
        0.135, "sun", scale=(1, 0.09, 1)
    )
    add_sphere(
        "Canvas leaf-green hill", (x + 0.13, y - 0.068, FLOOR_Z + 1.25),
        1, "leaf", scale=(0.265, 0.015, 0.16)
    )
    add_sphere(
        "Canvas lilac hill", (x - 0.20, y - 0.086, FLOOR_Z + 1.22),
        1, "lilac", scale=(0.20, 0.012, 0.12)
    )
    rounded_box(
        "Canvas lower cream border", (x, y - 0.10, FLOOR_Z + 1.075),
        (0.94, 0.025, 0.055), "paper", 0.01
    )


def build_press():
    x, y = 3.0, -0.65
    rounded_box(
        "Chunky tomato printing press", (x, y, FLOOR_Z + 0.45),
        (0.91, 0.78, 0.87), "tomato", 0.14
    )
    rounded_box(
        "Press cream top deck", (x, y - 0.02, FLOOR_Z + 0.89),
        (1.04, 0.84, 0.10), "paper", 0.04
    )
    for dx in (-0.36, 0.36):
        rounded_box(
            "Press roller support", (x + dx, y + 0.12, FLOOR_Z + 1.05),
            (0.12, 0.25, 0.35), "tomato", 0.05
        )
    for yy in (y - 0.04, y + 0.22):
        roller = add_cylinder(
            "Soft ink printing roller",
            (x, yy, FLOOR_Z + 1.09), 0.11, 0.66, "ink"
        )
        roller.rotation_euler.y = math.pi / 2

    rounded_box(
        "Press output tray", (x, y - 0.52, FLOOR_Z + 0.69),
        (0.70, 0.44, 0.075), "honey", 0.035
    )
    paper_stack(x, y - 0.51, FLOOR_Z + 0.74, 7, (0.53, 0.33))
    add_sphere(
        "Press yellow button", (x + 0.22, y - 0.402, FLOOR_Z + 0.48),
        0.065, "sun", scale=(1, 0.4, 1)
    )
    text_label(
        "Press label", "PRINT",
        (x - 0.07, y - 0.408, FLOOR_Z + 0.50), 0.105, "paper"
    )


def build_stations():
    top = FLOOR_Z + 0.915
    # Paper and pencil stay visible at the writer's front-left corner.
    paper_stack(-2.23, -1.15, top, 6, (0.25, 0.21))
    rod(
        "Writer yellow pencil", (-2.27, -0.97, top + 0.025),
        (-2.02, -0.91, top + 0.025), 0.016, "sun"
    )
    rod(
        "Writer graphite pencil tip", (-2.02, -0.91, top + 0.025),
        (-1.97, -0.898, top + 0.025), 0.011, "ink"
    )
    build_easel()

    add_cylinder(
        "Microphone stand base", (-0.35, 1.17, top + 0.025),
        0.105, 0.04, "ink"
    )
    rod(
        "Microphone stand", (-0.35, 1.17, top + 0.04),
        (-0.35, 1.17, top + 0.29), 0.023, "ink"
    )
    add_sphere(
        "Round studio microphone", (-0.35, 1.17, top + 0.37),
        0.12, "ink", scale=(0.85, 0.8, 1.22)
    )
    for dz in (-0.055, 0, 0.055):
        rounded_box(
            "Microphone grille stripe", (-0.35, 1.073, top + 0.37 + dz),
            (0.14, 0.015, 0.013), "paper", 0.006
        )

    build_press()
    for i in range(4):
        envelope(1.49, 1.05, top + i * 0.025, random.uniform(-0.17, 0.17))
    rounded_box(
        "Small sky-blue mail box", (2.25, 1.48, top + 0.18),
        (0.30, 0.35, 0.35), "sky", 0.12
    )
    rounded_box(
        "Mailbox ink slot", (2.25, 1.294, top + 0.19),
        (0.20, 0.015, 0.034), "ink", 0.01
    )
    rod(
        "Mailbox flag pole", (2.42, 1.53, top + 0.12),
        (2.42, 1.53, top + 0.44), 0.016, "tomato"
    )
    rounded_box(
        "Mailbox sunny flag", (2.47, 1.53, top + 0.41),
        (0.12, 0.035, 0.07), "sun", 0.015
    )


def build_plant(x, y, size=1.0):
    z = FLOOR_Z
    bpy.ops.mesh.primitive_cone_add(
        vertices=20, radius1=0.17 * size, radius2=0.235 * size,
        depth=0.34 * size, location=(x, y, z + 0.17 * size)
    )
    pot = bpy.context.object
    pot.name = "Rounded terracotta plant pot"
    material(pot, "terracotta")
    smooth(pot)
    mod = pot.modifiers.new("Soft clay pot edges", "BEVEL")
    mod.width, mod.segments = 0.035 * size, 3
    add_cylinder(
        "Pot rounded lip", (x, y, z + 0.33 * size),
        0.245 * size, 0.075 * size, "terracotta"
    )
    add_cylinder(
        "Pot dark soil", (x, y, z + 0.355 * size),
        0.20 * size, 0.015, "wood_dark"
    )
    for i in range(5):
        a = i * 2.399
        end = Vector((
            x + math.cos(a) * 0.23 * size,
            y + math.sin(a) * 0.23 * size,
            z + (0.65 + (i % 3) * 0.13) * size,
        ))
        rod(
            "Plant stem", (x, y, z + 0.35 * size),
            end, 0.022 * size, "leaf"
        )
        leaf = add_sphere(
            "Rounded clay leaf", end, 1, "leaf",
            scale=(0.13 * size, 0.10 * size, 0.26 * size)
        )
        leaf.rotation_euler = (
            0.35 * math.sin(a), 0.4 * math.cos(a), a
        )


def build_book():
    root = empty("HERO glowing open picture book")
    root.scale = (BOOK_SCALE,) * 3
    left = empty("Hero left flapping cover pivot", parent=root)
    right = empty("Hero right flapping cover pivot", parent=root)

    for sign, pivot in ((-1, left), (1, right)):
        rounded_box(
            "Hero tomato cover board", (sign * 0.17, 0, 0),
            (0.34, 0.47, 0.035), "tomato", 0.015, pivot
        )
        rounded_box(
            "Hero warm luminous page block", (sign * 0.16, 0, 0.041),
            (0.30, 0.425, 0.055), "book_glow", 0.014, pivot
        )
        for yy in (-0.10, -0.055, -0.01):
            rounded_box(
                "Hero illustrated page text", (sign * 0.16, yy, 0.072),
                (0.19, 0.010, 0.004), "wood_dark", 0.002, pivot
            )
        add_sphere(
            "Hero picture-book sun", (sign * 0.17, 0.11, 0.073),
            0.053, "sun", scale=(1, 1, 0.08), parent=pivot
        )
        rounded_box(
            "Hero picture-book green hill", (sign * 0.16, 0.065, 0.075),
            (0.17, 0.035, 0.005), "leaf", 0.002, pivot
        )

    rounded_box(
        "Hero tomato spine", (0, 0, 0.002),
        (0.045, 0.47, 0.045), "tomato", 0.015, root
    )
    light = add_light(
        "Hero parented golden glow", "POINT",
        (0, 0, 0), 70, "FFD782", 0.26
    )
    light.parent = root
    light.location = (0, 0, 0.22)
    return root, left, right, light


def catmull_rom(p0, p1, p2, p3, t):
    return 0.5 * (
        2 * p1
        + (-p0 + p2) * t
        + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t
        + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t
    )


def smoothstep(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


WAYPOINTS = [
    # Rest height accounts for the enlarged cover's thickness.
    (24, (-1.99, -0.76, FLOOR_Z + 0.94)),
    (40, (-2.08, -0.70, FLOOR_Z + 1.66)),
    (80, (-2.62, 0.20, FLOOR_Z + 1.65)),
    (130, (-0.02, 1.03, FLOOR_Z + 1.62)),
    (180, (2.94, -0.65, FLOOR_Z + 1.50)),
    (230, (1.81, 1.07, FLOOR_Z + 1.62)),
    (253, (2.48, 2.45, FLOOR_Z + 1.45)),
    (272, (2.50, 3.60, FLOOR_Z + 1.40)),
    (305, (2.50, 6.55, FLOOR_Z + 2.78)),
]


def book_position(frame):
    if frame <= WAYPOINTS[0][0]:
        return Vector(WAYPOINTS[0][1])
    if frame >= WAYPOINTS[-1][0]:
        return Vector(WAYPOINTS[-1][1])

    for i in range(len(WAYPOINTS) - 1):
        a, b = WAYPOINTS[i], WAYPOINTS[i + 1]
        if a[0] <= frame <= b[0]:
            u = (frame - a[0]) / (b[0] - a[0])
            # Slow near stations, but retain nonzero endpoint travel speed.
            t = u - 0.78 * math.sin(2 * math.pi * u) / (2 * math.pi)
            p1, p2 = Vector(a[1]), Vector(b[1])
            p0 = (
                Vector(WAYPOINTS[i - 1][1])
                if i else p1 - (p2 - p1) * 0.25
            )
            p3 = (
                Vector(WAYPOINTS[i + 2][1])
                if i + 2 < len(WAYPOINTS) else p2 + (p2 - p1)
            )
            p = catmull_rom(p0, p1, p2, p3, t)
            if i < 6:
                p.z += 0.12 * math.sin(math.pi * t) ** 2
            return p
    return Vector(WAYPOINTS[-1][1])


def animate_book(root, left, right, light):
    last_yaw = -0.18
    for frame in range(1, 331):
        root.location = book_position(frame)
        delta = book_position(frame + 0.35) - book_position(frame - 0.35)
        if frame <= 24:
            yaw = last_yaw
        elif delta.length > 0.00001:
            yaw = math.atan2(delta.y, delta.x) - math.pi / 2
            while yaw - last_yaw > math.pi:
                yaw -= 2 * math.pi
            while yaw - last_yaw < -math.pi:
                yaw += 2 * math.pi
            yaw = last_yaw + (yaw - last_yaw) * 0.16
        else:
            yaw = last_yaw

        flight = smoothstep((frame - 24) / 16)
        bank = max(-0.20, min(0.20, -(yaw - last_yaw) * 4))
        root.rotation_euler = (
            flight * 0.055 * math.sin(frame * 0.10), bank, yaw
        )

        vanish = 1.0 - smoothstep((frame - 286) / 19)
        # The enlarged book folds slightly while passing the narrow doorway.
        # Its rig scale remains 1.7 until the final dissolve.
        root.scale = (BOOK_SCALE * vanish,) * 3
        root.keyframe_insert(data_path="location", frame=frame)
        root.keyframe_insert(data_path="rotation_euler", frame=frame)
        root.keyframe_insert(data_path="scale", frame=frame)

        flap = 0.20 + flight * 0.16 * math.sin(frame * 0.25)
        fold_in = smoothstep((frame - 251) / 12)
        fold_out = 1.0 - smoothstep((frame - 279) / 10)
        flap += 0.46 * fold_in * fold_out
        left.rotation_euler.y = flap
        right.rotation_euler.y = -flap
        left.keyframe_insert(data_path="rotation_euler", frame=frame)
        right.keyframe_insert(data_path="rotation_euler", frame=frame)

        # Already fully luminous while resting on the writer's desk.
        light.data.energy = 70.0 * vanish
        light.data.keyframe_insert(data_path="energy", frame=frame)
        last_yaw = yaw


def build_sparkles():
    # Two new linked-mesh sparkles every frame; no particle systems.
    for spawn in range(28, 301, 2):
        for j in ((spawn // 2) % 2,):
            p = book_position(spawn)
            tangent = book_position(spawn + 0.4) - book_position(spawn - 0.4)
            if tangent.length:
                p -= tangent.normalized() * random.uniform(0.18, 0.40)
            p += Vector((
                random.uniform(-0.15, 0.15),
                random.uniform(-0.15, 0.15),
                random.uniform(-0.09, 0.11),
            ))

            radius = random.uniform(0.045, 0.070)
            # Avoid an oversized burst after the book disappears.
            end_factor = 1.0 - 0.65 * smoothstep((spawn - 286) / 14)
            radius *= end_factor
            obj = add_sphere(
                "Book sparkle %03d.%d" % (spawn, j), p, radius,
                "spark_sun" if j else "spark_white"
            )
            life = random.randint(26, 29)
            drift = Vector((
                random.uniform(-0.24, 0.24),
                random.uniform(-0.24, 0.24),
                random.uniform(-0.38, -0.16),
            ))
            keys = (
                (1, 0, 0),
                (spawn - 1, 0, 0),
                (spawn, 0.35, 0),
                (spawn + 2, 1, 0.08),
                (spawn + life // 2, 0.60, 0.5),
                (spawn + life, 0, 1),
                (330, 0, 1),
            )
            for frame, factor, offset in keys:
                obj.scale = (radius * factor,) * 3
                obj.location = p + drift * offset
                obj.keyframe_insert(data_path="scale", frame=frame)
                obj.keyframe_insert(data_path="location", frame=frame)


def build_dust():
    for i in range(72):
        base = Vector((
            random.uniform(-3.18, 3.12),
            random.uniform(-2.03, 3.20),
            random.uniform(FLOOR_Z + 0.28, FLOOR_Z + 2.60),
        ))
        radius = random.uniform(0.015, 0.025)
        obj = add_sphere(
            "Floating golden paper dust %02d" % i,
            base, radius, "dust_glow"
        )
        phase = random.uniform(0, 2 * math.pi)
        for frame in list(range(1, 331, 15)) + [330]:
            t = frame / 30
            obj.location = base + Vector((
                0.075 * math.sin(t * 0.54 + phase),
                0.060 * math.cos(t * 0.43 + phase),
                0.075 * math.sin(t * 0.71 + phase),
            ))
            obj.keyframe_insert(data_path="location", frame=frame)


def build_camera(book):
    scene = bpy.context.scene
    data = bpy.data.cameras.new("Office flythrough 50mm miniature camera")
    cam = bpy.data.objects.new("office_flythrough_camera", data)
    scene.collection.objects.link(cam)
    scene.camera = cam

    data.lens = 50
    data.sensor_width = 36
    data.clip_start = 0.1
    data.clip_end = 250
    data.dof.use_dof = True
    data.dof.focus_object = book
    data.dof.aperture_fstop = 0.9

    aim = empty("Single smoothed camera aim target")
    constraint = cam.constraints.new("TRACK_TO")
    constraint.target = aim
    constraint.track_axis = "TRACK_NEGATIVE_Z"
    constraint.up_axis = "UP_Y"

    center = Vector((0, 0.8, 1.0))
    filtered = center * 0.60 + book_position(1) * 0.40
    doorway = Vector((2.5, 3.5, FLOOR_Z + 1.1))

    for frame in range(1, 331):
        u = smoothstep((frame - 1) / 329)
        # Stay in the open front-right quadrant for the complete shot.
        azimuth = math.radians(-78 + 38 * u)
        radius = 19.5 - 5.5 * u
        cam.location = center + Vector((
            radius * math.cos(azimuth),
            radius * math.sin(azimuth),
            radius * math.tan(math.radians(34)),
        ))
        raw = center * 0.60 + book_position(frame) * 0.40
        raw = raw.lerp(
            doorway, 0.78 * smoothstep((frame - 285) / 45)
        )
        filtered = filtered.lerp(raw, 0.055)
        aim.location = filtered
        cam.keyframe_insert(data_path="location", frame=frame)
        aim.keyframe_insert(data_path="location", frame=frame)


def configure_lighting():
    scene = bpy.context.scene
    world = bpy.data.worlds.new("Soft peach-cream paper world")
    scene.world = world
    world.use_nodes = True
    background = world.node_tree.nodes["Background"]
    background.inputs["Color"].default_value = (
        *hex_to_linear("F7E6CC"), 1
    )
    background.inputs["Strength"].default_value = 0.35

    # Reduced light levels preserve pastel diffuse colours in Standard.
    # The small sun angle, real window apertures, and restrained fill retain
    # readable window-shaped bright patches and cross-mullion shadows.
    sun = add_light(
        "Morning sun through left windows", "SUN",
        (-8, -4, 9), 1.7, "FFF0D4"
    )
    sun.data.angle = math.radians(3)
    direction = Vector((1.0, 0.28, -math.tan(math.radians(40))))
    sun.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()

    add_light(
        "Large soft above-front fill", "AREA", (-1, -4, 9),
        220, "FFF3DE", 8, target=(0, 0.5, 0.7)
    )
    add_light(
        "Gentle cool sky rim", "AREA", (5.5, 2, 6),
        110, "C7E7FF", 5, target=(0, 0.7, 1.2)
    )

    rounded_box(
        "Warm matte paper studio ground", (0, 0, -0.055),
        (180, 180, 0.10), "backdrop", 0
    )


def configure_compositor(scene):
    ng = bpy.data.node_groups.new("NL_Comp", "CompositorNodeTree")
    scene.compositing_node_group = ng

    rl = ng.nodes.new("CompositorNodeRLayers")
    rl.location = (-300, 0)
    glare = ng.nodes.new("CompositorNodeGlare")
    glare.location = (-40, 0)
    glare.inputs["Type"].default_value = "Bloom"
    glare.inputs["Quality"].default_value = "Medium"
    glare.inputs["Threshold"].default_value = 1.3
    glare.inputs["Strength"].default_value = 0.45
    glare.inputs["Size"].default_value = 0.6

    out = ng.nodes.new("NodeGroupOutput")
    out.location = (220, 0)
    ng.interface.new_socket(
        name="Image", in_out="OUTPUT", socket_type="NodeSocketColor"
    )
    ng.links.new(rl.outputs["Image"], glare.inputs["Image"])
    ng.links.new(glare.outputs["Image"], out.inputs[0])


def configure_render(scene, output):
    try:
        scene.render.engine = "BLENDER_EEVEE"
    except Exception:
        scene.render.engine = "BLENDER_EEVEE_NEXT"

    scene.eevee.taa_render_samples = int(os.environ.get("NL_SAMPLES", "24"))
    scene.eevee.use_raytracing = False
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.view_settings.exposure = float(os.environ.get('NL_EXPOSURE', '0.35'))
    scene.view_settings.gamma = 1

    scene.render.resolution_x = 1600
    scene.render.resolution_y = 900
    scene.render.resolution_percentage = int(
        os.environ.get("NL_RES_PCT", "100")
    )
    scene.render.fps = 30
    scene.frame_start = 1
    scene.frame_end = 330
    scene.render.film_transparent = False
    scene.render.use_file_extension = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.image_settings.color_depth = "8"
    scene.render.image_settings.compression = 15
    scene.render.filepath = os.path.join(output, "frame_")
    if hasattr(scene.render, "use_motion_blur"):
        scene.render.use_motion_blur = False
    scene.render.use_compositing = True

    scene["shot_name"] = "office_flythrough"
    scene["publisher"] = "Nightlight Press"
    scene["description"] = (
        "A sunny clay-and-paper publishing office run by friendly AI agents."
    )
    scene["revision"] = (
        "Restrained lighting, warm backdrop, wider front-right orbit, "
        "camera-facing staff, enlarged glowing book and denser sparkle trail."
    )


def main():
    output = os.environ.get("NL_OUT")
    if not output:
        raise RuntimeError(
            "NL_OUT is required: set it to the output folder for PNG frames."
        )
    output = os.path.abspath(os.path.expanduser(output))
    os.makedirs(output, exist_ok=True)

    selected = os.environ.get("NL_FRAMES", "").strip()
    frames = None
    if selected:
        frames = [
            int(token.strip())
            for token in selected.split(",") if token.strip()
        ]
        if not frames:
            raise ValueError("NL_FRAMES did not contain any frame numbers.")
        if any(frame < 1 or frame > 330 for frame in frames):
            raise ValueError("NL_FRAMES must contain only frames in 1..330.")

    random.seed(7)

    # Clear datablocks directly, without selection-dependent deletion.
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for datablocks in (
        bpy.data.meshes, bpy.data.materials, bpy.data.lights,
        bpy.data.cameras, bpy.data.curves,
    ):
        for block in list(datablocks):
            datablocks.remove(block, do_unlink=True)
    SPHERE_MESHES.clear()
    MATS.clear()

    scene = bpy.context.scene
    scene.name = "office_flythrough"
    configure_render(scene, output)

    print(
        "[Nightlight Press] Building revised office_flythrough...",
        flush=True
    )

    for name, color in PALETTE.items():
        MATS[name] = make_mat(
            "NL " + name, color,
            roughness=0.9 if name == "backdrop" else 0.76
        )
    for name, color, strength in (
        ("screen_glow", "4DA8DA", 1.5),
        ("lamp_glow", "FFE4A0", 12),
        ("book_glow", "FFF5DA", 6),
        ("door_glow", "FFF4DC", 7),
        ("spark_sun", "FFC233", 20),
        ("spark_white", "FFF8EC", 18),
        ("dust_glow", "FFE5AE", 4.5),
    ):
        MATS[name] = make_mat(
            "NL " + name, color, emission=strength
        )

    build_room()
    build_clock()
    build_bookshelf()

    colors = ["tomato", "sun", "sky", "leaf", "lilac", "tomato"]
    index = 0
    for y in (-0.9, 1.3):
        for x in (-1.8, 0.0, 1.8):
            build_desk(x, y, index)
            build_figure(x, y, colors[index], index)
            index += 1

    build_stations()
    build_plant(-3.01, 2.87, 0.90)
    build_plant(3.04, 2.55, 0.76)
    build_plant(3.66, -2.27, 1.05)
    build_plant(-3.73, -2.45, 0.72)

    book, left, right, light = build_book()
    animate_book(book, left, right, light)
    build_sparkles()
    build_dust()
    build_camera(book)
    configure_lighting()
    configure_compositor(scene)

    for name, frame in (
        ("REST — writer", 1),
        ("LIFT OFF", 24),
        ("ILLUSTRATE — easel", 80),
        ("NARRATE — microphone", 130),
        ("PRINT", 180),
        ("MAIL", 230),
        ("INTO THE SUNSHINE", 272),
        ("DOORWAY HOLD", 305),
    ):
        scene.timeline_markers.new(name, frame=frame)

    scene.frame_set(1)
    start = time.perf_counter()

    if frames is not None:
        for number, frame in enumerate(frames, 1):
            print(
                "[Nightlight Press] Rendering frame %d (%d/%d)"
                % (frame, number, len(frames)),
                flush=True
            )
            scene.frame_set(frame)
            scene.render.filepath = os.path.join(
                output, "frame_%04d" % frame
            )
            bpy.ops.render.render(write_still=True)
    else:
        print(
            "[Nightlight Press] Rendering 330 frames at 30 fps...",
            flush=True
        )
        scene.render.filepath = os.path.join(output, "frame_")
        scene.frame_start = int(os.environ.get('NL_START', '1'))
        scene.frame_end = int(os.environ.get('NL_END', '330'))
        scene.frame_step = int(os.environ.get('NL_STEP', '1'))
        bpy.ops.render.render(animation=True)

    elapsed = time.perf_counter() - start
    print(
        "[Nightlight Press] office_flythrough complete. "
        "Total render time: %.2f s. Output: %s" % (elapsed, output),
        flush=True
    )


if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc()
        sys.exit(1)
