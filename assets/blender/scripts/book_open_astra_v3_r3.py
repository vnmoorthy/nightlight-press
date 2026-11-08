import bpy
import bmesh
import math
import os
import random
from mathutils import Vector

# Headless:
# blender -b --factory-startup -P book_open.py --python-exit-code 1

random.seed(7)
OUTPUT_DIR = os.path.abspath(os.environ.get("OUTPUT_DIR", "./book_open_frames"))
RES_X = int(os.environ.get("RES_X", "1600"))
RES_Y = int(os.environ.get("RES_Y", "900"))
SAMPLES = int(os.environ.get("SAMPLES", "24"))
FRAME_LIST = os.environ.get("FRAME_LIST", "").strip()
os.makedirs(OUTPUT_DIR, exist_ok=True)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene

try:
    scene.render.engine = 'BLENDER_EEVEE'
except Exception:
    scene.render.engine = 'BLENDER_EEVEE_NEXT'

try:
    scene.eevee.taa_render_samples = SAMPLES
except Exception:
    print("WARNING: legacy EEVEE sample property unavailable.", flush=True)
    try:
        scene.eevee.taa_samples = SAMPLES
    except Exception:
        pass

scene.render.resolution_x = RES_X
scene.render.resolution_y = RES_Y
scene.render.resolution_percentage = 100
scene.render.fps = 30
scene.frame_start = 1
scene.frame_end = 200
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGB'
scene.render.image_settings.color_depth = '8'
scene.render.use_file_extension = True
scene.render.film_transparent = False
scene.render.use_compositing = True
try:
    scene.render.use_motion_blur = False
except Exception:
    pass

for transform in ('AgX', 'Filmic', 'Standard'):
    try:
        scene.view_settings.view_transform = transform
        break
    except Exception:
        pass

for look in ('AgX - Punchy', 'AgX - Medium High Contrast',
             'Medium High Contrast'):
    try:
        scene.view_settings.look = look
        break
    except Exception:
        pass

scene.view_settings.exposure = 0.05
scene.view_settings.gamma = 1.0

HEX = {
    'paper': 'FFF8EC', 'ink': '22223B', 'tomato': 'FF6B4A',
    'sun': 'FFC233', 'sky': '4DA8DA', 'leaf': '3BB273',
    'lilac': 'B8A1FF', 'wood1': 'C8925E', 'wood2': 'B07A4A',
    'wood3': 'DDAA72', 'wood4': 'BE8655', 'wood5': 'D6A26A',
    'cream': 'F5E6CC',
}


def linear_color(value):
    h = HEX.get(value, value).lstrip('#')
    rgb = [int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)]
    return tuple(v / 12.92 if v <= 0.04045
                 else ((v + 0.055) / 1.055) ** 2.4 for v in rgb)


def set_input(node, name, value):
    socket = node.inputs.get(name)
    if socket is not None:
        try:
            socket.default_value = value
        except Exception:
            pass


def material(name, color, emission=0.0, roughness=0.78, alpha=1.0):
    mat = bpy.data.materials.new(name)
    if mat.node_tree is None:
        mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    rgba = (*linear_color(color), 1.0)
    set_input(bsdf, 'Base Color', rgba)
    set_input(bsdf, 'Roughness', roughness)
    set_input(bsdf, 'Coat Weight', 0.025)
    set_input(bsdf, 'Sheen Weight', 0.08)
    set_input(bsdf, 'Emission Color', rgba)
    set_input(bsdf, 'Emission Strength', emission)
    set_input(bsdf, 'Alpha', alpha)
    mat.diffuse_color = (*rgba[:3], alpha)
    if alpha < 1.0:
        try:
            mat.surface_render_method = 'DITHERED'
        except Exception:
            try:
                mat.blend_method = 'BLEND'
            except Exception:
                pass
        try:
            mat.use_transparent_shadow = True
        except Exception:
            pass
    return mat


M = {
    name: material(name, name, roughness=0.86 if 'wood' in name else 0.78)
    for name in HEX
}
# Only the painted tomato surfaces use this deeper base. Sparkle colors retain
# the original palette.
M['tomato'] = material('Saturated tomato painted clay', 'F2552F', roughness=0.60)
set_input(M['tomato'].node_tree.nodes.get('Principled BSDF'), 'Coat Weight', 0.0)
set_input(M['paper'].node_tree.nodes.get('Principled BSDF'),
          'Emission Strength', 0.0)
M['meadow'] = material('Sunny meadow green', '79C98A')
M['emblem'] = material('Softly glowing sun emblem', 'sun', 0.65)
M['star_gold'] = material('Golden paper stars', 'sun', 2.3)
M['star_paper'] = material('Ivory paper stars', 'paper', 1.8)

spark_mats = [
    material('Spark warm white', 'FFF4D6', 13),
    material('Spark golden', 'FFD268', 11),
    material('Spark lilac', 'lilac', 8),
    material('Spark tomato', 'tomato', 7),
]


def finish(obj, name, mat=None, parent=None):
    obj.name = name
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj


def bevel(obj, width=0.025, segments=3):
    mod = obj.modifiers.new('Soft rounded edges', 'BEVEL')
    mod.width = width
    mod.segments = segments
    try:
        mod.harden_normals = True
    except Exception:
        pass
    return obj


def box(name, loc, dims, mat, radius=0.025, parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.dimensions = dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    finish(obj, name, mat, parent)
    if radius:
        bevel(obj, radius)
    return obj


def sphere(name, loc, scale, mat, parent=None, segments=20, rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=segments, ring_count=rings, radius=1, location=loc)
    obj = bpy.context.object
    obj.scale = scale
    finish(obj, name, mat, parent)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return obj


def disc(name, loc, radius, depth, mat, parent=None, vertices=48):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices, radius=radius, depth=depth, location=loc)
    obj = bpy.context.object
    finish(obj, name, mat, parent)
    bevel(obj, min(depth * 0.28, 0.012), 3)
    for polygon in obj.data.polygons:
        polygon.use_smooth = len(polygon.vertices) == 4
    return obj


def empty(name, loc=(0, 0, 0), parent=None):
    obj = bpy.data.objects.new(name, None)
    scene.collection.objects.link(obj)
    obj.location = loc
    obj.empty_display_type = 'PLAIN_AXES'
    obj.empty_display_size = 0.15
    if parent:
        obj.parent = parent
    return obj


def extruded_polygon(name, points, thickness, mat, loc=(0, 0, 0),
                     parent=None, rounding=0.003):
    area = sum(
        points[i][0] * points[(i + 1) % len(points)][1]
        - points[(i + 1) % len(points)][0] * points[i][1]
        for i in range(len(points)))
    if area < 0:
        points = list(reversed(points))
    n = len(points)
    vertices = [(x, y, -thickness / 2) for x, y in points]
    vertices += [(x, y, thickness / 2) for x, y in points]
    faces = [tuple(reversed(range(n))), tuple(range(n, 2 * n))]
    faces += [
        (i, (i + 1) % n, (i + 1) % n + n, i + n)
        for i in range(n)]
    mesh = bpy.data.meshes.new(name + ' mesh')
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    obj.location = loc
    finish(obj, name, mat, parent)
    if rounding:
        bevel(obj, rounding, 2)
    return obj


def key(obj, path, value, frame):
    setattr(obj, path, value)
    obj.keyframe_insert(data_path=path, frame=frame)


# ---------------------------------------------------------------------------
# Table, backdrop, and background props.
# ---------------------------------------------------------------------------
wood_sequence = [
    'wood3', 'wood1', 'wood5', 'wood2', 'wood3', 'wood4', 'wood5',
    'wood1', 'wood3', 'wood4', 'wood2', 'wood5', 'wood1',
]
for i in range(13):
    box('Honey and oak tabletop plank %02d' % i,
        (0, -5.0 + i * 0.82, -0.105),
        (18, 0.806, 0.21), M[wood_sequence[i]], 0.045)

box('Soft warm cream backdrop', (0, 3.30, 4.0),
    (25, 0.30, 10), M['cream'], 0.14)


def make_mug():
    cx, cy = -2.55, 1.62
    profile = [
        (0.0, 0.025), (0.26, 0.025), (0.33, 0.065),
        (0.35, 0.65), (0.335, 0.70), (0.29, 0.70),
        (0.275, 0.64), (0.255, 0.115), (0.0, 0.115),
    ]
    segments = 48
    vertices, faces = [], []
    for radius, z in profile:
        for j in range(segments):
            angle = math.tau * j / segments
            vertices.append((cx + radius * math.cos(angle),
                             cy + radius * math.sin(angle), z))
    for ring in range(len(profile) - 1):
        for j in range(segments):
            k = (j + 1) % segments
            faces.append((ring * segments + j, ring * segments + k,
                          (ring + 1) * segments + k,
                          (ring + 1) * segments + j))
    mesh = bpy.data.meshes.new('Lathed hollow mug mesh')
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new('Sky blue clay mug', mesh)
    scene.collection.objects.link(obj)
    obj.data.materials.append(M['sky'])
    bevel(obj, 0.012, 3)
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    bpy.ops.mesh.primitive_torus_add(
        major_segments=40, minor_segments=12,
        location=(cx - 0.35, cy, 0.38),
        rotation=(math.pi / 2, 0, 0),
        major_radius=0.20, minor_radius=0.070)
    handle = finish(bpy.context.object, 'Rounded mug handle', M['sky'])
    for polygon in handle.data.polygons:
        polygon.use_smooth = True


make_mug()
plant_x, plant_y = 1.94, 2.22
disc('Little plant pot', (plant_x, plant_y, 0.22),
     0.29, 0.44, M['wood2'])
disc('Pot rounded rim', (plant_x, plant_y, 0.44),
     0.31, 0.08, M['wood3'])
disc('Plant stem', (plant_x, plant_y, 0.67),
     0.045, 0.47, M['leaf'])
for i, (dx, dy, z) in enumerate([
    (-0.21, 0, 0.74), (0.20, 0.01, 0.85), (-0.11, 0.05, 1.02),
    (0.12, -0.04, 1.13), (0, 0, 1.28),
]):
    obj = sphere('Clay plant leaf %d' % i,
                 (plant_x + dx, plant_y + dy, z),
                 (0.21, 0.115, 0.25), M['leaf'])
    obj.rotation_euler.y = -0.55 if dx < 0 else 0.55

sphere('Lilac background ball', (0.48, 2.35, 0.26),
       (0.26, 0.26, 0.26), M['lilac'])

# ---------------------------------------------------------------------------
# Original book construction and cover animation.
# ---------------------------------------------------------------------------
box('Tomato back board', (1, 0, 0.040),
    (2.04, 1.54, 0.040), M['tomato'], 0.025)
box('Lower half paper block', (1, 0, 0.130),
    (1.91, 1.405, 0.140), M['paper'], 0.015)

front = empty('Front half hinge at middle of book', (0, 0, 0.264))
box('Upper half paper block', (1, 0, 0.392 - 0.264),
    (1.91, 1.405, 0.140), M['paper'], 0.015, front)
cover = box('Front hardcover', (1, 0, 0.488 - 0.264),
            (2.04, 1.54, 0.040), M['tomato'], 0.025, front)

disc('Raised sun emblem', (0, 0.14, 0.026),
     0.205, 0.010, M['emblem'], cover)
for i in range(10):
    angle = math.tau * i / 10
    ray = box(
        'Sun emblem ray %02d' % i,
        (0.292 * math.cos(angle), 0.14 + 0.292 * math.sin(angle), 0.026),
        (0.105, 0.032, 0.010), M['emblem'], 0.012, cover)
    ray.rotation_euler.z = angle

box('Paper title strip', (0, -0.355, 0.025),
    (1.24, 0.175, 0.008), M['paper'], 0.025, cover)
font = bpy.data.curves.new('Publisher lettering', 'FONT')
font.body = 'NIGHTLIGHT PRESS'
font.align_x = 'CENTER'
font.align_y = 'CENTER'
font.size = 0.092
font.space_character = 1.05
font.extrude = 0.0005
font.bevel_depth = 0.0002
text = bpy.data.objects.new('Nightlight Press title', font)
scene.collection.objects.link(text)
text.parent = cover
text.location = (0, -0.355, 0.030)
font.materials.append(M['ink'])

spine = box('Rounded flexible tomato spine', (0, 0, 0.264),
            (0.075, 1.54, 0.49), M['tomato'], 0.035)
for frame, height, center in [
    (1, 0.49, 0.264), (20, 0.49, 0.264),
    (70, 0.17, 0.112), (80, 0.15, 0.102),
]:
    key(spine, 'scale', (1, 1, height / 0.49), frame)
    key(spine, 'location', (0, 0, center), frame)

for frame, degrees in [
    (1, 0), (20, 0), (62, -160), (70, -180),
    (75, -178.9), (82, -180), (200, -180),
]:
    key(front, 'rotation_euler', (0, math.radians(degrees), 0), frame)

score_mat = material('Subtle warm page edge lines', 'EBDDC8', roughness=0.9)
for i in range(5):
    z = 0.085 + i * 0.022
    box('Lower page fore edge %d' % i, (1.956, 0, z),
        (0.0025, 1.32, 0.002), score_mat, 0.0008)
    box('Upper page fore edge %d' % i, (1.956, 0, z - 0.058),
        (0.0025, 1.32, 0.002), score_mat, 0.0008, front)

# ---------------------------------------------------------------------------
# Shared flat, bold paper-cut illustration vocabulary.
# ---------------------------------------------------------------------------
def star_points(radius, phase=math.pi / 2):
    return [
        ((radius if i % 2 == 0 else radius * 0.46)
         * math.cos(phase + i * math.pi / 5),
         (radius if i % 2 == 0 else radius * 0.46)
         * math.sin(phase + i * math.pi / 5))
        for i in range(10)
    ]


def cloud_outline():
    circles = [(-0.145, 0, 0.12), (0, 0.045, 0.16), (0.15, 0, 0.115)]
    outline = []
    for i in range(80):
        angle = math.tau * i / 80
        dx, dy = math.cos(angle), math.sin(angle)
        distance = 0
        for cx, cy, radius in circles:
            projection = cx * dx + cy * dy
            discriminant = (
                radius * radius - cx * cx - cy * cy + projection * projection)
            if discriminant >= 0:
                distance = max(distance,
                               projection + math.sqrt(discriminant))
        outline.append((dx * distance, dy * distance))
    return outline


class PaperCut:
    def __init__(self, name, parent, surface_z, back=False):
        self.name = name
        self.parent = parent
        self.surface_z = surface_z
        self.sign = -1 if back else 1
        self.objects = []

    def z(self, layer=0, thickness=0.008):
        return self.surface_z + self.sign * (
            0.001 + thickness * 0.5 + layer * 0.009)

    def polygon(self, label, points, color, x=0, y=0, layer=0,
                thickness=0.008):
        obj = extruded_polygon(
            self.name + ' ' + label, points, thickness, M[color],
            (x, y, self.z(layer, thickness)), self.parent, rounding=0.002)
        self.objects.append(obj)
        return obj

    def circle(self, label, x, y, radius, color, layer=0):
        obj = disc(self.name + ' ' + label,
                   (x, y, self.z(layer)), radius, 0.008, M[color],
                   self.parent, vertices=40)
        self.objects.append(obj)
        return obj

    def rectangle(self, label, x, y, width, height, color, layer=0):
        obj = box(self.name + ' ' + label,
                  (x, y, self.z(layer)), (width, height, 0.008),
                  M[color], 0.003, self.parent)
        self.objects.append(obj)
        return obj

    def cloud(self, label, x, y, color='sky', scale=1.0, layer=0):
        return self.polygon(
            label, [(a * scale, b * scale) for a, b in cloud_outline()],
            color, x, y, layer)

    def star(self, label, x, y, radius, color='sun', layer=0):
        return self.polygon(label, star_points(radius), color, x, y, layer)

    def band(self, label, color, height, amplitude, frequency,
             phase=0, layer=0):
        points = [(0.105, -0.61), (1.89, -0.61)]
        for j in range(49):
            x = 1.89 - 1.785 * j / 48
            points.append((x, height + amplitude * math.sin(frequency * x + phase)))
        return self.polygon(label, points, color, layer=layer)

    def sun(self, x, y, radius=0.21, rays=True):
        self.circle('big sunshine', x, y, radius, 'sun')
        if rays:
            for j in range(8):
                angle = math.tau * j / 8
                distance = radius + 0.065
                obj = self.rectangle(
                    'sun ray %02d' % j,
                    x + distance * math.cos(angle),
                    y + distance * math.sin(angle),
                    0.072, 0.027, 'sun')
                obj.rotation_euler.z = angle

    def house(self, x, y, size=1.0):
        self.rectangle('tomato cottage', x, y,
                       0.34 * size, 0.29 * size, 'tomato', 1)
        self.polygon('golden roof',
                     [(-0.23 * size, 0), (0.23 * size, 0),
                      (0, 0.22 * size)],
                     'sun', x, y + 0.135 * size, 2)
        self.rectangle('cream doorway', x - 0.065 * size,
                       y - 0.06 * size,
                       0.085 * size, 0.17 * size, 'paper', 2)
        self.circle('round blue window', x + 0.08 * size,
                    y + 0.015 * size, 0.042 * size, 'sky', 2)


def themed_illustration(name, parent, back, theme, variant=0):
    art = PaperCut(name, parent, -0.003 if back else 0.003, back)
    shift = 0.12 if variant else 0.0

    if theme == 'night':
        art.rectangle('deep ink night panel', 1.0, 0, 1.78, 1.20, 'ink')
        # Crescent silhouette constructed directly, not a floating overlay mask.
        r = 0.265
        points = []
        for j in range(41):
            angle = math.pi / 2 + math.pi * j / 40
            points.append((r * math.cos(angle), r * math.sin(angle)))
        for j in range(41):
            t = -math.pi / 2 + math.pi * j / 40
            points.append((-0.115 * math.cos(t), r * math.sin(t)))
        art.polygon('large lilac crescent', points, 'lilac',
                    0.61 + shift, 0.12, 1)
        for j, (x, y, radius) in enumerate([
            (1.22, 0.32, 0.13), (1.65, 0.04, 0.12),
            (1.17, -0.31, 0.10), (0.46, -0.35, 0.075),
        ]):
            art.star('night star %d' % j, x, y, radius, 'sun', 1)

    elif theme == 'sea':
        art.band('wide blue sea', 'sky', -0.14, 0.075, 7.0, variant * 0.7)
        art.band('lilac wave foreground', 'lilac', -0.43, 0.045, 10, 0.5, 1)
        x = 1.04 + shift
        art.polygon('tomato boat hull',
                    [(-0.40, 0.04), (0.40, 0.04),
                     (0.25, -0.16), (-0.25, -0.16)],
                    'tomato', x, -0.08, 1)
        art.rectangle('boat mast', x, 0.18, 0.022, 0.52, 'ink', 1)
        art.polygon('golden big sail',
                    [(-0.025, 0.0), (-0.025, 0.48), (-0.37, 0.0)],
                    'sun', x, -0.015, 1)
        art.polygon('small tomato sail',
                    [(0.025, 0.0), (0.025, 0.35), (0.29, 0.0)],
                    'tomato', x, -0.015, 1)
        art.circle('small sea sun', 0.38, 0.37, 0.13, 'sun')
        art.cloud('sea cloud', 1.60, 0.39, 'sky', 0.75)

    elif theme == 'meadow':
        art.band('rolling meadow', 'meadow', -0.23, 0.14, 3.6)
        art.band('foreground green meadow', 'leaf', -0.43, 0.07, 4.8, 0.6, 1)
        x = 0.91 + shift
        art.rectangle('tree trunk', x, -0.08, 0.095, 0.62, 'ink', 1)
        art.circle('big round leaf-green tree', x, 0.22, 0.32, 'leaf', 2)
        art.circle('sunlit tree lobe', x - 0.21, 0.18, 0.20, 'leaf', 2)
        art.circle('rounded tree lobe', x + 0.20, 0.20, 0.21, 'leaf', 2)
        art.circle('tree fruit one', x - 0.12, 0.26, 0.047, 'tomato', 3)
        art.circle('tree fruit two', x + 0.13, 0.13, 0.047, 'tomato', 3)
        art.circle('meadow sun', 1.65, 0.40, 0.115, 'sun')
        art.star('big meadow flower', 0.35, -0.33, 0.10, 'lilac', 2)

    elif theme == 'sunny':
        art.band('golden field', 'sun', -0.29, 0.10, 3.4)
        art.band('green field front', 'leaf', -0.46, 0.06, 4.0, 1, 1)
        art.sun(0.68 + shift, 0.21, 0.23, True)
        art.cloud('sunny sky cloud', 1.49, 0.25, 'sky', 1.15)
        art.star('lilac field flower', 1.42, -0.36, 0.12, 'lilac', 2)

    elif theme == 'balloon':
        art.band('big lilac hillside', 'lilac', -0.25, 0.15, 3.0, 0.5)
        art.band('green foothill', 'leaf', -0.49, 0.06, 5.0, 0, 1)
        x = 1.12 + shift
        art.rectangle('balloon string', x, -0.13, 0.016, 0.57, 'ink', 1)
        balloon = [
            (0.245 * math.cos(math.tau * j / 48),
             0.29 * math.sin(math.tau * j / 48))
            for j in range(48)]
        art.polygon('large tomato balloon', balloon, 'tomato', x, 0.26, 1)
        art.polygon('balloon knot',
                    [(-0.045, 0), (0.045, 0), (0, 0.07)],
                    'tomato', x, -0.09, 1)
        art.cloud('blue cloud at left', 0.41, 0.31, 'sky', 0.85)
        art.star('yellow hillside flower', 0.55, -0.38, 0.12, 'sun', 2)

    elif theme == 'sky':
        art.cloud('big blue cloud', 0.48, 0.28, 'sky', 1.25)
        art.cloud('lilac evening cloud', 1.48, -0.32, 'lilac', 1.05)
        x, y = 1.25, 0.24
        art.polygon('kite golden half',
                    [(0, 0.29), (-0.24, 0), (0, -0.32)],
                    'sun', x, y)
        art.polygon('kite tomato half',
                    [(0, 0.29), (0, -0.32), (0.24, 0)],
                    'tomato', x, y)
        art.polygon('kite curling ribbon',
                    [(1.245, -0.08), (1.26, -0.08),
                     (1.10, -0.30), (1.15, -0.47), (1.08, -0.56),
                     (1.065, -0.55), (1.13, -0.47), (1.08, -0.30)],
                    'ink')
        art.star('kite tail bow', 1.10, -0.32, 0.065, 'leaf', 1)
        art.circle('small sky sunshine', 1.77, 0.45, 0.085, 'sun')

    return art.objects


def panoramic_illustration(name, parent, surface_z, left=False):
    art = PaperCut(name, parent, surface_z, back=left)

    # A single world-X landscape function is sampled on both sides. Both hills
    # reach the gutter at the same elevation and have matching tangent slopes.
    def landscape(label, color, foreground=False):
        points = [(0.065, -0.625), (1.90, -0.625)]
        for j in range(65):
            x = 1.90 - 1.835 * j / 64
            world_x = -x if left else x
            if foreground:
                y = -0.43 + 0.075 * math.cos(2.4 * world_x + 0.3)
            else:
                y = -0.12 + 0.14 * math.cos(1.9 * world_x + 0.3)
            points.append((x, y))
        art.polygon(label, points, color, layer=1 if foreground else 0)

    landscape('continuous rolling green hills', 'leaf')
    landscape('continuous sunny meadow', 'meadow', True)
    if left:
        art.sun(1.30, 0.31, 0.19, True)
        art.star('lilac meadow flower one', 0.58, -0.39, 0.09, 'lilac', 2)
        art.star('lilac meadow flower two', 1.59, -0.40, 0.075, 'lilac', 2)
    else:
        art.house(1.11, -0.21, 1.10)
        art.cloud('large blue cloud over cottage', 1.17, 0.38, 'sky', 1.35)
        art.star('small lilac evening star', 1.76, 0.34, 0.10, 'lilac')
    return art.objects


# The right-hand final panorama is visible after the last turning leaf.
panoramic_illustration('Final panorama right', None, 0.202, left=False)

# ---------------------------------------------------------------------------
# Six turning leaves. All artwork is baked, tessellated, and JOINED to its leaf
# before the shared curl key is created. No separately animated cut-outs remain.
# ---------------------------------------------------------------------------
def apply_modifiers(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    for modifier in list(obj.modifiers):
        bpy.ops.object.modifier_apply(modifier=modifier.name)


def subdivide_artwork(obj):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.triangulate(bm, faces=list(bm.faces))
    for threshold, cuts in ((0.09, 4), (0.12, 2)):
        long_edges = [edge for edge in bm.edges
                      if edge.calc_length() > threshold]
        if long_edges:
            bmesh.ops.subdivide_edges(
                bm, edges=long_edges, cuts=cuts, use_grid_fill=True)
    bmesh.ops.triangulate(bm, faces=[face for face in bm.faces if len(face.verts) > 4])
    bm.normal_update()
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()


def join_artwork_to_leaf(page, artwork):
    apply_modifiers(page)
    for obj in artwork:
        apply_modifiers(obj)
        subdivide_artwork(obj)
        group = obj.vertex_groups.new(name='CutoutRelief')
        group.add(list(range(len(obj.data.vertices))), 1.0, 'REPLACE')

    bpy.ops.object.select_all(action='DESELECT')
    page.select_set(True)
    for obj in artwork:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = page
    bpy.ops.object.join()
    page.data.update()


def animate_joined_leaf(page, start, angle_degrees):
    page.shape_key_add(name='Basis')
    curled = page.shape_key_add(name='Paper and attached artwork curl')
    k = math.radians(angle_degrees) / 1.905

    # Bend each vertex using its own sheet-space depth, including all of the
    # raised artwork. This is the same cylindrical deformation for every part.
    for source, destination in zip(page.data.vertices, curled.data):
        p = source.co
        if p.x < 0.045:
            destination.co = p
            continue
        theta = k * (p.x - 0.045)
        destination.co = (
            0.045 + math.sin(theta) / k + p.z * math.sin(theta),
            p.y,
            -(1.0 - math.cos(theta)) / k + p.z * math.cos(theta),
        )

    for frame, amount in [
        (1, 0), (start, 0), (start + 8, 0.44),
        (start + 16, 1.0), (start + 23, 0.55),
        (start + 30, 0), (200, 0),
    ]:
        curled.value = amount
        curled.keyframe_insert(data_path='value', frame=frame)

    # The original closely packed hinges are retained. Flatten the relief only
    # while a leaf is pressed into that stack; it opens to its full 8 mm relief
    # as the leaf lifts. This prevents art on buried leaves piercing the next
    # sheet without moving the book, changing its timing, or hiding artwork.
    group = page.vertex_groups.get('CutoutRelief')
    if group is not None:
        relief_indices = [
            vertex.index for vertex in page.data.vertices
            if any(entry.group == group.index and entry.weight > 0.5
                   for entry in vertex.groups)
        ]
        max_depth = max(
            (abs(page.data.vertices[i].co.z) for i in relief_indices),
            default=0.04)
        compressed = page.shape_key_add(name='Relief pressed into closed stack')
        for index in relief_indices:
            p = page.data.vertices[index].co
            fraction = max(0.0, abs(p.z) - 0.003) / max(0.001, max_depth - 0.003)
            compressed.data[index].co.z = math.copysign(
                0.00315 + 0.0010 * fraction, p.z)
        for frame, amount in [
            (1, 1.0), (start, 1.0), (start + 6, 0.0), (200, 0.0),
        ]:
            compressed.value = amount
            compressed.keyframe_insert(data_path='value', frame=frame)


page_hinges = []
page_objects = []
themes = ['night', 'sea', 'meadow', 'sunny', 'balloon', 'sky']

for i in range(6):
    z = 0.251 + (5 - i) * 0.009
    hinge = empty('Individual page hinge %02d' % (i + 1), (0, 0, z))
    page_hinges.append(hinge)

    vertices, faces = [], []
    nx, ny = 64, 8
    for ix in range(nx + 1):
        x = 0.045 + 1.905 * ix / nx
        for iy in range(ny + 1):
            vertices.append((x, -0.698 + 1.396 * iy / ny, 0))
    for ix in range(nx):
        for iy in range(ny):
            a = ix * (ny + 1) + iy
            faces.append((a, a + ny + 1, a + ny + 2, a + 1))

    mesh = bpy.data.meshes.new('Subdivided paper leaf %02d' % i)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    page = bpy.data.objects.new('Illustrated turning leaf %02d' % (i + 1), mesh)
    scene.collection.objects.link(page)
    page.parent = hinge
    page.data.materials.append(M['paper'])
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    solid = page.modifiers.new('Six millimeter paper thickness', 'SOLIDIFY')
    solid.thickness = 0.006
    solid.offset = 0
    bevel(page, 0.002, 2)
    page_objects.append(page)

    artwork = themed_illustration(
        'Leaf %d front %s' % (i + 1, themes[i]),
        hinge, False, themes[i], variant=0)
    if i == 5:
        artwork += panoramic_illustration(
            'Final panorama left', hinge, -0.003, left=True)
    else:
        reverse_theme = themes[(i + 2) % len(themes)]
        artwork += themed_illustration(
            'Leaf %d reverse %s' % (i + 1, reverse_theme),
            hinge, True, reverse_theme, variant=1)

    bpy.context.view_layer.update()
    join_artwork_to_leaf(page, artwork)

    start = 62 + 11 * i
    animate_joined_leaf(page, start, 62.0 + (i % 3) * 3.0)
    end_angle = -(176 - 3 * i)
    for frame, degrees in [
        (1, 0), (start, 0), (start + 8, -28),
        (start + 16, -102), (start + 30, end_angle), (200, end_angle),
    ]:
        key(hinge, 'rotation_euler', (0, math.radians(degrees), 0), frame)

# ---------------------------------------------------------------------------
# Original golden gutter light and four feathered glow layers.
# ---------------------------------------------------------------------------
def light(name, light_type, loc, color, energy):
    data = bpy.data.lights.new(name, light_type)
    data.color = linear_color(color)
    data.energy = energy
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    obj.location = loc
    return obj


magic = light('Golden light emerging from gutter', 'POINT',
              (0, -0.02, 0.62), 'FFD17C', 0)
magic.data.shadow_soft_size = 0.48
for frame, power in [
    (1, 0), (59, 0), (73, 15), (85, 48), (105, 66), (120, 78),
    (133, 69), (146, 81), (159, 72), (172, 80), (186, 72), (200, 78),
]:
    key(magic.data, 'energy', power, frame)


def glow_material(name, maximum_alpha):
    mat = material(name, 'FFD16D', 0.0, roughness=1, alpha=maximum_alpha)
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    bsdf = nodes.get('Principled BSDF')
    tex = nodes.new('ShaderNodeTexCoord')
    subtract = nodes.new('ShaderNodeVectorMath')
    subtract.operation = 'SUBTRACT'
    subtract.inputs[1].default_value = (0.5, 0.5, 0)
    length = nodes.new('ShaderNodeVectorMath')
    length.operation = 'LENGTH'
    ramp = nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.interpolation = 'EASE'
    ramp.color_ramp.elements[0].position = 0.0
    ramp.color_ramp.elements[0].color = (maximum_alpha,) * 3 + (1,)
    ramp.color_ramp.elements[1].position = 0.49
    ramp.color_ramp.elements[1].color = (0, 0, 0, 1)
    mid = ramp.color_ramp.elements.new(0.22)
    mid.color = (maximum_alpha * 0.45,) * 3 + (1,)
    links.new(tex.outputs['UV'], subtract.inputs[0])
    links.new(subtract.outputs['Vector'], length.inputs[0])
    links.new(length.outputs['Value'], ramp.inputs['Fac'])
    links.new(ramp.outputs['Color'], bsdf.inputs['Alpha'])
    return mat


for i, (width, depth, z, alpha, strength) in enumerate([
    (0.52, 1.38, 0.326, 0.37, 5.5),
    (0.76, 1.46, 0.395, 0.20, 4.7),
    (0.98, 1.52, 0.490, 0.12, 4.0),
    (1.18, 1.60, 0.610, 0.065, 3.5),
]):
    mat = glow_material('Soft radial gutter glow layer %d' % i, alpha)
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, z))
    obj = finish(bpy.context.object, 'Feathered golden glow plane %d' % i, mat)
    base_scale = (width, depth, 1)
    for frame, scale in [
        (1, (0, 0, 0)), (59, (0, 0, 0)),
        (85, base_scale), (200, base_scale),
    ]:
        key(obj, 'scale', scale, frame)
    socket = mat.node_tree.nodes.get('Principled BSDF').inputs.get('Emission Strength')
    if socket:
        for frame, value in [
            (1, 0), (59, 0), (75, strength * 0.35),
            (85, strength * 0.75), (120, strength),
            (147, strength * 0.88), (173, strength * 1.05), (200, strength),
        ]:
            socket.default_value = value
            socket.keyframe_insert(data_path='default_value', frame=frame)

# ---------------------------------------------------------------------------
# Original seeded sparkles and paper-star choreography.
# No illustration construction above consumes random numbers.
# ---------------------------------------------------------------------------
bpy.ops.mesh.primitive_uv_sphere_add(segments=8, ring_count=4, radius=1)
template = bpy.context.object
spark_mesh = template.data
spark_mesh.name = 'Shared low-poly rounded sparkle mesh'
for polygon in spark_mesh.polygons:
    polygon.use_smooth = True
bpy.data.objects.remove(template, do_unlink=True)

spark_meshes = []
for index, mat in enumerate(spark_mats):
    mesh = spark_mesh.copy()
    mesh.name = 'Spark geometry material %d' % index
    mesh.materials.clear()
    mesh.materials.append(mat)
    spark_meshes.append(mesh)


def animate_rising(obj, birth, life, base_scale, is_star=False):
    x0 = random.triangular(-0.85, 0.85, 0)
    y0 = random.uniform(-0.38, 0.38)
    z0 = random.uniform(0.42, 0.60)
    rise = random.uniform(0.85, 1.95)
    drift_x = random.uniform(-0.43, 0.43)
    drift_y = random.uniform(-0.18, 0.20)
    amplitude = random.uniform(0.055, 0.17)
    phase = random.uniform(0, math.tau)
    spin0 = (
        random.uniform(0.55, 1.0), random.uniform(-0.35, 0.35),
        random.uniform(-math.pi, math.pi),
    )
    spin_delta = (
        random.uniform(-0.45, 0.45), random.uniform(-0.65, 0.65),
        random.uniform(-2.4, 2.4),
    )
    death = birth + life

    key(obj, 'scale', (0, 0, 0), 1)
    key(obj, 'scale', (0, 0, 0), birth - 1)
    key(obj, 'scale', (0, 0, 0), birth)
    key(obj, 'scale', base_scale, birth + 5)
    key(obj, 'scale', base_scale, death - 12)
    key(obj, 'scale', (0, 0, 0), death)
    if death < 200:
        key(obj, 'scale', (0, 0, 0), 200)

    for frame in list(range(birth, death, 8)) + [death]:
        t = (frame - birth) / life
        wobble = amplitude * (
            math.sin(phase + t * math.tau) - math.sin(phase))
        key(obj, 'location',
            (x0 + drift_x * t + wobble,
             y0 + drift_y * t + 0.055 * math.sin(t * math.tau),
             z0 + rise * t), frame)
        if is_star:
            key(obj, 'rotation_euler',
                tuple(spin0[k] + t * spin_delta[k] for k in range(3)), frame)


for i in range(90):
    index = random.choices([0, 1, 2, 3], weights=[47, 38, 10, 5])[0]
    obj = bpy.data.objects.new('Rising sparkle %03d' % i, spark_meshes[index])
    scene.collection.objects.link(obj)
    radius = random.uniform(0.017, 0.035)
    birth = max(70, min(
        198, round(70 + i * 128 / 89 + random.uniform(-2, 2))))
    animate_rising(obj, birth, random.randint(64, 90), (radius,) * 3)

for i in range(18):
    radius = random.uniform(0.070, 0.105)
    obj = extruded_polygon(
        'Floating five-point paper star %02d' % i,
        star_points(radius), 0.012,
        M['star_paper' if i % 3 == 0 else 'star_gold'], rounding=0.003)
    birth = max(72, min(
        195, round(73 + i * 120 / 17 + random.uniform(-2, 2))))
    animate_rising(obj, birth, random.randint(72, 90), (1, 1, 1), True)

# ---------------------------------------------------------------------------
# Sunny key retained; reduced ambient and fill restore soft contact shadows.
# ---------------------------------------------------------------------------
world = bpy.data.worlds.new('Warm cream ambient world')
scene.world = world
if world.node_tree is None:
    world.use_nodes = True
background = world.node_tree.nodes.get('Background')
background.inputs['Color'].default_value = (*linear_color('FFF0DB'), 1)
background.inputs['Strength'].default_value = 0.27

sun = light('Sunny upper-left window sunlight', 'SUN',
            (-4, 3, 7), 'FFF0D8', 3.5)
sun.rotation_euler = Vector(
    (0.65, -0.38, -1.0)).to_track_quat('-Z', 'Y').to_euler()
sun.data.angle = 0.18


def aim_at(obj, point):
    obj.rotation_euler = (
        Vector(point) - obj.location).to_track_quat('-Z', 'Y').to_euler()


keylight = light('Large soft warm front-right key', 'AREA',
                 (3.5, -4.0, 6.0), 'FFF3E1', 560)
keylight.data.shape = 'DISK'
keylight.data.size = 5.0
aim_at(keylight, (0, 0, 0.2))

fill = light('Broad warm-neutral left fill', 'AREA',
             (-4, -1.3, 3.8), 'F5F1E9', 255)
fill.data.shape = 'DISK'
fill.data.size = 4.5
aim_at(fill, (0, 0, 0.35))

# ---------------------------------------------------------------------------
# Camera, push-in, target animation, and DOF unchanged.
# ---------------------------------------------------------------------------
target = empty('Camera focus and framing target', (1, 0, 0.22))
key(target, 'location', (1, 0, 0.22), 1)
key(target, 'location', (0, -0.14, 0.16), 200)

camera_data = bpy.data.cameras.new('50mm storybook camera')
camera = bpy.data.objects.new('Camera', camera_data)
scene.collection.objects.link(camera)
scene.camera = camera
camera_data.lens = 50
camera_data.sensor_width = 36
camera_data.clip_start = 0.05
camera_data.clip_end = 150
camera_data.dof.use_dof = True
camera_data.dof.focus_object = target
camera_data.dof.aperture_fstop = 1.5
camera_data.dof.aperture_blades = 7

track = camera.constraints.new('TRACK_TO')
track.target = target
track.track_axis = 'TRACK_NEGATIVE_Z'
track.up_axis = 'UP_Y'
key(camera, 'location', (4.08, -8.35, 6.72), 1)
key(camera, 'location', (2.25, -6.10, 4.90), 200)


def smooth_action(id_block):
    try:
        action = id_block.animation_data.action
    except Exception:
        return
    if not action:
        return
    curves = []
    try:
        curves.extend(action.fcurves)
    except Exception:
        pass
    try:
        for layer in action.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    curves.extend(bag.fcurves)
    except Exception:
        pass
    for curve in curves:
        for point in curve.keyframe_points:
            point.interpolation = 'BEZIER'
            point.handle_left_type = 'AUTO_CLAMPED'
            point.handle_right_type = 'AUTO_CLAMPED'


for obj in scene.objects:
    smooth_action(obj)
    if obj.data:
        smooth_action(obj.data)
        if obj.type == 'MESH' and obj.data.shape_keys:
            smooth_action(obj.data.shape_keys)
for mat in bpy.data.materials:
    if mat.node_tree:
        smooth_action(mat.node_tree)

# ---------------------------------------------------------------------------
# High-threshold, additive-only bloom. The original render remains untouched;
# only the isolated glare contribution is added, with no screen-wide lift.
# ---------------------------------------------------------------------------
try:
    tree = bpy.data.node_groups.new('Comp', 'CompositorNodeTree')
    tree.interface.new_socket(
        name='Image', in_out='OUTPUT', socket_type='NodeSocketColor')
    scene.compositing_node_group = tree

    layers = tree.nodes.new('CompositorNodeRLayers')
    layers.location = (-500, 80)
    try:
        layers.scene = scene
    except Exception:
        pass
    glare = tree.nodes.new('CompositorNodeGlare')
    glare.location = (-260, -80)
    output = tree.nodes.new('NodeGroupOutput')
    output.location = (280, 80)
    try:
        output.is_active_output = True
    except Exception:
        pass

    def glare_setting(socket_names, attribute, value):
        for name in socket_names:
            socket = glare.inputs.get(name)
            if socket is not None:
                try:
                    socket.default_value = value
                    return True
                except Exception:
                    pass
        if hasattr(glare, attribute):
            try:
                setattr(glare, attribute, value)
                return True
            except Exception:
                pass
        return False

    if not glare_setting(['Type', 'Glare Type'], 'glare_type', 'BLOOM'):
        glare_setting(['Type', 'Glare Type'], 'glare_type', 'FOG_GLOW')
    glare_setting(['Quality'], 'quality', 'MEDIUM')
    glare_setting(['Threshold'], 'threshold', 2.1)
    glare_setting(['Strength'], 'strength', 1.0)

    size_socket = glare.inputs.get('Size')
    if size_socket is not None:
        try:
            size_socket.default_value = 0.28
        except Exception:
            pass
    else:
        try:
            glare.size = 7
        except Exception:
            pass

    tree.links.new(layers.outputs['Image'], glare.inputs['Image'])

    isolated_glare = glare.outputs.get('Glare')
    if isolated_glare is None:
        # Legacy Glare: Mix=1 produces the effect alone.
        if not glare_setting(['Mix'], 'mix', 1.0):
            raise RuntimeError("Cannot isolate glare contribution safely.")
        isolated_glare = glare.outputs.get('Image')

    add = tree.nodes.new('CompositorNodeMixRGB')
    add.label = 'Original render plus localized emitter glow'
    add.location = (35, 80)
    add.blend_type = 'ADD'
    add.inputs[0].default_value = 0.52
    add.use_clamp = False
    tree.links.new(layers.outputs['Image'], add.inputs[1])
    tree.links.new(isolated_glare, add.inputs[2])
    tree.links.new(add.outputs['Image'], output.inputs['Image'])
    scene.render.use_compositing = True
except Exception as exc:
    print("WARNING: compositor setup skipped:", exc, flush=True)
    scene.render.use_compositing = False
    try:
        scene.compositing_node_group = None
    except Exception:
        pass

assert len(scene.objects) < 300, "Unexpectedly high object count"
print("book_open: built %d objects; rendering to %s" %
      (len(scene.objects), OUTPUT_DIR), flush=True)


def rendered_frame(scene_arg, *args):
    print("book_open: rendered frame %04d" % scene_arg.frame_current, flush=True)


bpy.app.handlers.render_write.append(rendered_frame)
scene.frame_set(1)

if FRAME_LIST:
    frames = [int(item.strip()) for item in FRAME_LIST.split(',') if item.strip()]
    for frame in frames:
        if not 1 <= frame <= 200:
            raise ValueError("FRAME_LIST frames must be between 1 and 200")
        scene.frame_set(frame)
        scene.render.filepath = os.path.join(OUTPUT_DIR, "frame_%04d.png" % frame)
        bpy.ops.render.render(write_still=True)
else:
    scene.render.filepath = os.path.join(OUTPUT_DIR, "frame_")
    bpy.ops.render.render(animation=True)

print("DONE", flush=True)
